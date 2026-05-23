import type { LegacyBossData, LegacyMonsterData } from "../types";
import legacyBossData from "../../../../game/boss.json";
import legacyMonsterData from "../../../../game/monster.json";

const GENERATED_MONSTER_ROOT = "/assets/generated/monsters";

type EnemyTextureParams = {
  name: string;
  mainLocation?: string;
  subLocation?: string;
  isBoss?: boolean;
};

type EnemyTextureOverride = {
  sprite?: string;
  texturePath?: string;
};

export const ENEMY_TEXTURE_IDS = [
  "slime",
  "goblin-raider",
  "skeleton-warrior",
  "masked-bandit",
  "prairie-wolf",
  "skeletal-koala",
  "moss-tree-giant",
  "forest-imp",
  "bramble-spirit",
  "desert-mummy",
  "black-desert-scorpion",
  "vampire-lord",
  "desert-basilisk",
  "ancient-mural-beast",
  "sandstone-golem",
  "ruins-guardian",
  "desert-gladiator",
  "fire-mummy",
  "sand-elemental",
  "lava-brute",
  "desert-ifrit",
  "sandstorm-beast",
  "sand-worm",
  "storm-witch",
  "gale-knight",
  "frost-witch",
  "ice-brute",
  "snow-spirit",
  "rage-fire-witch",
  "fire-yokai",
  "flame-spirit",
  "confusion-ghost",
  "ghost-king",
  "berserk-ape",
  "mud-giant",
  "river-hippo",
  "angry-frog",
  "moisture-yokai",
  "fog-zombie",
  "sap-slime",
  "mist-wraith",
  "reed-dryad",
  "swamp-hydra",
  "water-giant",
  "water-spirit",
  "ice-current-spirit",
  "waterfall-guardian",
  "whirlpool-spirit",
  "river-dragon",
  "crystal-turtle",
  "glowing-jellyfish",
  "luminous-flatfish",
  "abyss-predator",
  "shadow-tentacle",
  "dark-sea-dragon",
  "thunder-manta",
  "lightning-trident-spirit",
  "abyss-urchin",
  "shadow-shark",
  "floating-sky-eye",
  "dark-raven",
  "sky-wyvern",
  "sky-lich",
  "air-golem",
  "zephyr-spirit",
  "thunder-drake",
  "classic-dragon",
  "vampire-dragon",
  "satellite-drone",
  "heat-drone",
  "steel-war-machine",
  "storm-aircraft",
  "ring-guardian",
  "frost-core",
  "grave-wraith",
  "demon-minion",
  "demon-lord",
  "pyramid-monster",
  "cursed-cloud",
  "destroyed-moon",
] as const;

export type EnemyTextureId = (typeof ENEMY_TEXTURE_IDS)[number];

export const DEFAULT_ENEMY_TEXTURE_ID: EnemyTextureId = "slime";

export const ENEMY_TEXTURES = Object.fromEntries(
  ENEMY_TEXTURE_IDS.map((id) => [id, `${GENERATED_MONSTER_ROOT}/monster-${id}.png`]),
) as Record<EnemyTextureId, string>;

function hasAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function byBossName(name: string): EnemyTextureId {
  if (name.includes("마왕의 부하")) return "demon-minion";
  if (name.includes("마왕")) return "demon-lord";
  if (name.includes("피라미드")) return "pyramid-monster";
  if (name.includes("달")) return "destroyed-moon";
  if (name.includes("구름")) return "cursed-cloud";
  if (name.includes("상어")) return "shadow-shark";
  if (hasAny(name, ["가오리", "폭풍의 군주"])) return "thunder-manta";
  if (hasAny(name, ["독수리", "비둘기"])) return "dark-raven";
  if (hasAny(name, ["고리", "토성"])) return "ring-guardian";
  if (hasAny(name, ["빙하", "냉기", "해왕성"])) return "frost-core";
  if (hasAny(name, ["수성", "위성"])) return "satellite-drone";
  if (hasAny(name, ["금성", "더위"])) return "heat-drone";
  if (hasAny(name, ["화성", "불 수호자"])) return "steel-war-machine";
  if (hasAny(name, ["목성", "바람 수호자"])) return "storm-aircraft";
  if (hasAny(name, ["해골", "나무늘보"])) return "skeletal-koala";
  if (hasAny(name, ["낙타", "모래"])) return "sandstorm-beast";
  if (hasAny(name, ["도굴꾼"])) return "masked-bandit";
  if (hasAny(name, ["고릴라"])) return "berserk-ape";
  if (hasAny(name, ["하마"])) return "river-hippo";
  if (hasAny(name, ["개구리"])) return "angry-frog";
  if (hasAny(name, ["악어", "도롱뇽", "머맨"])) return "river-dragon";
  if (hasAny(name, ["마녀"])) return "sky-lich";
  if (hasAny(name, ["불꽃", "화염"])) return "flame-spirit";
  if (hasAny(name, ["바람"])) return "storm-witch";
  if (hasAny(name, ["대지"])) return "mud-giant";

  return DEFAULT_ENEMY_TEXTURE_ID;
}

export function getEnemyTextureId(params: EnemyTextureParams): EnemyTextureId {
  const { name, mainLocation = "", subLocation = "", isBoss = false } = params;
  const context = `${mainLocation} ${subLocation} ${name}`;

  if (isBoss) return byBossName(name);

  if (name.includes("해골 코알라")) return "skeletal-koala";
  if (name.includes("수액 슬라임")) return "sap-slime";
  if (name.includes("슬라임")) return "slime";
  if (hasAny(name, ["고블린", "도깨비"])) return name.includes("숲") ? "forest-imp" : "goblin-raider";
  if (name.includes("해골")) return "skeleton-warrior";
  if (name.includes("도적")) return "masked-bandit";
  if (hasAny(name, ["들개", "늑대"])) return "prairie-wolf";
  if (name.includes("나무 거인")) return "moss-tree-giant";
  if (name.includes("덤불")) return "bramble-spirit";

  if (name.includes("화염의 미라")) return "fire-mummy";
  if (name.includes("미라")) return "desert-mummy";
  if (hasAny(name, ["스콜피온", "전갈"])) return "black-desert-scorpion";
  if (name.includes("뱀파이어 군주")) return "vampire-lord";
  if (name.includes("바실리스크")) return "desert-basilisk";
  if (name.includes("벽화")) return "ancient-mural-beast";
  if (hasAny(name, ["사암", "거상", "초거인", "모래 거인"])) return "sandstone-golem";
  if (name.includes("파수꾼")) return "ruins-guardian";
  if (name.includes("글라디에이터")) return "desert-gladiator";
  if (name.includes("용암")) return "lava-brute";
  if (name.includes("이프리트")) return "desert-ifrit";
  if (name.includes("모래 웜")) return "sand-worm";
  if (hasAny(name, ["모래 폭풍", "모래폭풍", "모래인간"])) return "sandstorm-beast";
  if (hasAny(name, ["모래", "사막"])) return "sand-elemental";

  if (hasAny(context, ["동결", "얼음 산길"]) && name.includes("마녀")) return "frost-witch";
  if (hasAny(context, ["불꽃 산길", "분노"]) && name.includes("마녀")) return "rage-fire-witch";
  if (name.includes("마녀")) return "storm-witch";
  if (name.includes("태풍")) return "storm-witch";
  if (name.includes("질풍")) return "gale-knight";
  if (hasAny(name, ["빙결 괴인"])) return "ice-brute";
  if (hasAny(name, ["빙설", "서리"])) return "snow-spirit";
  if (hasAny(name, ["불꽃 요괴"])) return "fire-yokai";
  if (hasAny(name, ["화염 정령"])) return "flame-spirit";
  if (name.includes("혼란 유령 왕")) return "ghost-king";
  if (name.includes("혼란 유령")) return "confusion-ghost";
  if (name.includes("고릴라")) return "berserk-ape";

  if (name.includes("진흙")) return "mud-giant";
  if (name.includes("하마")) return "river-hippo";
  if (name.includes("개구리")) return "angry-frog";
  if (name.includes("습도")) return "moisture-yokai";
  if (name.includes("좀비")) return "fog-zombie";
  if (hasAny(name, ["안개의 망령", "늪의 망령"])) return "mist-wraith";
  if (name.includes("하이드라")) return "swamp-hydra";
  if (name.includes("수초")) return "reed-dryad";

  if (name.includes("물의 거인")) return "water-giant";
  if (hasAny(name, ["물의 정령", "빙류 정령"])) return name.includes("빙류") ? "ice-current-spirit" : "water-spirit";
  if (name.includes("폭포")) return "waterfall-guardian";
  if (name.includes("소용돌이")) return "whirlpool-spirit";
  if (hasAny(name, ["수룡", "지배자"])) return "river-dragon";
  if (name.includes("거북")) return "crystal-turtle";

  if (name.includes("해파리")) return "glowing-jellyfish";
  if (name.includes("넙치")) return "luminous-flatfish";
  if (name.includes("촉수")) return "shadow-tentacle";
  if (name.includes("해룡")) return "dark-sea-dragon";
  if (name.includes("가오리")) return "thunder-manta";
  if (name.includes("삼지창")) return "lightning-trident-spirit";
  if (name.includes("성게")) return "abyss-urchin";
  if (name.includes("상어")) return "shadow-shark";
  if (hasAny(name, ["심연", "포식자"])) return "abyss-predator";

  if (name.includes("눈동자")) return "floating-sky-eye";
  if (name.includes("레이븐")) return "dark-raven";
  if (name.includes("와이번")) return "sky-wyvern";
  if (name.includes("리치")) return "sky-lich";
  if (name.includes("에어 골렘")) return "air-golem";
  if (name.includes("제피로스")) return "zephyr-spirit";
  if (name.includes("뇌우")) return "thunder-drake";
  if (name.includes("드레이크")) return "thunder-drake";
  if (name.includes("뱀파이어 드래곤")) return "vampire-dragon";
  if (name.includes("드래곤")) return "classic-dragon";

  if (hasAny(name, ["인공위성", "위성"])) return "satellite-drone";
  if (name.includes("방열")) return "heat-drone";
  if (name.includes("강철병기")) return "steel-war-machine";
  if (name.includes("폭풍탑재기")) return "storm-aircraft";
  if (name.includes("고리수호병")) return "ring-guardian";
  if (hasAny(name, ["냉기코어", "심해코어"])) return "frost-core";
  if (hasAny(name, ["악령", "무덤", "악귀"])) return "grave-wraith";

  if (mainLocation.includes("우주")) return "satellite-drone";
  if (mainLocation.includes("바다")) return "abyss-predator";
  if (mainLocation.includes("강")) return "water-spirit";
  if (mainLocation.includes("습지")) return "mist-wraith";
  if (mainLocation.includes("산길")) return "storm-witch";
  if (mainLocation.includes("사막")) return "sand-elemental";

  return DEFAULT_ENEMY_TEXTURE_ID;
}

export function getEnemyTexturePath(params: EnemyTextureParams): string {
  return ENEMY_TEXTURES[getEnemyTextureId(params)];
}

function getConfiguredEnemyTexturePath(record: EnemyTextureOverride): string | undefined {
  const texturePath = record.sprite ?? record.texturePath;
  return typeof texturePath === "string" && texturePath.length > 0
    ? texturePath
    : undefined;
}

function collectConfiguredEnemyTexturePaths(): string[] {
  const texturePaths: string[] = [];
  const monsters = legacyMonsterData as LegacyMonsterData;
  const bosses = legacyBossData as LegacyBossData;

  Object.values(monsters).forEach((subLocations) => {
    Object.values(subLocations).forEach((enemies) => {
      enemies.forEach((enemy) => {
        const texturePath = getConfiguredEnemyTexturePath(enemy);
        if (texturePath) {
          texturePaths.push(texturePath);
        }
      });
    });
  });

  Object.values(bosses).forEach((boss) => {
    const texturePath = getConfiguredEnemyTexturePath(boss);
    if (texturePath) {
      texturePaths.push(texturePath);
    }
  });

  return texturePaths;
}

export function resolveEnemyTexturePath(params: EnemyTextureParams & EnemyTextureOverride): string {
  return getConfiguredEnemyTexturePath(params) ?? getEnemyTexturePath(params);
}

export function getEnemyTexturePaths(): string[] {
  return Array.from(new Set([
    ...Object.values(ENEMY_TEXTURES),
    ...collectConfiguredEnemyTexturePaths(),
  ]));
}
