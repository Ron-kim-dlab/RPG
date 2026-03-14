import mongoose from "mongoose";
import type { PlayerSave } from "@rpg/game-core";
import type { StoredAccount, UserRepository } from "./types";

type MemberDocument = {
  username: string;
  password: string;
};

type DataDocument = {
  username: string;
  data: PlayerSave | Record<string, unknown> | null;
};

const memberSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  },
  { collection: "members" },
);

const dataSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    data: { type: Object },
  },
  { collection: "data" },
);

const MemberModel = (mongoose.models.RpgMember as mongoose.Model<MemberDocument> | undefined)
  ?? mongoose.model<MemberDocument>("RpgMember", memberSchema);
const DataModel = (mongoose.models.RpgData as mongoose.Model<DataDocument> | undefined)
  ?? mongoose.model<DataDocument>("RpgData", dataSchema);

export class MongoUserRepository implements UserRepository {
  constructor(private readonly mongodbUri: string) {}

  async connect(): Promise<void> {
    if (mongoose.connection.readyState === 1) {
      return;
    }

    try {
      await mongoose.connect(this.mongodbUri);
    } catch (error) {
      throw new Error("Failed to connect to MongoDB. Check MONGODB_URI and database availability.", {
        cause: error,
      });
    }
  }

  async findByUsername(username: string): Promise<StoredAccount | null> {
    const [member, data] = await Promise.all([
      MemberModel.findOne({ username }).lean<MemberDocument | null>(),
      DataModel.findOne({ username }).lean<DataDocument | null>(),
    ]);

    if (!member) {
      return null;
    }

    return {
      username,
      passwordHash: member.password,
      player: (data?.data ?? null) as PlayerSave | null,
    };
  }

  async saveAccount(account: StoredAccount): Promise<void> {
    await Promise.all([
      MemberModel.updateOne(
        { username: account.username },
        { $set: { password: account.passwordHash } },
        { upsert: true },
      ),
      DataModel.updateOne(
        { username: account.username },
        { $set: { data: account.player } },
        { upsert: true },
      ),
    ]);
  }
}
