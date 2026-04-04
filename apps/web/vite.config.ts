import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) {
            return "phaser";
          }

          if (id.includes("node_modules/socket.io-client")) {
            return "realtime";
          }

          if (id.includes("/packages/game-core/")) {
            return "game-core";
          }

          return undefined;
        },
      },
    },
  },
});
