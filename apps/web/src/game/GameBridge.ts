import Phaser from "phaser";
import type { DialogueNpc, EncounterZone, Facing, PlayerSave, PresenceState, WorldContent } from "@rpg/game-core";
import { BootScene } from "./BootScene";
import { OverworldScene } from "./OverworldScene";

type BridgeCallbacks = {
  canMove: () => boolean;
  onPositionChange: (x: number, y: number, facing: Facing) => void;
  onSceneChange: (locationKey: string) => void;
  onInteractNpc: (npc: DialogueNpc) => void;
  onEncounter: (zone: EncounterZone) => void;
};

export class GameBridge {
  private readonly game: Phaser.Game;
  private readonly overworldScene = new OverworldScene();

  constructor(container: HTMLElement, private readonly callbacks: BridgeCallbacks) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: 1024,
      height: 768,
      backgroundColor: "#1f2937",
      scene: [new BootScene(), this.overworldScene],
      render: {
        pixelArt: true,
      },
    });
  }

  sync(world: WorldContent | null, player: PlayerSave | null, nearbyPlayers: PresenceState[]): void {
    if (!world || !player) {
      return;
    }

    this.overworldScene.attach(world, player, this.callbacks);
    this.overworldScene.sync(player, nearbyPlayers);
  }

  destroy(): void {
    this.game.destroy(true);
  }
}
