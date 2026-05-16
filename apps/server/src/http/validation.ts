import type { Facing, PlayerSave, StoryState, WorldContent } from "@rpg/game-core";
import { getMaxHp, getMaxMp, MAX_EXPERIENCE, normalizePlayerPosition } from "@rpg/game-core";
import { createRouteError } from "./response";

type CredentialsInput = {
  username: string;
  password: string;
};

const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 24;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/u;
const MAX_LEVEL = 100;
const MAX_COINS = 999_999;
const MAX_DEFENSE = 10_000;
const MAX_SPEED = 10_000;

const FACING_VALUES = new Set<Facing>(["up", "down", "left", "right"]);

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.trunc(clamp(value, min, max));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function collectValidIds(
  value: unknown,
  path: string,
  validIds: Set<string>,
  issues: string[],
): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return [];
  }

  const ids = uniqueStrings(value);
  const invalid = ids.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    issues.push(`${path} contains unknown ids: ${invalid.join(", ")}.`);
  }

  return ids;
}

function collectVisitedMainLocations(value: unknown, world: WorldContent, issues: string[]): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return [];
  }

  const validMainLocations = new Set(Object.values(world.locations).map((location) => location.mainLocation));
  const entries = uniqueStrings(value);
  const invalid = entries.filter((entry) => !validMainLocations.has(entry));
  if (invalid.length > 0) {
    issues.push(`player.visitedMainLocations contains unknown locations: ${invalid.join(", ")}.`);
  }

  return entries;
}

function readStoryStateRecord(value: unknown, world: WorldContent, issues: string[]): Record<string, StoryState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const output: Record<string, StoryState> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const location = world.locations[key];
    if (!location) {
      issues.push(`player.storyState.${key} references an unknown location.`);
      return;
    }

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }

    const state = entry as Record<string, unknown>;
    output[key] = {
      completed: Boolean(state.completed),
      currentIndex: clampInteger(Number(state.currentIndex), 0, Math.max(0, location.story.length)),
    };
  });

  return output;
}

function readQuestCompletion(value: unknown, world: WorldContent, issues: string[]): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const validBossNames = new Set(
    Object.values(world.locations)
      .map((location) => location.bossName)
      .filter((name): name is string => Boolean(name)),
  );
  const output: Record<string, boolean> = {};

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (!validBossNames.has(key)) {
      issues.push(`player.questCompletion.${key} references an unknown boss.`);
      return;
    }
    output[key] = Boolean(entry);
  });

  return output;
}

function baseAttackForLevel(level: number): number {
  let attack = 10;
  for (let currentLevel = 2; currentLevel <= level; currentLevel += 1) {
    attack += Math.floor((currentLevel + 2) ** 2);
  }
  return attack;
}

export function readCredentials(body: unknown): CredentialsInput {
  const record = asRecord(body, "인증 요청 본문이 올바르지 않습니다.");
  const username = String(record.username ?? "").trim();
  const password = String(record.password ?? "");

  if (username.length < USERNAME_MIN_LENGTH) {
    throw createRouteError(400, "validation_error", `사용자 이름은 ${USERNAME_MIN_LENGTH}자 이상이어야 합니다.`);
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    throw createRouteError(400, "validation_error", `사용자 이름은 ${USERNAME_MAX_LENGTH}자 이하여야 합니다.`);
  }

  if (!USERNAME_PATTERN.test(username)) {
    throw createRouteError(400, "validation_error", "사용자 이름은 영문, 숫자, 밑줄, 하이픈만 사용할 수 있습니다.");
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw createRouteError(400, "validation_error", `비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw createRouteError(400, "validation_error", `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`);
  }

  return { username, password };
}

export function readPlayerSave(body: unknown, world: WorldContent): PlayerSave {
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

  const equipmentIds = new Set(world.equipment.map((item) => item.id));
  const skillIds = new Set(world.skills.map((skill) => skill.id));
  const tacticIds = new Set(world.tactics.map((tactic) => tactic.id));
  const locationKeys = new Set(Object.keys(world.locations));
  const locationKey = String(candidate.locationKey);

  if (!locationKeys.has(locationKey)) {
    issues.push(`player.locationKey references an unknown location: ${locationKey}.`);
  }

  const visitedMainLocations = collectVisitedMainLocations(candidate.visitedMainLocations, world, issues);
  const visitedLocationKeys = collectValidIds(candidate.visitedLocationKeys, "player.visitedLocationKeys", locationKeys, issues);
  const ownedEquipmentIds = collectValidIds(candidate.ownedEquipmentIds, "player.ownedEquipmentIds", equipmentIds, issues);
  const equippedEquipmentIds = collectValidIds(candidate.equippedEquipmentIds, "player.equippedEquipmentIds", equipmentIds, issues);
  const learnedSkillIds = collectValidIds(candidate.learnedSkillIds, "player.learnedSkillIds", skillIds, issues);
  const learnedTacticIds = collectValidIds(candidate.learnedTacticIds, "player.learnedTacticIds", tacticIds, issues);
  const storyStateRecord = readStoryStateRecord(candidate.storyState, world, issues);
  const questCompletion = readQuestCompletion(candidate.questCompletion, world, issues);

  const unownedEquipped = equippedEquipmentIds.filter((id) => !ownedEquipmentIds.includes(id));
  if (unownedEquipped.length > 0) {
    issues.push(`player.equippedEquipmentIds contains unowned ids: ${unownedEquipped.join(", ")}.`);
  }

  if (!FACING_VALUES.has(candidate.facing as Facing)) {
    issues.push("player.facing must be one of: up, down, left, right.");
  }

  if (issues.length > 0) {
    throw createRouteError(400, "validation_error", "플레이어 세이브 내용이 월드 데이터와 맞지 않습니다.", issues);
  }

  const level = clampInteger(Number(candidate.level), 1, MAX_LEVEL);
  const maxHp = getMaxHp(level);
  const maxMp = getMaxMp(level);
  const equipmentById = new Map(world.equipment.map((item) => [item.id, item]));
  const equippedAttackBonus = equippedEquipmentIds.reduce(
    (total, id) => total + (equipmentById.get(id)?.attackBonus ?? 0),
    0,
  );
  const maxAttack = baseAttackForLevel(level) + equippedAttackBonus;
  const safeLocation = world.locations[locationKey] ? locationKey : world.startLocationKey;
  const safeVisitedLocationKeys = uniqueStrings([...visitedLocationKeys, safeLocation]);
  const safeVisitedMainLocations = uniqueStrings([
    ...visitedMainLocations,
    world.locations[safeLocation]?.mainLocation ?? "",
  ].filter(Boolean));

  const sanitized: PlayerSave = {
    version: 2,
    username: String(candidate.username).trim(),
    coins: clampInteger(Number(candidate.coins), 0, MAX_COINS),
    experience: clampInteger(Number(candidate.experience), 0, MAX_EXPERIENCE),
    level,
    currentHp: clamp(Number(candidate.currentHp), 0, maxHp),
    currentMp: clamp(Number(candidate.currentMp), 0, maxMp),
    attack: clampInteger(Number(candidate.attack), 1, maxAttack),
    defense: clampInteger(Number(candidate.defense), 0, MAX_DEFENSE),
    speed: clampInteger(Number(candidate.speed), 0, MAX_SPEED),
    accuracy: clamp(Number(candidate.accuracy), 0, 1),
    locationKey: safeLocation,
    position: {
      x: Number((position as Record<string, unknown>).x),
      y: Number((position as Record<string, unknown>).y),
    },
    facing: candidate.facing as Facing,
    visitedMainLocations: safeVisitedMainLocations,
    visitedLocationKeys: safeVisitedLocationKeys,
    storyState: {
      ...storyStateRecord,
      [safeLocation]: storyStateRecord[safeLocation] ?? {
        completed: false,
        currentIndex: 0,
      },
    },
    ownedEquipmentIds,
    equippedEquipmentIds,
    learnedSkillIds,
    learnedTacticIds,
    questCompletion,
    flags: {
      demonLordDefeated: Boolean((candidate.flags as Record<string, unknown>).demonLordDefeated),
    },
  };

  return normalizePlayerPosition(sanitized, world);
}
