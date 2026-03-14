import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  outDir: "dist",
  dts: true,
  clean: true,
  noExternal: ["@rpg/game-core"],
});
