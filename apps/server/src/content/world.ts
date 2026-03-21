import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  LegacyBossData,
  LegacyEquipmentData,
  LegacyMapData,
  LegacyMonsterData,
  LegacySkillData,
  LegacyTacticData,
  WorldContent,
} from "@rpg/game-core";
import { buildWorldContentFromLegacy } from "@rpg/game-core";

let cachedWorld: WorldContent | null = null;
const contentDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(contentDir, "../../../../");

async function readJson<T>(relativePath: string): Promise<T> {
  const absolutePath = resolve(repositoryRoot, relativePath);
  const source = await readFile(absolutePath, "utf8");
  return JSON.parse(source) as T;
}

export async function loadWorld(): Promise<WorldContent> {
  if (cachedWorld) {
    return cachedWorld;
  }

  const [map, monsters, bosses, equipment, skills, tactics] = await Promise.all([
    readJson<LegacyMapData>("game/map.json"),
    readJson<LegacyMonsterData>("game/monster.json"),
    readJson<LegacyBossData>("game/boss.json"),
    readJson<LegacyEquipmentData>("game/equipment.json"),
    readJson<LegacySkillData>("game/skill.json"),
    readJson<LegacyTacticData>("game/tactics.json"),
  ]);

  cachedWorld = buildWorldContentFromLegacy({
    map,
    monsters,
    bosses,
    equipment,
    skills,
    tactics,
  });

  return cachedWorld;
}

export function resetWorldCache(): void {
  cachedWorld = null;
}
