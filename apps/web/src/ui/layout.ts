export const FLOATING_LAYOUT_STORAGE_KEY = "rpg-rebuild-floating-layout-v1";
export const FLOATING_LAYOUT_BREAKPOINT = 920;

export type FloatingPanelKey = "hud" | "log" | "chat" | "action" | "dialogue" | "battle";

export type FloatingPanelCollapsedState = Partial<Record<FloatingPanelKey, boolean>>;

export type FloatingPanelLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

export type FloatingPanelPreferences = {
  layouts: Partial<Record<FloatingPanelKey, FloatingPanelLayout>>;
  collapsed: FloatingPanelCollapsedState;
};

export type FloatingPanelConstraint = {
  minWidth: number;
  minHeight: number;
};

const PANEL_KEYS: FloatingPanelKey[] = ["hud", "log", "chat", "action", "dialogue", "battle"];

export const FLOATING_PANEL_CONSTRAINTS: Record<FloatingPanelKey, FloatingPanelConstraint> = {
  hud: { minWidth: 480, minHeight: 160 },
  log: { minWidth: 260, minHeight: 180 },
  chat: { minWidth: 280, minHeight: 220 },
  action: { minWidth: 360, minHeight: 180 },
  dialogue: { minWidth: 360, minHeight: 180 },
  battle: { minWidth: 380, minHeight: 260 },
};

export function isFloatingLayoutEnabled(viewportWidth: number): boolean {
  return viewportWidth > FLOATING_LAYOUT_BREAKPOINT;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sanitizeCollapsedPanels(value: unknown): FloatingPanelCollapsedState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const output: FloatingPanelCollapsedState = {};
  PANEL_KEYS.forEach((key) => {
    if (typeof record[key] === "boolean") {
      output[key] = record[key];
    }
  });
  return output;
}

export function sanitizeStoredLayouts(value: unknown): Partial<Record<FloatingPanelKey, FloatingPanelLayout>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const output: Partial<Record<FloatingPanelKey, FloatingPanelLayout>> = {};

  PANEL_KEYS.forEach((key) => {
    const candidate = record[key];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return;
    }

    const layout = candidate as Record<string, unknown>;
    if (
      !isFiniteNumber(layout.x)
      || !isFiniteNumber(layout.y)
      || !isFiniteNumber(layout.width)
      || !isFiniteNumber(layout.height)
      || !isFiniteNumber(layout.z)
    ) {
      return;
    }

    output[key] = {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      z: Math.max(1, Math.round(layout.z)),
    };
  });

  return output;
}

export function sanitizeStoredPanelPreferences(value: unknown): FloatingPanelPreferences {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if ("layouts" in record || "collapsed" in record) {
      return {
        layouts: sanitizeStoredLayouts(record.layouts),
        collapsed: sanitizeCollapsedPanels(record.collapsed),
      };
    }
  }

  return {
    layouts: sanitizeStoredLayouts(value),
    collapsed: {},
  };
}

export function cloneFloatingLayouts(
  layouts: Partial<Record<FloatingPanelKey, FloatingPanelLayout>>,
): Partial<Record<FloatingPanelKey, FloatingPanelLayout>> {
  return Object.fromEntries(
    Object.entries(layouts).map(([key, layout]) => [key, layout ? { ...layout } : layout]),
  ) as Partial<Record<FloatingPanelKey, FloatingPanelLayout>>;
}

export function cloneCollapsedPanels(collapsed: FloatingPanelCollapsedState): FloatingPanelCollapsedState {
  return { ...collapsed };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampFloatingPanelLayout(
  key: FloatingPanelKey,
  layout: FloatingPanelLayout,
  container: { width: number; height: number },
): FloatingPanelLayout {
  const constraint = FLOATING_PANEL_CONSTRAINTS[key];
  const width = clamp(Math.round(layout.width), constraint.minWidth, Math.max(constraint.minWidth, Math.round(container.width)));
  const height = clamp(Math.round(layout.height), constraint.minHeight, Math.max(constraint.minHeight, Math.round(container.height)));
  const maxX = Math.max(0, Math.round(container.width) - width);
  const maxY = Math.max(0, Math.round(container.height) - height);

  return {
    x: clamp(Math.round(layout.x), 0, maxX),
    y: clamp(Math.round(layout.y), 0, maxY),
    width,
    height,
    z: Math.max(1, Math.round(layout.z)),
  };
}
