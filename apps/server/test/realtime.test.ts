import type { AddressInfo } from "node:net";
import { io as createClient } from "socket.io-client";
import { describe, expect, it } from "vitest";
import type { WorldContent } from "@rpg/game-core";
import { createStarterPlayer } from "@rpg/game-core";
import { createAppContext } from "../src/app";
import { signToken } from "../src/http/auth";
import { MemoryUserRepository } from "../src/storage/memoryRepository";

function createWorld(): WorldContent {
  return {
    startLocationKey: "시작의 마을::마을 입구",
    locations: {},
    equipment: [],
    skills: [],
    tactics: [],
    enemies: {},
    enemiesByLocation: {},
  };
}

describe("realtime presence", () => {
  it("shares presence snapshots and chat in the same scene", async () => {
    const repository = new MemoryUserRepository();
    const world = createWorld();
    const env = {
      runtimeMode: "test" as const,
      port: 0,
      clientOrigin: "http://localhost:5173",
      jwtSecret: "0123456789abcdef0123456789abcdef",
      jwtExpiresIn: "7d",
      passwordHashRounds: 10,
      storageDriver: "memory" as const,
    };

    await repository.saveAccount({
      username: "hero-a",
      passwordHash: "plain",
      player: createStarterPlayer("hero-a", world),
    });
    await repository.saveAccount({
      username: "hero-b",
      passwordHash: "plain",
      player: createStarterPlayer("hero-b", world),
    });

    const context = await createAppContext({
      env,
      repository,
      worldLoader: async () => world,
    });

    await new Promise<void>((resolve) => context.httpServer.listen(0, resolve));
    const address = context.httpServer.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const tokenA = signToken(env, "hero-a");
    const tokenB = signToken(env, "hero-b");

    const socketA = createClient(baseUrl, { auth: { token: tokenA } });
    const socketB = createClient(baseUrl, { auth: { token: tokenB } });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        socketA.once("connect", () => resolve());
        socketA.once("connect_error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        socketB.once("connect", () => resolve());
        socketB.once("connect_error", reject);
      }),
    ]);

    const snapshotPromise = new Promise<unknown[]>((resolve) => {
      socketB.on("presence:snapshot", (snapshot) => resolve(snapshot));
    });
    const chatPromise = new Promise<{ text: string }>((resolve) => {
      socketB.on("chat:message", (message) => resolve(message));
    });

    socketA.emit("presence:join", { sceneId: "scene-start", x: 10, y: 20, facing: "down" });
    socketB.emit("presence:join", { sceneId: "scene-start", x: 50, y: 60, facing: "left" });
    socketA.emit("chat:send", { text: "안녕!" });

    const snapshot = await snapshotPromise;
    const chat = await chatPromise;

    expect(snapshot.length).toBeGreaterThan(0);
    expect(chat.text).toBe("안녕!");

    socketA.disconnect();
    socketB.disconnect();
    await new Promise<void>((resolve, reject) => context.httpServer.close((error) => (error ? reject(error) : resolve())));
  }, 10_000);
});
