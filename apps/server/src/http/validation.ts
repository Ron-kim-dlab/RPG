import type { PlayerSave } from "@rpg/game-core";
import { createRouteError } from "./response";

type CredentialsInput = {
  username: string;
  password: string;
};

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createRouteError(400, "bad_request", message);
  }

  return value as Record<string, unknown>;
}

function expectString(value: unknown, path: string, issues: string[], options?: { minLength?: number }): void {
  if (typeof value !== "string") {
    issues.push(`${path} must be a string.`);
    return;
  }

  if (options?.minLength && value.trim().length < options.minLength) {
    issues.push(`${path} must be at least ${options.minLength} characters long.`);
  }
}

function expectNumber(value: unknown, path: string, issues: string[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${path} must be a finite number.`);
  }
}

function expectStringArray(value: unknown, path: string, issues: string[]): void {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    issues.push(`${path} must be an array of strings.`);
  }
}

function expectBooleanRecord(value: unknown, path: string, issues: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${path} must be an object of boolean flags.`);
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (typeof entry !== "boolean") {
      issues.push(`${path}.${key} must be a boolean.`);
    }
  });
}

export function readCredentials(body: unknown): CredentialsInput {
  const record = asRecord(body, "인증 요청 본문이 올바르지 않습니다.");
  const username = String(record.username ?? "").trim();
  const password = String(record.password ?? "");

  if (username.length < 2) {
    throw createRouteError(400, "validation_error", "사용자 이름은 2자 이상이어야 합니다.");
  }

  if (password.length < 8) {
    throw createRouteError(400, "validation_error", "비밀번호는 최소 8자 이상이어야 합니다.");
  }

  return { username, password };
}

export function readPlayerSave(body: unknown): PlayerSave {
  const record = asRecord(body, "세이브 요청 본문이 올바르지 않습니다.");
  const player = record.player;
  const issues: string[] = [];

  if (!player || typeof player !== "object" || Array.isArray(player)) {
    throw createRouteError(400, "bad_request", "세이브 요청에는 player 객체가 필요합니다.");
  }

  const candidate = player as Record<string, unknown>;
  const position = candidate.position;
  const storyState = candidate.storyState;
  const flags = candidate.flags;

  if (candidate.version !== 2) {
    issues.push("player.version must be 2.");
  }

  expectString(candidate.username, "player.username", issues, { minLength: 1 });
  expectNumber(candidate.coins, "player.coins", issues);
  expectNumber(candidate.experience, "player.experience", issues);
  expectNumber(candidate.level, "player.level", issues);
  expectNumber(candidate.currentHp, "player.currentHp", issues);
  expectNumber(candidate.currentMp, "player.currentMp", issues);
  expectNumber(candidate.attack, "player.attack", issues);
  expectNumber(candidate.defense, "player.defense", issues);
  expectNumber(candidate.speed, "player.speed", issues);
  expectNumber(candidate.accuracy, "player.accuracy", issues);
  expectString(candidate.locationKey, "player.locationKey", issues, { minLength: 1 });

  if (!position || typeof position !== "object" || Array.isArray(position)) {
    issues.push("player.position must be an object with x and y.");
  } else {
    expectNumber((position as Record<string, unknown>).x, "player.position.x", issues);
    expectNumber((position as Record<string, unknown>).y, "player.position.y", issues);
  }

  if (!["up", "down", "left", "right"].includes(String(candidate.facing ?? ""))) {
    issues.push("player.facing must be one of: up, down, left, right.");
  }

  expectStringArray(candidate.visitedMainLocations, "player.visitedMainLocations", issues);
  expectStringArray(candidate.visitedLocationKeys, "player.visitedLocationKeys", issues);
  expectStringArray(candidate.ownedEquipmentIds, "player.ownedEquipmentIds", issues);
  expectStringArray(candidate.equippedEquipmentIds, "player.equippedEquipmentIds", issues);
  expectStringArray(candidate.learnedSkillIds, "player.learnedSkillIds", issues);
  expectStringArray(candidate.learnedTacticIds, "player.learnedTacticIds", issues);
  expectBooleanRecord(candidate.questCompletion, "player.questCompletion", issues);

  if (!storyState || typeof storyState !== "object" || Array.isArray(storyState)) {
    issues.push("player.storyState must be an object.");
  } else {
    Object.entries(storyState as Record<string, unknown>).forEach(([key, entry]) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        issues.push(`player.storyState.${key} must be an object.`);
        return;
      }

      const state = entry as Record<string, unknown>;
      if (typeof state.completed !== "boolean") {
        issues.push(`player.storyState.${key}.completed must be a boolean.`);
      }
      if (typeof state.currentIndex !== "number" || !Number.isFinite(state.currentIndex)) {
        issues.push(`player.storyState.${key}.currentIndex must be a finite number.`);
      }
    });
  }

  if (!flags || typeof flags !== "object" || Array.isArray(flags)) {
    issues.push("player.flags must be an object.");
  } else if (typeof (flags as Record<string, unknown>).demonLordDefeated !== "boolean") {
    issues.push("player.flags.demonLordDefeated must be a boolean.");
  }

  if (issues.length > 0) {
    throw createRouteError(400, "validation_error", "플레이어 세이브 형식이 올바르지 않습니다.", issues);
  }

  return player as PlayerSave;
}
