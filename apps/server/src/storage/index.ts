import { MemoryUserRepository } from "./memoryRepository";
import { MongoUserRepository } from "./mongoRepository";
import type { UserRepository } from "./types";

export function createUserRepository(mongodbUri?: string): UserRepository {
  if (mongodbUri) {
    return new MongoUserRepository(mongodbUri);
  }
  return new MemoryUserRepository();
}

export type { StoredAccount, UserRepository } from "./types";
