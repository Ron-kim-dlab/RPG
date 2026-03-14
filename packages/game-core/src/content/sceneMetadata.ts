import type { CollisionZone, SceneAssetBundle, SceneLayoutId, SceneThemeId } from "../types";

type SceneRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type SceneLayoutTemplate = {
  width: number;
  height: number;
  tileSize: number;
  spawn: { x: number; y: number };
  npcAnchor: { x: number; y: number };
  encounterZone: { x: number; y: number; width: number; height: number };
  portalSlots: Array<{ x: number; y: number; width: number; height: number }>;
  collisionZones: SceneRect[];
};

export const SCENE_THEME_IDS: SceneThemeId[] = [
  "village",
  "grassland",
  "forest",
  "desert",
  "mountain",
  "swamp",
  "river",
  "sea",
  "sky",
  "space",
  "castle",
];

export const SCENE_LAYOUT_IDS: SceneLayoutId[] = [
  "town_gate",
  "shop",
  "inn",
  "skill_shop",
  "plaza",
  "field",
  "boss_arena",
];

const COMMON_TEXTURES = {
  propsTexturePath: "/assets/placeholders/props/prop-block.svg",
  playerTexturePath: "/assets/placeholders/actors/player-local.svg",
  remotePlayerTexturePath: "/assets/placeholders/actors/player-remote.svg",
  npcTexturePath: "/assets/placeholders/actors/npc-guide.svg",
  portalTexturePath: "/assets/placeholders/actors/portal.svg",
  encounterTexturePath: "/assets/placeholders/actors/encounter.svg",
} as const;

const SCENE_LAYOUTS: Record<SceneLayoutId, SceneLayoutTemplate> = {
  town_gate: {
    width: 1024,
    height: 768,
    tileSize: 16,
    spawn: { x: 512, y: 636 },
    npcAnchor: { x: 512, y: 188 },
    encounterZone: { x: 372, y: 346, width: 280, height: 136 },
    portalSlots: [
      { x: 468, y: 22, width: 88, height: 24 },
      { x: 942, y: 324, width: 24, height: 120 },
      { x: 468, y: 722, width: 88, height: 24 },
      { x: 58, y: 324, width: 24, height: 120 },
    ],
    collisionZones: [
      { id: "north-left-block", x: 96, y: 96, width: 240, height: 164 },
      { id: "north-right-block", x: 688, y: 96, width: 240, height: 164 },
      { id: "center-planter", x: 432, y: 304, width: 160, height: 88 },
    ],
  },
  shop: {
    width: 1024,
    height: 768,
    tileSize: 16,
    spawn: { x: 512, y: 640 },
    npcAnchor: { x: 512, y: 180 },
    encounterZone: { x: 404, y: 392, width: 216, height: 116 },
    portalSlots: [
      { x: 468, y: 718, width: 88, height: 24 },
      { x: 468, y: 22, width: 88, height: 24 },
      { x: 942, y: 324, width: 24, height: 120 },
      { x: 58, y: 324, width: 24, height: 120 },
    ],
    collisionZones: [
      { id: "counter", x: 248, y: 150, width: 528, height: 68 },
      { id: "rack-left", x: 110, y: 110, width: 108, height: 240 },
      { id: "rack-right", x: 806, y: 110, width: 108, height: 240 },
    ],
  },
  inn: {
    width: 1024,
    height: 768,
    tileSize: 16,
    spawn: { x: 512, y: 640 },
    npcAnchor: { x: 512, y: 190 },
    encounterZone: { x: 404, y: 392, width: 216, height: 116 },
    portalSlots: [
      { x: 468, y: 718, width: 88, height: 24 },
      { x: 468, y: 22, width: 88, height: 24 },
      { x: 942, y: 324, width: 24, height: 120 },
      { x: 58, y: 324, width: 24, height: 120 },
    ],
    collisionZones: [
      { id: "reception", x: 272, y: 142, width: 480, height: 58 },
      { id: "bed-left", x: 138, y: 288, width: 236, height: 120 },
      { id: "bed-right", x: 650, y: 288, width: 236, height: 120 },
    ],
  },
  skill_shop: {
    width: 1024,
    height: 768,
    tileSize: 16,
    spawn: { x: 512, y: 640 },
    npcAnchor: { x: 512, y: 186 },
    encounterZone: { x: 404, y: 392, width: 216, height: 116 },
    portalSlots: [
      { x: 468, y: 718, width: 88, height: 24 },
      { x: 468, y: 22, width: 88, height: 24 },
      { x: 942, y: 324, width: 24, height: 120 },
      { x: 58, y: 324, width: 24, height: 120 },
    ],
    collisionZones: [
      { id: "altar", x: 404, y: 146, width: 216, height: 78 },
      { id: "archive-left", x: 120, y: 120, width: 110, height: 244 },
      { id: "archive-right", x: 794, y: 120, width: 110, height: 244 },
    ],
  },
  plaza: {
    width: 1024,
    height: 768,
    tileSize: 16,
    spawn: { x: 512, y: 630 },
    npcAnchor: { x: 512, y: 174 },
    encounterZone: { x: 356, y: 392, width: 312, height: 124 },
    portalSlots: [
      { x: 468, y: 22, width: 88, height: 24 },
      { x: 942, y: 324, width: 24, height: 120 },
      { x: 468, y: 722, width: 88, height: 24 },
      { x: 58, y: 324, width: 24, height: 120 },
    ],
    collisionZones: [
      { id: "fountain", x: 404, y: 260, width: 216, height: 152 },
      { id: "market-left", x: 122, y: 138, width: 154, height: 104 },
      { id: "market-right", x: 748, y: 138, width: 154, height: 104 },
    ],
  },
  field: {
    width: 1024,
    height: 768,
    tileSize: 16,
    spawn: { x: 512, y: 646 },
    npcAnchor: { x: 512, y: 168 },
    encounterZone: { x: 312, y: 304, width: 400, height: 182 },
    portalSlots: [
      { x: 468, y: 22, width: 88, height: 24 },
      { x: 942, y: 324, width: 24, height: 120 },
      { x: 468, y: 722, width: 88, height: 24 },
      { x: 58, y: 324, width: 24, height: 120 },
    ],
    collisionZones: [
      { id: "tree-cluster-left", x: 108, y: 148, width: 172, height: 208 },
      { id: "tree-cluster-right", x: 744, y: 128, width: 172, height: 224 },
      { id: "rock-bank", x: 404, y: 520, width: 224, height: 84 },
    ],
  },
  boss_arena: {
    width: 1024,
    height: 768,
    tileSize: 16,
    spawn: { x: 512, y: 640 },
    npcAnchor: { x: 512, y: 152 },
    encounterZone: { x: 296, y: 236, width: 432, height: 236 },
    portalSlots: [
      { x: 468, y: 718, width: 88, height: 24 },
      { x: 468, y: 22, width: 88, height: 24 },
      { x: 942, y: 324, width: 24, height: 120 },
      { x: 58, y: 324, width: 24, height: 120 },
    ],
    collisionZones: [
      { id: "pillar-nw", x: 178, y: 134, width: 94, height: 94 },
      { id: "pillar-ne", x: 752, y: 134, width: 94, height: 94 },
      { id: "pillar-sw", x: 178, y: 506, width: 94, height: 94 },
      { id: "pillar-se", x: 752, y: 506, width: 94, height: 94 },
    ],
  },
};

function cloneZones(zones: SceneRect[]): CollisionZone[] {
  return zones.map((zone) => ({ ...zone }));
}

export function getSceneThemeId(mainLocation: string): SceneThemeId {
  const explicit: Record<string, SceneThemeId> = {
    "시작의 마을": "village",
    "시작의 땅": "grassland",
    "평화의 마을": "village",
    "이웃 마을": "village",
    사막: "desert",
    산길: "mountain",
    늪지: "swamp",
    하천: "river",
    바다: "sea",
    하늘: "sky",
    우주: "space",
    "마왕의 성": "castle",
  };

  return explicit[mainLocation] ?? "grassland";
}

export function getSceneLayoutId(
  subLocation: string,
  options: { hasEncounter: boolean; hasBoss: boolean },
): SceneLayoutId {
  if (subLocation === "무기 상점") {
    return "shop";
  }

  if (subLocation === "여관") {
    return "inn";
  }

  if (subLocation === "기술 상점") {
    return "skill_shop";
  }

  if (subLocation.includes("광장")) {
    return "plaza";
  }

  if (subLocation === "마을 입구") {
    return "town_gate";
  }

  if (options.hasBoss) {
    return "boss_arena";
  }

  if (options.hasEncounter) {
    return "field";
  }

  return "field";
}

export function createSceneLayout(layoutId: SceneLayoutId): SceneLayoutTemplate {
  const template = SCENE_LAYOUTS[layoutId];
  return {
    width: template.width,
    height: template.height,
    tileSize: template.tileSize,
    spawn: { ...template.spawn },
    npcAnchor: { ...template.npcAnchor },
    encounterZone: { ...template.encounterZone },
    portalSlots: template.portalSlots.map((slot) => ({ ...slot })),
    collisionZones: cloneZones(template.collisionZones),
  };
}

export function getSceneMapJsonPath(layoutId: SceneLayoutId): string {
  return `/maps/layouts/${layoutId}.json`;
}

export function getSceneTerrainTexturePath(themeId: SceneThemeId): string {
  return `/assets/placeholders/terrain/${themeId}.svg`;
}

export function getSceneAssetBundle(themeId: SceneThemeId, layoutId: SceneLayoutId): SceneAssetBundle {
  return {
    layoutId,
    mapJsonPath: getSceneMapJsonPath(layoutId),
    terrainTexturePath: getSceneTerrainTexturePath(themeId),
    propsTexturePath: COMMON_TEXTURES.propsTexturePath,
    playerTexturePath: COMMON_TEXTURES.playerTexturePath,
    remotePlayerTexturePath: COMMON_TEXTURES.remotePlayerTexturePath,
    npcTexturePath: COMMON_TEXTURES.npcTexturePath,
    portalTexturePath: COMMON_TEXTURES.portalTexturePath,
    encounterTexturePath: COMMON_TEXTURES.encounterTexturePath,
    license: "placeholder",
    attribution: "Handmade SVG placeholder assets for development-only map prototyping.",
  };
}

export function getCommonSceneTexturePaths(): string[] {
  return Object.values(COMMON_TEXTURES);
}

export function getSceneAssetManifest(): { jsonPaths: string[]; texturePaths: string[] } {
  return {
    jsonPaths: SCENE_LAYOUT_IDS.map((layoutId) => getSceneMapJsonPath(layoutId)),
    texturePaths: [
      ...SCENE_THEME_IDS.map((themeId) => getSceneTerrainTexturePath(themeId)),
      ...getCommonSceneTexturePaths(),
    ],
  };
}
