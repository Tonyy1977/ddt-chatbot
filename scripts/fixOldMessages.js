// scripts/fixOldMessages.js
import mongoose from "mongoose";
import Message from "../models/Message.js";

const MONGO_URI = process.env.MONGODB_URI;

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find ANY docs with a legacy timestamp field
    const oldMessages = await Message.find({ timestamp: { $exists: true } }).lean();

    console.log(`📦 Found ${oldMessages.length} messages with legacy timestamp field…`);

    for (const doc of oldMessages) {
      let fallbackDate = null;

      // 1. Use legacy timestamp if valid
      if (doc.timestamp) {
        const parsed = new Date(doc.timestamp);
        if (!isNaN(parsed)) fallbackDate = parsed;
      }

      // 2. Fallback to ObjectId timestamp
      if (!fallbackDate && doc._id) {
        fallbackDate = doc._id.getTimestamp();
      }

      if (fallbackDate) {
        await Message.updateOne(
          { _id: doc._id },
          {
            $set: {
              createdAt: fallbackDate,
              updatedAt: fallbackDate,
            },
            $unset: { timestamp: "" }, // 🔑 remove legacy field
          }
        );
        console.log(`🛠 Fixed message ${doc._id} → ${fallbackDate.toISOString()}`);
      } else {
        console.warn(`⚠️ Could not fix message ${doc._id} — no fallback date`);
      }
    }

    console.log("🎉 Legacy timestamp backfill complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during backfill:", err);
    process.exit(1);
  }
})();
