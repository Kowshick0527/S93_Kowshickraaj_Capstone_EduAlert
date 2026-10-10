const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();

const User = require("./models/User");
const Attendance = require("./models/Attendance");
const requireAuth = require("./middleware/requireAuth");

const app = express();
app.use(express.json({ limit: "10kb" }));

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
  if (req.authUser.role !== "faculty" && req.body?.studentId !== req.authUser.id) {
    return res.status(403).json({ message: "You can only add your own attendance" });
  }

  try {
    const attendance = await Attendance.create(req.body);
    res.status(201).json(attendance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/attendance", requireAuth, async (req, res) => {
  try {
    const filter = req.authUser.role === "faculty" ? {} : { studentId: req.authUser.id };
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

    for (const field of ["subject", "totalClasses", "attendedClasses", "percentage"]) {
      if (req.body?.[field] !== undefined) attendance[field] = req.body[field];
    }
    await attendance.save();
    res.json(attendance);
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
