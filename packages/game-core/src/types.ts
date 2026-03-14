export type Facing = "up" | "down" | "left" | "right";

export type NumericStat = "hp" | "mp" | "attack" | "defense" | "speed" | "accuracy";
export type FormulaSource = "none" | "self_attack" | "target_attack";
export type EffectTrigger = "on_use" | "on_turn_start" | "on_turn_end" | "on_hit";
export type EffectTarget = "self" | "opponent";

export type EffectFormula = {
  source: FormulaSource;
  flat?: number;
  scale?: number;
  minimum?: number;
  rounding?: "round" | "floor" | "ceil";
};

export type DamageEffect = {
  type: "damage";
  trigger: EffectTrigger;
  target: EffectTarget;
  repeat?: number;
  formula: EffectFormula;
};

export type HealEffect = {
  type: "heal";
  trigger: EffectTrigger;
  target: EffectTarget;
  clampToMax?: boolean;
  formula: EffectFormula;
};

export type StatModifierEffect = {
  type: "stat_modifier";
  trigger: EffectTrigger;
  target: EffectTarget;
  stat: NumericStat;
  operation: "add" | "multiply";
  value: number;
  minimum?: number;
  durationTurns?: number;
};

export type EffectDefinition = DamageEffect | HealEffect | StatModifierEffect;

export type SkillDefinition = {
  id: string;
  name: string;
  description: string;
  village?: string;
  cost: number;
  manaCost: number;
  accuracy: number;
  effects: EffectDefinition[];
};

export type EquipmentDefinition = {
  id: string;
  name: string;
  village?: string;
  cost: number;
  attackBonus: number;
  manaCost: number;
  accuracy: number;
  description: string;
  effects: EffectDefinition[];
};

export type TacticDefinition = {
  id: string;
  name: string;
  description: string;
  type: "charge" | "multi" | "guard_break" | "evade";
  hits?: number;
  coefficient?: number;
  durationTurns?: number;
};

export type EnemyDefinition = {
  id: string;
  name: string;
  currentHp?: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  accuracy: number;
  mana: number;
  experienceReward: number;
  coinReward: number;
  specialAbility?: SkillDefinition;
  specialChance?: number;
  isBoss?: boolean;
};

export type ScenePortal = {
  id: string;
  label: string;
  toLocationKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DialogueNpc = {
  id: string;
  name: string;
  x: number;
  y: number;
  lines: string[];
};

export type EncounterZone = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enemyIds: string[];
};

export type SceneDefinition = {
  sceneId: string;
  width: number;
  height: number;
  backgroundColor: string;
  spawn: { x: number; y: number };
  portals: ScenePortal[];
  npcs: DialogueNpc[];
  encounterZones: EncounterZone[];
};

export type LocationConnection = {
  toLocationKey: string;
  main: string;
  sub: string;
  branch?: string;
};

export type LocationNode = {
  key: string;
  mainLocation: string;
  subLocation: string;
  story: string[];
  bossName?: string;
  connections: LocationConnection[];
  scene: SceneDefinition;
};

export type StoryState = {
  completed: boolean;
  currentIndex: number;
};

export type PlayerSave = {
  version: 2;
  username: string;
  coins: number;
  experience: number;
  level: number;
  currentHp: number;
  currentMp: number;
  attack: number;
  defense: number;
  speed: number;
  accuracy: number;
  locationKey: string;
  position: { x: number; y: number };
  facing: Facing;
  visitedMainLocations: string[];
  visitedLocationKeys: string[];
  storyState: Record<string, StoryState>;
  ownedEquipmentIds: string[];
  equippedEquipmentIds: string[];
  learnedSkillIds: string[];
  learnedTacticIds: string[];
  questCompletion: Record<string, boolean>;
  flags: {
    demonLordDefeated: boolean;
  };
};

export type PresenceState = {
  username: string;
  sceneId: string;
  x: number;
  y: number;
  facing: Facing;
  color: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  username: string;
  sceneId: string;
  text: string;
  createdAt: string;
};

export type WorldContent = {
  startLocationKey: string;
  locations: Record<string, LocationNode>;
  equipment: EquipmentDefinition[];
  skills: SkillDefinition[];
  tactics: TacticDefinition[];
  enemies: Record<string, EnemyDefinition>;
  enemiesByLocation: Record<string, string[]>;
};

export type CombatantRuntime = {
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  accuracy: number;
};

export type BattleAction =
  | { kind: "attack" }
  | { kind: "normal" }
  | { kind: "defend" }
  | { kind: "skill"; skillId: string }
  | { kind: "tactic"; tacticId: string };

export type BattleState = {
  id: string;
  enemyId: string;
  player: CombatantRuntime;
  enemy: CombatantRuntime;
  isBoss: boolean;
  turnNumber: number;
  charged: boolean;
  evadeNext: boolean;
  guardBreakTurns: number;
  finished: boolean;
  outcome?: "player_win" | "enemy_win" | "draw";
  log: string[];
};

export type BattleResolution = {
  player: PlayerSave;
  state: BattleState;
  logs: string[];
  requiresFollowUpAction: boolean;
};

export type LegacyMapLocation = {
  스토리?: string[];
  보스?: string;
  연결?: Array<string | { main: string; sub: string; branch?: string }>;
};

export type LegacyMapData = Record<string, Record<string, LegacyMapLocation>>;

export type LegacySkillData = Array<{
  이름: string;
  판매마을?: string;
  cost: number;
  MP소모: number;
  명중률: number;
  설명?: string;
  능력: string;
}>;

export type LegacyEquipmentData = Array<{
  이름: string;
  판매마을?: string;
  cost: number;
  공격력?: number;
  MP소모?: number;
  명중률?: number;
  설명?: string;
  능력?: { 이름: string; MP소모: number; 설명?: string; 능력: string } | string | null;
}>;

export type LegacyEnemyUnit = {
  이름: string;
  체력: number;
  공격력: number;
  경험치: number;
  MP: number;
  방어력: number;
  속도: number;
  명중률: number;
  특수능력?: { 이름: string; MP소모: number; 능력: string } | null;
};

export type LegacyMonsterData = Record<string, Record<string, LegacyEnemyUnit[]>>;

export type LegacyBossData = Record<
  string,
  {
    체력: number;
    공격력: number;
    경험치: number;
    MP: number;
    방어력: number;
    속도: number;
    명중률: number;
    특수능력?: { 이름: string; MP소모: number; 능력: string } | null;
  }
>;

export type LegacyTacticData = Array<{
  이름: string;
  설명: string;
  효과: string;
  타수?: number;
  계수?: number;
  턴수?: number;
}>;
