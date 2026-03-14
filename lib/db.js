import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!global.mongoose) {
  global.mongoose = { conn: null, promise: null };
}

export async function dbConnect() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }
  if (global.mongoose.conn) return global.mongoose.conn;
  if (!global.mongoose.promise) {
    global.mongoose.promise = mongoose.connect(MONGODB_URI);
  }
  global.mongoose.conn = await global.mongoose.promise;
  return global.mongoose.conn;
}

// 회원 스키마 (members 컬렉션)
const memberSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { collection: "members" });

// 게임 데이터 스키마 (data 컬렉션)
const dataSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  data: { type: Object }
}, { collection: "data" });

export const Member = mongoose.models.Member || mongoose.model("Member", memberSchema);
export const Data = mongoose.models.Data || mongoose.model("Data", dataSchema);
