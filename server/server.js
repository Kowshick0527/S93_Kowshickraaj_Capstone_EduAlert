const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");
const Attendance = require("./models/Attendance");

const app = express();

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "EduAlert API is running",
  });
});

// Create user
app.post("/api/users", async (req, res) => {
  try {
    const user = await User.create(req.body);

    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// Read users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();

    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Create attendance
app.post("/api/attendance", async (req, res) => {
  try {
    const attendance = await Attendance.create(req.body);

    res.status(201).json(attendance);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// Read attendance
app.get("/api/attendance", async (req, res) => {
  try {
    const attendance = await Attendance.find();

    res.json(attendance);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`EduAlert server running on port ${PORT}`);
});