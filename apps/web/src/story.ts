import { ensureStoryState, type LocationNode, type PlayerSave } from "@rpg/game-core";
import type { DialogueState } from "./state/store";

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
): { player: PlayerSave; dialogue: DialogueState | null; completedLocationStory: boolean } {
  const lastIndex = dialogue.lines.length - 1;
  if (dialogue.index < lastIndex) {
    return {
      player,
      dialogue: {
        ...dialogue,
        index: dialogue.index + 1,
      },
      completedLocationStory: false,
    };
  }

  if (dialogue.kind !== "location") {
    return {
      player,
      dialogue: null,
      completedLocationStory: false,
    };
  }

  return {
    player: {
      ...player,
      storyState: {
        ...player.storyState,
        [dialogue.locationKey]: {
          completed: true,
          currentIndex: Math.max(0, lastIndex),
        },
      },
    },
    dialogue: null,
    completedLocationStory: true,
  };
}
