import request from "supertest";
import { describe, expect, it } from "vitest";
import type { WorldContent } from "@rpg/game-core";
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

describe("http api", () => {
  it("registers, authenticates, and saves a player", async () => {
    const repository = new MemoryUserRepository();
    const world = createWorld();
    const context = await createAppContext({
      env: {
        port: 4100,
        clientOrigin: "http://localhost:5173",
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d",
      },
      repository,
      worldLoader: async () => world,
    });

    const agent = request(context.app);

    const register = await agent
      .post("/auth/register")
      .send({ username: "hero", password: "secret123" })
      .expect(201);

    const token = register.body.token as string;
    expect(token).toBeTruthy();

    const me = await agent
      .get("/player/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(me.body.player.username).toBe("hero");

    const updated = {
      ...createStarterPlayer("hero", world),
      coins: 123,
    };

    const saved = await agent
      .post("/player/save")
      .set("Authorization", `Bearer ${token}`)
      .send({ player: updated })
      .expect(200);

    expect(saved.body.player.coins).toBe(123);
  });
});
