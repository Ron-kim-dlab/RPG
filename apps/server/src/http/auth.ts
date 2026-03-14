import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { PlayerSave, SessionPayload, WorldContent } from "@rpg/game-core";
import { createStarterPlayer, migrateLegacyPlayerSave } from "@rpg/game-core";
import type { ServerEnv } from "../config/env";
import type { UserRepository } from "../storage";
import { createRouteError, sendFailure, sendSuccess } from "./response";
import { readCredentials } from "./validation";

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
  const { username, password } = readCredentials(req.body);

  const existing = await repository.findByUsername(username);
  if (existing) {
    throw createRouteError(409, "conflict", "이미 존재하는 사용자입니다.");
  }

  const world = await worldLoader();
  const passwordHash = await bcrypt.hash(password, env.passwordHashRounds);
  const player = createStarterPlayer(username, world);
  await repository.saveAccount({
    username,
    passwordHash,
    player,
  });

  const payload: SessionPayload = {
    token: signToken(env, username),
    player,
  };

  sendSuccess(res, payload, 201);
}

export async function loginHandler(
  req: Request,
  res: Response,
  repository: UserRepository,
  env: ServerEnv,
  worldLoader: () => Promise<WorldContent>,
): Promise<void> {
  const { username, password } = readCredentials(req.body);

  const account = await repository.findByUsername(username);
  if (!account) {
    throw createRouteError(401, "unauthorized", "아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  let authenticated = false;
  if (isBcryptHash(account.passwordHash)) {
    authenticated = await bcrypt.compare(password, account.passwordHash);
  } else {
    authenticated = account.passwordHash === password;
  }

  if (!authenticated) {
    throw createRouteError(401, "unauthorized", "아이디 또는 비밀번호가 올바르지 않습니다.");
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

  const payload: SessionPayload = {
    token: signToken(env, username),
    player: migratedPlayer,
  };

  sendSuccess(res, payload);
}

export type AuthenticatedRequest = Request & {
  auth?: AuthPayload;
};

export function authMiddleware(env: ServerEnv) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    if (!token) {
      sendFailure(res, 401, "unauthorized", "인증 토큰이 필요합니다.");
      return;
    }

    try {
      req.auth = verifyToken(env, token);
      next();
    } catch {
      sendFailure(res, 401, "unauthorized", "유효하지 않은 토큰입니다.");
    }
  };
}

export function assertPlayerOwnership(req: AuthenticatedRequest, player: PlayerSave): boolean {
  return req.auth?.username === player.username;
}
