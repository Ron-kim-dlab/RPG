import { createServer, type Server as HttpServer } from "node:http";
import express, { type Express } from "express";
import cors from "cors";
import { Server, type Server as SocketServer } from "socket.io";
import type { PlayerSave, WorldContent } from "@rpg/game-core";
import { migrateLegacyPlayerSave } from "@rpg/game-core";
import type { ServerEnv } from "./config/env";
import { loadWorld } from "./content/world";
import { authMiddleware, assertPlayerOwnership, type AuthenticatedRequest, loginHandler, registerHandler } from "./http/auth";
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

  app.get("/healthz", (_req, res) => {
    res.json({ success: true });
  });

  app.get("/content/bootstrap", async (_req, res) => {
    const world = await worldLoader();
    res.json({ success: true, world });
  });

  app.post("/auth/register", async (req, res) => {
    await registerHandler(req, res, repository, env, worldLoader);
  });

  app.post("/auth/login", async (req, res) => {
    await loginHandler(req, res, repository, env, worldLoader);
  });

  app.get("/player/me", authMiddleware(env), async (req: AuthenticatedRequest, res) => {
    const username = req.auth!.username;
    const account = await repository.findByUsername(username);
    if (!account) {
      res.status(404).json({ success: false, message: "플레이어를 찾을 수 없습니다." });
      return;
    }

    const world = await worldLoader();
    const player = migrateLegacyPlayerSave(account.player as Record<string, unknown> | null, username, world);
    res.json({ success: true, player });
  });

  app.post("/player/save", authMiddleware(env), async (req: AuthenticatedRequest, res) => {
    const account = await repository.findByUsername(req.auth!.username);
    if (!account) {
      res.status(404).json({ success: false, message: "플레이어를 찾을 수 없습니다." });
      return;
    }

    const player = req.body?.player as PlayerSave | undefined;
    if (!player || !assertPlayerOwnership(req, player)) {
      res.status(403).json({ success: false, message: "다른 플레이어의 세이브를 저장할 수 없습니다." });
      return;
    }

    await repository.saveAccount({
      ...account,
      player,
    });

    res.json({ success: true, player });
  });

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
