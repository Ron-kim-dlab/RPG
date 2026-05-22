import type { AddressInfo } from "node:net";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { describe, expect, it } from "vitest";
import type { DeathGraveState, FieldMonsterClaimResult, FieldMonsterState, PresenceState, WorldContent } from "@rpg/game-core";
import { createStarterPlayer, DEFAULT_PLAYER_AVATAR_ID } from "@rpg/game-core";
import { createAppContext } from "../src/app";
import { signToken } from "../src/http/auth";
import { MemoryUserRepository } from "../src/storage/memoryRepository";

function createWorld(): WorldContent {
  const startLocationKey = "시작의 마을::마을 입구";
  return {
    startLocationKey,
    locations: {
      [startLocationKey]: {
        key: startLocationKey,
        mainLocation: "시작의 마을",
        subLocation: "마을 입구",
        story: [],
        connections: [],
        scene: {
          sceneId: "scene-start",
          themeId: "village",
          width: 1024,
          height: 768,
          tileSize: 32,
          backgroundColor: "#10231b",
          spawn: { x: 512, y: 636 },
          portals: [],
          npcs: [],
          encounterZones: [],
          collisionZones: [],
          assets: {
            layoutId: "town_gate",
            mapJsonPath: "/maps/test.json",
            terrainTexturePath: "/terrain.svg",
            propsTexturePath: "/props.svg",
            playerTexturePath: "/player.svg",
            remotePlayerTexturePath: "/remote.svg",
            npcTexturePath: "/npc.svg",
            portalTexturePath: "/portal.svg",
            encounterTexturePath: "/encounter.svg",
            license: "placeholder",
            attribution: "test",
          },
        },
      },
    },
    equipment: [],
    skills: [],
    tactics: [],
    enemies: {},
    enemiesByLocation: {},
  };
}

function createFieldMonsterWorld(options: { boss?: boolean } = {}): WorldContent {
  const startLocationKey = "field::monster-zone";
  const slimeId = "enemy-slime";
  const wispId = "enemy-wisp";
  const bossId = "boss-warden";
  const enemyIds = options.boss ? [bossId] : [slimeId, wispId];
  return {
    startLocationKey,
    locations: {
      [startLocationKey]: {
        key: startLocationKey,
        mainLocation: "field",
        subLocation: "monster-zone",
        story: [],
        bossName: options.boss ? "Warden" : undefined,
        connections: [],
        scene: {
          sceneId: "scene-field",
          themeId: "forest",
          width: 1024,
          height: 768,
          tileSize: 32,
          backgroundColor: "#10231b",
          spawn: { x: 72, y: 72 },
          portals: [
            {
              id: "portal-safe",
              label: "safe",
              toLocationKey: startLocationKey,
              x: 32,
              y: 300,
              width: 72,
              height: 112,
            },
          ],
          npcs: [
            {
              id: "npc-keeper",
              name: "Keeper",
              x: 840,
              y: 240,
              texturePath: "/npc.svg",
              lines: ["Stay alert."],
            },
          ],
          encounterZones: [
            {
              id: "encounter-field",
              x: 180,
              y: 170,
              width: 560,
              height: 420,
              enemyIds,
            },
          ],
          collisionZones: [],
          assets: {
            layoutId: options.boss ? "boss_arena" : "field",
            mapJsonPath: "/maps/test.json",
            terrainTexturePath: "/terrain.svg",
            propsTexturePath: "/props.svg",
            playerTexturePath: "/player.svg",
            remotePlayerTexturePath: "/remote.svg",
            npcTexturePath: "/npc.svg",
            portalTexturePath: "/portal.svg",
            encounterTexturePath: "/encounter.svg",
            license: "placeholder",
            attribution: "test",
          },
        },
      },
    },
    equipment: [],
    skills: [],
    tactics: [],
    enemies: {
      [slimeId]: {
        id: slimeId,
        name: "Slime",
        texturePath: "/slime.svg",
        spawnRate: 1,
        maxHp: 10,
        attack: 2,
        defense: 0,
        speed: 1,
        accuracy: 1,
        mana: 0,
        experienceReward: 1,
        coinReward: 1,
      },
      [wispId]: {
        id: wispId,
        name: "Wisp",
        texturePath: "/wisp.svg",
        spawnRate: 3,
        maxHp: 12,
        attack: 3,
        defense: 0,
        speed: 2,
        accuracy: 1,
        mana: 0,
        experienceReward: 2,
        coinReward: 2,
      },
      [bossId]: {
        id: bossId,
        name: "Warden",
        texturePath: "/warden.svg",
        maxHp: 40,
        attack: 6,
        defense: 2,
        speed: 1,
        accuracy: 1,
        mana: 0,
        experienceReward: 10,
        coinReward: 10,
        isBoss: true,
      },
    },
    enemiesByLocation: {
      [startLocationKey]: enemyIds,
    },
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

function emitAck<T>(socket: ClientSocket, eventName: string, payload: unknown, timeoutMs = 5_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${eventName} ack.`));
    }, timeoutMs);

    socket.emit(eventName, payload, (result: unknown) => {
      clearTimeout(timer);
      resolve(result as T);
    });
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

function monsterHitbox(monster: FieldMonsterState): { x: number; y: number; width: number; height: number } {
  return {
    x: monster.x - 18,
    y: monster.y - 18,
    width: 36,
    height: 36,
  };
}

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
  );
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
      socketB.emit("presence:join", { sceneId: "scene-start", x: 50, y: 60, facing: "left", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      await snapshotB;

      const joinedByB = onceEvent<PresenceState>(socketB, "presence:joined");
      const snapshotA = onceEvent<PresenceState[]>(socketA, "presence:snapshot");
      socketA.emit("presence:join", { sceneId: "scene-start", x: 10, y: 20, facing: "down", avatarId: DEFAULT_PLAYER_AVATAR_ID });
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

  it("shares temporary death graves inside the same scene", async () => {
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

      const snapshotB = onceEvent<DeathGraveState[]>(socketB, "death-graves:snapshot");
      socketB.emit("presence:join", { sceneId: "scene-start", x: 50, y: 60, facing: "left", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      expect(await snapshotB).toEqual([]);

      const snapshotA = onceEvent<DeathGraveState[]>(socketA, "death-graves:snapshot");
      socketA.emit("presence:join", { sceneId: "scene-start", x: 120, y: 140, facing: "down", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      await snapshotA;

      const graveUpdate = onceEvent<DeathGraveState[]>(socketB, "death-graves:update");
      socketA.emit("death-graves:create", { sceneId: "scene-start", x: 120, y: 140, defeatedBy: "Slime" });
      const graves = await graveUpdate;

      expect(graves).toHaveLength(1);
      expect(graves[0]).toMatchObject({
        sceneId: "scene-start",
        playerName: "hero-a",
        defeatedBy: "Slime",
        x: 120,
        y: 140,
      });
      expect(Date.parse(graves[0]!.expiresAt) - Date.parse(graves[0]!.createdAt)).toBe(5 * 60 * 1000);
    } finally {
      sockets.forEach((socket) => socket.disconnect());
      await new Promise<void>((resolve, reject) => context.httpServer.close((error) => (error ? reject(error) : resolve())));
    }
  }, 15_000);

  it("ignores malformed presence and chat payloads", async () => {
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
      const actor = await connectClient(baseUrl, signToken(env, "hero-a"));
      sockets.push(observer, actor);

      const observerSnapshot = onceEvent<PresenceState[]>(observer, "presence:snapshot");
      observer.emit("presence:join", { sceneId: "scene-start", x: 50, y: 60, facing: "left", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      await observerSnapshot;

      let joined: PresenceState | null = null;
      observer.on("presence:joined", (presence) => {
        joined = presence as PresenceState;
      });
      actor.emit("presence:join", { sceneId: "unknown-scene", x: 10, y: 20, facing: "down", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      await waitForTick();
      expect(joined).toBeNull();

      const joinedByObserver = onceEvent<PresenceState>(observer, "presence:joined");
      const actorSnapshot = onceEvent<PresenceState[]>(actor, "presence:snapshot");
      actor.emit("presence:join", { sceneId: "scene-start", x: 10, y: 20, facing: "down", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      await Promise.all([joinedByObserver, actorSnapshot]);

      let update: PresenceState | null = null;
      observer.on("presence:update", (presence) => {
        update = presence as PresenceState;
      });
      actor.emit("presence:update", { x: 5000, y: 20, facing: "down" });
      await waitForTick();
      expect(update).toBeNull();

      let chat: { text: string } | null = null;
      observer.on("chat:message", (message) => {
        chat = message as { text: string };
      });
      actor.emit("chat:send", { text: "x".repeat(201) });
      await waitForTick();
      expect(chat).toBeNull();
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
      observer.emit("presence:join", { sceneId: "scene-start", x: 50, y: 60, facing: "left", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      await observerSnapshot;

      const firstSnapshot = onceEvent<PresenceState[]>(firstSocket, "presence:snapshot");
      const joinedByObserver = onceEvent<PresenceState>(observer, "presence:joined");
      firstSocket.emit("presence:join", { sceneId: "scene-start", x: 10, y: 20, facing: "down", avatarId: DEFAULT_PLAYER_AVATAR_ID });
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
      replacementSocket.emit("presence:join", { sceneId: "scene-start", x: 88, y: 99, facing: "right", avatarId: "forest-archer" });
      const [update, replacementRoom] = await Promise.all([updatePromise, replacementSnapshot]);

      expect(update.username).toBe("hero-a");
      expect(update.x).toBe(88);
      expect(update.facing).toBe("right");
      expect(update.avatarId).toBe("forest-archer");
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

  it("shares field monsters and blocks duplicate claims on busy monsters", async () => {
    const repository = new MemoryUserRepository();
    const world = createFieldMonsterWorld();
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

      const snapshotA = onceEvent<FieldMonsterState[]>(socketA, "field-monsters:snapshot");
      socketA.emit("presence:join", { sceneId: "scene-field", x: 72, y: 72, facing: "down", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      const monsters = await snapshotA;
      const normalMonsters = monsters.filter((monster) => !monster.isBoss);

      expect(normalMonsters).toHaveLength(20);
      expect(normalMonsters.every((monster) => monster.sceneId === "scene-field")).toBe(true);
      const location = world.locations[world.startLocationKey]!;
      const portal = location.scene.portals[0]!;
      const npcBlock = { x: 816, y: 208, width: 48, height: 64 };
      normalMonsters.forEach((monster) => {
        expect(rectanglesOverlap(monsterHitbox(monster), portal)).toBe(false);
        expect(rectanglesOverlap(monsterHitbox(monster), npcBlock)).toBe(false);
      });

      const snapshotB = onceEvent<FieldMonsterState[]>(socketB, "field-monsters:snapshot");
      socketB.emit("presence:join", { sceneId: "scene-field", x: 90, y: 72, facing: "down", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      await snapshotB;

      const target = normalMonsters[0]!;
      const claimA = await emitAck<FieldMonsterClaimResult>(socketA, "field-monsters:claim", { monsterId: target.id });
      if (!claimA.ok) {
        throw new Error(`Expected first claim to succeed, got ${claimA.reason}.`);
      }
      expect(claimA.monster.id).toBe(target.id);

      const claimB = await emitAck<FieldMonsterClaimResult>(socketB, "field-monsters:claim", { monsterId: target.id });
      expect(claimB).toEqual({ ok: false, reason: "busy" });

      const releaseUpdate = onceEvent<FieldMonsterState[]>(socketB, "field-monsters:update");
      socketA.emit("field-monsters:release", { monsterId: target.id });
      const afterRelease = await releaseUpdate;
      expect(afterRelease.some((monster) => monster.id === target.id)).toBe(false);
      expect(afterRelease.filter((monster) => !monster.isBoss)).toHaveLength(19);
    } finally {
      sockets.forEach((socket) => socket.disconnect());
      await new Promise<void>((resolve, reject) => context.httpServer.close((error) => (error ? reject(error) : resolve())));
    }
  }, 15_000);

  it("keeps one available boss even while another boss instance is in battle", async () => {
    const repository = new MemoryUserRepository();
    const world = createFieldMonsterWorld({ boss: true });
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

      const snapshotA = onceEvent<FieldMonsterState[]>(socketA, "field-monsters:snapshot");
      socketA.emit("presence:join", { sceneId: "scene-field", x: 72, y: 72, facing: "down", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      const initialBosses = await snapshotA;
      expect(initialBosses.filter((monster) => monster.isBoss)).toHaveLength(1);

      const snapshotB = onceEvent<FieldMonsterState[]>(socketB, "field-monsters:snapshot");
      socketB.emit("presence:join", { sceneId: "scene-field", x: 90, y: 72, facing: "down", avatarId: DEFAULT_PLAYER_AVATAR_ID });
      await snapshotB;

      const firstBoss = initialBosses.find((monster) => monster.isBoss)!;
      const bossUpdate = onceEvent<FieldMonsterState[]>(socketB, "field-monsters:update");
      const claimA = await emitAck<FieldMonsterClaimResult>(socketA, "field-monsters:claim", { monsterId: firstBoss.id });
      if (!claimA.ok) {
        throw new Error(`Expected boss claim to succeed, got ${claimA.reason}.`);
      }

      const bossesAfterClaim = await bossUpdate;
      const availableBoss = bossesAfterClaim.find((monster) => monster.isBoss && !monster.inBattleBy);
      expect(bossesAfterClaim.filter((monster) => monster.isBoss)).toHaveLength(2);
      expect(availableBoss).toBeTruthy();

      const secondClaimUpdate = onceEvent<FieldMonsterState[]>(socketA, "field-monsters:update");
      const claimB = await emitAck<FieldMonsterClaimResult>(socketB, "field-monsters:claim", { monsterId: availableBoss!.id });
      expect(claimB.ok).toBe(true);
      await secondClaimUpdate;

      const releaseUpdate = onceEvent<FieldMonsterState[]>(socketB, "field-monsters:update");
      socketA.emit("field-monsters:release", { monsterId: firstBoss.id });
      const bossesAfterRelease = await releaseUpdate;
      expect(bossesAfterRelease.some((monster) => monster.id === firstBoss.id)).toBe(false);
      expect(bossesAfterRelease.some((monster) => monster.isBoss && !monster.inBattleBy)).toBe(true);
    } finally {
      sockets.forEach((socket) => socket.disconnect());
      await new Promise<void>((resolve, reject) => context.httpServer.close((error) => (error ? reject(error) : resolve())));
    }
  }, 15_000);
});
