import type { ServerEnv } from "../config/env";
import { MemoryUserRepository } from "./memoryRepository";
import { MongoUserRepository } from "./mongoRepository";
import type { UserRepository } from "./types";

export function createUserRepository(env: Pick<ServerEnv, "storageDriver" | "mongodbUri">): UserRepository {
  if (env.storageDriver === "mongo") {
    if (!env.mongodbUri) {
      throw new Error("MONGODB_URI is required when STORAGE_DRIVER=mongo.");
    }
    return new MongoUserRepository(env.mongodbUri);
  }

  return new MemoryUserRepository();
}

export type { StoredAccount, UserRepository } from "./types";
