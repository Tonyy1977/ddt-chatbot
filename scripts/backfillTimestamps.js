// scripts/backfillTimestamps.js
import mongoose from "mongoose";
import Message from "../models/message.js";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/chatbot";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all messages missing createdAt
    const messages = await Message.find({ createdAt: { $exists: false } });

    console.log(`Found ${messages.length} messages missing createdAt...`);

    for (const msg of messages) {
      const fallbackDate = msg.timestamp || msg._id.getTimestamp();

      msg.createdAt = new Date(fallbackDate);
      msg.updatedAt = new Date(fallbackDate);
      await msg.save();
    }

    console.log("🎉 Backfill complete");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during backfill:", err);
    process.exit(1);
  }
})();
