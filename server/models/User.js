const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    role: {
      type: String,
      enum: ["student", "faculty"],
      required: true,
    },

    studentId: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual("attendanceRecords", {
  ref: "Attendance",
  localField: "_id",
  foreignField: "studentId",
});

userSchema.virtual("performanceRecords", {
  ref: "Performance",
  localField: "_id",
  foreignField: "studentId",
});

module.exports = mongoose.model("User", userSchema);