const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      firstName: {
        type: String,
        required: true,
      },

      lastName: {
        type: String,
        required: true,
      },
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      select : false,
      required : function(){
        return !this.googleId;
      }
    },

    googleId: {
      type: String,
      select : false,
    },

    refreshToken: {
      type: String,
      select : false,
    },

    role: {
      type: String,
      enum: ["user", "moderator", "department", "admin"],
      default: "user",
    },
  },
  { timestamps: true }
);

const userModel = mongoose.model("user", userSchema);

module.exports = userModel;
