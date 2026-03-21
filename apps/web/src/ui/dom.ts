import type {
  BattleState,
  EquipmentDefinition,
  LocationNode,
  PlayerSave,
  SkillDefinition,
  TacticDefinition,
} from "@rpg/game-core";
import type { AppState } from "../state/store";

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

export class DomUi {
  private readonly root: HTMLElement;
  private readonly appShell: HTMLElement;
  private readonly authPanel: HTMLElement;
  private readonly hudPanel: HTMLElement;
  private readonly actionPanel: HTMLElement;
  private readonly dialoguePanel: HTMLElement;
  private readonly battlePanel: HTMLElement;
  private readonly chatPanel: HTMLElement;
  private readonly logPanel: HTMLElement;

  constructor(root: HTMLElement, private readonly callbacks: UiCallbacks) {
    this.root = root;
    this.root.innerHTML = `
      <div class="viewport-shell">
        <div class="atmosphere atmosphere-one"></div>
        <div class="atmosphere atmosphere-two"></div>
        <main class="game-stage">
          <div class="stage-canvas"></div>
          <div class="ui-layer">
            <header class="panel hud-panel"></header>
            <aside class="panel log-panel"></aside>
            <aside class="panel chat-panel"></aside>
            <section class="panel action-panel"></section>
            <section class="panel dialogue-panel"></section>
            <section class="panel battle-panel"></section>
            <section class="panel auth-panel"></section>
          </div>
        </main>
      </div>
    `;

    this.appShell = this.root.querySelector(".stage-canvas") as HTMLElement;
    this.authPanel = this.root.querySelector(".auth-panel") as HTMLElement;
    this.hudPanel = this.root.querySelector(".hud-panel") as HTMLElement;
    this.actionPanel = this.root.querySelector(".action-panel") as HTMLElement;
    this.dialoguePanel = this.root.querySelector(".dialogue-panel") as HTMLElement;
    this.battlePanel = this.root.querySelector(".battle-panel") as HTMLElement;
    this.chatPanel = this.root.querySelector(".chat-panel") as HTMLElement;
    this.logPanel = this.root.querySelector(".log-panel") as HTMLElement;
  }

  getGameContainer(): HTMLElement {
    return this.appShell;
  }

  render(
    state: AppState,
    currentLocation: LocationNode | null,
    equipmentForLocation: EquipmentDefinition[],
    skillForLocation: SkillDefinition[],
    equipped: EquipmentDefinition[],
    learnedSkills: SkillDefinition[],
    learnedTactics: TacticDefinition[],
  ): void {
    this.renderAuth(state);
    this.renderHud(state, currentLocation);
    this.renderActions(state, currentLocation, equipmentForLocation, skillForLocation, equipped);
    this.renderDialogue(state);
    this.renderBattle(state.battle, learnedSkills, learnedTactics);
    this.renderChat(state);
    this.renderLogs(state.logs);
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
            <input name="username" autocomplete="username" ${disabled} />
          </label>
          <label>
            비밀번호
            <input type="password" name="password" autocomplete="current-password" ${disabled} />
          </label>
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
    const prompt = state.fieldPrompt;

    this.hudPanel.innerHTML = `
      <div class="hud-row">
        <div class="hud-brand">
          <div class="eyebrow">OVERWORLD MVP</div>
          <h1>${locationTitle}</h1>
          <p>${state.player ? "WASD 이동 · Space 대화 · Enter 전환 · B 교전" : "접속 후 오버월드 탐험이 활성화됩니다."}</p>
        </div>
        <div class="hud-meta">
          <span class="status-pill ${state.connectionStatus}">${state.connectionStatus}</span>
          <span class="status-pill mode-pill mode-${overlayMode}">${overlayMode}</span>
          <button class="ghost" data-save ${state.player ? "" : "disabled"}>저장</button>
        </div>
      </div>
      <div class="meter-grid">
        ${state.player ? this.renderPlayerMeters(state.player, nearbyPlayers.length) : this.renderLoadingMeters(state)}
      </div>
      ${prompt ? `
        <div class="context-card ${prompt.tone}">
          <div>
            <div class="eyebrow">FIELD PROMPT</div>
            <h3>${prompt.title}</h3>
            <p>${prompt.body}</p>
          </div>
          <span class="pill">${prompt.actionLabel}</span>
        </div>
      ` : ""}
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
  ): void {
    const { player, battle, battleReport } = state;
    if (!player || !currentLocation) {
      this.actionPanel.classList.remove("visible");
      this.actionPanel.innerHTML = "";
      return;
    }

    const restingVisible = currentLocation.subLocation === "여관";
    const equipmentButtons = equipmentForLocation
      .map((item) => {
        const owned = player.ownedEquipmentIds.includes(item.id);
        const equippedState = player.equippedEquipmentIds.includes(item.id);
        return `
          <button class="dock-card" data-equipment="${item.id}">
            <strong>${item.name}</strong>
            <span>${owned ? (equippedState ? "장착 해제/교체" : "장착") : `${item.cost} 코인 구매`}</span>
          </button>
        `;
      })
      .join("");
    const skillButtons = skillsForLocation
      .map((skill) => {
        const learned = player.learnedSkillIds.includes(skill.id);
        return `
          <button class="dock-card" data-skill="${skill.id}">
            <strong>${skill.name}</strong>
            <span>${learned ? "습득 완료" : `${skill.cost} 코인 습득`}</span>
          </button>
        `;
      })
      .join("");
    const equippedPills = equipped.length > 0
      ? equipped.map((item) => `<span class="pill">${item.name}</span>`).join("")
      : `<span class="pill muted">장착 없음</span>`;

    const hasContextActions = restingVisible || equipmentButtons || skillButtons;
    this.actionPanel.classList.add("visible");
    this.actionPanel.innerHTML = `
      <div class="dock-header">
        <div>
          <div class="eyebrow">FIELD ACTIONS</div>
          <h2>${currentLocation.subLocation}</h2>
        </div>
        <div class="dock-summary">
          <span class="pill">${currentLocation.mainLocation}</span>
          ${equippedPills}
        </div>
      </div>
      <div class="dock-grid">
        ${restingVisible ? `<button class="dock-card accent" data-rest><strong>숙박</strong><span>20 코인으로 HP/MP 회복</span></button>` : ""}
        ${equipmentButtons}
        ${skillButtons}
        ${!hasContextActions ? `<div class="dock-card static"><strong>탐험 구간</strong><span>출구 진입 후 Enter 로 씬 전환, NPC 근처에서 Space 로 대화</span></div>` : ""}
        ${battle ? `<div class="dock-card static danger"><strong>전투 진행 중</strong><span>오른쪽 전투 오버레이에서 행동을 선택하세요.</span></div>` : ""}
        ${battleReport ? `
          <div class="dock-card static ${battleReport.outcome === "enemy_win" ? "danger" : "accent"} report-card">
            <strong>${battleReport.title}</strong>
            <span>${battleReport.summary}</span>
            <span>최근 전투 로그 ${battleReport.lines.length}개가 오른쪽 패널에 반영되었습니다.</span>
          </div>
        ` : ""}
      </div>
    `;

    this.actionPanel.querySelectorAll<HTMLButtonElement>("[data-equipment]").forEach((button) => {
      const equipmentId = button.dataset.equipment!;
      const owned = player.ownedEquipmentIds.includes(equipmentId);
      button.onclick = () => (owned ? this.callbacks.onToggleEquip(equipmentId) : this.callbacks.onBuyEquipment(equipmentId));
    });
    this.actionPanel.querySelectorAll<HTMLButtonElement>("[data-skill]").forEach((button) => {
      const skillId = button.dataset.skill!;
      button.onclick = () => this.callbacks.onLearnSkill(skillId);
    });
    const restButton = this.actionPanel.querySelector<HTMLButtonElement>("[data-rest]");
    if (restButton) {
      restButton.onclick = () => this.callbacks.onRest();
    }
  }

  private renderDialogue(state: AppState): void {
    if (!state.dialogue) {
      this.dialoguePanel.classList.remove("visible");
      this.dialoguePanel.innerHTML = "";
      return;
    }

    const currentLine = state.dialogue.lines[state.dialogue.index] ?? "";
    this.dialoguePanel.classList.add("visible");
    this.dialoguePanel.innerHTML = `
      <div class="eyebrow">DIALOGUE</div>
      <div class="panel-header">
        <h2>${state.dialogue.title}</h2>
        <span>${state.dialogue.index + 1} / ${state.dialogue.lines.length}</span>
      </div>
      <p class="dialogue-line">${currentLine}</p>
      <div class="dialogue-footer">
        <p class="panel-note">Space 또는 Enter 로 계속 진행할 수 있습니다.</p>
        <button class="primary" data-dialogue-next>${state.dialogue.index >= state.dialogue.lines.length - 1 ? "닫기" : "다음"}</button>
      </div>
    `;
    (this.dialoguePanel.querySelector("[data-dialogue-next]") as HTMLButtonElement).onclick = () => this.callbacks.onDialogueNext();
  }

  private renderBattle(battle: BattleState | null, skills: SkillDefinition[], tactics: TacticDefinition[]): void {
    if (!battle) {
      this.battlePanel.classList.remove("visible");
      this.battlePanel.innerHTML = "";
      return;
    }

    const statuses = [
      battle.charged ? "충전 완료" : null,
      battle.evadeNext ? "다음 반격 회피 준비" : null,
      battle.guardBreakTurns > 0 ? `가드 브레이크 ${battle.guardBreakTurns}턴` : null,
    ].filter((entry): entry is string => Boolean(entry));

    this.battlePanel.classList.add("visible");
    this.battlePanel.innerHTML = `
      <div class="eyebrow">BATTLE</div>
      <div class="panel-header">
        <h2>${battle.enemy.name}</h2>
        <span>턴 ${battle.turnNumber}</span>
      </div>
      <div class="battle-stats">
        <div><span>적 HP</span><strong>${Math.round(battle.enemy.currentHp)} / ${battle.enemy.maxHp}</strong></div>
        <div><span>내 HP</span><strong>${Math.round(battle.player.currentHp)} / ${battle.player.maxHp}</strong></div>
        <div><span>내 MP</span><strong>${Math.round(battle.player.currentMp)} / ${battle.player.maxMp}</strong></div>
        <div><span>전황</span><strong>${battle.isBoss ? "보스전" : "일반전"}</strong></div>
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
            <strong>${skill.name}</strong>
            <span>MP ${skill.manaCost}</span>
          </button>
        `).join("") || `<p class="panel-note">습득한 기술이 없습니다.</p>`}
      </div>
      <div class="action-stack">
        <h3>전술</h3>
        ${tactics.map((tactic) => `
          <button data-battle-tactic="${tactic.id}">
            <strong>${tactic.name}</strong>
            <span>${tactic.description}</span>
          </button>
        `).join("") || `<p class="panel-note">습득한 전술이 없습니다.</p>`}
      </div>
      <div class="action-stack battle-feed">
        <h3>최근 전황</h3>
        ${battle.log.slice(-6).map((entry) => `<div class="battle-feed-item">${entry}</div>`).join("")}
      </div>
    `;

    this.battlePanel.querySelectorAll<HTMLButtonElement>("[data-battle-basic]").forEach((button) => {
      button.onclick = () => this.callbacks.onBattleAction({ kind: button.dataset.battleBasic as "attack" | "normal" | "defend" });
    });
    this.battlePanel.querySelectorAll<HTMLButtonElement>("[data-battle-skill]").forEach((button) => {
      button.onclick = () => this.callbacks.onBattleAction({ kind: "skill", skillId: button.dataset.battleSkill! });
    });
    this.battlePanel.querySelectorAll<HTMLButtonElement>("[data-battle-tactic]").forEach((button) => {
      button.onclick = () => this.callbacks.onBattleAction({ kind: "tactic", tacticId: button.dataset.battleTactic! });
    });
  }

  private renderChat(state: AppState): void {
    const nearbyPlayers = state.presence.filter((entry) => entry.username !== state.player?.username);

    this.chatPanel.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="eyebrow">SOCIAL</div>
          <h2>지역 채팅</h2>
        </div>
        <span class="status-pill ${state.connectionStatus}">${nearbyPlayers.length} nearby</span>
      </div>
      <div class="presence-strip">
        ${nearbyPlayers.map((presence) => `<span class="pill">${presence.username}</span>`).join("") || `<span class="pill muted">같은 씬의 다른 유저 없음</span>`}
      </div>
      <div class="chat-list">
        ${state.chatMessages
          .slice(-8)
          .map((message) => `<div class="chat-item"><strong>${message.username}</strong><span>${message.text}</span></div>`)
          .join("") || `<p class="panel-note">같은 씬의 유저에게 말을 걸 수 있습니다.</p>`}
      </div>
      <form class="chat-form">
        <input name="text" placeholder="같은 씬의 유저에게 말하기" ${state.player ? "" : "disabled"} />
        <button type="submit" class="primary" ${state.player ? "" : "disabled"}>전송</button>
      </form>
    `;
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
  }

  private renderLogs(logs: string[]): void {
    this.logPanel.innerHTML = `
      <div class="panel-header">
        <div>
          <div class="eyebrow">EVENT FEED</div>
          <h2>최근 이벤트</h2>
        </div>
      </div>
      <div class="log-list">
        ${logs.slice(0, 6).map((entry) => `<div class="log-item">${entry}</div>`).join("") || `<p class="panel-note">저장, 이동, 전투 결과가 여기에 쌓입니다.</p>`}
      </div>
    `;
  }

  private renderPlayerMeters(player: PlayerSave, nearbyCount: number): string {
    return `
      <div class="meter-card"><span>Lv</span><strong>${player.level}</strong></div>
      <div class="meter-card"><span>HP</span><strong>${Math.round(player.currentHp)}</strong></div>
      <div class="meter-card"><span>MP</span><strong>${Math.round(player.currentMp)}</strong></div>
      <div class="meter-card"><span>Coin</span><strong>${player.coins}</strong></div>
      <div class="meter-card"><span>Atk</span><strong>${player.attack}</strong></div>
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
