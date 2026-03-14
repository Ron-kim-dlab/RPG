import type { PlayerSave, WorldContent } from "../types";
import { toLocationKey } from "../utils/id";

export const MAX_EXPERIENCE = 1_000_000_000;

export function getLevelThreshold(level: number): number {
  const rate = 1 - Math.sqrt(1 - Math.pow(level * 0.01, 4));
  return MAX_EXPERIENCE * rate;
}

export function getMaxHp(level: number): number {
  let maxHp = 120;
  for (let currentLevel = 1; currentLevel <= level - 1; currentLevel += 1) {
    maxHp += Math.floor((currentLevel + 2) ** 2 * 10);
  }

  return maxHp;
}

export function getMaxMp(level: number): number {
  let maxMp = 50;
  for (let currentLevel = 1; currentLevel <= level - 1; currentLevel += 1) {
    maxMp += Math.floor((currentLevel + 2) * 20);
  }

  return maxMp;
}

export function applyLevelUps(player: PlayerSave): { player: PlayerSave; messages: string[] } {
  const nextPlayer: PlayerSave = structuredClone(player);
  const messages: string[] = [];

  while (nextPlayer.experience >= getLevelThreshold(nextPlayer.level)) {
    const threshold = getLevelThreshold(nextPlayer.level);
    nextPlayer.experience -= threshold;
    nextPlayer.level += 1;

    const attackIncrease = Math.floor((nextPlayer.level + 2) ** 2);
    nextPlayer.attack += attackIncrease;
    nextPlayer.currentHp = getMaxHp(nextPlayer.level);
    nextPlayer.currentMp = getMaxMp(nextPlayer.level);

    messages.push(
      `레벨 ${nextPlayer.level} 달성! 공격력 +${attackIncrease}, HP/MP가 완전히 회복되었습니다.`,
    );
  }

  return { player: nextPlayer, messages };
}

export function createStarterPlayer(username: string, world: WorldContent): PlayerSave {
  const locationKey = world.startLocationKey || toLocationKey("시작의 마을", "마을 입구");

  return {
    version: 2,
    username,
    coins: 0,
    experience: 0,
    level: 1,
    currentHp: 100,
    currentMp: 50,
    attack: 10,
    defense: 0,
    speed: 10,
    accuracy: 0.8,
    locationKey,
    position: { x: 512, y: 384 },
    facing: "down",
    visitedMainLocations: ["시작의 마을"],
    visitedLocationKeys: [locationKey],
    storyState: {
      [locationKey]: {
        completed: false,
        currentIndex: 0,
      },
    },
    ownedEquipmentIds: [],
    equippedEquipmentIds: [],
    learnedSkillIds: [],
    learnedTacticIds: [],
    questCompletion: {},
    flags: {
      demonLordDefeated: false,
    },
  };
}

export function ensureStoryState(player: PlayerSave, locationKey: string): PlayerSave {
  if (player.storyState[locationKey]) {
    return player;
  }

  return {
    ...player,
    storyState: {
      ...player.storyState,
      [locationKey]: {
        completed: false,
        currentIndex: 0,
      },
    },
  };
}

export function migrateLegacyPlayerSave(
  legacy: Record<string, unknown> | null | undefined,
  username: string,
  world: WorldContent,
): PlayerSave {
  if (!legacy) {
    return createStarterPlayer(username, world);
  }

  if (legacy.version === 2) {
    return legacy as PlayerSave;
  }

  const locationKey = toLocationKey(
    String(legacy.위치 ?? "시작의 마을"),
    String(legacy.세부위치 ?? "마을 입구"),
  );

  const storyState = Object.fromEntries(
    (Array.isArray(legacy.세부방문) ? legacy.세부방문 : []).map((entry) => [
      String(entry).includes("::") ? String(entry) : String(entry).replace("_", "::"),
      {
        completed: true,
        currentIndex: 999,
      },
    ]),
  ) as PlayerSave["storyState"];

  if (!storyState[locationKey]) {
    storyState[locationKey] = {
      completed: !legacy.스토리진행중,
      currentIndex: Number(legacy.스토리인덱스 ?? 0),
    };
  }

  return {
    version: 2,
    username,
    coins: Number(legacy.코인 ?? 0),
    experience: Number(legacy.경험치 ?? 0),
    level: Number(legacy.레벨 ?? 1),
    currentHp: Number(legacy.체력 ?? 100),
    currentMp: Number(legacy.MP ?? 50),
    attack: Number(legacy.공격력 ?? 10),
    defense: Number(legacy.방어력 ?? 0),
    speed: Number(legacy.속도 ?? 10),
    accuracy: Number(legacy.명중률 ?? 0.8),
    locationKey,
    position: { x: 512, y: 384 },
    facing: "down",
    visitedMainLocations: (Array.isArray(legacy.방문) ? legacy.방문 : ["시작의 마을"]).map(String),
    visitedLocationKeys: (Array.isArray(legacy.세부방문) ? legacy.세부방문 : [])
      .map((entry) => String(entry).includes("::") ? String(entry) : String(entry).replace("_", "::"))
      .concat(locationKey),
    storyState,
    ownedEquipmentIds: (Array.isArray(legacy.소유장비) ? legacy.소유장비 : []).map((value) =>
      `equipment-${String(value).normalize("NFKC").trim().replace(/\s+/g, "-").toLowerCase()}`
    ),
    equippedEquipmentIds: (Array.isArray(legacy.장착장비) ? legacy.장착장비 : []).map((value) =>
      `equipment-${String(value).normalize("NFKC").trim().replace(/\s+/g, "-").toLowerCase()}`
    ),
    learnedSkillIds: (Array.isArray(legacy.배운특수능력) ? legacy.배운특수능력 : []).map((value) =>
      `skill-${String((value as { 이름?: string }).이름 ?? value).normalize("NFKC").trim().replace(/\s+/g, "-").toLowerCase()}`
    ),
    learnedTacticIds: (Array.isArray(legacy.배운전술) ? legacy.배운전술 : []).map((value) =>
      `tactic-${String((value as { 이름?: string }).이름 ?? value).normalize("NFKC").trim().replace(/\s+/g, "-").toLowerCase()}`
    ),
    questCompletion: Object.fromEntries(
      Object.entries((legacy.퀘스트완료 as Record<string, boolean>) ?? {}).map(([key, value]) => [key, Boolean(value)]),
    ),
    flags: {
      demonLordDefeated: Boolean(legacy.마왕패배),
    },
  };
}
