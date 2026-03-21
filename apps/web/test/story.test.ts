import { describe, expect, it } from "vitest";
import { createStarterPlayer, type LocationNode, type WorldContent } from "@rpg/game-core";
import {
  advanceDialogueProgress,
  createLocationStoryDialogue,
  hasUnreadLocationStory,
  prepareLocationStory,
} from "../src/story";

const baseLocation: LocationNode = {
  key: "시작의 마을::마을 입구",
  mainLocation: "시작의 마을",
  subLocation: "마을 입구",
  story: ["첫 줄", "둘째 줄"],
  connections: [],
  scene: {
    sceneId: "village_gate",
    themeId: "village",
    width: 1024,
    height: 768,
    tileSize: 32,
    backgroundColor: "#10231b",
    spawn: { x: 120, y: 120 },
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
};

const baseWorld: WorldContent = {
  startLocationKey: baseLocation.key,
  locations: {
    [baseLocation.key]: baseLocation,
  },
  equipment: [],
  skills: [],
  tactics: [],
  enemies: {},
  enemiesByLocation: {},
};

describe("location story helpers", () => {
  it("keeps unread location stories available without auto-opening movement locks", () => {
    const player = createStarterPlayer("tester", baseWorld);
    const prepared = prepareLocationStory(player, baseLocation);

    expect(prepared.hasUnreadStory).toBe(true);
    expect(hasUnreadLocationStory(prepared.player, baseLocation)).toBe(true);

    const dialogue = createLocationStoryDialogue(prepared.player, baseLocation);
    expect(dialogue.dialogue?.kind).toBe("location");
    expect(dialogue.dialogue?.lines).toEqual(baseLocation.story);
  });

  it("marks only location stories as completed on the last line", () => {
    const player = createStarterPlayer("tester", baseWorld);
    const locationDialogue = createLocationStoryDialogue(player, baseLocation).dialogue;
    expect(locationDialogue).not.toBeNull();

    const advanced = advanceDialogueProgress(player, {
      ...locationDialogue!,
      index: 1,
    });
    expect(advanced.completedLocationStory).toBe(true);
    expect(advanced.dialogue).toBeNull();
    expect(advanced.player.storyState[baseLocation.key]?.completed).toBe(true);

    const npcAdvanced = advanceDialogueProgress(player, {
      kind: "npc",
      title: "이장",
      locationKey: baseLocation.key,
      lines: ["안녕"],
      index: 0,
    });
    expect(npcAdvanced.completedLocationStory).toBe(false);
    expect(npcAdvanced.player.storyState[baseLocation.key]?.completed).toBe(false);
  });
});
