import Phaser from "phaser";
import { getSceneAssetManifest } from "@rpg/game-core";
import { INITIAL_SCENE } from "./sceneFlow";

export class BootScene extends Phaser.Scene {
  constructor(private readonly onBootComplete: () => void = () => {}) {
    super("boot");
  }

  preload(): void {
    const manifest = getSceneAssetManifest();
    manifest.jsonPaths.forEach((path) => {
      this.load.json(path, path);
    });

    manifest.texturePaths.forEach((path) => {
      if (path.endsWith(".svg")) {
        this.load.svg(path, path);
        return;
      }

      this.load.image(path, path);
    });
  }

  create(): void {
    this.scene.start(INITIAL_SCENE);
    this.onBootComplete();
  }
}
