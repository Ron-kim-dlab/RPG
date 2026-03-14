import type {
  BattleAction,
  DialogueNpc,
  EncounterZone,
  EquipmentDefinition,
  Facing,
  LocationNode,
  PlayerSave,
  PresenceState,
  SkillDefinition,
  TacticDefinition,
  WorldContent,
} from "@rpg/game-core";
import {
  createBattle,
  ensureStoryState,
  getMaxHp,
  getMaxMp,
  performBattleAction,
  pickRandom,
} from "@rpg/game-core";
import { ApiClient } from "./net/api";
import { PresenceClient } from "./net/socket";
import { GameBridge } from "./game/GameBridge";
import { AppStore } from "./state/store";
import { DomUi } from "./ui/dom";

const TOKEN_KEY = "rpg-rebuild-token";

export class AppController {
  private readonly store = new AppStore();
  private readonly api = new ApiClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000");
  private readonly ui: DomUi;
  private readonly game: GameBridge;
  private readonly presence: PresenceClient;
  private lastSavedAt = 0;

  constructor(root: HTMLElement) {
    this.ui = new DomUi(root, {
      onAuthSubmit: (mode, username, password) => {
        void this.authenticate(mode, username, password);
      },
      onAuthModeChange: (mode) => this.store.setState({ authMode: mode }),
      onSave: () => {
        void this.savePlayer("수동 저장 완료");
      },
      onDialogueNext: () => {
        void this.advanceDialogue();
      },
      onBattleAction: (action) => {
        void this.performAction(action as BattleAction);
      },
      onBuyEquipment: (equipmentId) => {
        void this.buyEquipment(equipmentId);
      },
      onToggleEquip: (equipmentId) => {
        void this.toggleEquipment(equipmentId);
      },
      onLearnSkill: (skillId) => {
        void this.learnSkill(skillId);
      },
      onRest: () => {
        void this.restAtInn();
      },
      onSendChat: (text) => this.presence.sendChat(text),
    });

    this.game = new GameBridge(this.ui.getGameContainer(), {
      canMove: () => {
        const state = this.store.getState();
        return Boolean(state.player && !state.battle && !state.dialogue);
      },
      onPositionChange: (x, y, facing) => this.updatePosition(x, y, facing),
      onSceneChange: (locationKey) => {
        void this.changeLocation(locationKey);
      },
      onInteractNpc: (npc) => this.openNpcDialogue(npc),
      onEncounter: (zone) => {
        void this.startEncounter(zone);
      },
    });

    this.presence = new PresenceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000", {
      onSnapshot: (snapshot) => this.setPresence(snapshot),
      onPresenceUpdate: (presence) => this.mergePresence(presence),
      onPresenceLeft: (username) => this.removePresence(username),
      onChatMessage: (message) => {
        this.store.update((state) => ({
          ...state,
          chatMessages: [...state.chatMessages, message].slice(-40),
        }));
      },
      onConnect: () => this.store.setState({ connectionStatus: "online" }),
      onDisconnect: () => this.store.setState({ connectionStatus: "offline" }),
    });

    this.store.subscribe((state) => {
      const currentLocation = state.player && state.world ? state.world.locations[state.player.locationKey] ?? null : null;
      const equipmentMap = this.equipmentMap;
      const skillMap = this.skillMap;
      const tacticMap = this.tacticMap;
      const equipmentForLocation = currentLocation
        ? currentLocation.subLocation === "무기 상점"
          ? Object.values(equipmentMap).filter((item) => item.village === currentLocation.mainLocation)
          : []
        : [];
      const skillsForLocation = currentLocation
        ? currentLocation.subLocation === "기술 상점"
          ? Object.values(skillMap).filter((item) => item.village === currentLocation.mainLocation)
          : []
        : [];
      const equipped = state.player
        ? state.player.equippedEquipmentIds.map((id) => equipmentMap[id]).filter((value): value is EquipmentDefinition => Boolean(value))
        : [];
      const learnedSkills = state.player
        ? state.player.learnedSkillIds.map((id) => skillMap[id]).filter((value): value is SkillDefinition => Boolean(value))
        : [];
      const learnedTactics = state.player
        ? state.player.learnedTacticIds.map((id) => tacticMap[id]).filter((value): value is TacticDefinition => Boolean(value))
        : [];

      this.ui.render(state, currentLocation, equipmentForLocation, skillsForLocation, equipped, learnedSkills, learnedTactics);
      this.game.sync(state.world, state.player, state.presence);
    });
  }

  async start(): Promise<void> {
    this.store.setState({ pending: true });
    try {
      const world = await this.api.bootstrap();
      this.store.setState({ world });

      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const player = await this.api.me(token);
          this.store.setState({ token, player, pending: false });
          this.presence.connect(token);
          this.enterPresence(player, false);
          await this.maybeOpenLocationDialogue(player.locationKey);
          return;
        } catch {
          localStorage.removeItem(TOKEN_KEY);
        }
      }
    } catch (error) {
      this.store.pushLog(error instanceof Error ? error.message : "콘텐츠 로딩 실패");
    }

    this.store.setState({ pending: false });
  }

  private get world(): WorldContent {
    const world = this.store.getState().world;
    if (!world) {
      throw new Error("World not loaded yet.");
    }
    return world;
  }

  private get equipmentMap(): Record<string, EquipmentDefinition> {
    return Object.fromEntries(this.world.equipment.map((item) => [item.id, item]));
  }

  private get skillMap(): Record<string, SkillDefinition> {
    return Object.fromEntries(this.world.skills.map((item) => [item.id, item]));
  }

  private get tacticMap(): Record<string, TacticDefinition> {
    return Object.fromEntries(this.world.tactics.map((item) => [item.id, item]));
  }

  private get currentLocation(): LocationNode | null {
    const state = this.store.getState();
    return state.player ? this.world.locations[state.player.locationKey] ?? null : null;
  }

  private async authenticate(mode: "login" | "register", username: string, password: string): Promise<void> {
    this.store.setState({ pending: true });
    try {
      const session = mode === "login" ? await this.api.login(username, password) : await this.api.register(username, password);
      localStorage.setItem(TOKEN_KEY, session.token);
      this.store.setState({
        token: session.token,
        player: session.player,
        battle: null,
        dialogue: null,
        chatMessages: [],
        presence: [],
        pending: false,
      });
      this.store.pushLog(`${username} ${mode === "login" ? "로그인" : "회원가입"} 성공`);
      this.presence.connect(session.token);
      this.enterPresence(session.player, false);
      await this.maybeOpenLocationDialogue(session.player.locationKey);
    } catch (error) {
      this.store.setState({ pending: false });
      this.store.pushLog(error instanceof Error ? error.message : "인증 실패");
    }
  }

  private updatePosition(x: number, y: number, facing: Facing): void {
    const state = this.store.getState();
    if (!state.player || !state.world) {
      return;
    }
    const nextPlayer: PlayerSave = {
      ...state.player,
      position: { x, y },
      facing,
    };
    this.store.setState({ player: nextPlayer });
    const sceneId = state.world.locations[nextPlayer.locationKey]?.scene.sceneId;
    if (sceneId) {
      this.presence.updatePosition(x, y, facing);
    }
  }

  private async changeLocation(locationKey: string): Promise<void> {
    const state = this.store.getState();
    if (!state.player || !state.world) {
      return;
    }
    const nextLocation = state.world.locations[locationKey];
    if (!nextLocation) {
      return;
    }

    let nextPlayer = ensureStoryState(state.player, locationKey);
    nextPlayer = {
      ...nextPlayer,
      locationKey,
      position: { ...nextLocation.scene.spawn },
      facing: "down",
      visitedMainLocations: Array.from(new Set([...nextPlayer.visitedMainLocations, nextLocation.mainLocation])),
      visitedLocationKeys: Array.from(new Set([...nextPlayer.visitedLocationKeys, locationKey])),
    };

    this.store.setState({
      player: nextPlayer,
      presence: [],
      chatMessages: [],
    });
    this.enterPresence(nextPlayer, true);
    this.store.pushLog(`${nextLocation.subLocation}(으)로 이동했습니다.`);
    await this.maybeOpenLocationDialogue(locationKey);
    await this.savePlayer();
  }

  private openNpcDialogue(npc: DialogueNpc): void {
    const state = this.store.getState();
    if (!state.player) {
      return;
    }

    this.store.setState({
      dialogue: {
        title: npc.name,
        locationKey: state.player.locationKey,
        lines: npc.lines,
        index: 0,
      },
    });
  }

  private async maybeOpenLocationDialogue(locationKey: string): Promise<void> {
    const state = this.store.getState();
    if (!state.player) {
      return;
    }

    const nextPlayer = ensureStoryState(state.player, locationKey);
    const location = this.world.locations[locationKey];
    if (!location) {
      return;
    }
    const story = nextPlayer.storyState[locationKey];
    if (state.player !== nextPlayer) {
      this.store.setState({ player: nextPlayer });
    }

    if (story && !story.completed && location.story.length > 0) {
      this.store.setState({
        dialogue: {
          title: `${location.subLocation} 이야기`,
          locationKey,
          lines: location.story,
          index: story.currentIndex,
        },
      });
    }
  }

  private async advanceDialogue(): Promise<void> {
    const state = this.store.getState();
    if (!state.player || !state.dialogue) {
      return;
    }

    if (state.dialogue.index < state.dialogue.lines.length - 1) {
      this.store.setState({
        dialogue: {
          ...state.dialogue,
          index: state.dialogue.index + 1,
        },
      });
      return;
    }

    const nextPlayer: PlayerSave = {
      ...state.player,
      storyState: {
        ...state.player.storyState,
        [state.dialogue.locationKey]: {
          completed: true,
          currentIndex: state.dialogue.lines.length - 1,
        },
      },
    };

    this.store.setState({
      player: nextPlayer,
      dialogue: null,
    });
    await this.savePlayer();
  }

  private async startEncounter(zone: EncounterZone): Promise<void> {
    const state = this.store.getState();
    if (!state.player || state.battle) {
      return;
    }

    const enemyId = pickRandom(zone.enemyIds, Math.random);
    const enemy = this.world.enemies[enemyId];
    if (!enemy) {
      return;
    }

    this.store.setState({
      battle: createBattle(state.player, enemy),
    });
    this.store.pushLog(`${enemy.name}과(와) 전투를 시작합니다.`);
  }

  private async performAction(action: BattleAction): Promise<void> {
    const state = this.store.getState();
    if (!state.player || !state.battle) {
      return;
    }

    const resolution = performBattleAction({
      player: state.player,
      state: state.battle,
      action,
      skills: this.skillMap,
      tactics: this.tacticMap,
      equipment: this.equipmentMap,
      enemies: this.world.enemies,
    });

    let nextPlayer = resolution.player;
    if (resolution.state.finished && resolution.state.outcome === "player_win") {
      const bossName = this.currentLocation?.bossName;
      if (bossName) {
        nextPlayer = {
          ...nextPlayer,
          questCompletion: {
            ...nextPlayer.questCompletion,
            [bossName]: true,
          },
        };
      }
    }

    this.store.setState({
      player: nextPlayer,
      battle: resolution.state.finished ? null : resolution.state,
    });
    resolution.logs.slice(-4).forEach((entry) => this.store.pushLog(entry));
    await this.savePlayer();
  }

  private async buyEquipment(equipmentId: string): Promise<void> {
    const state = this.store.getState();
    if (!state.player) {
      return;
    }
    const item = this.equipmentMap[equipmentId];
    if (!item) {
      return;
    }
    if (state.player.coins < item.cost) {
      this.store.pushLog(`${item.name} 구매에 필요한 코인이 부족합니다.`);
      return;
    }

    const nextPlayer: PlayerSave = {
      ...state.player,
      coins: state.player.coins - item.cost,
      ownedEquipmentIds: Array.from(new Set([...state.player.ownedEquipmentIds, equipmentId])),
    };

    this.store.setState({ player: nextPlayer });
    this.store.pushLog(`${item.name} 구매 완료`);
    await this.savePlayer();
  }

  private async toggleEquipment(equipmentId: string): Promise<void> {
    const state = this.store.getState();
    if (!state.player) {
      return;
    }

    const equipped = state.player.equippedEquipmentIds.includes(equipmentId)
      ? []
      : [equipmentId];

    this.store.setState({
      player: this.applyEquipmentSelection(state.player, equipped),
    });
    this.store.pushLog("장비 구성이 갱신되었습니다.");
    await this.savePlayer();
  }

  private async learnSkill(skillId: string): Promise<void> {
    const state = this.store.getState();
    if (!state.player) {
      return;
    }
    const skill = this.skillMap[skillId];
    if (!skill) {
      return;
    }
    if (state.player.learnedSkillIds.includes(skillId)) {
      this.store.pushLog(`${skill.name}은(는) 이미 습득했습니다.`);
      return;
    }
    if (state.player.coins < skill.cost) {
      this.store.pushLog(`${skill.name} 습득 비용이 부족합니다.`);
      return;
    }

    this.store.setState({
      player: {
        ...state.player,
        coins: state.player.coins - skill.cost,
        learnedSkillIds: [...state.player.learnedSkillIds, skillId],
      },
    });
    this.store.pushLog(`${skill.name} 습득 완료`);
    await this.savePlayer();
  }

  private async restAtInn(): Promise<void> {
    const state = this.store.getState();
    if (!state.player) {
      return;
    }
    if (state.player.coins < 20) {
      this.store.pushLog("숙박비가 부족합니다.");
      return;
    }

    this.store.setState({
      player: {
        ...state.player,
        coins: state.player.coins - 20,
        currentHp: getMaxHp(state.player.level),
        currentMp: getMaxMp(state.player.level),
      },
    });
    this.store.pushLog("여관에서 휴식했습니다.");
    await this.savePlayer();
  }

  private async savePlayer(successMessage?: string): Promise<void> {
    const state = this.store.getState();
    if (!state.player || !state.token) {
      return;
    }
    const now = Date.now();
    if (!successMessage && now - this.lastSavedAt < 400) {
      return;
    }

    try {
      const savedPlayer = await this.api.save(state.token, state.player);
      this.lastSavedAt = now;
      this.store.setState({ player: savedPlayer });
      if (successMessage) {
        this.store.pushLog(successMessage);
      }
    } catch (error) {
      this.store.pushLog(error instanceof Error ? error.message : "세이브 실패");
    }
  }

  private enterPresence(player: PlayerSave, isSceneChange: boolean): void {
    const sceneId = this.world.locations[player.locationKey]?.scene.sceneId;
    if (!sceneId) {
      return;
    }
    if (isSceneChange) {
      this.presence.changeScene(sceneId, player.position.x, player.position.y, player.facing);
    } else {
      this.presence.joinScene(sceneId, player.position.x, player.position.y, player.facing);
    }
    this.store.setState({ connectionStatus: "connecting" });
  }

  private setPresence(snapshot: PresenceState[]): void {
    this.store.setState({ presence: snapshot });
  }

  private mergePresence(presence: PresenceState): void {
    this.store.update((state) => {
      const existing = state.presence.filter((entry) => entry.username !== presence.username);
      return {
        ...state,
        presence: [...existing, presence],
      };
    });
  }

  private removePresence(username: string): void {
    this.store.update((state) => ({
      ...state,
      presence: state.presence.filter((entry) => entry.username !== username),
    }));
  }

  private applyEquipmentSelection(player: PlayerSave, equippedEquipmentIds: string[]): PlayerSave {
    const previousEquipped = player.equippedEquipmentIds
      .map((id) => this.equipmentMap[id])
      .filter((item): item is EquipmentDefinition => Boolean(item));
    const nextEquipped = equippedEquipmentIds
      .map((id) => this.equipmentMap[id])
      .filter((item): item is EquipmentDefinition => Boolean(item));

    const baseAttack = player.attack - previousEquipped.reduce((total, item) => total + item.attackBonus, 0);
    const nextAttack = baseAttack + nextEquipped.reduce((total, item) => total + item.attackBonus, 0);
    const nextAccuracy = nextEquipped[0]?.accuracy ?? 0.8;

    return {
      ...player,
      attack: nextAttack,
      accuracy: nextAccuracy,
      equippedEquipmentIds,
    };
  }
}
