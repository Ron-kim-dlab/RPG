const TEXT_INPUT_TAGS = new Set(["input", "textarea", "select", "option"]);

const GAMEPLAY_SHORTCUT_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  " ",
  "space",
  "spacebar",
  "enter",
  "b",
  "1",
  "2",
  "3",
]);

type ClosestCapableTarget = {
  tagName?: string | null;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
};

function isClosestCapableTarget(target: unknown): target is ClosestCapableTarget {
  return typeof target === "object" && target !== null;
}

export function isTextInputTag(tagName: string | null | undefined, isContentEditable: boolean): boolean {
  if (!tagName) {
    return isContentEditable;
  }

  return TEXT_INPUT_TAGS.has(tagName.toLowerCase()) || isContentEditable;
}

export function isTextInputTarget(target: EventTarget | Element | null): boolean {
  if (!isClosestCapableTarget(target)) {
    return false;
  }

  return isTextInputTag(target.tagName, Boolean(target.isContentEditable))
    || (typeof target.closest === "function" && target.closest("input, textarea, select, option, [contenteditable='true']") !== null);
}

export function isGameplayShortcutKey(key: string): boolean {
  return GAMEPLAY_SHORTCUT_KEYS.has(key.trim().toLowerCase());
}

export function shouldBlockGameplayInput(target: EventTarget | null, activeElement: Element | null): boolean {
  return isTextInputTarget(target) || isTextInputTarget(activeElement);
}
