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
      <div class="shell">
        <aside class="sidebar">
          <section class="panel auth-panel"></section>
          <section class="panel hud-panel"></section>
          <section class="panel action-panel"></section>
          <section class="panel log-panel"></section>
        </aside>
        <main class="stage-wrap">
          <div class="stage-header">
            <div>
              <h1>RPG Rebuild</h1>
              <p>탑다운 탐험, 지역 채팅, 유저 실시간 표시</p>
            </div>
          </div>
          <div class="stage-canvas"></div>
          <section class="panel dialogue-panel"></section>
          <section class="panel battle-panel"></section>
          <section class="panel chat-panel"></section>
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
    this.renderHud(state.player, currentLocation);
    this.renderActions(state.player, currentLocation, state.battle, equipmentForLocation, skillForLocation, equipped);
    this.renderDialogue(state);
    this.renderBattle(state.battle, learnedSkills, learnedTactics);
    this.renderChat(state);
    this.renderLogs(state.logs);
  }

  private renderAuth(state: AppState): void {
    const disabled = state.pending ? "disabled" : "";
    this.authPanel.innerHTML = `
      <div class="panel-header">
        <h2>계정</h2>
      </div>
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
        <button type="submit" ${disabled}>${state.authMode === "login" ? "접속" : "시작하기"}</button>
      </form>
      <p class="panel-note">${state.player ? `${state.player.username} 접속 중` : "로그인 후 게임이 시작됩니다."}</p>
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

  private renderHud(player: PlayerSave | null, currentLocation: LocationNode | null): void {
    if (!player) {
      this.hudPanel.innerHTML = `
        <div class="panel-header"><h2>상태</h2></div>
        <p class="panel-note">접속하면 현재 위치와 스탯이 여기에 표시됩니다.</p>
      `;
      return;
    }

    this.hudPanel.innerHTML = `
      <div class="panel-header">
        <h2>상태</h2>
        <button class="ghost" data-save>저장</button>
      </div>
      <div class="stat-grid">
        <div><span>위치</span><strong>${currentLocation?.mainLocation ?? "-"}</strong></div>
        <div><span>세부</span><strong>${currentLocation?.subLocation ?? "-"}</strong></div>
        <div><span>레벨</span><strong>${player.level}</strong></div>
        <div><span>코인</span><strong>${player.coins}</strong></div>
        <div><span>HP</span><strong>${Math.round(player.currentHp)}</strong></div>
        <div><span>MP</span><strong>${Math.round(player.currentMp)}</strong></div>
        <div><span>공격</span><strong>${player.attack}</strong></div>
        <div><span>방어</span><strong>${player.defense}</strong></div>
      </div>
    `;
    (this.hudPanel.querySelector("[data-save]") as HTMLButtonElement).onclick = () => this.callbacks.onSave();
  }

  private renderActions(
    player: PlayerSave | null,
    currentLocation: LocationNode | null,
    battle: BattleState | null,
    equipmentForLocation: EquipmentDefinition[],
    skillsForLocation: SkillDefinition[],
    equipped: EquipmentDefinition[],
  ): void {
    if (!player || !currentLocation) {
      this.actionPanel.innerHTML = `<div class="panel-header"><h2>행동</h2></div><p class="panel-note">게임에 접속하면 상점과 휴식 메뉴가 열립니다.</p>`;
      return;
    }

    const restingVisible = currentLocation.subLocation === "여관";
    const equipmentButtons = equipmentForLocation
      .map((item) => {
        const owned = player.ownedEquipmentIds.includes(item.id);
        const equippedState = player.equippedEquipmentIds.includes(item.id);
        return `
          <button data-equipment="${item.id}">
            ${owned ? (equippedState ? "장착 해제/교체" : "장착") : `구매 ${item.cost}`}
            <span>${item.name}</span>
          </button>
        `;
      })
      .join("");
    const skillButtons = skillsForLocation
      .map((skill) => {
        const learned = player.learnedSkillIds.includes(skill.id);
        return `
          <button data-skill="${skill.id}">
            ${learned ? "습득 완료" : `습득 ${skill.cost}`}
            <span>${skill.name}</span>
          </button>
        `;
      })
      .join("");

    this.actionPanel.innerHTML = `
      <div class="panel-header">
        <h2>현장 메뉴</h2>
      </div>
      <div class="panel-note">전투 중에는 전투 패널을 사용하세요. 탐험 중에는 위치에 맞는 상호작용이 열립니다.</div>
      ${restingVisible ? `<button class="action-wide" data-rest>숙박 20 코인</button>` : ""}
      ${equipmentButtons ? `<div class="action-stack"><h3>무기 상점</h3>${equipmentButtons}</div>` : ""}
      ${skillButtons ? `<div class="action-stack"><h3>기술 상점</h3>${skillButtons}</div>` : ""}
      ${equipped.length > 0 ? `<div class="action-stack"><h3>장착 중</h3>${equipped.map((item) => `<span class="pill">${item.name}</span>`).join("")}</div>` : ""}
      ${battle ? `<p class="panel-note">전투가 진행 중이라 상점/휴식은 비활성 상태입니다.</p>` : ""}
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
      <div class="panel-header"><h2>${state.dialogue.title}</h2></div>
      <p class="dialogue-line">${currentLine}</p>
      <button data-dialogue-next>${state.dialogue.index >= state.dialogue.lines.length - 1 ? "닫기" : "다음"}</button>
    `;
    (this.dialoguePanel.querySelector("[data-dialogue-next]") as HTMLButtonElement).onclick = () => this.callbacks.onDialogueNext();
  }

  private renderBattle(battle: BattleState | null, skills: SkillDefinition[], tactics: TacticDefinition[]): void {
    if (!battle) {
      this.battlePanel.classList.remove("visible");
      this.battlePanel.innerHTML = "";
      return;
    }

    this.battlePanel.classList.add("visible");
    this.battlePanel.innerHTML = `
      <div class="panel-header"><h2>전투</h2></div>
      <div class="battle-stats">
        <div><span>적</span><strong>${battle.enemy.name}</strong></div>
        <div><span>적 HP</span><strong>${Math.round(battle.enemy.currentHp)} / ${battle.enemy.maxHp}</strong></div>
        <div><span>내 HP</span><strong>${Math.round(battle.player.currentHp)} / ${battle.player.maxHp}</strong></div>
        <div><span>내 MP</span><strong>${Math.round(battle.player.currentMp)} / ${battle.player.maxMp}</strong></div>
      </div>
      <div class="battle-actions">
        <button data-battle-basic="attack">공격</button>
        <button data-battle-basic="normal">일반</button>
        <button data-battle-basic="defend">방어</button>
      </div>
      <div class="action-stack">
        <h3>특수 기술</h3>
        ${skills.map((skill) => `<button data-battle-skill="${skill.id}">${skill.name}<span>MP ${skill.manaCost}</span></button>`).join("") || `<p class="panel-note">습득한 기술이 없습니다.</p>`}
      </div>
      <div class="action-stack">
        <h3>전술</h3>
        ${tactics.map((tactic) => `<button data-battle-tactic="${tactic.id}">${tactic.name}</button>`).join("") || `<p class="panel-note">습득한 전술이 없습니다.</p>`}
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
    this.chatPanel.innerHTML = `
      <div class="panel-header">
        <h2>지역 채팅</h2>
        <span class="status-dot ${state.connectionStatus}">${state.connectionStatus}</span>
      </div>
      <div class="chat-list">
        ${state.chatMessages
          .slice(-12)
          .map((message) => `<div class="chat-item"><strong>${message.username}</strong><span>${message.text}</span></div>`)
          .join("") || `<p class="panel-note">같은 씬의 다른 유저와 대화할 수 있습니다.</p>`}
      </div>
      <form class="chat-form">
        <input name="text" placeholder="같은 씬의 유저에게 말하기" ${state.player ? "" : "disabled"} />
        <button type="submit" ${state.player ? "" : "disabled"}>전송</button>
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
      <div class="panel-header"><h2>이벤트 로그</h2></div>
      <div class="log-list">
        ${logs.map((entry) => `<div class="log-item">${entry}</div>`).join("") || `<p class="panel-note">전투, 상점, 저장 결과가 여기에 기록됩니다.</p>`}
      </div>
    `;
  }
}
