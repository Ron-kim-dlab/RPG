import type Phaser from "phaser";
import type {
  DeathGraveState,
  DialogueNpc,
  Facing,
  FieldMonsterState,
  PlayerSave,
  PresenceState,
  WorldContent,
} from "@rpg/game-core";
import type { FieldPrompt, OverlayMode } from "../gameplay";
import type { OverworldScene } from "./OverworldScene";
import { INITIAL_SCENE, shouldDisableGlobalKeyboardCapture, type ManagedSceneKey } from "./sceneFlow";

type BridgeCallbacks = {
  canMove: () => boolean;
  isGameplayInputBlocked: () => boolean;
  getPlayerAvatarId: () => string;
  getOverlayMode: () => OverlayMode;
  hasPendingLocationStory: () => boolean;
  onPositionChange: (x: number, y: number, facing: Facing) => void;
  onSceneChange: (locationKey: string) => void;
  onOpenLocationStory: () => void;
  onInteractNpc: (npc: DialogueNpc) => void;
  onInteractGrave: (grave: DeathGraveState) => void;
  onFieldMonsterContact: (monster: FieldMonsterState) => void;
  onFieldPromptChange: (prompt: FieldPrompt) => void;
};

export class GameBridge {
  private activeScene: ManagedSceneKey = INITIAL_SCENE;

  private constructor(
    private readonly game: Phaser.Game,
    private readonly overworldScene: OverworldScene,
    private readonly callbacks: BridgeCallbacks,
  ) {}

  static async create(container: HTMLElement, callbacks: BridgeCallbacks): Promise<GameBridge> {
    let notifyBootComplete: (() => void) | null = null;
    const bootCompleted = new Promise<void>((resolve) => {
      notifyBootComplete = resolve;
    });

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
    const bootScene = new BootScene(() => {
      notifyBootComplete?.();
    });
    const game = new PhaserModule.default.Game({
      type: PhaserModule.default.AUTO,
      parent: container,
      width: 1024,
      height: 768,
      backgroundColor: "#1f2937",
      scene: [bootScene, loadingScene, loginScene, overworldScene],
      render: {
        pixelArt: true,
      },
    });

    await bootCompleted;

    const bridge = new GameBridge(game, overworldScene, callbacks);
    bridge.syncGlobalCapture(bridge.activeScene);
    return bridge;
  }

  sync(
    world: WorldContent | null,
    player: PlayerSave | null,
    nearbyPlayers: PresenceState[],
    fieldMonsters: FieldMonsterState[],
    deathGraves: DeathGraveState[],
  ): void {
    if (!world) {
      return;
    }

    if (!player) {
      this.ensureScene("login");
      return;
    }

    this.overworldScene.attach(world, player, this.callbacks);
    this.overworldScene.sync(player, nearbyPlayers, fieldMonsters, deathGraves);
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
    this.syncGlobalCapture(nextScene);
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
