const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      enum: ["road", "lighting", "waste", "safety", "water", "other"],
      required: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },

    address: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["reported", "in_progress", "resolved"],
      default: "reported",
    },

    images: [
      {
        type: String,
      },
    ],

    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },

    aiScore: {
      type: Number,
      default: 0,
    },

    aiSuggestions: [
      {
        type: String,
      },
    ],

    votesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

issueSchema.index({ location: "2dsphere" });

const issueModel = mongoose.model("issue", issueSchema);

module.exports = issueModel;
