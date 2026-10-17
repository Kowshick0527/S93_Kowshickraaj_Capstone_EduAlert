const mongoose = require("mongoose");

const studentFileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, maxlength: 180 },
    storageName: { type: String, required: true, unique: true },
    contentType: { type: String, required: true, enum: ["application/pdf", "image/png", "image/jpeg"] },
    size: { type: Number, required: true, max: 5 * 1024 * 1024 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentFile", studentFileSchema);
