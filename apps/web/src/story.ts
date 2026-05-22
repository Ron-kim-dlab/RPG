import { ensureStoryState, toLocationKey, toStableId, type LocationNode, type PlayerSave } from "@rpg/game-core";
import type { DialogueState } from "./state/store";

const BLACKSMITH_REWARD_LOCATION_KEY = toLocationKey("시작의 마을", "무기 상점");
const BLACKSMITH_REWARD_EQUIPMENT_ID = toStableId("equipment", "마을의 검");
const BLACKSMITH_REWARD_MESSAGE = "대장장이가 '마을의 검'을 지급하였습니다.";

type DialogueAdvanceResult = {
  player: PlayerSave;
  dialogue: DialogueState | null;
  completedLocationStory: boolean;
  rewardMessages: string[];
};

export function hasUnreadLocationStory(
  player: PlayerSave | null,
  location: LocationNode | null | undefined,
): boolean {
  if (!player || !location || location.story.length === 0) {
    return false;
  }

  const story = player.storyState[location.key];
  return Boolean(story && !story.completed);
}

export function prepareLocationStory(
  player: PlayerSave,
  location: LocationNode | null | undefined,
): { player: PlayerSave; hasUnreadStory: boolean } {
  if (!location) {
    return { player, hasUnreadStory: false };
  }

  const nextPlayer = ensureStoryState(player, location.key);
  return {
    player: nextPlayer,
    hasUnreadStory: hasUnreadLocationStory(nextPlayer, location),
  };
}

export function createLocationStoryDialogue(
  player: PlayerSave,
  location: LocationNode | null | undefined,
): { player: PlayerSave; dialogue: DialogueState | null } {
  const prepared = prepareLocationStory(player, location);
  if (!location || !prepared.hasUnreadStory) {
    return {
      player: prepared.player,
      dialogue: null,
    };
  }

  const story = prepared.player.storyState[location.key];
  return {
    player: prepared.player,
    dialogue: {
      kind: "location",
      title: `${location.subLocation} 이야기`,
      locationKey: location.key,
      lines: location.story,
      index: story?.currentIndex ?? 0,
    },
  };
}

export function advanceDialogueProgress(
  player: PlayerSave,
  dialogue: DialogueState,
): DialogueAdvanceResult {
  const lastIndex = dialogue.lines.length - 1;
  if (dialogue.index < lastIndex) {
    return {
      player,
      dialogue: {
        ...dialogue,
        index: dialogue.index + 1,
      },
      completedLocationStory: false,
      rewardMessages: [],
    };
  }

  if (dialogue.kind !== "location") {
    const rewarded = applyDialogueCompletionRewards(player, dialogue);
    return {
      player: rewarded.player,
      dialogue: null,
      completedLocationStory: false,
      rewardMessages: rewarded.messages,
    };
  }

  const completedPlayer: PlayerSave = {
    ...player,
    storyState: {
      ...player.storyState,
      [dialogue.locationKey]: {
        completed: true,
        currentIndex: Math.max(0, lastIndex),
      },
    },
  };
  const rewarded = applyDialogueCompletionRewards(completedPlayer, dialogue);

  return {
    player: rewarded.player,
    dialogue: null,
    completedLocationStory: true,
    rewardMessages: rewarded.messages,
  };
}

function applyDialogueCompletionRewards(
  player: PlayerSave,
  dialogue: DialogueState,
): { player: PlayerSave; messages: string[] } {
  if (dialogue.locationKey !== BLACKSMITH_REWARD_LOCATION_KEY) {
    return { player, messages: [] };
  }

  if (player.ownedEquipmentIds.includes(BLACKSMITH_REWARD_EQUIPMENT_ID)) {
    return { player, messages: [] };
  }

  return {
    player: {
      ...player,
      ownedEquipmentIds: [...player.ownedEquipmentIds, BLACKSMITH_REWARD_EQUIPMENT_ID],
    },
    messages: [BLACKSMITH_REWARD_MESSAGE],
  };
}
