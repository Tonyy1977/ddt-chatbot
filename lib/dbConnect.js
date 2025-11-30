// lib/dbConnect.js
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('❌ MongoDB URI is not defined in environment variables');
}

let cached = global.mongoose || { conn: null, promise: null };

async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      dbName: 'micah',
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

global.mongoose = cached;
export default dbConnect;
