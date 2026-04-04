import Phaser from "phaser";
import type { DialogueNpc, EncounterZone, Facing, PlayerSave, PresenceState, WorldContent } from "@rpg/game-core";
import type { FieldPrompt, OverlayMode } from "../gameplay";
import { BootScene } from "./BootScene";
import { LoadingScene } from "./LoadingScene";
import { LoginScene } from "./LoginScene";
import { OverworldScene } from "./OverworldScene";

type BridgeCallbacks = {
  canMove: () => boolean;
  isGameplayInputBlocked: () => boolean;
  getOverlayMode: () => OverlayMode;
  hasPendingLocationStory: () => boolean;
  onPositionChange: (x: number, y: number, facing: Facing) => void;
  onSceneChange: (locationKey: string) => void;
  onOpenLocationStory: () => void;
  onInteractNpc: (npc: DialogueNpc) => void;
  onEncounter: (zone: EncounterZone) => void;
  onFieldPromptChange: (prompt: FieldPrompt) => void;
};

export class GameBridge {
  private readonly game: Phaser.Game;
  private readonly loadingScene = new LoadingScene();
  private readonly loginScene = new LoginScene();
  private readonly overworldScene = new OverworldScene();
  private activeScene: "loading" | "login" | "overworld" = "loading";

  constructor(container: HTMLElement, private readonly callbacks: BridgeCallbacks) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: 1024,
      height: 768,
      backgroundColor: "#1f2937",
      scene: [new BootScene(), this.loadingScene, this.loginScene, this.overworldScene],
      render: {
        pixelArt: true,
      },
    });
  }

  sync(world: WorldContent | null, player: PlayerSave | null, nearbyPlayers: PresenceState[]): void {
    if (!world) {
      return;
    }

    if (!player) {
      this.ensureScene("login");
      return;
    }

    this.overworldScene.attach(world, player, this.callbacks);
    this.overworldScene.sync(player, nearbyPlayers);
    this.ensureScene("overworld");
  }

  destroy(): void {
    this.game.destroy(true);
  }

  private ensureScene(nextScene: "loading" | "login" | "overworld"): void {
    if (this.activeScene === nextScene) {
      return;
    }

    this.game.scene.start(nextScene);
    this.activeScene = nextScene;
  }
}
