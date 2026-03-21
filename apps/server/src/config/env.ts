import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

export type StorageDriver = "memory" | "mongo";
export type RuntimeMode = "development" | "production" | "test";

export type ServerEnv = {
  runtimeMode: RuntimeMode;
  port: number;
  clientOrigin: string | string[];
  jwtSecret: string;
  jwtExpiresIn: string;
  passwordHashRounds: number;
  storageDriver: StorageDriver;
  mongodbUri?: string;
};

const PLACEHOLDER_SECRETS = new Set(["change-me", "replace-me", "your-jwt-secret", "secret"]);

function readRequiredString(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptionalString(source: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = source[name]?.trim();
  return value ? value : undefined;
}

function readPort(source: NodeJS.ProcessEnv): number {
  const raw = source.PORT?.trim();
  if (!raw) {
    return 4000;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function readRuntimeMode(source: NodeJS.ProcessEnv): RuntimeMode {
  const value = (source.NODE_ENV?.trim().toLowerCase() || "development") as RuntimeMode;
  if (value === "development" || value === "production" || value === "test") {
    return value;
  }

  throw new Error("NODE_ENV must be one of: development, production, test.");
}

function readClientOrigin(source: NodeJS.ProcessEnv): string | string[] {
  const value = source.CLIENT_ORIGIN?.trim() || "http://localhost:5173";
  const origins = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        const parsed = new URL(entry);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error();
        }
        return parsed.origin;
      } catch {
        throw new Error("CLIENT_ORIGIN must be a valid comma-separated list of http/https URLs.");
      }
    });

  if (origins.length === 0) {
    throw new Error("CLIENT_ORIGIN must include at least one valid http/https URL.");
  }

  return origins.length === 1 ? origins[0] : origins;
}

function readJwtSecret(source: NodeJS.ProcessEnv): string {
  const secret = readRequiredString(source, "JWT_SECRET");
  if (secret.length < 32 || PLACEHOLDER_SECRETS.has(secret.toLowerCase())) {
    throw new Error("JWT_SECRET must be at least 32 characters and must not use a placeholder value.");
  }
  return secret;
}

function readJwtExpiresIn(source: NodeJS.ProcessEnv): string {
  return readOptionalString(source, "JWT_EXPIRES_IN") ?? "7d";
}

function readPasswordHashRounds(source: NodeJS.ProcessEnv): number {
  const raw = source.BCRYPT_SALT_ROUNDS?.trim();
  if (!raw) {
    return 10;
  }

  const rounds = Number(raw);
  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 14) {
    throw new Error("BCRYPT_SALT_ROUNDS must be an integer between 10 and 14.");
  }

  return rounds;
}

function readStorageDriver(source: NodeJS.ProcessEnv, runtimeMode: RuntimeMode): StorageDriver {
  const raw = source.STORAGE_DRIVER?.trim().toLowerCase();
  const value = (raw || (runtimeMode === "test" ? "memory" : "mongo")) as StorageDriver;

  if (value === "memory" || value === "mongo") {
    return value;
  }

  throw new Error("STORAGE_DRIVER must be either 'memory' or 'mongo'.");
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const runtimeMode = readRuntimeMode(source);
  const storageDriver = readStorageDriver(source, runtimeMode);
  const mongodbUri = readOptionalString(source, "MONGODB_URI");

  if (storageDriver === "mongo" && !mongodbUri) {
    throw new Error("MONGODB_URI is required when STORAGE_DRIVER=mongo.");
  }

  if (storageDriver === "memory" && runtimeMode === "production") {
    throw new Error("STORAGE_DRIVER=memory is not allowed in production.");
  }

  return {
    runtimeMode,
    port: readPort(source),
    clientOrigin: readClientOrigin(source),
    jwtSecret: readJwtSecret(source),
    jwtExpiresIn: readJwtExpiresIn(source),
    passwordHashRounds: readPasswordHashRounds(source),
    storageDriver,
    mongodbUri,
  };
}
