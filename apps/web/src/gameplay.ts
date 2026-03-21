import type { BattleResolution, PlayerSave, WorldContent } from "@rpg/game-core";

export type OverlayMode = "explore" | "dialogue" | "battle";
export type FieldPromptKind = "idle" | "portal" | "npc" | "encounter" | "dialogue" | "battle";
export type FieldPromptTone = "neutral" | "accent" | "danger";

export type FieldPrompt = {
  kind: FieldPromptKind;
  title: string;
  body: string;
  actionLabel: string;
  tone: FieldPromptTone;
};

export type BattleReport = {
  enemyName: string;
  outcome: NonNullable<BattleResolution["state"]["outcome"]>;
  title: string;
  summary: string;
  lines: string[];
  turnNumber: number;
};

export function deriveOverlayMode(params: { battle: unknown; dialogue: unknown }): OverlayMode {
  if (params.battle) {
    return "battle";
  }
  if (params.dialogue) {
    return "dialogue";
  }
  return "explore";
}

export function createBattleReport(resolution: BattleResolution): BattleReport | null {
  const outcome = resolution.state.outcome;
  if (!resolution.state.finished || !outcome) {
    return null;
  }

  const enemyName = resolution.state.enemy.name;
  const title =
    outcome === "player_win"
      ? `${enemyName} 제압`
      : outcome === "enemy_win"
        ? `${enemyName}에게 패배`
        : `${enemyName} 전투 종료`;
  const summary =
    outcome === "player_win"
      ? "보상을 정산하고 다음 탐험으로 이어갈 수 있습니다."
      : outcome === "enemy_win"
        ? "부활 후 오버월드 위치와 실시간 씬을 다시 맞췄습니다."
        : "전투가 무승부로 종료되었습니다.";

  return {
    enemyName,
    outcome,
    title,
    summary,
    lines: resolution.logs.slice(-5),
    turnNumber: Math.max(0, resolution.state.turnNumber - 1),
  };
}

export function didSceneChange(world: WorldContent, previousPlayer: PlayerSave, nextPlayer: PlayerSave): boolean {
  const previousSceneId = world.locations[previousPlayer.locationKey]?.scene.sceneId;
  const nextSceneId = world.locations[nextPlayer.locationKey]?.scene.sceneId;
  return Boolean(previousSceneId && nextSceneId && previousSceneId !== nextSceneId);
}
