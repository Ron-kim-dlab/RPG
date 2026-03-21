import { describe, expect, it } from "vitest";
import { readEnv } from "../src/config/env";

function createProcessEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "development",
    CLIENT_ORIGIN: "http://localhost:5173",
    JWT_SECRET: "0123456789abcdef0123456789abcdef",
    JWT_EXPIRES_IN: "7d",
    BCRYPT_SALT_ROUNDS: "10",
    STORAGE_DRIVER: "memory",
    ...overrides,
  };
}

describe("server env", () => {
  it("requires a strong JWT secret", () => {
    expect(() => readEnv(createProcessEnv({ JWT_SECRET: "change-me" }))).toThrow(/JWT_SECRET/);
    expect(() => readEnv(createProcessEnv({ JWT_SECRET: "too-short-secret" }))).toThrow(/JWT_SECRET/);
  });

  it("requires MONGODB_URI when mongo storage is enabled", () => {
    expect(() => readEnv(createProcessEnv({ STORAGE_DRIVER: "mongo", MONGODB_URI: "" }))).toThrow(/MONGODB_URI/);
  });

  it("supports multiple client origins in a comma-separated list", () => {
    const env = readEnv(
      createProcessEnv({
        CLIENT_ORIGIN: "http://localhost:5173, http://127.0.0.1:5173",
      }),
    );

    expect(env.clientOrigin).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
  });

  it("rejects memory storage in production", () => {
    expect(() => readEnv(createProcessEnv({ NODE_ENV: "production", STORAGE_DRIVER: "memory" }))).toThrow(/production/);
  });

  it("defaults to mongo storage outside tests when MONGODB_URI is provided", () => {
    const env = readEnv(
      createProcessEnv({
        STORAGE_DRIVER: undefined,
        MONGODB_URI: "mongodb://localhost:27017/rpg-rebuild",
      }),
    );

    expect(env.storageDriver).toBe("mongo");
    expect(env.mongodbUri).toBe("mongodb://localhost:27017/rpg-rebuild");
  });
});
