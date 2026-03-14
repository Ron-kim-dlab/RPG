import { config } from "dotenv";

config();

export type ServerEnv = {
  port: number;
  clientOrigin: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  mongodbUri?: string;
};

export function readEnv(): ServerEnv {
  return {
    port: Number(process.env.PORT ?? 4000),
    clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    jwtSecret: process.env.JWT_SECRET ?? "change-me",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
    mongodbUri: process.env.MONGODB_URI || undefined,
  };
}
