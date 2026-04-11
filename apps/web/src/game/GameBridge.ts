import type Phaser from "phaser";
import type { DialogueNpc, EncounterZone, Facing, PlayerSave, PresenceState, WorldContent } from "@rpg/game-core";
import type { FieldPrompt, OverlayMode } from "../gameplay";
import type { OverworldScene } from "./OverworldScene";

export type ManagedSceneKey = "loading" | "login" | "overworld";

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
  private activeScene: ManagedSceneKey = "loading";

  private constructor(
    private readonly game: Phaser.Game,
    private readonly overworldScene: OverworldScene,
    private readonly callbacks: BridgeCallbacks,
  ) {}

  static async create(container: HTMLElement, callbacks: BridgeCallbacks): Promise<GameBridge> {
    const [
      PhaserModule,
      { BootScene },
      { LoadingScene },
      { LoginScene },
      { OverworldScene },
    ] = await Promise.all([
      import("phaser"),
      import("./BootScene"),
      import("./LoadingScene"),
      import("./LoginScene"),
      import("./OverworldScene"),
    ]);

    const loadingScene = new LoadingScene();
    const loginScene = new LoginScene();
    const overworldScene = new OverworldScene();
    const game = new PhaserModule.default.Game({
      type: PhaserModule.default.AUTO,
      parent: container,
      width: 1024,
      height: 768,
      backgroundColor: "#1f2937",
      scene: [new BootScene(), loadingScene, loginScene, overworldScene],
      render: {
        pixelArt: true,
      },
    });

    const bridge = new GameBridge(game, overworldScene, callbacks);
    bridge.syncGlobalCapture(bridge.activeScene);
    return bridge;
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

    this.syncGlobalCapture(nextScene);
    this.game.scene.start(nextScene);
    this.activeScene = nextScene;
  }

  private syncGlobalCapture(activeScene: ManagedSceneKey): void {
    const keyboardManager = this.game.input.keyboard;
    if (!keyboardManager) {
      return;
    }

    if (shouldDisableGlobalKeyboardCapture(activeScene)) {
      keyboardManager.preventDefault = false;
      this.overworldScene.input.keyboard?.resetKeys();
      return;
    }

    keyboardManager.preventDefault = true;
  }
}

export async function createGameBridge(container: HTMLElement, callbacks: BridgeCallbacks): Promise<GameBridge> {
  return GameBridge.create(container, callbacks);
}

export function shouldDisableGlobalKeyboardCapture(activeScene: ManagedSceneKey): boolean {
  return activeScene !== "overworld";
}
