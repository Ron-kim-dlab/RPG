export function toLocationKey(mainLocation: string, subLocation: string): string {
  return `${mainLocation}::${subLocation}`;
}

export function toStableId(prefix: string, raw: string): string {
  const base = raw
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-\u3131-\uD79D]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (base.length > 0) {
    return `${prefix}-${base.toLowerCase()}`;
  }

  const hash = Array.from(raw).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1_000_000_007, 7);
  return `${prefix}-${hash}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pickRandom<T>(items: readonly T[], rng: () => number): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list.");
  }

  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index] as T;
}
