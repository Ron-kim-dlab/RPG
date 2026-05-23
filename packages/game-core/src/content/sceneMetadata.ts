import type { CollisionZone, SceneAssetBundle, SceneLayoutId, SceneThemeId } from "../types";
import sceneLayoutData from "../../../../game/scene-layouts.json";
import { getEnemyTexturePaths } from "./enemyTextures";
import { getEquipmentTexturePaths } from "./equipmentTextures";

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

export type ScenePortalSlot = {
  x: number;
  y: number;
  width: number;
  height: number;
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

type SceneLayoutData = {
  layouts: Record<SceneLayoutId, SceneLayoutTemplate>;
};

const SCENE_LAYOUTS = (sceneLayoutData as SceneLayoutData).layouts;

export const SCENE_LAYOUT_IDS = Object.keys(SCENE_LAYOUTS) as SceneLayoutId[];

const GENERATED_ACTOR_ROOT = "/assets/generated/actors";
const GENERATED_SCENE_ROOT = "/assets/generated/scenes";

export const PLAYER_AVATAR_IDS = [
  "sword-knight",
  "shield-guardian",
  "forest-archer",
  "hooded-rogue",
  "fire-mage",
  "frost-cleric",
  "dwarven-fighter",
  "elven-spellblade",
  "desert-wanderer",
  "royal-lancer",
] as const;

export type PlayerAvatarId = (typeof PLAYER_AVATAR_IDS)[number];

export const DEFAULT_PLAYER_AVATAR_ID: PlayerAvatarId = PLAYER_AVATAR_IDS[0];

export const PLAYER_AVATAR_TEXTURES: Record<PlayerAvatarId, string> = {
  "sword-knight": `${GENERATED_ACTOR_ROOT}/player-sword-knight.png`,
  "shield-guardian": `${GENERATED_ACTOR_ROOT}/player-shield-guardian.png`,
  "forest-archer": `${GENERATED_ACTOR_ROOT}/player-forest-archer.png`,
  "hooded-rogue": `${GENERATED_ACTOR_ROOT}/player-hooded-rogue.png`,
  "fire-mage": `${GENERATED_ACTOR_ROOT}/player-fire-mage.png`,
  "frost-cleric": `${GENERATED_ACTOR_ROOT}/player-frost-cleric.png`,
  "dwarven-fighter": `${GENERATED_ACTOR_ROOT}/player-dwarven-fighter.png`,
  "elven-spellblade": `${GENERATED_ACTOR_ROOT}/player-elven-spellblade.png`,
  "desert-wanderer": `${GENERATED_ACTOR_ROOT}/player-desert-wanderer.png`,
  "royal-lancer": `${GENERATED_ACTOR_ROOT}/player-royal-lancer.png`,
};

const NPC_TEXTURES = {
  gateWarden: `${GENERATED_ACTOR_ROOT}/npc-gate-warden.png`,
  blacksmithMerchant: `${GENERATED_ACTOR_ROOT}/npc-blacksmith-merchant.png`,
  innkeeper: `${GENERATED_ACTOR_ROOT}/npc-innkeeper.png`,
  skillMentor: `${GENERATED_ACTOR_ROOT}/npc-skill-mentor.png`,
  townHerald: `${GENERATED_ACTOR_ROOT}/npc-town-herald.png`,
  rangerGuide: `${GENERATED_ACTOR_ROOT}/npc-ranger-guide.png`,
  bossSeer: `${GENERATED_ACTOR_ROOT}/npc-boss-seer.png`,
} as const;

const VILLAGE_FLOOR_TEXTURES = {
  "시작의 마을": `${GENERATED_SCENE_ROOT}/floor-start-village.png`,
  "평화의 마을": `${GENERATED_SCENE_ROOT}/floor-peace-village.png`,
  "이웃 마을": `${GENERATED_SCENE_ROOT}/floor-neighbor-village.png`,
} as const;

const FIELD_FLOOR_TEXTURES: Partial<Record<SceneThemeId, string>> = {
  grassland: `${GENERATED_SCENE_ROOT}/floor-grassland-field.png`,
  forest: `${GENERATED_SCENE_ROOT}/floor-forest-field.png`,
  desert: `${GENERATED_SCENE_ROOT}/floor-desert-field.png`,
  mountain: `${GENERATED_SCENE_ROOT}/floor-mountain-field.png`,
  swamp: `${GENERATED_SCENE_ROOT}/floor-swamp-field.png`,
  river: `${GENERATED_SCENE_ROOT}/floor-river-field.png`,
  sea: `${GENERATED_SCENE_ROOT}/floor-sea-field.png`,
  sky: `${GENERATED_SCENE_ROOT}/floor-sky-field.png`,
  space: `${GENERATED_SCENE_ROOT}/floor-space-field.png`,
  castle: `${GENERATED_SCENE_ROOT}/floor-castle-field.png`,
};

const LAYOUT_PROP_TEXTURES: Partial<Record<SceneLayoutId, Record<string, string>>> = {
  town_gate: {
    building: `${GENERATED_SCENE_ROOT}/facility-town-gate.png`,
    stall: `${GENERATED_SCENE_ROOT}/facility-town-gate.png`,
  },
  shop: {
    building: `${GENERATED_SCENE_ROOT}/facility-forge-shop.png`,
    rock: `${GENERATED_SCENE_ROOT}/facility-forge-shop.png`,
    stall: `${GENERATED_SCENE_ROOT}/facility-forge-shop.png`,
  },
  inn: {
    altar: `${GENERATED_SCENE_ROOT}/facility-inn.png`,
    bed: `${GENERATED_SCENE_ROOT}/facility-inn.png`,
    stall: `${GENERATED_SCENE_ROOT}/facility-inn.png`,
  },
  skill_shop: {
    altar: `${GENERATED_SCENE_ROOT}/facility-skill-shop.png`,
    building: `${GENERATED_SCENE_ROOT}/facility-skill-shop.png`,
  },
  plaza: {
    altar: `${GENERATED_SCENE_ROOT}/facility-plaza.png`,
    building: `${GENERATED_SCENE_ROOT}/facility-plaza.png`,
    stall: `${GENERATED_SCENE_ROOT}/facility-plaza.png`,
  },
  field: {
    tree: `${GENERATED_SCENE_ROOT}/field-tree-cluster.png`,
    rock: `${GENERATED_SCENE_ROOT}/field-rock-bank.png`,
    stall: `${GENERATED_SCENE_ROOT}/field-camp.png`,
  },
  boss_arena: {
    rock: `${GENERATED_SCENE_ROOT}/boss-arena-pillar.png`,
  },
};

const COMMON_TEXTURES = {
  propsTexturePath: "/assets/placeholders/props/prop-block.svg",
  playerTexturePath: PLAYER_AVATAR_TEXTURES[DEFAULT_PLAYER_AVATAR_ID],
  remotePlayerTexturePath: PLAYER_AVATAR_TEXTURES["shield-guardian"],
  npcTexturePath: NPC_TEXTURES.rangerGuide,
  portalTexturePath: `${GENERATED_SCENE_ROOT}/portal-rift.png`,
  encounterTexturePath: `${GENERATED_SCENE_ROOT}/encounter-danger-zone.png`,
  graveTexturePath: `${GENERATED_SCENE_ROOT}/player-grave.png`,
} as const;

const HORIZONTAL_PORTAL = {
  width: 88,
  height: 24,
} as const;

const VERTICAL_PORTAL = {
  width: 24,
  height: 120,
} as const;

const PORTAL_EDGE_ORDER = ["top", "right", "bottom", "left"] as const;
const PORTAL_HORIZONTAL_PADDING = 128;
const PORTAL_VERTICAL_PADDING = 104;
const PORTAL_TOP_Y = 22;
const PORTAL_LEFT_X = 58;

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

function distributeValues(count: number, start: number, end: number): number[] {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [Math.round((start + end) / 2)];
  }

  return Array.from({ length: count }, (_value, index) => {
    const ratio = index / (count - 1);
    return Math.round(start + (end - start) * ratio);
  });
}

function buildHorizontalPortalSlots(sceneWidth: number, sceneHeight: number, count: number, edge: "top" | "bottom"): ScenePortalSlot[] {
  if (count <= 0) {
    return [];
  }

  const y = edge === "top"
    ? PORTAL_TOP_Y
    : sceneHeight - PORTAL_TOP_Y - HORIZONTAL_PORTAL.height;
  const minCenter = PORTAL_HORIZONTAL_PADDING + HORIZONTAL_PORTAL.width / 2;
  const maxCenter = sceneWidth - PORTAL_HORIZONTAL_PADDING - HORIZONTAL_PORTAL.width / 2;

  return distributeValues(count, minCenter, maxCenter).map((centerX) => ({
    x: centerX - HORIZONTAL_PORTAL.width / 2,
    y,
    width: HORIZONTAL_PORTAL.width,
    height: HORIZONTAL_PORTAL.height,
  }));
}

function buildVerticalPortalSlots(sceneWidth: number, sceneHeight: number, count: number, edge: "right" | "left"): ScenePortalSlot[] {
  if (count <= 0) {
    return [];
  }

  const x = edge === "left"
    ? PORTAL_LEFT_X
    : sceneWidth - PORTAL_LEFT_X - VERTICAL_PORTAL.width;
  const minCenter = PORTAL_VERTICAL_PADDING + VERTICAL_PORTAL.height / 2;
  const maxCenter = sceneHeight - PORTAL_VERTICAL_PADDING - VERTICAL_PORTAL.height / 2;

  return distributeValues(count, minCenter, maxCenter).map((centerY) => ({
    x,
    y: centerY - VERTICAL_PORTAL.height / 2,
    width: VERTICAL_PORTAL.width,
    height: VERTICAL_PORTAL.height,
  }));
}

export function createScenePortalSlots(
  layout: { width: number; height: number; portalSlots: ScenePortalSlot[] },
  portalCount: number,
): ScenePortalSlot[] {
  if (portalCount <= 0) {
    return [];
  }

  if (portalCount <= layout.portalSlots.length) {
    return layout.portalSlots.slice(0, portalCount).map((slot) => ({ ...slot }));
  }

  const countsByEdge = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  for (let index = 0; index < portalCount; index += 1) {
    const edge = PORTAL_EDGE_ORDER[index % PORTAL_EDGE_ORDER.length]!;
    countsByEdge[edge] += 1;
  }

  const slotsByEdge = {
    top: buildHorizontalPortalSlots(layout.width, layout.height, countsByEdge.top, "top"),
    right: buildVerticalPortalSlots(layout.width, layout.height, countsByEdge.right, "right"),
    bottom: buildHorizontalPortalSlots(layout.width, layout.height, countsByEdge.bottom, "bottom"),
    left: buildVerticalPortalSlots(layout.width, layout.height, countsByEdge.left, "left"),
  };

  const edgeOffsets = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  return Array.from({ length: portalCount }, (_value, index) => {
    const edge = PORTAL_EDGE_ORDER[index % PORTAL_EDGE_ORDER.length]!;
    const nextSlot = slotsByEdge[edge][edgeOffsets[edge]]!;
    edgeOffsets[edge] += 1;
    return nextSlot;
  });
}

export function getSceneMapJsonPath(layoutId: SceneLayoutId): string {
  return `/maps/layouts/${layoutId}.json`;
}

export function getSceneTerrainTexturePath(themeId: SceneThemeId): string {
  return `/assets/placeholders/terrain/${themeId}.svg`;
}

export function getSceneFloorTexturePath(mainLocation: string, themeId?: SceneThemeId): string | undefined {
  return VILLAGE_FLOOR_TEXTURES[mainLocation as keyof typeof VILLAGE_FLOOR_TEXTURES]
    ?? (themeId ? FIELD_FLOOR_TEXTURES[themeId] : undefined);
}

export function getScenePropTexturePaths(layoutId: SceneLayoutId): Record<string, string> | undefined {
  const texturePaths = LAYOUT_PROP_TEXTURES[layoutId];
  return texturePaths ? { ...texturePaths } : undefined;
}

export function getGeneratedSceneTexturePaths(): string[] {
  return Array.from(new Set([
    ...Object.values(VILLAGE_FLOOR_TEXTURES),
    ...Object.values(FIELD_FLOOR_TEXTURES),
    ...Object.values(LAYOUT_PROP_TEXTURES).flatMap((texturePaths) => (
      texturePaths ? Object.values(texturePaths) : []
    )),
    COMMON_TEXTURES.portalTexturePath,
  ]));
}

export function getDeathGraveTexturePath(): string {
  return COMMON_TEXTURES.graveTexturePath;
}

export function getSceneAssetBundle(themeId: SceneThemeId, layoutId: SceneLayoutId, mainLocation?: string): SceneAssetBundle {
  const floorTexturePath = mainLocation ? getSceneFloorTexturePath(mainLocation, themeId) : FIELD_FLOOR_TEXTURES[themeId];
  const propTexturePaths = getScenePropTexturePaths(layoutId);

  return {
    layoutId,
    mapJsonPath: getSceneMapJsonPath(layoutId),
    terrainTexturePath: getSceneTerrainTexturePath(themeId),
    ...(floorTexturePath ? { floorTexturePath } : {}),
    propsTexturePath: COMMON_TEXTURES.propsTexturePath,
    ...(propTexturePaths ? { propTexturePaths } : {}),
    playerTexturePath: COMMON_TEXTURES.playerTexturePath,
    remotePlayerTexturePath: COMMON_TEXTURES.remotePlayerTexturePath,
    npcTexturePath: COMMON_TEXTURES.npcTexturePath,
    portalTexturePath: COMMON_TEXTURES.portalTexturePath,
    encounterTexturePath: COMMON_TEXTURES.encounterTexturePath,
    license: "generated",
    attribution: "AI-generated actor, scene, and facility sprites with handmade SVG placeholder map assets.",
  };
}

export function getCommonSceneTexturePaths(): string[] {
  return Array.from(new Set([
    ...Object.values(COMMON_TEXTURES),
    ...Object.values(PLAYER_AVATAR_TEXTURES),
    ...Object.values(NPC_TEXTURES),
    ...getGeneratedSceneTexturePaths(),
  ]));
}

export function getNpcTexturePath(layoutId: SceneLayoutId, hasBoss: boolean): string {
  if (hasBoss || layoutId === "boss_arena") {
    return NPC_TEXTURES.bossSeer;
  }

  if (layoutId === "shop") {
    return NPC_TEXTURES.blacksmithMerchant;
  }

  if (layoutId === "inn") {
    return NPC_TEXTURES.innkeeper;
  }

  if (layoutId === "skill_shop") {
    return NPC_TEXTURES.skillMentor;
  }

  if (layoutId === "plaza") {
    return NPC_TEXTURES.townHerald;
  }

  if (layoutId === "town_gate") {
    return NPC_TEXTURES.gateWarden;
  }

  return NPC_TEXTURES.rangerGuide;
}

export function isPlayerAvatarId(value: unknown): value is PlayerAvatarId {
  return typeof value === "string" && PLAYER_AVATAR_IDS.includes(value as PlayerAvatarId);
}

export function getPlayerAvatarTexturePath(avatarId: string): string {
  return isPlayerAvatarId(avatarId)
    ? PLAYER_AVATAR_TEXTURES[avatarId]
    : PLAYER_AVATAR_TEXTURES[DEFAULT_PLAYER_AVATAR_ID];
}

export function getSceneAssetManifest(): { jsonPaths: string[]; texturePaths: string[] } {
  return {
    jsonPaths: SCENE_LAYOUT_IDS.map((layoutId) => getSceneMapJsonPath(layoutId)),
    texturePaths: [
      ...SCENE_THEME_IDS.map((themeId) => getSceneTerrainTexturePath(themeId)),
      ...getCommonSceneTexturePaths(),
      ...getEnemyTexturePaths(),
      ...getEquipmentTexturePaths(),
    ],
  };
}
