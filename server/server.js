const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();

const User = require("./models/User");
const Attendance = require("./models/Attendance");
const Performance = require("./models/Performance");
const StudentFile = require("./models/StudentFile");
const requireAuth = require("./middleware/requireAuth");

const app = express();
app.use(express.json({ limit: "7mb" }));

const uploadDirectory = path.join(__dirname, "uploads");
const maxUploadBytes = 5 * 1024 * 1024;
const allowedFileTypes = new Map([
  ["application/pdf", { extension: ".pdf", matches: (bytes) => bytes.subarray(0, 5).toString() === "%PDF-" }],
  ["image/png", { extension: ".png", matches: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ["image/jpeg", { extension: ".jpg", matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
]);

function safeFile(file) {
  return { id: file.id, name: file.name, contentType: file.contentType, size: file.size, createdAt: file.createdAt };
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}

function createToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

function sendAuthResponse(res, user, status = 200) {
  return res.status(status).json({ token: createToken(user), user: safeUser(user) });
}

async function registerAccount(req, res) {
  const { name, username, email, password } = req.body || {};
  if ([name, username, email, password].some((value) => typeof value !== "string")) {
    return res.status(400).json({ message: "Complete all required fields" });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  if (
    !name.trim() ||
    name.trim().length > 80 ||
    !/^[a-z0-9_.-]{3,32}$/.test(normalizedUsername) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      message: "Use a valid name, email, username, and a password of 8 to 72 bytes",
    });
  }

  try {
    const existingUser = await User.exists({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
    });
    if (existingUser) {
      return res.status(409).json({ message: "Username or email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role: "student",
    });

    return sendAuthResponse(res, user, 201);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Username or email is already registered" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Please check the account details" });
    }
    console.error("Registration failed:", error);
    return res.status(500).json({ message: "Unable to create account right now" });
  }
}

app.get("/", (req, res) => {
  res.json({ message: "EduAlert API is running" });
});

app.post("/api/auth/register", registerAccount);
app.post("/api/users", registerAccount);

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Enter your username and password" });
  }

  try {
    const user = await User.findOne({ username: username.trim().toLowerCase() })
      .select("+passwordHash");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Incorrect username or password" });
    }

    return sendAuthResponse(res, user);
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ message: "Unable to sign in right now" });
  }
});

app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body || {};
  if (typeof credential !== "string" || credential.length > 8192) {
    return res.status(400).json({ message: "A valid Google credential is required" });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ message: "Google sign-in is not configured" });
  }

  let profile;
  try {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    profile = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: "Google sign-in could not be verified" });
  }

  if (!profile?.sub || !profile.email || profile.email_verified !== true) {
    return res.status(401).json({ message: "A verified Google email is required" });
  }

  try {
    let user = await User.findOne({ googleId: profile.sub }).select("+googleId");
    if (user) {
      return sendAuthResponse(res, user);
    }

    user = await User.findOne({ email: profile.email.toLowerCase() }).select("+googleId");
    if (user) {
      if (user.googleId && user.googleId !== profile.sub) {
        return res.status(409).json({ message: "This email is linked to another Google account" });
      }
      user.googleId = profile.sub;
      await user.save();
      return sendAuthResponse(res, user);
    }

    const username = `g-${crypto.randomBytes(12).toString("hex")}`;
    user = await User.create({
      name: profile.name?.trim().slice(0, 80) || profile.email,
      username,
      email: profile.email.toLowerCase(),
      googleId: profile.sub,
      role: "student",
    });

    return sendAuthResponse(res, user, 201);
  } catch (error) {
    if (error.code === 11000) {
      const existingUser = await User.findOne({ googleId: profile.sub });
      if (existingUser) return sendAuthResponse(res, existingUser);
      return res.status(409).json({ message: "This Google account is already linked" });
    }
    console.error("Google sign-in failed:", error);
    return res.status(500).json({ message: "Unable to sign in with Google right now" });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: safeUser(req.authUser) });
});

app.post("/api/ai/autocomplete", requireAuth, async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== "string" || !text.trim() || text.length > 2000) {
    return res.status(400).json({ message: "Enter up to 2,000 characters for an AI continuation" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ message: "AI autocomplete is not configured" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Continue the student's brief academic reflection in a supportive, clear tone. Return only a short continuation, without repeating the text or adding claims about grades, attendance, or personal circumstances.",
          },
          { role: "user", content: text.trim() },
        ],
        max_tokens: 120,
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error("AI autocomplete provider returned status:", response.status);
      return res.status(502).json({ message: "AI autocomplete is temporarily unavailable" });
    }

    const result = await response.json();
    const completion = result.choices?.[0]?.message?.content;
    if (typeof completion !== "string" || !completion.trim()) {
      console.error("AI autocomplete provider returned an empty completion");
      return res.status(502).json({ message: "AI autocomplete did not return a suggestion" });
    }

    return res.json({ completion: completion.trim() });
  } catch (error) {
    console.error("AI autocomplete request failed:", error.message);
    return res.status(502).json({ message: "AI autocomplete is temporarily unavailable" });
  }
});

app.get("/api/files", requireAuth, async (req, res) => {
  try {
    const files = await StudentFile.find({ userId: req.authUser.id }).sort({ createdAt: -1 });
    res.json({ files: files.map(safeFile) });
  } catch (error) {
    console.error("Unable to list files:", error);
    res.status(500).json({ message: "Unable to load your files right now" });
  }
});

app.post("/api/files", requireAuth, async (req, res) => {
  const { name, contentType, data } = req.body || {};
  const type = allowedFileTypes.get(contentType);
  if (typeof name !== "string" || !name.trim() || name.length > 180 || !type || typeof data !== "string") {
    return res.status(400).json({ message: "Choose a PDF, PNG, or JPEG file" });
  }

  const encoded = data.replace(/^data:[^,]*;base64,/, "");
  if (!encoded || encoded.length > Math.ceil(maxUploadBytes / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    return res.status(400).json({ message: "Files must be 5 MB or smaller" });
  }
  const contents = Buffer.from(encoded, "base64");
  if (!contents.length || contents.length > maxUploadBytes) {
    return res.status(400).json({ message: "Files must be 5 MB or smaller" });
  }
  if (!type.matches(contents)) {
    return res.status(400).json({ message: "The file contents do not match the selected file type" });
  }

  const storageName = `${crypto.randomUUID()}${type.extension}`;
  try {
    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(path.join(uploadDirectory, storageName), contents, { flag: "wx" });
    const file = await StudentFile.create({
      userId: req.authUser.id,
      name: path.basename(name.trim()),
      storageName,
      contentType,
      size: contents.length,
    });
    res.status(201).json({ file: safeFile(file) });
  } catch (error) {
    await fs.unlink(path.join(uploadDirectory, storageName)).catch(() => {});
    console.error("Unable to save file:", error);
    res.status(500).json({ message: "Unable to save your file right now" });
  }
});

app.get("/api/files/:id/download", requireAuth, async (req, res) => {
  try {
    const file = await StudentFile.findOne({ _id: req.params.id, userId: req.authUser.id });
    if (!file) return res.status(404).json({ message: "File not found" });
    res.download(path.join(uploadDirectory, file.storageName), file.name, (error) => {
      if (error && !res.headersSent) res.status(404).json({ message: "File is no longer available" });
    });
  } catch (error) {
    console.error("Unable to download file:", error);
    res.status(500).json({ message: "Unable to download your file right now" });
  }
});

app.get("/api/users", requireAuth, async (req, res) => {
  if (req.authUser.role !== "faculty") {
    return res.status(403).json({ message: "Faculty access required" });
  }

  try {
    const users = await User.find();
    res.json(users.map(safeUser));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/users/:id", requireAuth, async (req, res) => {
  if (req.authUser.role !== "faculty" && req.authUser.id !== req.params.id) {
    return res.status(403).json({ message: "You can only update your own account" });
  }

  const updates = {};
  for (const field of ["name", "username", "email"]) {
    if (typeof req.body?.[field] === "string") updates[field] = req.body[field];
  }

  try {
    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(safeUser(user));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/attendance", requireAuth, async (req, res) => {
  const { subject, totalClasses, attendedClasses } = req.body || {};
  const studentId = req.authUser.role === "faculty" ? req.body?.studentId : req.authUser.id;
  if (req.authUser.role !== "faculty" && req.body?.studentId && req.body.studentId !== req.authUser.id) {
    return res.status(403).json({ message: "You can only add your own attendance" });
  }
  if (
    typeof subject !== "string" ||
    !subject.trim() ||
    subject.trim().length > 100 ||
    !Number.isInteger(totalClasses) ||
    totalClasses < 1 ||
    !Number.isInteger(attendedClasses) ||
    attendedClasses < 0 ||
    attendedClasses > totalClasses ||
    (req.authUser.role === "faculty" && !mongoose.isValidObjectId(studentId))
  ) {
    return res.status(400).json({ message: "Enter a subject and valid attended/total class counts" });
  }

  try {
    if (req.authUser.role === "faculty" && !(await User.exists({ _id: studentId, role: "student" }))) {
      return res.status(404).json({ message: "Student not found" });
    }

    const attendance = await Attendance.create({
      studentId,
      subject: subject.trim(),
      totalClasses,
      attendedClasses,
      percentage: Math.round((attendedClasses / totalClasses) * 10000) / 100,
    });
    res.status(201).json(attendance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/attendance", requireAuth, async (req, res) => {
  try {
    const filter = req.authUser.role === "faculty"
      ? req.query.studentId
        ? { studentId: req.query.studentId }
        : {}
      : { studentId: req.authUser.id };
    const attendance = await Attendance.find(filter);
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/attendance/:id", requireAuth, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) return res.status(404).json({ message: "Attendance record not found" });
    if (
      req.authUser.role !== "faculty" &&
      attendance.studentId.toString() !== req.authUser.id
    ) {
      return res.status(403).json({ message: "You can only update your own attendance" });
    }

    const subject = req.body?.subject ?? attendance.subject;
    const totalClasses = req.body?.totalClasses ?? attendance.totalClasses;
    const attendedClasses = req.body?.attendedClasses ?? attendance.attendedClasses;
    if (
      typeof subject !== "string" ||
      !subject.trim() ||
      subject.trim().length > 100 ||
      !Number.isInteger(totalClasses) ||
      totalClasses < 1 ||
      !Number.isInteger(attendedClasses) ||
      attendedClasses < 0 ||
      attendedClasses > totalClasses
    ) {
      return res.status(400).json({ message: "Enter a subject and valid attended/total class counts" });
    }

    attendance.subject = subject.trim();
    attendance.totalClasses = totalClasses;
    attendance.attendedClasses = attendedClasses;
    attendance.percentage = Math.round((attendedClasses / totalClasses) * 10000) / 100;
    await attendance.save();
    res.json(attendance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/api/performance", requireAuth, async (req, res) => {
  const { subject, assessment, category = "grade", marks, maxMarks } = req.body || {};
  const studentId = req.authUser.role === "faculty" ? req.body?.studentId : req.authUser.id;
  if (req.authUser.role !== "faculty" && req.body?.studentId && req.body.studentId !== req.authUser.id) {
    return res.status(403).json({ message: "You can only add your own scores" });
  }
  if (
    typeof subject !== "string" ||
    !subject.trim() ||
    subject.trim().length > 100 ||
    typeof assessment !== "string" ||
    !assessment.trim() ||
    assessment.trim().length > 120 ||
    !["grade", "project"].includes(category) ||
    typeof marks !== "number" ||
    !Number.isFinite(marks) ||
    typeof maxMarks !== "number" ||
    !Number.isFinite(maxMarks) ||
    maxMarks <= 0 ||
    marks < 0 ||
    marks > maxMarks ||
    (req.authUser.role === "faculty" && !mongoose.isValidObjectId(studentId))
  ) {
    return res.status(400).json({ message: "Enter a subject, assessment, valid score, and score category" });
  }

  try {
    if (req.authUser.role === "faculty" && !(await User.exists({ _id: studentId, role: "student" }))) {
      return res.status(404).json({ message: "Student not found" });
    }
    const performance = await Performance.create({
      studentId,
      subject: subject.trim(),
      assessment: assessment.trim(),
      category,
      marks,
      maxMarks,
    });
    res.status(201).json(performance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/performance", requireAuth, async (req, res) => {
  try {
    const filter = req.authUser.role === "faculty" && req.query.studentId
      ? { studentId: req.query.studentId }
      : req.authUser.role === "faculty"
        ? {}
        : { studentId: req.authUser.id };
    const performance = await Performance.find(filter).sort({ createdAt: -1 });
    res.json(performance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/performance/:id", requireAuth, async (req, res) => {
  try {
    const performance = await Performance.findById(req.params.id);
    if (!performance) return res.status(404).json({ message: "Score record not found" });
    if (
      req.authUser.role !== "faculty" &&
      performance.studentId.toString() !== req.authUser.id
    ) {
      return res.status(403).json({ message: "You can only update your own scores" });
    }

    const subject = req.body?.subject ?? performance.subject;
    const assessment = req.body?.assessment ?? performance.assessment;
    const category = req.body?.category ?? performance.category ?? "grade";
    const marks = req.body?.marks ?? performance.marks;
    const maxMarks = req.body?.maxMarks ?? performance.maxMarks;
    if (
      typeof subject !== "string" ||
      !subject.trim() ||
      subject.trim().length > 100 ||
      typeof assessment !== "string" ||
      !assessment.trim() ||
      assessment.trim().length > 120 ||
      !["grade", "project"].includes(category) ||
      typeof marks !== "number" ||
      !Number.isFinite(marks) ||
      typeof maxMarks !== "number" ||
      !Number.isFinite(maxMarks) ||
      maxMarks <= 0 ||
      marks < 0 ||
      marks > maxMarks
    ) {
      return res.status(400).json({ message: "Enter a subject, assessment, valid score, and score category" });
    }

    performance.subject = subject.trim();
    performance.assessment = assessment.trim();
    performance.category = category;
    performance.marks = marks;
    performance.maxMarks = maxMarks;
    await performance.save();
    res.json(performance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

async function startServer() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("Set MONGO_URI and a JWT_SECRET of at least 32 characters");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`EduAlert API listening on port ${port}`));
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Unable to start EduAlert API:", error.message);
    process.exit(1);
  });
}

module.exports = { app, startServer };
