import type { AddressInfo } from "node:net";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { describe, expect, it } from "vitest";
import type { PresenceState, WorldContent } from "@rpg/game-core";
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

function onceEvent<T>(socket: ClientSocket, eventName: string, timeoutMs = 5_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handleEvent);
      reject(new Error(`Timed out waiting for ${eventName}.`));
    }, timeoutMs);

    const handleEvent = (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload as T);
    };

    socket.once(eventName, handleEvent);
  });
}

async function connectClient(baseUrl: string, token: string): Promise<ClientSocket> {
  const socket = createClient(baseUrl, { auth: { token } });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
  return socket;
}

async function waitForTick(duration = 120): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, duration));
}

describe("realtime presence", () => {
  it("shares joins, snapshots, chat, and leave events inside the same scene", async () => {
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

    const sockets: ClientSocket[] = [];

    try {
      const socketA = await connectClient(baseUrl, signToken(env, "hero-a"));
      const socketB = await connectClient(baseUrl, signToken(env, "hero-b"));
      sockets.push(socketA, socketB);

      const snapshots: PresenceState[][] = [];
      socketA.on("presence:snapshot", (snapshot) => snapshots.push(snapshot as PresenceState[]));

      const snapshotB = onceEvent<PresenceState[]>(socketB, "presence:snapshot");
      socketB.emit("presence:join", { sceneId: "scene-start", x: 50, y: 60, facing: "left" });
      await snapshotB;

      const joinedByB = onceEvent<PresenceState>(socketB, "presence:joined");
      const snapshotA = onceEvent<PresenceState[]>(socketA, "presence:snapshot");
      socketA.emit("presence:join", { sceneId: "scene-start", x: 10, y: 20, facing: "down" });
      const [joinedPresence] = await Promise.all([joinedByB, snapshotA]);

      expect(joinedPresence.username).toBe("hero-a");
      expect(snapshots.at(-1)?.map((presence) => presence.username).sort()).toEqual(["hero-a", "hero-b"]);

      const chatMessage = onceEvent<{ text: string }>(socketB, "chat:message");
      socketA.emit("chat:send", { text: "안녕!" });
      expect((await chatMessage).text).toBe("안녕!");

      const leftEvent = onceEvent<string>(socketB, "presence:left");
      socketA.disconnect();
      expect(await leftEvent).toBe("hero-a");
    } finally {
      sockets.forEach((socket) => socket.disconnect());
      await new Promise<void>((resolve, reject) => context.httpServer.close((error) => (error ? reject(error) : resolve())));
    }
  }, 15_000);

  it("keeps the replacement socket active when the same user reconnects", async () => {
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

    const sockets: ClientSocket[] = [];

    try {
      const observer = await connectClient(baseUrl, signToken(env, "hero-b"));
      const firstSocket = await connectClient(baseUrl, signToken(env, "hero-a"));
      sockets.push(observer, firstSocket);

      const observerSnapshot = onceEvent<PresenceState[]>(observer, "presence:snapshot");
      observer.emit("presence:join", { sceneId: "scene-start", x: 50, y: 60, facing: "left" });
      await observerSnapshot;

      const firstSnapshot = onceEvent<PresenceState[]>(firstSocket, "presence:snapshot");
      const joinedByObserver = onceEvent<PresenceState>(observer, "presence:joined");
      firstSocket.emit("presence:join", { sceneId: "scene-start", x: 10, y: 20, facing: "down" });
      const [initialJoin] = await Promise.all([joinedByObserver, firstSnapshot]);
      expect(initialJoin.username).toBe("hero-a");

      let leftUsername: string | null = null;
      observer.on("presence:left", (username) => {
        leftUsername = String(username);
      });

      const replacementSocket = await connectClient(baseUrl, signToken(env, "hero-a"));
      sockets.push(replacementSocket);

      const replacementSnapshot = onceEvent<PresenceState[]>(replacementSocket, "presence:snapshot");
      const updatePromise = onceEvent<PresenceState>(observer, "presence:update");
      replacementSocket.emit("presence:join", { sceneId: "scene-start", x: 88, y: 99, facing: "right" });
      const [update, replacementRoom] = await Promise.all([updatePromise, replacementSnapshot]);

      expect(update.username).toBe("hero-a");
      expect(update.x).toBe(88);
      expect(update.facing).toBe("right");
      expect(replacementRoom.some((presence) => presence.username === "hero-a")).toBe(true);

      firstSocket.disconnect();

      const chatPromise = onceEvent<{ text: string }>(observer, "chat:message");
      replacementSocket.emit("chat:send", { text: "복귀 완료" });
      const chat = await chatPromise;
      await waitForTick();

      expect(chat.text).toBe("복귀 완료");
      expect(leftUsername).toBeNull();
    } finally {
      sockets.forEach((socket) => socket.disconnect());
      await new Promise<void>((resolve, reject) => context.httpServer.close((error) => (error ? reject(error) : resolve())));
    }
  }, 15_000);
});
