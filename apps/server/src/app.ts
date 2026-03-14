import { createServer, type Server as HttpServer } from "node:http";
import express, { type Express } from "express";
import cors from "cors";
import { Server, type Server as SocketServer } from "socket.io";
import type { BootstrapPayload, HealthPayload, PlayerPayload, PlayerSave, WorldContent } from "@rpg/game-core";
import { migrateLegacyPlayerSave } from "@rpg/game-core";
import type { ServerEnv } from "./config/env";
import { loadWorld } from "./content/world";
import { authMiddleware, assertPlayerOwnership, type AuthenticatedRequest, loginHandler, registerHandler } from "./http/auth";
import { createRouteError, route, sendSuccess } from "./http/response";
import { readPlayerSave } from "./http/validation";
import { configureRealtime } from "./realtime/presence";
import type { UserRepository } from "./storage";

export async function createAppContext(options: {
  env: ServerEnv;
  repository: UserRepository;
  worldLoader?: () => Promise<WorldContent>;
}): Promise<{ app: Express; httpServer: HttpServer; io: SocketServer }> {
  const { env, repository } = options;
  const worldLoader = options.worldLoader ?? loadWorld;
  await repository.connect();

  const app = express();
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", route(async (_req, res) => {
    const payload: HealthPayload = { status: "ok" };
    sendSuccess(res, payload);
  }));

  app.get("/content/bootstrap", route(async (_req, res) => {
    const world = await worldLoader();
    const payload: BootstrapPayload = { world };
    sendSuccess(res, payload);
  }));

  app.post("/auth/register", route(async (req, res) => {
    await registerHandler(req, res, repository, env, worldLoader);
  }));

  app.post("/auth/login", route(async (req, res) => {
    await loginHandler(req, res, repository, env, worldLoader);
  }));

  app.get("/player/me", authMiddleware(env), route(async (req: AuthenticatedRequest, res) => {
    const username = req.auth!.username;
    const account = await repository.findByUsername(username);
    if (!account) {
      throw createRouteError(404, "not_found", "플레이어를 찾을 수 없습니다.");
    }

    const world = await worldLoader();
    const player = migrateLegacyPlayerSave(account.player as Record<string, unknown> | null, username, world);
    const payload: PlayerPayload = { player };
    sendSuccess(res, payload);
  }));

  app.post("/player/save", authMiddleware(env), route(async (req: AuthenticatedRequest, res) => {
    const account = await repository.findByUsername(req.auth!.username);
    if (!account) {
      throw createRouteError(404, "not_found", "플레이어를 찾을 수 없습니다.");
    }

    const player = readPlayerSave(req.body) as PlayerSave;
    if (!assertPlayerOwnership(req, player)) {
      throw createRouteError(403, "forbidden", "다른 플레이어의 세이브를 저장할 수 없습니다.");
    }

    await repository.saveAccount({
      ...account,
      player,
    });

    const payload: PlayerPayload = { player };
    sendSuccess(res, payload);
  }));

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin,
      credentials: true,
    },
  });

  configureRealtime(io, env);

  return { app, httpServer, io };
}
