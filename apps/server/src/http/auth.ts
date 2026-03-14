import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { PlayerSave, WorldContent } from "@rpg/game-core";
import { createStarterPlayer, migrateLegacyPlayerSave } from "@rpg/game-core";
import type { ServerEnv } from "../config/env";
import type { UserRepository } from "../storage";

type AuthPayload = {
  username: string;
};

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

function needsPasswordRehash(passwordHash: string, targetRounds: number): boolean {
  if (!isBcryptHash(passwordHash)) {
    return true;
  }

  try {
    return bcrypt.getRounds(passwordHash) < targetRounds;
  } catch {
    return true;
  }
}

export function signToken(env: ServerEnv, username: string): string {
  return jwt.sign({ username } satisfies AuthPayload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

export function verifyToken(env: ServerEnv, token: string): AuthPayload {
  return jwt.verify(token, env.jwtSecret) as AuthPayload;
}

export async function registerHandler(
  req: Request,
  res: Response,
  repository: UserRepository,
  env: ServerEnv,
  worldLoader: () => Promise<WorldContent>,
): Promise<void> {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (username.length < 2) {
    res.status(400).json({ success: false, message: "사용자 이름은 2자 이상이어야 합니다." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ success: false, message: "비밀번호는 최소 8자 이상이어야 합니다." });
    return;
  }

  const existing = await repository.findByUsername(username);
  if (existing) {
    res.status(409).json({ success: false, message: "이미 존재하는 사용자입니다." });
    return;
  }

  const world = await worldLoader();
  const passwordHash = await bcrypt.hash(password, env.passwordHashRounds);
  const player = createStarterPlayer(username, world);
  await repository.saveAccount({
    username,
    passwordHash,
    player,
  });

  res.status(201).json({
    success: true,
    token: signToken(env, username),
    player,
  });
}

export async function loginHandler(
  req: Request,
  res: Response,
  repository: UserRepository,
  env: ServerEnv,
  worldLoader: () => Promise<WorldContent>,
): Promise<void> {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  const account = await repository.findByUsername(username);
  if (!account) {
    res.status(401).json({ success: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  let authenticated = false;
  if (isBcryptHash(account.passwordHash)) {
    authenticated = await bcrypt.compare(password, account.passwordHash);
  } else {
    authenticated = account.passwordHash === password;
  }

  if (!authenticated) {
    res.status(401).json({ success: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  const world = await worldLoader();
  const migratedPlayer = migrateLegacyPlayerSave(account.player as Record<string, unknown> | null, username, world);
  const upgradedPassword = needsPasswordRehash(account.passwordHash, env.passwordHashRounds)
    ? await bcrypt.hash(password, env.passwordHashRounds)
    : account.passwordHash;
  await repository.saveAccount({
    username,
    passwordHash: upgradedPassword,
    player: migratedPlayer,
  });

  res.json({
    success: true,
    token: signToken(env, username),
    player: migratedPlayer,
  });
}

export type AuthenticatedRequest = Request & {
  auth?: AuthPayload;
};

export function authMiddleware(env: ServerEnv) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    if (!token) {
      res.status(401).json({ success: false, message: "인증 토큰이 필요합니다." });
      return;
    }

    try {
      req.auth = verifyToken(env, token);
      next();
    } catch {
      res.status(401).json({ success: false, message: "유효하지 않은 토큰입니다." });
    }
  };
}

export function assertPlayerOwnership(req: AuthenticatedRequest, player: PlayerSave): boolean {
  return req.auth?.username === player.username;
}
