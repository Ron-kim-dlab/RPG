import type {
  BattleState,
  EquipmentDefinition,
  LocationNode,
  PlayerSave,
  SkillDefinition,
  TacticDefinition,
} from "@rpg/game-core";
import { EQUIPMENT_SLOT_LABELS, EQUIPMENT_SLOT_ORDER } from "@rpg/game-core";
import { AUTH_PASSWORD_MIN_LENGTH, AUTH_USERNAME_MAX_LENGTH, AUTH_USERNAME_MIN_LENGTH } from "../auth";
import type { AppState } from "../state/store";
import {
  clampFloatingPanelLayout,
  cloneFloatingLayouts,
  cloneCollapsedPanels,
  FLOATING_LAYOUT_STORAGE_KEY,
  FLOATING_PANEL_CONSTRAINTS,
  sanitizeStoredPanelPreferences,
  type FloatingPanelCollapsedState,
  type FloatingPanelKey,
  type FloatingPanelLayout,
} from "./layout";
import { describeEquipmentActionCard, describeSkillActionCard } from "./actionCards";

type UiCallbacks = {
  onAuthSubmit: (mode: "login" | "register", username: string, password: string) => void;
  onAuthModeChange: (mode: "login" | "register") => void;
  onSave: () => void;
  onDialogueNext: () => void;
  onBattleAction: (action: { kind: "attack" | "normal" | "defend" } | { kind: "skill"; skillId: string } | { kind: "tactic"; tacticId: string }) => void;
  onBuyEquipment: (equipmentId: string) => void;
  onToggleEquip: (equipmentId: string) => void;
  onLearnSkill: (skillId: string) => void;
  onRest: () => void;
  onSendChat: (text: string) => void;
};

type LayoutGesture =
  | {
    key: FloatingPanelKey;
    pointerId: number;
    mode: "move";
    offsetX: number;
    offsetY: number;
  }
  | {
    key: FloatingPanelKey;
    pointerId: number;
    mode: "resize";
  };

type SidePanelKey = Extract<FloatingPanelKey, "action" | "battle" | "log">;

const SIDE_PANEL_KEYS: SidePanelKey[] = ["action", "battle", "log"];

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export class DomUi {
  private readonly root: HTMLElement;
  private readonly appShell: HTMLElement;
  private readonly uiLayer: HTMLElement;
  private readonly authPanel: HTMLElement;
  private readonly hudPanel: HTMLElement;
  private readonly actionPanel: HTMLElement;
  private readonly dialoguePanel: HTMLElement;
  private readonly battlePanel: HTMLElement;
  private readonly chatPanel: HTMLElement;
  private readonly logPanel: HTMLElement;
  private readonly sideMenuButtons: NodeListOf<HTMLButtonElement>;
  private readonly floatingPanels: Record<FloatingPanelKey, HTMLElement>;
  private activeSidePanel: SidePanelKey = "action";
  private actionPanelWasVisible = false;
  private battlePanelWasVisible = false;
  private panelLayouts: Partial<Record<FloatingPanelKey, FloatingPanelLayout>> = {};
  private savedPanelLayouts: Partial<Record<FloatingPanelKey, FloatingPanelLayout>> = {};
  private collapsedPanels: FloatingPanelCollapsedState = {};
  private savedCollapsedPanels: FloatingPanelCollapsedState = {};
  private nextPanelZ = 20;
  private activeGesture: LayoutGesture | null = null;
  private readonly handlePointerMove = (event: PointerEvent) => this.onPointerMove(event);
  private readonly handlePointerUp = (event: PointerEvent) => this.onPointerUp(event);
  private readonly handleViewportResize = () => {
    window.requestAnimationFrame(() => this.refreshFloatingLayouts());
  };

  constructor(root: HTMLElement, private readonly callbacks: UiCallbacks) {
    this.root = root;
    this.root.innerHTML = `
      <div class="viewport-shell">
        <div class="atmosphere atmosphere-one"></div>
        <div class="atmosphere atmosphere-two"></div>
        <header class="status-bar hud-panel"></header>
        <div class="game-layout">
          <aside class="left-ui-shell" aria-label="게임 메뉴">
            <nav class="side-menu" data-no-panel-drag>
              <button class="side-tab active" type="button" data-side-panel="action" aria-controls="action-panel" aria-expanded="true">행동</button>
              <button class="side-tab" type="button" data-side-panel="battle" aria-controls="battle-panel" aria-expanded="false">전투</button>
              <button class="side-tab" type="button" data-side-panel="log" aria-controls="log-panel" aria-expanded="false">로그</button>
            </nav>
            <div class="left-panel-stack">
              <section id="action-panel" class="panel action-panel"></section>
              <section id="battle-panel" class="panel battle-panel"></section>
              <aside id="log-panel" class="panel log-panel"></aside>
            </div>
          </aside>
          <main class="game-stage">
            <div class="stage-canvas"></div>
            <div class="ui-layer">
              <section class="panel dialogue-panel"></section>
              <section class="panel auth-panel"></section>
            </div>
          </main>
          <aside class="right-ui-shell" aria-label="채팅">
            <aside class="panel chat-panel"></aside>
          </aside>
        </div>
      </div>
    `;

    this.appShell = this.root.querySelector(".stage-canvas") as HTMLElement;
    this.uiLayer = this.root.querySelector(".ui-layer") as HTMLElement;
    this.authPanel = this.root.querySelector(".auth-panel") as HTMLElement;
    this.hudPanel = this.root.querySelector(".hud-panel") as HTMLElement;
    this.actionPanel = this.root.querySelector(".action-panel") as HTMLElement;
    this.dialoguePanel = this.root.querySelector(".dialogue-panel") as HTMLElement;
    this.battlePanel = this.root.querySelector(".battle-panel") as HTMLElement;
    this.chatPanel = this.root.querySelector(".chat-panel") as HTMLElement;
    this.logPanel = this.root.querySelector(".log-panel") as HTMLElement;
    this.sideMenuButtons = this.root.querySelectorAll<HTMLButtonElement>("[data-side-panel]");
    this.floatingPanels = {
      hud: this.hudPanel,
      log: this.logPanel,
      chat: this.chatPanel,
      action: this.actionPanel,
      dialogue: this.dialoguePanel,
      battle: this.battlePanel,
    };

    const storedPreferences = this.loadStoredPreferences();
    this.savedPanelLayouts = storedPreferences.layouts;
    this.panelLayouts = cloneFloatingLayouts(storedPreferences.layouts);
    this.savedCollapsedPanels = storedPreferences.collapsed;
    this.collapsedPanels = cloneCollapsedPanels(storedPreferences.collapsed);
    this.nextPanelZ = this.computeNextPanelZ();
    this.initializeFloatingPanels();
    this.bindSideMenu();
  }

  getGameContainer(): HTMLElement {
    return this.appShell;
  }

  private initializeFloatingPanels(): void {
    Object.entries(this.floatingPanels).forEach(([key, panel]) => {
      const panelKey = key as FloatingPanelKey;
      const constraint = FLOATING_PANEL_CONSTRAINTS[panelKey];
      panel.dataset.panelKey = panelKey;
      panel.classList.add("layout-panel");
      panel.style.setProperty("--panel-min-width", `${constraint.minWidth}px`);
      panel.style.setProperty("--panel-min-height", `${constraint.minHeight}px`);
      panel.addEventListener("pointerdown", (event) => this.onPanelPointerDown(panelKey, event));
    });

    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
    window.addEventListener("resize", this.handleViewportResize);
    window.requestAnimationFrame(() => this.refreshFloatingLayouts());
  }

  private loadStoredPreferences(): {
    layouts: Partial<Record<FloatingPanelKey, FloatingPanelLayout>>;
    collapsed: FloatingPanelCollapsedState;
  } {
    if (typeof window === "undefined") {
      return {
        layouts: {},
        collapsed: {},
      };
    }

    try {
      const raw = window.localStorage.getItem(FLOATING_LAYOUT_STORAGE_KEY);
      if (!raw) {
        return {
          layouts: {},
          collapsed: {},
        };
      }
      return sanitizeStoredPanelPreferences(JSON.parse(raw));
    } catch {
      return {
        layouts: {},
        collapsed: {},
      };
    }
  }

  private persistPreferences(): void {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(FLOATING_LAYOUT_STORAGE_KEY, JSON.stringify({
      layouts: this.savedPanelLayouts,
      collapsed: this.savedCollapsedPanels,
    }));
  }

  private computeNextPanelZ(): number {
    const maxZ = Object.values(this.panelLayouts).reduce((current, layout) => Math.max(current, layout?.z ?? 0), 19);
    return maxZ + 1;
  }

  private isFloatingLayoutActive(): boolean {
    return false;
  }

  private isSidePanelKey(value: string | undefined): value is SidePanelKey {
    return value === "action" || value === "battle" || value === "log";
  }

  private bindSideMenu(): void {
    this.sideMenuButtons.forEach((button) => {
      const key = button.dataset.sidePanel;
      if (!this.isSidePanelKey(key)) {
        return;
      }

      button.onclick = () => {
        this.activeSidePanel = key;
        this.syncSidePanels();
      };
    });
    this.syncSidePanels();
  }

  private syncSidePanels(): void {
    const availablePanels = SIDE_PANEL_KEYS.filter((key) => this.floatingPanels[key].classList.contains("visible"));
    if (availablePanels.length > 0 && !availablePanels.includes(this.activeSidePanel)) {
      this.activeSidePanel = availablePanels[0] ?? this.activeSidePanel;
    }

    SIDE_PANEL_KEYS.forEach((key) => {
      const panel = this.floatingPanels[key];
      const isAvailable = panel.classList.contains("visible");
      const isActive = isAvailable && key === this.activeSidePanel;
      panel.classList.toggle("menu-open", isActive);

      const button = Array.from(this.sideMenuButtons).find((entry) => entry.dataset.sidePanel === key);
      if (!button) {
        return;
      }
      button.disabled = !isAvailable;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-expanded", String(isActive));
    });
  }

  private measurePanelLayout(key: FloatingPanelKey): FloatingPanelLayout | null {
    const panel = this.floatingPanels[key];
    const panelRect = panel.getBoundingClientRect();
    const containerRect = this.uiLayer.getBoundingClientRect();
    if (panelRect.width === 0 || panelRect.height === 0 || containerRect.width === 0 || containerRect.height === 0) {
      return null;
    }

    return {
      x: panelRect.left - containerRect.left,
      y: panelRect.top - containerRect.top,
      width: panelRect.width,
      height: panelRect.height,
      z: this.panelLayouts[key]?.z ?? this.nextPanelZ,
    };
  }

  private ensureMeasuredLayout(key: FloatingPanelKey): FloatingPanelLayout | null {
    const current = this.panelLayouts[key];
    if (current) {
      return current;
    }

    const measured = this.measurePanelLayout(key);
    if (!measured) {
      return null;
    }

    const clamped = this.clampLayout(key, measured);
    this.panelLayouts[key] = clamped;
    this.applyLayout(key, clamped);
    return clamped;
  }

  private snapshotVisibleLayouts(): void {
    (Object.keys(this.floatingPanels) as FloatingPanelKey[]).forEach((key) => {
      const panel = this.floatingPanels[key];
      if (!panel.classList.contains("visible") && key !== "hud" && key !== "chat" && key !== "log") {
        return;
      }

      const measured = this.measurePanelLayout(key);
      if (!measured) {
        return;
      }

      const clamped = this.clampLayout(key, {
        ...measured,
        height: this.collapsedPanels[key] ? (this.panelLayouts[key]?.height ?? measured.height) : measured.height,
      });
      this.panelLayouts[key] = clamped;
      this.applyLayout(key, clamped);
    });
  }

  private clampLayout(key: FloatingPanelKey, layout: FloatingPanelLayout): FloatingPanelLayout {
    return clampFloatingPanelLayout(key, layout, {
      width: this.uiLayer.clientWidth,
      height: this.uiLayer.clientHeight,
    });
  }

  private applyLayout(key: FloatingPanelKey, layout: FloatingPanelLayout): void {
    const panel = this.floatingPanels[key];
    panel.style.inset = "";
    panel.style.top = `${layout.y}px`;
    panel.style.left = `${layout.x}px`;
    panel.style.width = `${layout.width}px`;
    panel.style.height = `${layout.height}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.zIndex = String(layout.z);
  }

  private clearLayoutStyles(panel: HTMLElement): void {
    panel.style.top = "";
    panel.style.left = "";
    panel.style.width = "";
    panel.style.height = "";
    panel.style.right = "";
    panel.style.bottom = "";
    panel.style.inset = "";
    panel.style.zIndex = "";
  }

  private restoreDefaultFloatingLayouts(): void {
    Object.values(this.floatingPanels).forEach((panel) => this.clearLayoutStyles(panel));
  }

  private refreshFloatingLayouts(): void {
    const enabled = this.isFloatingLayoutActive();
    Object.values(this.floatingPanels).forEach((panel) => {
      panel.classList.toggle("floating-enabled", enabled);
    });

    if (!enabled) {
      this.activeGesture = null;
      Object.values(this.floatingPanels).forEach((panel) => {
        panel.classList.remove("is-dragging", "is-resizing");
        this.clearLayoutStyles(panel);
      });
      return;
    }

    let didChange = false;
    (Object.entries(this.panelLayouts) as Array<[FloatingPanelKey, FloatingPanelLayout]>).forEach(([key, layout]) => {
      const clamped = this.clampLayout(key, layout);
      this.panelLayouts[key] = clamped;
      this.applyLayout(key, clamped);
      didChange = didChange || JSON.stringify(clamped) !== JSON.stringify(layout);
    });
    if (didChange) {
      this.panelLayouts = cloneFloatingLayouts(this.panelLayouts);
    }
  }

  private bringPanelToFront(key: FloatingPanelKey): void {
    const layout = this.ensureMeasuredLayout(key);
    if (!layout) {
      return;
    }

    const next = {
      ...layout,
      z: this.nextPanelZ,
    };
    this.nextPanelZ += 1;
    this.panelLayouts[key] = next;
    this.applyLayout(key, next);
  }

  private isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest("button, input, textarea, select, option, label, a, [contenteditable='true'], [data-no-panel-drag]"));
  }

  private isResizeCorner(panel: HTMLElement, event: PointerEvent): boolean {
    const rect = panel.getBoundingClientRect();
    return rect.right - event.clientX <= 22 && rect.bottom - event.clientY <= 22;
  }

  private onPanelPointerDown(key: FloatingPanelKey, event: PointerEvent): void {
    if (!this.isFloatingLayoutActive()) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const panel = this.floatingPanels[key];
    if (this.isInteractiveTarget(event.target)) {
      return;
    }

    const measured = this.ensureMeasuredLayout(key);
    if (!measured) {
      return;
    }

    this.bringPanelToFront(key);

    if (this.isResizeCorner(panel, event)) {
      this.activeGesture = {
        key,
        pointerId: event.pointerId,
        mode: "resize",
      };
      panel.classList.add("is-resizing");
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const dragZoneHeight = 58;
    if (event.clientY - panelRect.top > dragZoneHeight) {
      return;
    }

    this.activeGesture = {
      key,
      pointerId: event.pointerId,
      mode: "move",
      offsetX: event.clientX - panelRect.left,
      offsetY: event.clientY - panelRect.top,
    };
    panel.classList.add("is-dragging");
    panel.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.activeGesture || this.activeGesture.mode !== "move" || event.pointerId !== this.activeGesture.pointerId || !this.isFloatingLayoutActive()) {
      return;
    }

    const layout = this.panelLayouts[this.activeGesture.key];
    if (!layout) {
      return;
    }

    const containerRect = this.uiLayer.getBoundingClientRect();
    const next = this.clampLayout(this.activeGesture.key, {
      ...layout,
      x: event.clientX - containerRect.left - this.activeGesture.offsetX,
      y: event.clientY - containerRect.top - this.activeGesture.offsetY,
    });
    this.panelLayouts[this.activeGesture.key] = next;
    this.applyLayout(this.activeGesture.key, next);
    event.preventDefault();
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.activeGesture || event.pointerId !== this.activeGesture.pointerId) {
      return;
    }

    const { key } = this.activeGesture;
    const panel = this.floatingPanels[key];
    panel.classList.remove("is-dragging", "is-resizing");
    panel.releasePointerCapture?.(event.pointerId);

    if (this.isFloatingLayoutActive()) {
      const measured = this.measurePanelLayout(key);
      if (measured) {
        const clamped = this.clampLayout(key, {
          ...measured,
          z: this.panelLayouts[key]?.z ?? measured.z,
        });
        this.panelLayouts[key] = clamped;
        this.applyLayout(key, clamped);
      }
    }

    this.activeGesture = null;
  }

  private saveFloatingLayouts(): void {
    if (!this.isFloatingLayoutActive()) {
      return;
    }

    this.snapshotVisibleLayouts();
    const nextLayouts = cloneFloatingLayouts(this.panelLayouts);
    this.savedPanelLayouts = nextLayouts;
    this.savedCollapsedPanels = cloneCollapsedPanels(this.collapsedPanels);
    this.persistPreferences();
  }

  private loadFloatingLayouts(): void {
    const stored = this.loadStoredPreferences();
    this.savedPanelLayouts = stored.layouts;
    this.panelLayouts = cloneFloatingLayouts(stored.layouts);
    this.savedCollapsedPanels = cloneCollapsedPanels(stored.collapsed);
    this.collapsedPanels = cloneCollapsedPanels(stored.collapsed);
    this.nextPanelZ = this.computeNextPanelZ();
    if (Object.keys(this.panelLayouts).length === 0) {
      this.restoreDefaultFloatingLayouts();
    }
    this.refreshFloatingLayouts();
    this.syncCollapsedPanels();
  }

  private resetFloatingLayouts(): void {
    this.panelLayouts = {};
    this.savedPanelLayouts = {};
    this.collapsedPanels = {};
    this.savedCollapsedPanels = {};
    this.nextPanelZ = 20;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(FLOATING_LAYOUT_STORAGE_KEY);
    }
    this.restoreDefaultFloatingLayouts();
    this.refreshFloatingLayouts();
    this.syncCollapsedPanels();
  }

  private isPanelCollapsed(key: FloatingPanelKey): boolean {
    return Boolean(this.collapsedPanels[key]);
  }

  private togglePanelCollapsed(key: FloatingPanelKey): void {
    this.collapsedPanels[key] = !this.isPanelCollapsed(key);
    this.syncCollapsedPanel(key);
  }

  private syncCollapsedPanels(): void {
    (Object.keys(this.floatingPanels) as FloatingPanelKey[]).forEach((key) => {
      this.syncCollapsedPanel(key);
    });
  }

  private syncCollapsedPanel(key: FloatingPanelKey): void {
    const panel = this.floatingPanels[key];
    const collapsed = this.isPanelCollapsed(key);
    panel.classList.toggle("is-collapsed", collapsed);

    const toggleButton = panel.querySelector<HTMLButtonElement>("[data-panel-toggle]");
    if (toggleButton) {
      const title = toggleButton.dataset.panelTitle ?? "패널";
      toggleButton.textContent = collapsed ? "펼치기" : "접기";
      toggleButton.setAttribute("aria-expanded", String(!collapsed));
      toggleButton.setAttribute("aria-label", collapsed ? `${title} 패널 펼치기` : `${title} 패널 접기`);
    }
  }

  private bindPanelToggle(key: FloatingPanelKey): void {
    const panel = this.floatingPanels[key];
    const toggleButton = panel.querySelector<HTMLButtonElement>("[data-panel-toggle]");
    if (!toggleButton) {
      return;
    }

    toggleButton.onclick = () => this.togglePanelCollapsed(key);
    this.syncCollapsedPanel(key);
  }

  private renderPanelFrame(options: {
    key: FloatingPanelKey;
    eyebrow: string;
    title: string;
    titleTag?: "h1" | "h2";
    subtitle?: string;
    controls?: string;
    body: string;
    bodyClassName?: string;
    collapsible?: boolean;
  }): string {
    const headingTag = options.titleTag ?? "h2";
    const eyebrow = escapeHtml(options.eyebrow);
    const title = escapeHtml(options.title);
    const subtitle = options.subtitle ? escapeHtml(options.subtitle) : "";
    const collapsible = options.collapsible ?? true;

    return `
      <div class="panel-shell">
        <div class="panel-shell-header">
          <div class="panel-shell-copy">
            <div class="eyebrow">${eyebrow}</div>
            <div class="panel-shell-heading">
              <${headingTag}>${title}</${headingTag}>
              ${subtitle ? `<p class="panel-shell-subtitle">${subtitle}</p>` : ""}
            </div>
          </div>
          <div class="panel-shell-controls" data-no-panel-drag>
            ${options.controls ?? ""}
            ${collapsible ? `<button
              class="ghost panel-toggle-button"
              type="button"
              data-panel-toggle
              data-panel-title="${title}"
            >
              ${this.isPanelCollapsed(options.key) ? "펼치기" : "접기"}
            </button>` : ""}
          </div>
        </div>
        <div class="panel-shell-body ${options.bodyClassName ?? ""}">
          ${options.body}
        </div>
      </div>
    `;
  }

  render(
    state: AppState,
    currentLocation: LocationNode | null,
    equipmentForLocation: EquipmentDefinition[],
    skillForLocation: SkillDefinition[],
    equipped: EquipmentDefinition[],
    ownedEquipment: EquipmentDefinition[],
    learnedSkills: SkillDefinition[],
    learnedTactics: TacticDefinition[],
  ): void {
    this.renderAuth(state);
    this.renderHud(state, currentLocation);
    this.renderActions(state, currentLocation, equipmentForLocation, skillForLocation, equipped, ownedEquipment);
    this.renderDialogue(state);
    this.renderBattle(state.battle, learnedSkills, learnedTactics);
    this.renderChat(state);
    this.renderLogs(state.logs);
    this.syncSidePanels();
  }

  private renderAuth(state: AppState): void {
    if (state.player) {
      this.authPanel.classList.remove("visible");
      this.authPanel.innerHTML = "";
      return;
    }

    const disabled = state.pending ? "disabled" : "";
    this.authPanel.classList.add("visible");
    this.authPanel.innerHTML = `
      <div class="auth-card">
        <div class="eyebrow">LOGIN</div>
        <h2>탐험가 등록소</h2>
        <p class="panel-note">접속 후에는 오버월드에서 바로 이동과 상호작용을 이어갈 수 있습니다.</p>
        <div class="segmented">
          <button class="${state.authMode === "login" ? "active" : ""}" data-auth-mode="login">로그인</button>
          <button class="${state.authMode === "register" ? "active" : ""}" data-auth-mode="register">회원가입</button>
        </div>
        <form class="auth-form">
          <label>
            아이디
            <input
              name="username"
              autocomplete="username"
              minlength="${AUTH_USERNAME_MIN_LENGTH}"
              maxlength="${AUTH_USERNAME_MAX_LENGTH}"
              pattern="[A-Za-z0-9_\\-]+"
              required
              ${disabled}
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              name="password"
              autocomplete="${state.authMode === "login" ? "current-password" : "new-password"}"
              minlength="${AUTH_PASSWORD_MIN_LENGTH}"
              required
              ${disabled}
            />
          </label>
          <p class="panel-note">아이디는 ${AUTH_USERNAME_MIN_LENGTH}-${AUTH_USERNAME_MAX_LENGTH}자의 영문, 숫자, 밑줄, 하이픈만 사용할 수 있고, 비밀번호는 ${AUTH_PASSWORD_MIN_LENGTH}자 이상이어야 합니다.</p>
          <button type="submit" class="primary" ${disabled}>
            ${state.pending ? "처리 중..." : state.authMode === "login" ? "접속하기" : "모험 시작"}
          </button>
        </form>
      </div>
    `;

    this.authPanel.querySelectorAll<HTMLButtonElement>("[data-auth-mode]").forEach((button) => {
      button.onclick = () => this.callbacks.onAuthModeChange(button.dataset.authMode as "login" | "register");
    });

    const form = this.authPanel.querySelector("form") as HTMLFormElement;
    form.onsubmit = (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      this.callbacks.onAuthSubmit(
        state.authMode,
        String(formData.get("username") ?? ""),
        String(formData.get("password") ?? ""),
      );
    };
  }

  private renderHud(state: AppState, currentLocation: LocationNode | null): void {
    const nearbyPlayers = state.presence.filter((entry) => entry.username !== state.player?.username);
    const locationTitle = currentLocation ? `${currentLocation.mainLocation} · ${currentLocation.subLocation}` : "월드 로딩 중";
    const overlayMode = state.battle ? "battle" : state.dialogue ? "dialogue" : "explore";
    const modeLabel = overlayMode === "battle" ? "전투" : overlayMode === "dialogue" ? "대화" : "탐험";

    this.hudPanel.classList.add("visible");
    this.hudPanel.innerHTML = `
      <div class="status-bar-inner">
        <div class="status-location">
          <div class="eyebrow">LOCATION</div>
          <strong>${escapeHtml(locationTitle)}</strong>
          <span>${state.player ? escapeHtml(state.player.username) : "로그인 필요"}</span>
        </div>
        <div class="status-meters">
          ${state.player ? this.renderPlayerMeters(state.player, nearbyPlayers.length) : this.renderLoadingMeters(state)}
        </div>
        <div class="status-actions" data-no-panel-drag>
          <span class="status-pill ${state.connectionStatus}">${state.connectionStatus}</span>
          <span class="status-pill mode-pill mode-${overlayMode}">${modeLabel}</span>
          <button class="ghost" data-save ${state.player ? "" : "disabled"}>저장</button>
        </div>
      </div>
    `;

    const saveButton = this.hudPanel.querySelector<HTMLButtonElement>("[data-save]");
    if (saveButton) {
      saveButton.onclick = () => this.callbacks.onSave();
    }
  }

  private renderActions(
    state: AppState,
    currentLocation: LocationNode | null,
    equipmentForLocation: EquipmentDefinition[],
    skillsForLocation: SkillDefinition[],
    equipped: EquipmentDefinition[],
    ownedEquipment: EquipmentDefinition[],
  ): void {
    const { player, battle, battleReport } = state;
    if (!player || !currentLocation) {
      this.actionPanelWasVisible = false;
      this.actionPanel.classList.remove("visible");
      this.actionPanel.innerHTML = "";
      return;
    }

    if (!this.actionPanelWasVisible) {
      this.activeSidePanel = "action";
      this.actionPanelWasVisible = true;
    }

    const restingVisible = currentLocation.subLocation === "여관";
    const equipmentButtons = equipmentForLocation
      .map((item) => {
        const owned = player.ownedEquipmentIds.includes(item.id);
        const equippedState = player.equippedEquipmentIds.includes(item.id);
        const card = describeEquipmentActionCard(item, {
          owned,
          equipped: equippedState,
        });
        return `
          <button class="dock-card" data-equipment="${escapeHtml(item.id)}">
            <span class="dock-card-media">
              <img src="${escapeHtml(item.texturePath)}" alt="" loading="lazy">
            </span>
            <span class="dock-card-content">
              <strong>${escapeHtml(card.title)}</strong>
              <span class="card-description">${escapeHtml(card.description)}</span>
              <span class="card-meta">${escapeHtml(card.meta)}</span>
              <span class="card-action">${escapeHtml(card.action)}</span>
            </span>
          </button>
        `;
      })
      .join("");
    const skillButtons = skillsForLocation
      .map((skill) => {
        const learned = player.learnedSkillIds.includes(skill.id);
        const card = describeSkillActionCard(skill, learned);
        return `
          <button class="dock-card" data-skill="${escapeHtml(skill.id)}">
            <strong>${escapeHtml(card.title)}</strong>
            <span class="card-description">${escapeHtml(card.description)}</span>
            <span class="card-meta">${escapeHtml(card.meta)}</span>
            <span class="card-action">${escapeHtml(card.action)}</span>
          </button>
        `;
      })
      .join("");
    const equippedPills = equipped.length > 0
      ? equipped.map((item) => `<span class="pill">${escapeHtml(item.name)}</span>`).join("")
      : `<span class="pill muted">장착 없음</span>`;

    const equippedBySlot = new Map(equipped.map((item) => [item.slot, item]));
    const equippedSlots = EQUIPMENT_SLOT_ORDER.map((slot) => {
      const item = equippedBySlot.get(slot);
      const slotLabel = EQUIPMENT_SLOT_LABELS[slot];
      if (!item) {
        return `
          <div class="equipment-slot empty" data-equipment-slot="${escapeHtml(slot)}">
            <span class="inventory-icon empty"></span>
            <span class="inventory-copy">
              <strong>${escapeHtml(slotLabel)}</strong>
              <span>비어 있음</span>
            </span>
          </div>
        `;
      }

      return `
        <button
          class="equipment-slot"
          type="button"
          data-inventory-equipment="${escapeHtml(item.id)}"
          data-equipment-slot="${escapeHtml(slot)}"
          title="${escapeHtml(`${slotLabel}: ${item.name} 장착 해제`)}"
          aria-pressed="true"
        >
          <span class="inventory-icon">
            <img src="${escapeHtml(item.texturePath)}" alt="" loading="lazy">
          </span>
          <span class="inventory-copy">
            <strong>${escapeHtml(slotLabel)}</strong>
            <span>${escapeHtml(item.name)} · 공격 +${item.attackBonus} · 명중 ${Math.round(item.accuracy * 100)}%</span>
          </span>
        </button>
      `;
    }).join("");
    const inventoryItems = ownedEquipment.length > 0
      ? ownedEquipment.map((item) => {
        const equippedState = player.equippedEquipmentIds.includes(item.id);
        const slotLabel = EQUIPMENT_SLOT_LABELS[item.slot];
        return `
          <button
            class="inventory-item ${equippedState ? "equipped" : ""}"
            type="button"
            data-inventory-equipment="${escapeHtml(item.id)}"
            title="${escapeHtml(`${slotLabel}: ${item.name}`)}"
            aria-pressed="${String(equippedState)}"
          >
            <span class="inventory-icon">
              <img src="${escapeHtml(item.texturePath)}" alt="" loading="lazy">
            </span>
            <span class="inventory-copy">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(slotLabel)} · 공격 +${item.attackBonus} · 명중 ${Math.round(item.accuracy * 100)}%</span>
            </span>
            ${equippedState ? `<span class="inventory-badge">E</span>` : ""}
          </button>
        `;
      }).join("")
      : `<div class="inventory-empty">보유한 아이템이 없습니다.</div>`;

    const hasContextActions = restingVisible || equipmentButtons || skillButtons;
    this.actionPanel.classList.add("visible");
    this.actionPanel.innerHTML = this.renderPanelFrame({
      key: "action",
      eyebrow: "FIELD ACTIONS",
      title: currentLocation.subLocation,
      collapsible: false,
      controls: `
        <div class="dock-summary">
          <span class="pill">${escapeHtml(currentLocation.mainLocation)}</span>
          ${equippedPills}
        </div>
      `,
      body: `
        <div class="equipment-layout">
          <section class="equipment-board" aria-label="장비창">
            <div class="inventory-section-heading">
              <h3>장비</h3>
              <span class="pill">${equipped.length} / ${EQUIPMENT_SLOT_ORDER.length}</span>
            </div>
            <div class="equipment-slots">
              ${equippedSlots}
            </div>
          </section>
          <section class="inventory-board" aria-label="인벤토리">
            <div class="inventory-section-heading">
              <h3>인벤토리</h3>
              <span class="pill">${ownedEquipment.length}</span>
            </div>
            <div class="inventory-grid">
              ${inventoryItems}
            </div>
          </section>
        </div>
        <div class="dock-grid">
          ${restingVisible ? `<button class="dock-card accent" data-rest><strong>숙박</strong><span>20 코인으로 HP/MP 회복</span></button>` : ""}
          ${equipmentButtons}
          ${skillButtons}
          ${!hasContextActions ? `<div class="dock-card static"><strong>탐험 구간</strong><span>출구 진입 후 Enter 로 씬 전환, NPC 근처에서 Space 로 대화</span></div>` : ""}
          ${battle ? `<div class="dock-card static danger"><strong>전투 진행 중</strong><span>오른쪽 전투 오버레이에서 행동을 선택하세요.</span></div>` : ""}
          ${battleReport ? `
            <div class="dock-card static ${battleReport.outcome === "enemy_win" ? "danger" : "accent"} report-card">
              <strong>${escapeHtml(battleReport.title)}</strong>
              <span>${escapeHtml(battleReport.summary)}</span>
              <span>최근 전투 로그 ${battleReport.lines.length}개가 오른쪽 패널에 반영되었습니다.</span>
            </div>
          ` : ""}
        </div>
      `,
    });

    this.actionPanel.querySelectorAll<HTMLButtonElement>("[data-equipment]").forEach((button) => {
      const equipmentId = button.dataset.equipment!;
      const owned = player.ownedEquipmentIds.includes(equipmentId);
      button.onclick = () => (owned ? this.callbacks.onToggleEquip(equipmentId) : this.callbacks.onBuyEquipment(equipmentId));
    });
    this.actionPanel.querySelectorAll<HTMLButtonElement>("[data-inventory-equipment]").forEach((button) => {
      const equipmentId = button.dataset.inventoryEquipment!;
      button.ondblclick = () => this.callbacks.onToggleEquip(equipmentId);
    });
    this.actionPanel.querySelectorAll<HTMLButtonElement>("[data-skill]").forEach((button) => {
      const skillId = button.dataset.skill!;
      button.onclick = () => this.callbacks.onLearnSkill(skillId);
    });
    const restButton = this.actionPanel.querySelector<HTMLButtonElement>("[data-rest]");
    if (restButton) {
      restButton.onclick = () => this.callbacks.onRest();
    }
    this.bindPanelToggle("action");
  }

  private renderDialogue(state: AppState): void {
    if (!state.dialogue) {
      this.dialoguePanel.classList.remove("visible");
      this.dialoguePanel.innerHTML = "";
      return;
    }

    const currentLine = state.dialogue.lines[state.dialogue.index] ?? "";
    this.dialoguePanel.classList.add("visible");
    this.dialoguePanel.innerHTML = this.renderPanelFrame({
      key: "dialogue",
      eyebrow: "DIALOGUE",
      title: state.dialogue.title,
      collapsible: false,
      controls: `<span class="pill">${state.dialogue.index + 1} / ${state.dialogue.lines.length}</span>`,
      body: `
        <p class="dialogue-line">${escapeHtml(currentLine)}</p>
        <div class="dialogue-footer">
          <p class="panel-note">Space 또는 Enter 로 계속 진행할 수 있습니다.</p>
          <button class="primary" data-dialogue-next>${state.dialogue.index >= state.dialogue.lines.length - 1 ? "닫기" : "다음"}</button>
        </div>
      `,
    });
    (this.dialoguePanel.querySelector("[data-dialogue-next]") as HTMLButtonElement).onclick = () => this.callbacks.onDialogueNext();
    this.bindPanelToggle("dialogue");
  }

  private renderBattle(battle: BattleState | null, skills: SkillDefinition[], tactics: TacticDefinition[]): void {
    if (!battle) {
      this.battlePanelWasVisible = false;
      this.battlePanel.classList.remove("visible");
      this.battlePanel.innerHTML = "";
      return;
    }

    if (!this.battlePanelWasVisible) {
      this.activeSidePanel = "battle";
      this.battlePanelWasVisible = true;
    }

    const statuses = [
      battle.charged ? "충전 완료" : null,
      battle.evadeNext ? "다음 반격 회피 준비" : null,
      battle.guardBreakTurns > 0 ? `가드 브레이크 ${battle.guardBreakTurns}턴` : null,
    ].filter((entry): entry is string => Boolean(entry));
    const enemyTexturePath = battle.enemy.texturePath ? escapeHtml(battle.enemy.texturePath) : null;

    this.battlePanel.classList.add("visible");
    this.battlePanel.innerHTML = this.renderPanelFrame({
      key: "battle",
      eyebrow: "BATTLE",
      title: battle.enemy.name,
      collapsible: false,
      controls: `<span class="pill">턴 ${battle.turnNumber}</span>`,
      body: `
        <div class="battle-showcase">
          <div class="battle-portrait ${battle.isBoss ? "boss" : ""}">
            ${enemyTexturePath ? `<img src="${enemyTexturePath}" alt="${escapeHtml(battle.enemy.name)}" loading="lazy">` : ""}
          </div>
          <div class="battle-stats">
            <div><span>적 HP</span><strong>${Math.round(battle.enemy.currentHp)} / ${battle.enemy.maxHp}</strong></div>
            <div><span>내 HP</span><strong>${Math.round(battle.player.currentHp)} / ${battle.player.maxHp}</strong></div>
            <div><span>내 MP</span><strong>${Math.round(battle.player.currentMp)} / ${battle.player.maxMp}</strong></div>
            <div><span>전황</span><strong>${battle.isBoss ? "보스전" : "일반전"}</strong></div>
          </div>
        </div>
        <div class="battle-status-strip">
          ${statuses.map((status) => `<span class="pill">${status}</span>`).join("") || `<span class="pill muted">지속 효과 없음</span>`}
        </div>
        <div class="battle-actions">
          <button data-battle-basic="attack"><strong>공격</strong><span>1</span></button>
          <button data-battle-basic="normal"><strong>일반</strong><span>2</span></button>
          <button data-battle-basic="defend"><strong>방어</strong><span>3</span></button>
        </div>
        <div class="action-stack">
          <h3>특수 기술</h3>
          ${skills.map((skill) => `
            <button data-battle-skill="${skill.id}" ${battle.player.currentMp < skill.manaCost ? "disabled" : ""}>
              <strong>${escapeHtml(skill.name)}</strong>
              <span>MP ${skill.manaCost}</span>
            </button>
          `).join("") || `<p class="panel-note">습득한 기술이 없습니다.</p>`}
        </div>
        <div class="action-stack">
          <h3>전술</h3>
          ${tactics.map((tactic) => `
            <button data-battle-tactic="${tactic.id}">
              <strong>${escapeHtml(tactic.name)}</strong>
              <span>${escapeHtml(tactic.description)}</span>
            </button>
          `).join("") || `<p class="panel-note">습득한 전술이 없습니다.</p>`}
        </div>
        <div class="action-stack battle-feed">
          <h3>최근 전황</h3>
          ${battle.log.slice(-6).map((entry) => `<div class="battle-feed-item">${escapeHtml(entry)}</div>`).join("")}
        </div>
      `,
    });

    this.battlePanel.querySelectorAll<HTMLButtonElement>("[data-battle-basic]").forEach((button) => {
      button.onclick = () => this.callbacks.onBattleAction({ kind: button.dataset.battleBasic as "attack" | "normal" | "defend" });
    });
    this.battlePanel.querySelectorAll<HTMLButtonElement>("[data-battle-skill]").forEach((button) => {
      button.onclick = () => this.callbacks.onBattleAction({ kind: "skill", skillId: button.dataset.battleSkill! });
    });
    this.battlePanel.querySelectorAll<HTMLButtonElement>("[data-battle-tactic]").forEach((button) => {
      button.onclick = () => this.callbacks.onBattleAction({ kind: "tactic", tacticId: button.dataset.battleTactic! });
    });
    this.bindPanelToggle("battle");
  }

  private renderChat(state: AppState): void {
    const nearbyPlayers = state.presence.filter((entry) => entry.username !== state.player?.username);
    const canChat = Boolean(state.player && state.connectionStatus === "online");
    const chatPlaceholder = state.connectionStatus === "online"
      ? "같은 씬의 유저에게 말하기"
      : "연결 복구 후 채팅 가능";

    this.chatPanel.classList.add("visible");
    this.chatPanel.innerHTML = this.renderPanelFrame({
      key: "chat",
      eyebrow: "SOCIAL",
      title: "지역 채팅",
      collapsible: false,
      controls: `<span class="status-pill ${state.connectionStatus}">${nearbyPlayers.length} nearby</span>`,
      body: `
        <div class="presence-strip">
          ${nearbyPlayers.map((presence) => `<span class="pill">${escapeHtml(presence.username)}</span>`).join("") || `<span class="pill muted">같은 씬의 다른 유저 없음</span>`}
        </div>
        <div class="chat-list">
          ${state.chatMessages
            .slice(-8)
            .map((message) => `<div class="chat-item"><strong>${escapeHtml(message.username)}</strong><span>${escapeHtml(message.text)}</span></div>`)
            .join("") || `<p class="panel-note">${state.connectionStatus === "online" ? "같은 씬의 유저에게 말을 걸 수 있습니다." : "실시간 연결이 복구되면 채팅이 다시 활성화됩니다."}</p>`}
        </div>
        <form class="chat-form">
          <input name="text" placeholder="${escapeHtml(chatPlaceholder)}" ${canChat ? "" : "disabled"} />
          <button type="submit" class="primary" ${canChat ? "" : "disabled"}>전송</button>
        </form>
      `,
    });
    const form = this.chatPanel.querySelector(".chat-form") as HTMLFormElement;
    form.onsubmit = (event) => {
      event.preventDefault();
      const input = this.chatPanel.querySelector<HTMLInputElement>("input[name='text']");
      const value = input?.value.trim() ?? "";
      if (value) {
        this.callbacks.onSendChat(value);
        if (input) input.value = "";
      }
    };
    this.bindPanelToggle("chat");
  }

  private renderLogs(logs: string[]): void {
    this.logPanel.classList.add("visible");
    this.logPanel.innerHTML = this.renderPanelFrame({
      key: "log",
      eyebrow: "EVENT FEED",
      title: "최근 이벤트",
      collapsible: false,
      controls: `<span class="pill">${Math.min(logs.length, 6)} entries</span>`,
      body: `
        <div class="log-list">
          ${logs.slice(0, 6).map((entry) => `<div class="log-item">${escapeHtml(entry)}</div>`).join("") || `<p class="panel-note">저장, 이동, 전투 결과가 여기에 쌓입니다.</p>`}
        </div>
      `,
    });
    this.bindPanelToggle("log");
  }

  private renderPlayerMeters(player: PlayerSave, nearbyCount: number): string {
    return `
      <div class="meter-card"><span>Lv</span><strong>${player.level}</strong></div>
      <div class="meter-card"><span>HP</span><strong>${Math.round(player.currentHp)}</strong></div>
      <div class="meter-card"><span>MP</span><strong>${Math.round(player.currentMp)}</strong></div>
      <div class="meter-card"><span>Coin</span><strong>${player.coins}</strong></div>
      <div class="meter-card"><span>Atk</span><strong>${player.attack}</strong></div>
      <div class="meter-card"><span>Def</span><strong>${player.defense}</strong></div>
      <div class="meter-card"><span>Nearby</span><strong>${nearbyCount}</strong></div>
    `;
  }

  private renderLoadingMeters(state: AppState): string {
    return `
      <div class="meter-card"><span>World</span><strong>${state.world ? "ready" : "loading"}</strong></div>
      <div class="meter-card"><span>Status</span><strong>${state.pending ? "auth" : "idle"}</strong></div>
      <div class="meter-card"><span>Scene</span><strong>${state.world ? "login" : "boot"}</strong></div>
    `;
  }
}
