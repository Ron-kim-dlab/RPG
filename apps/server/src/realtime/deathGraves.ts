import type { DeathGraveState } from "@rpg/game-core";

export const DEATH_GRAVE_TTL_MS = 5 * 60 * 1000;

function copyGrave(grave: DeathGraveState): DeathGraveState {
  return { ...grave };
}

export class DeathGraveManager {
  private readonly gravesByScene = new Map<string, DeathGraveState[]>();
  private nextGraveId = 1;

  constructor(private readonly now: () => number = () => Date.now()) {}

  getSceneGraves(sceneId: string): DeathGraveState[] {
    this.cleanupExpired();
    return (this.gravesByScene.get(sceneId) ?? []).map(copyGrave);
  }

  createGrave(params: {
    sceneId: string;
    playerName: string;
    defeatedBy: string;
    x: number;
    y: number;
  }): { grave: DeathGraveState; changedSceneIds: string[] } {
    this.cleanupExpired();

    const createdAtMs = this.now();
    const grave: DeathGraveState = {
      id: `death-grave-${this.nextGraveId++}`,
      sceneId: params.sceneId,
      playerName: params.playerName,
      defeatedBy: params.defeatedBy,
      x: params.x,
      y: params.y,
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: new Date(createdAtMs + DEATH_GRAVE_TTL_MS).toISOString(),
    };
    const sceneGraves = this.gravesByScene.get(params.sceneId) ?? [];
    sceneGraves.push(grave);
    this.gravesByScene.set(params.sceneId, sceneGraves);

    return {
      grave: copyGrave(grave),
      changedSceneIds: [params.sceneId],
    };
  }

  cleanupExpired(): string[] {
    const now = this.now();
    const changedSceneIds: string[] = [];
    this.gravesByScene.forEach((graves, sceneId) => {
      const activeGraves = graves.filter((grave) => Date.parse(grave.expiresAt) > now);
      if (activeGraves.length === graves.length) {
        return;
      }
      changedSceneIds.push(sceneId);
      if (activeGraves.length === 0) {
        this.gravesByScene.delete(sceneId);
        return;
      }
      this.gravesByScene.set(sceneId, activeGraves);
    });

    return changedSceneIds;
  }
}
