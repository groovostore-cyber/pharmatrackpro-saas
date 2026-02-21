const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Modern Mongoose (v5.11+) handles these options internally
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
