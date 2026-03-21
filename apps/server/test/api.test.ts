import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ApiResponse, BootstrapPayload, PlayerPayload, SessionPayload, WorldContent } from "@rpg/game-core";
import { createStarterPlayer } from "@rpg/game-core";
import { createAppContext } from "../src/app";
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

function createPlayableWorld(): WorldContent {
  return {
    startLocationKey: "시작의 마을::마을 입구",
    locations: {
      "시작의 마을::마을 입구": {
        key: "시작의 마을::마을 입구",
        mainLocation: "시작의 마을",
        subLocation: "마을 입구",
        story: [],
        connections: [],
        scene: {
          sceneId: "town_gate",
          themeId: "village",
          width: 1024,
          height: 768,
          tileSize: 32,
          backgroundColor: "#10231b",
          spawn: { x: 512, y: 636 },
          portals: [],
          npcs: [],
          encounterZones: [],
          collisionZones: [{ id: "center", x: 432, y: 304, width: 160, height: 88 }],
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

function createEnv() {
  return {
    runtimeMode: "test" as const,
    port: 4100,
    clientOrigin: "http://localhost:5173",
    jwtSecret: "0123456789abcdef0123456789abcdef",
    jwtExpiresIn: "7d",
    passwordHashRounds: 10,
    storageDriver: "memory" as const,
  };
}

describe("http api", () => {
  it("registers, authenticates, and saves a player", async () => {
    const repository = new MemoryUserRepository();
    const world = createWorld();
    const context = await createAppContext({
      env: createEnv(),
      repository,
      worldLoader: async () => world,
    });

    const agent = request(context.app);

    const register = await agent
      .post("/auth/register")
      .send({ username: "hero", password: "secret123" })
      .expect(201);

    const registerPayload = register.body as ApiResponse<SessionPayload>;
    expect(registerPayload.success).toBe(true);
    if (!registerPayload.success) {
      throw new Error("register response should be successful");
    }

    const token = registerPayload.data.token;
    expect(token).toBeTruthy();

    const bootstrap = await agent
      .get("/content/bootstrap")
      .expect(200);

    const bootstrapPayload = bootstrap.body as ApiResponse<BootstrapPayload>;
    expect(bootstrapPayload.success).toBe(true);
    if (!bootstrapPayload.success) {
      throw new Error("bootstrap response should be successful");
    }
    expect(bootstrapPayload.data.world.startLocationKey).toBe(world.startLocationKey);

    const me = await agent
      .get("/player/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const mePayload = me.body as ApiResponse<PlayerPayload>;
    expect(mePayload.success).toBe(true);
    if (!mePayload.success) {
      throw new Error("player/me response should be successful");
    }

    expect(mePayload.data.player.username).toBe("hero");

    const updated = {
      ...createStarterPlayer("hero", world),
      coins: 123,
    };

    const saved = await agent
      .post("/player/save")
      .set("Authorization", `Bearer ${token}`)
      .send({ player: updated })
      .expect(200);

    const savedPayload = saved.body as ApiResponse<PlayerPayload>;
    expect(savedPayload.success).toBe(true);
    if (!savedPayload.success) {
      throw new Error("player/save response should be successful");
    }

    expect(savedPayload.data.player.coins).toBe(123);
  });

  it("hashes passwords on register and upgrades legacy passwords on login", async () => {
    const repository = new MemoryUserRepository();
    const world = createWorld();
    const context = await createAppContext({
      env: createEnv(),
      repository,
      worldLoader: async () => world,
    });

    const agent = request(context.app);

    await agent
      .post("/auth/register")
      .send({ username: "new-hero", password: "secret123" })
      .expect(201);

    const created = await repository.findByUsername("new-hero");
    expect(created?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(created?.passwordHash).not.toBe("secret123");

    await repository.saveAccount({
      username: "legacy-hero",
      passwordHash: "secret123",
      player: createStarterPlayer("legacy-hero", world),
    });

    await agent
      .post("/auth/login")
      .send({ username: "legacy-hero", password: "secret123" })
      .expect(200);

    const upgraded = await repository.findByUsername("legacy-hero");
    expect(upgraded?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(upgraded?.passwordHash).not.toBe("secret123");
  });

  it("returns consistent validation errors for malformed requests", async () => {
    const repository = new MemoryUserRepository();
    const world = createWorld();
    const context = await createAppContext({
      env: createEnv(),
      repository,
      worldLoader: async () => world,
    });

    const agent = request(context.app);

    const invalidRegister = await agent
      .post("/auth/register")
      .send({ username: "a", password: "123" })
      .expect(400);

    expect(invalidRegister.body).toMatchObject({
      success: false,
      error: {
        code: "validation_error",
      },
    });

    const register = await agent
      .post("/auth/register")
      .send({ username: "hero", password: "secret123" })
      .expect(201);

    const registerPayload = register.body as ApiResponse<SessionPayload>;
    if (!registerPayload.success) {
      throw new Error("register response should be successful");
    }

    const malformedSave = await agent
      .post("/player/save")
      .set("Authorization", `Bearer ${registerPayload.data.token}`)
      .send({ player: { username: "hero" } })
      .expect(400);

    expect(malformedSave.body).toMatchObject({
      success: false,
      error: {
        code: "validation_error",
      },
    });
  });

  it("normalizes a blocked saved position to the scene spawn on player load", async () => {
    const repository = new MemoryUserRepository();
    const world = createPlayableWorld();
    const context = await createAppContext({
      env: createEnv(),
      repository,
      worldLoader: async () => world,
    });

    const agent = request(context.app);
    const blockedPlayer = {
      ...createStarterPlayer("stuck-hero", world),
      position: { x: 512, y: 384 },
    };

    await repository.saveAccount({
      username: "stuck-hero",
      passwordHash: "secret123",
      player: blockedPlayer,
    });

    const login = await agent
      .post("/auth/login")
      .send({ username: "stuck-hero", password: "secret123" })
      .expect(200);

    const loginPayload = login.body as ApiResponse<SessionPayload>;
    expect(loginPayload.success).toBe(true);
    if (!loginPayload.success) {
      throw new Error("login response should be successful");
    }

    expect(loginPayload.data.player.position).toEqual({ x: 512, y: 636 });
  });
});
