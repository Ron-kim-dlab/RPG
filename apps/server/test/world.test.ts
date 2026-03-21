import { describe, expect, it } from "vitest";
import { loadWorld, resetWorldCache } from "../src/content/world";

describe("loadWorld", () => {
  it("loads legacy content from the repository root regardless of current working directory", async () => {
    resetWorldCache();

    const world = await loadWorld();

    expect(world.startLocationKey).toBeTruthy();
    expect(Object.keys(world.locations).length).toBeGreaterThan(0);
    expect(Object.keys(world.enemies).length).toBeGreaterThan(0);
    expect(world.skills.length).toBeGreaterThan(0);
  });
});
