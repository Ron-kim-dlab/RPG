import { describe, expect, it } from "vitest";
import { isGameplayShortcutKey, isTextInputTag, shouldBlockGameplayInput } from "../src/input";

function createClosestTarget(options: {
  tagName?: string;
  isContentEditable?: boolean;
  closestResult?: unknown;
} = {}) {
  return {
    tagName: options.tagName ?? "div",
    isContentEditable: options.isContentEditable ?? false,
    closest: () => options.closestResult ?? null,
  };
}

describe("input helpers", () => {
  it("recognizes common gameplay shortcut keys", () => {
    expect(isGameplayShortcutKey("W")).toBe(true);
    expect(isGameplayShortcutKey("ArrowLeft")).toBe(true);
    expect(isGameplayShortcutKey("Space")).toBe(true);
    expect(isGameplayShortcutKey("Enter")).toBe(true);
    expect(isGameplayShortcutKey("B")).toBe(true);
    expect(isGameplayShortcutKey("1")).toBe(true);
    expect(isGameplayShortcutKey("x")).toBe(false);
  });

  it("recognizes text entry tags and contenteditable nodes", () => {
    expect(isTextInputTag("input", false)).toBe(true);
    expect(isTextInputTag("TEXTAREA", false)).toBe(true);
    expect(isTextInputTag("div", true)).toBe(true);
    expect(isTextInputTag("button", false)).toBe(false);
  });

  it("blocks gameplay input when the key target is a text entry control", () => {
    const inputTarget = createClosestTarget({ tagName: "input" }) as unknown as EventTarget;

    expect(shouldBlockGameplayInput(inputTarget, null)).toBe(true);
  });

  it("blocks gameplay input when another text field keeps active focus", () => {
    const nonInputTarget = createClosestTarget({ tagName: "button" }) as unknown as EventTarget;
    const activeInput = createClosestTarget({ tagName: "textarea" }) as unknown as Element;

    expect(shouldBlockGameplayInput(nonInputTarget, activeInput)).toBe(true);
  });
});
