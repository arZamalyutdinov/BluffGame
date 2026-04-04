import { randomUUID } from 'node:crypto';

import {
  type AppErrorCode,
  type Card,
  type Claim,
  type ClaimRecordSnapshot,
  DEFAULT_ROOM_SETTINGS,
  type DealingSnapshot,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_ROOM_CHAT_MESSAGES,
  type MatchPhase,
  type RevealedHandSnapshot,
  type RoomChatMessageSnapshot,
  type RoomSettings,
  type RoomSnapshot,
  type ShowdownSnapshot,
  type TimeoutSnapshot,
  applyRoundLoss,
  calculateDealingDurationMs,
  calculateResolutionDisplayDurationMs,
  createDeckShoe,
  dealCards,
  getDefaultAppErrorMessage,
  getNextActiveSeatIndex,
  isClaimStrictlyHigher,
  normalizeRoomSettings,
  parseClaimKey,
  resolveShowdown,
  roomSessionSchema,
  shuffleDeck,
  sortCardsDescending,
} from '@bluff-game/shared';

import {
  type BotOpponentRead,
  chooseBotAction,
  generateBotName,
} from './bot-strategy.js';

class CommandError extends Error {
  constructor(
    readonly code: AppErrorCode,
    readonly statusCode = 400,
    message = getDefaultAppErrorMessage(code),
  ) {
    super(message);
  }
}

interface PlayerState {
  playerId: string;
  sessionToken: string;
  socketId: string | undefined;
  name: string;
  seatIndex: number;
  isHost: boolean;
  isBot: boolean;
  isReady: boolean;
  connectionStatus: 'connected' | 'disconnected';
  handSize: number;
  isEliminated: boolean;
  spectatorRevealEnabled: boolean;
}

interface RoundState {
  roundNumber: number;
  starterSeatIndex: number;
  currentTurnSeatIndex: number;
  lastClaim?: Claim | undefined;
  lastClaimantPlayerId?: string | undefined;
  claimHistory: ClaimRecordSnapshot[];
  handsByPlayerId: Record<string, Card[]>;
  remainingDeck: Card[];
}

interface MatchState {
  phase: MatchPhase;
  round: RoundState;
  dealing?: DealingSnapshot | undefined;
  turnTimer?: TurnTimerState | undefined;
  winnerPlayerId?: string | undefined;
  lastShowdown?: ShowdownSnapshot | undefined;
  lastTimeout?: TimeoutSnapshot | undefined;
}

interface TurnTimerState {
  durationSeconds: number;
  remainingMs: number;
  isPaused: boolean;
  deadlineAtMs?: number | undefined;
  pausedByPlayerId?: string | undefined;
}

interface RoomState {
  code: string;
  phase: 'lobby' | 'in-match' | 'match-complete';
  hostPlayerId: string;
  settings: RoomSettings;
  players: PlayerState[];
  playerReadsById: Record<string, BotOpponentRead>;
  chatMessages: RoomChatMessageSnapshot[];
  match: MatchState | undefined;
}

export interface AttachConnectionResult {
  roomCode: string;
  playerId: string;
  previousSocketId?: string;
}

interface RoomRegistryOptions {
  onAutonomousRoomUpdate?: (roomCode: string) => void;
  now?: () => number;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}

const MAX_ROOM_PLAYERS = 8;
const BOT_ACTION_DELAY_MS = 900;
const HOST_REASSIGN_DELAY_MS = 10_000;

function createRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';

  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function sortPlayersBySeat(players: PlayerState[]): PlayerState[] {
  return [...players].sort((left, right) => left.seatIndex - right.seatIndex);
}

function sanitizeDisplayName(value: string): string {
  return value.trim().slice(0, 24);
}

function normalizeDisplayNameKey(value: string): string {
  return sanitizeDisplayName(value).toLowerCase();
}

function sanitizeChatMessage(value: string): string {
  return value.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
}

function createBotRead(): BotOpponentRead {
  return {
    caughtBluffs: 0,
    provenClaims: 0,
    timeouts: 0,
  };
}

function getOpenSeatIndexes(room: RoomState): number[] {
  return Array.from(
    { length: MAX_ROOM_PLAYERS },
    (_value, seatIndex) => seatIndex,
  ).filter(
    (seatIndex) =>
      !room.players.some((player) => player.seatIndex === seatIndex),
  );
}

function getRandomOpenSeatIndex(room: RoomState): number {
  const openSeatIndexes = getOpenSeatIndexes(room);

  const randomSeatIndex =
    openSeatIndexes[Math.floor(Math.random() * openSeatIndexes.length)];

  if (randomSeatIndex === undefined) {
    throw new Error('Unable to choose an open seat.');
  }

  return randomSeatIndex;
}

function getFirstOpenSeatIndex(room: RoomState): number {
  const firstOpenSeatIndex = getOpenSeatIndexes(room)[0];

  if (firstOpenSeatIndex === undefined) {
    throw new Error('Unable to choose an open seat.');
  }

  return firstOpenSeatIndex;
}

function reindexLobbySeats(players: PlayerState[]): PlayerState[] {
  return sortPlayersBySeat(players).map((player, seatIndex) => ({
    ...player,
    seatIndex,
  }));
}

function isPlayerInRound(round: RoundState, playerId: string): boolean {
  return round.handsByPlayerId[playerId] !== undefined;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, RoomState>();
  private readonly roomQueues = new Map<string, Promise<void>>();
  private readonly turnTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly dealingHoldTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly botTurnTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly resultHoldTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly hostReassignmentTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly onAutonomousRoomUpdate:
    | ((roomCode: string) => void)
    | undefined;
  private readonly now: () => number;
  private readonly setTimer: typeof setTimeout;
  private readonly clearTimer: typeof clearTimeout;

  constructor(options: RoomRegistryOptions = {}) {
    this.onAutonomousRoomUpdate = options.onAutonomousRoomUpdate;
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  getConnectedRecipients(
    code: string,
  ): Array<{ playerId: string; socketId: string }> {
    const room = this.rooms.get(code);

    if (!room) {
      return [];
    }

    return room.players
      .filter((player): player is PlayerState & { socketId: string } =>
        Boolean(player.socketId),
      )
      .map((player) => ({
        playerId: player.playerId,
        socketId: player.socketId,
      }));
  }

  buildSnapshot(code: string, viewerPlayerId: string): RoomSnapshot {
    const room = this.requireRoom(code);
    this.healAutonomousState(room);
    const viewer = room.players.find(
      (player) => player.playerId === viewerPlayerId,
    );

    if (!viewer) {
      throw new CommandError('viewer-not-in-room', 404);
    }

    const players = sortPlayersBySeat(room.players).map((player) => ({
      playerId: player.playerId,
      name: player.name,
      seatIndex: player.seatIndex,
      isHost: player.playerId === room.hostPlayerId,
      isBot: player.isBot,
      isReady: player.isReady,
      connectionStatus: player.connectionStatus,
      handSize: player.handSize,
      isEliminated: player.isEliminated,
      cardCount:
        room.match?.round.handsByPlayerId[player.playerId]?.length ?? 0,
    }));

    const snapshot: RoomSnapshot = {
      roomCode: room.code,
      phase: room.phase,
      selfPlayerId: viewer.playerId,
      hostPlayerId: room.hostPlayerId,
      serverNowMs: this.now(),
      settings: room.settings,
      players,
      chatMessages: [...room.chatMessages],
    };

    if (room.match) {
      const matchSnapshot: RoomSnapshot['match'] = {
        phase: room.match.phase,
        roundNumber: room.match.round.roundNumber,
        starterPlayerId: this.requirePlayerBySeat(
          room,
          room.match.round.starterSeatIndex,
        ).playerId,
        currentTurnPlayerId: this.requirePlayerBySeat(
          room,
          room.match.round.currentTurnSeatIndex,
        ).playerId,
        claimHistory: room.match.round.claimHistory,
        yourHand: sortCardsDescending(
          room.match.round.handsByPlayerId[viewerPlayerId] ?? [],
        ),
      };

      if (viewer.isEliminated && !viewer.isBot) {
        matchSnapshot.spectator = {
          isSpectator: true,
          revealCardsEnabled: viewer.spectatorRevealEnabled,
          ...(viewer.spectatorRevealEnabled &&
          room.match.phase !== 'showing-result' &&
          room.match.phase !== 'match-complete'
            ? {
                revealedHands: this.buildSpectatorRevealedHands(
                  room,
                  viewer.playerId,
                ),
              }
            : {}),
        };
      }

      if (room.match.dealing) {
        matchSnapshot.dealing = room.match.dealing;
      }

      if (room.match.turnTimer) {
        const remainingMs = room.match.turnTimer.isPaused
          ? room.match.turnTimer.remainingMs
          : Math.max(
              0,
              (room.match.turnTimer.deadlineAtMs ?? this.now()) - this.now(),
            );

        matchSnapshot.turnTimer = {
          durationSeconds: room.match.turnTimer.durationSeconds,
          remainingMs,
          isPaused: room.match.turnTimer.isPaused,
          ...(room.match.turnTimer.deadlineAtMs
            ? { deadlineAtMs: room.match.turnTimer.deadlineAtMs }
            : {}),
          ...(room.match.turnTimer.pausedByPlayerId
            ? { pausedByPlayerId: room.match.turnTimer.pausedByPlayerId }
            : {}),
        };
      }

      if (room.match.round.lastClaim) {
        matchSnapshot.lastClaim = room.match.round.lastClaim;
      }

      if (room.match.lastShowdown) {
        matchSnapshot.showdown = room.match.lastShowdown;
      }

      if (room.match.lastTimeout) {
        matchSnapshot.timeout = room.match.lastTimeout;
      }

      if (room.match.winnerPlayerId) {
        matchSnapshot.winnerPlayerId = room.match.winnerPlayerId;
      }

      snapshot.match = matchSnapshot;
    }

    return snapshot;
  }

  createRoom(displayName: string) {
    const playerId = randomUUID();
    const sessionToken = randomUUID();
    const name = sanitizeDisplayName(displayName);

    if (!name) {
      throw new CommandError('display-name-required');
    }

    let code = createRoomCode();
    while (this.rooms.has(code)) {
      code = createRoomCode();
    }

    const room: RoomState = {
      code,
      phase: 'lobby',
      hostPlayerId: playerId,
      settings: { ...DEFAULT_ROOM_SETTINGS },
      playerReadsById: {
        [playerId]: createBotRead(),
      },
      chatMessages: [],
      match: undefined,
      players: [
        {
          playerId,
          sessionToken,
          socketId: undefined,
          name,
          seatIndex: 0,
          isHost: true,
          isBot: false,
          isReady: false,
          connectionStatus: 'disconnected',
          handSize: 1,
          isEliminated: false,
          spectatorRevealEnabled: false,
        },
      ],
    };

    this.rooms.set(code, room);

    return roomSessionSchema.parse({
      roomCode: code,
      playerId,
      sessionToken,
      displayName: name,
    });
  }

  async joinRoom(code: string, displayName: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);

      if (room.players.length >= MAX_ROOM_PLAYERS) {
        throw new CommandError('room-full');
      }

      const name = sanitizeDisplayName(displayName);

      if (!name) {
        throw new CommandError('display-name-required');
      }

      this.assertDisplayNameAvailable(room, name);

      const playerId = randomUUID();
      const sessionToken = randomUUID();

      room.players.push({
        playerId,
        sessionToken,
        socketId: undefined,
        name,
        seatIndex: getRandomOpenSeatIndex(room),
        isHost: false,
        isBot: false,
        isReady: false,
        connectionStatus: 'disconnected',
        handSize: this.calculateJoinHandSize(room),
        isEliminated: false,
        spectatorRevealEnabled: false,
      });
      room.playerReadsById[playerId] = createBotRead();

      return roomSessionSchema.parse({
        roomCode: code,
        playerId,
        sessionToken,
        displayName: name,
      });
    });
  }

  async attachConnection(input: {
    roomCode: string;
    playerId: string;
    sessionToken: string;
    socketId: string;
  }): Promise<AttachConnectionResult> {
    return this.withRoomLock(input.roomCode, () => {
      const room = this.requireRoom(input.roomCode);
      this.healAutonomousState(room);
      const player = this.requirePlayer(room, input.playerId);

      if (player.sessionToken !== input.sessionToken) {
        throw new CommandError('invalid-session-token', 401);
      }

      const previousSocketId = player.socketId;

      player.socketId = input.socketId;
      player.connectionStatus = 'connected';
      if (room.hostPlayerId === player.playerId) {
        this.clearHostReassignment(room.code);
      }

      return {
        roomCode: room.code,
        playerId: player.playerId,
        ...(previousSocketId ? { previousSocketId } : {}),
      };
    });
  }

  async disconnect(code: string, playerId: string, socketId: string) {
    return this.withRoomLock(code, () => {
      const room = this.rooms.get(code);

      if (!room) {
        return;
      }

      const player = room.players.find(
        (candidate) => candidate.playerId === playerId,
      );

      if (!player || player.socketId !== socketId) {
        return;
      }

      player.socketId = undefined;
      player.connectionStatus = 'disconnected';
      if (room.hostPlayerId === player.playerId) {
        this.scheduleHostReassignment(room, player.playerId);
      }
    });
  }

  async leaveRoom(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.healAutonomousState(room);
      const player = this.requirePlayer(room, playerId);
      const previousHostPlayerId = room.hostPlayerId;

      room.players = room.players.filter(
        (candidate) => candidate.playerId !== playerId,
      );
      delete room.playerReadsById[playerId];

      if (room.players.filter((candidate) => !candidate.isBot).length === 0) {
        this.clearTurnTimeout(code);
        this.clearDealingHold(code);
        this.clearBotTurn(code);
        this.clearResultHold(code);
        this.clearHostReassignment(code);
        this.rooms.delete(code);
        return;
      }

      this.maybeReassignHost(room, previousHostPlayerId);

      if (room.phase === 'lobby') {
        return;
      }

      if (room.phase === 'match-complete') {
        this.repairMatchReferencesAfterPlayerRemoval(room, player);
        return;
      }

      this.handleActiveMatchLeave(room, player);
    });
  }

  async addBot(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);

      if (room.phase !== 'lobby') {
        throw new CommandError('bot-add-lobby-only');
      }

      this.assertHost(room, playerId);

      if (room.players.length >= MAX_ROOM_PLAYERS) {
        throw new CommandError('room-full');
      }

      const botPlayerId = randomUUID();
      const name = generateBotName(room.players.map((player) => player.name));

      room.players.push({
        playerId: botPlayerId,
        sessionToken: randomUUID(),
        socketId: undefined,
        name,
        seatIndex: getFirstOpenSeatIndex(room),
        isHost: false,
        isBot: true,
        isReady: true,
        connectionStatus: 'connected',
        handSize: 1,
        isEliminated: false,
        spectatorRevealEnabled: false,
      });
      room.playerReadsById[botPlayerId] = createBotRead();
    });
  }

  async removeBot(code: string, playerId: string, targetPlayerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);

      if (room.phase !== 'lobby') {
        throw new CommandError('bot-remove-lobby-only');
      }

      this.assertHost(room, playerId);

      const targetPlayer = this.requirePlayer(room, targetPlayerId);

      if (!targetPlayer.isBot) {
        throw new CommandError('player-not-bot');
      }

      room.players = reindexLobbySeats(
        room.players.filter((player) => player.playerId !== targetPlayerId),
      );
      delete room.playerReadsById[targetPlayerId];
    });
  }

  async setReady(code: string, playerId: string, ready: boolean) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);

      if (room.phase !== 'lobby') {
        throw new CommandError('ready-lobby-only');
      }

      const player = this.requirePlayer(room, playerId);
      player.isReady = ready;
    });
  }

  async updateRoomSettings(
    code: string,
    playerId: string,
    settings: RoomSettings,
  ) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);

      if (room.phase !== 'lobby') {
        throw new CommandError('settings-lobby-only');
      }

      this.assertHost(room, playerId);

      const nextSettings = normalizeRoomSettings(settings);
      const settingsChanged =
        room.settings.eliminationHandSize !==
          nextSettings.eliminationHandSize ||
        room.settings.claimOrderPreset !== nextSettings.claimOrderPreset ||
        room.settings.flushRule !== nextSettings.flushRule ||
        room.settings.showdownDrawRule !== nextSettings.showdownDrawRule ||
        room.settings.jokerRule !== nextSettings.jokerRule ||
        room.settings.turnTimeLimitSeconds !==
          nextSettings.turnTimeLimitSeconds;

      room.settings = nextSettings;

      if (settingsChanged) {
        room.players = room.players.map((player) => ({
          ...player,
          isReady: player.isBot,
        }));
      }
    });
  }

  async startMatch(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);

      if (room.phase !== 'lobby') {
        throw new CommandError('start-match-lobby-only');
      }

      this.assertHost(room, playerId);

      if (room.players.length < 2) {
        throw new CommandError('start-match-min-players');
      }

      if (room.players.some((player) => !player.isReady)) {
        throw new CommandError('start-match-ready-required');
      }

      const starterSeatIndex =
        room.players[Math.floor(Math.random() * room.players.length)]
          ?.seatIndex;

      if (starterSeatIndex === undefined) {
        throw new CommandError('start-match-no-starter');
      }

      room.players = room.players.map((player) => ({
        ...player,
        handSize: 1,
        isEliminated: false,
        spectatorRevealEnabled: false,
      }));

      room.phase = 'in-match';
      room.match = this.createRound(room, {
        roundNumber: 1,
        starterSeatIndex,
      });
      this.syncAutonomousTurn(room);
    });
  }

  async setMatchPaused(code: string, playerId: string, paused: boolean) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.healAutonomousState(room);
      const match = this.requireActiveMatch(room);

      if (this.resolveExpiredTurnIfNeeded(room)) {
        return;
      }

      this.assertHost(room, playerId);

      if (match.phase === 'dealing') {
        throw new CommandError('dealing-in-progress');
      }

      if (!match.turnTimer) {
        throw new CommandError('no-turn-timer');
      }

      if (paused) {
        if (!match.turnTimer.isPaused) {
          this.pauseTurnTimer(room, playerId);
        }

        return;
      }

      if (match.turnTimer.isPaused) {
        this.resumeTurnTimer(room);
      }
    });
  }

  async sendChatMessage(code: string, playerId: string, text: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.healAutonomousState(room);
      const player = this.requirePlayer(room, playerId);
      const messageText = sanitizeChatMessage(text);

      if (!messageText) {
        throw new CommandError('chat-message-empty');
      }

      room.chatMessages = [
        ...room.chatMessages,
        {
          messageId: randomUUID(),
          playerId: player.playerId,
          playerName: player.name,
          text: messageText,
          sentAtMs: this.now(),
        },
      ].slice(-MAX_ROOM_CHAT_MESSAGES);
    });
  }

  async submitClaim(code: string, playerId: string, claimKey: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.healAutonomousState(room);
      this.submitClaimForPlayer(room, playerId, parseClaimKey(claimKey));
    });
  }

  async challengeClaim(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.healAutonomousState(room);
      this.challengeClaimForPlayer(room, playerId);
    });
  }

  async setSpectatorCardReveal(
    code: string,
    playerId: string,
    enabled: boolean,
  ) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.healAutonomousState(room);
      this.requireActiveMatch(room);

      const player = this.requirePlayer(room, playerId);

      if (player.isBot || !player.isEliminated) {
        throw new CommandError('spectator-reveal-for-eliminated-humans-only');
      }

      player.spectatorRevealEnabled = enabled;
    });
  }

  async kickPlayerToSpectator(
    code: string,
    playerId: string,
    targetPlayerId: string,
  ) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.healAutonomousState(room);
      this.assertHost(room, playerId);

      if (playerId === targetPlayerId) {
        throw new CommandError('self-spectate-use-stop-playing');
      }

      this.movePlayerToSpectator(room, targetPlayerId);
    });
  }

  async becomeSpectator(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.healAutonomousState(room);
      this.movePlayerToSpectator(room, playerId);
    });
  }

  async restartMatch(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.assertHost(room, playerId);

      this.clearTurnTimeout(code);
      this.clearDealingHold(code);
      this.clearBotTurn(code);
      this.clearResultHold(code);
      this.clearHostReassignment(code);
      room.phase = 'lobby';
      room.players = room.players.map((player) => ({
        ...player,
        handSize: 1,
        isEliminated: false,
        spectatorRevealEnabled: false,
        isReady: player.isBot,
      }));
      room.match = undefined;
    });
  }

  private createRound(
    room: RoomState,
    options: {
      roundNumber: number;
      starterSeatIndex: number;
      lastShowdown?: ShowdownSnapshot;
      lastTimeout?: TimeoutSnapshot;
    },
  ): MatchState {
    const activePlayers = sortPlayersBySeat(room.players).filter(
      (player) => !player.isEliminated,
    );
    const totalCardCount = activePlayers.reduce(
      (count, player) => count + player.handSize,
      0,
    );
    const shuffledDeck = shuffleDeck(
      createDeckShoe(totalCardCount, room.settings.jokerRule),
    );
    const handsByPlayerId = dealCards(
      shuffledDeck,
      activePlayers.map((player) => ({
        playerId: player.playerId,
        count: player.handSize,
      })),
    );
    const remainingDeck = shuffledDeck.slice(totalCardCount);

    return {
      phase: 'dealing',
      round: {
        roundNumber: options.roundNumber,
        starterSeatIndex: options.starterSeatIndex,
        currentTurnSeatIndex: options.starterSeatIndex,
        claimHistory: [],
        handsByPlayerId,
        remainingDeck,
      },
      dealing: {
        startedAtMs: this.now(),
        durationMs: calculateDealingDurationMs({
          totalCardCount,
        }),
      },
      ...(options.lastShowdown ? { lastShowdown: options.lastShowdown } : {}),
      ...(options.lastTimeout ? { lastTimeout: options.lastTimeout } : {}),
    };
  }

  private createRunningTurnTimer(durationSeconds: number): TurnTimerState {
    const remainingMs = durationSeconds * 1000;

    return {
      durationSeconds,
      remainingMs,
      isPaused: false,
      deadlineAtMs: this.now() + remainingMs,
    };
  }

  private resetTurnTimer(room: RoomState) {
    if (!room.match) {
      return;
    }

    room.match.turnTimer = this.createRunningTurnTimer(
      room.settings.turnTimeLimitSeconds,
    );
    this.syncAutonomousTurn(room);
  }

  private pauseTurnTimer(room: RoomState, pausedByPlayerId: string) {
    if (!room.match?.turnTimer || room.match.turnTimer.isPaused) {
      return;
    }

    room.match.turnTimer = {
      durationSeconds: room.match.turnTimer.durationSeconds,
      remainingMs: Math.max(
        0,
        (room.match.turnTimer.deadlineAtMs ?? this.now()) - this.now(),
      ),
      isPaused: true,
      pausedByPlayerId,
    };
    this.clearTurnTimeout(room.code);
    this.clearBotTurn(room.code);
  }

  private resumeTurnTimer(room: RoomState) {
    if (!room.match?.turnTimer || !room.match.turnTimer.isPaused) {
      return;
    }

    room.match.turnTimer = {
      durationSeconds: room.match.turnTimer.durationSeconds,
      remainingMs: room.match.turnTimer.remainingMs,
      isPaused: false,
      deadlineAtMs: this.now() + room.match.turnTimer.remainingMs,
    };
    this.syncAutonomousTurn(room);
  }

  private syncAutonomousTurn(room: RoomState) {
    this.scheduleDealingHold(room);
    this.scheduleTurnTimeout(room);
    this.scheduleBotTurn(room);
    this.scheduleResultHold(room);
  }

  private scheduleHostReassignment(
    room: RoomState,
    previousHostPlayerId: string,
  ) {
    this.clearHostReassignment(room.code);

    if (room.hostPlayerId !== previousHostPlayerId) {
      return;
    }

    const handle = this.setTimer(() => {
      this.hostReassignmentTimers.delete(room.code);
      void this.handleHostReassignment(room.code, previousHostPlayerId);
    }, HOST_REASSIGN_DELAY_MS);
    this.hostReassignmentTimers.set(room.code, handle);
  }

  private scheduleDealingHold(room: RoomState) {
    this.clearDealingHold(room.code);

    if (
      room.phase !== 'in-match' ||
      !room.match ||
      room.match.phase !== 'dealing' ||
      !room.match.dealing
    ) {
      return;
    }

    const delayMs = Math.max(
      0,
      room.match.dealing.startedAtMs +
        room.match.dealing.durationMs -
        this.now(),
    );
    const handle = this.setTimer(() => {
      this.dealingHoldTimers.delete(room.code);
      void this.handleDealingHold(room.code);
    }, delayMs);
    this.dealingHoldTimers.set(room.code, handle);
  }

  private scheduleTurnTimeout(room: RoomState) {
    this.clearTurnTimeout(room.code);

    if (
      room.phase !== 'in-match' ||
      !room.match ||
      room.match.phase === 'match-complete' ||
      room.match.phase === 'dealing' ||
      room.match.phase === 'showing-result' ||
      !room.match.turnTimer ||
      room.match.turnTimer.isPaused ||
      room.match.turnTimer.deadlineAtMs === undefined
    ) {
      return;
    }

    const delayMs = Math.max(0, room.match.turnTimer.deadlineAtMs - this.now());
    const handle = this.setTimer(() => {
      this.turnTimers.delete(room.code);
      void this.handleTurnTimeout(room.code);
    }, delayMs);
    this.turnTimers.set(room.code, handle);
  }

  private clearTurnTimeout(code: string) {
    const handle = this.turnTimers.get(code);

    if (!handle) {
      return;
    }

    this.clearTimer(handle);
    this.turnTimers.delete(code);
  }

  private clearDealingHold(code: string) {
    const handle = this.dealingHoldTimers.get(code);

    if (!handle) {
      return;
    }

    this.clearTimer(handle);
    this.dealingHoldTimers.delete(code);
  }

  private scheduleBotTurn(room: RoomState) {
    this.clearBotTurn(room.code);

    if (
      room.phase !== 'in-match' ||
      !room.match ||
      room.match.phase === 'match-complete' ||
      room.match.phase === 'dealing' ||
      room.match.phase === 'showing-result' ||
      !room.match.turnTimer ||
      room.match.turnTimer?.isPaused
    ) {
      return;
    }

    const currentPlayer = this.requirePlayerBySeat(
      room,
      room.match.round.currentTurnSeatIndex,
    );

    if (!currentPlayer.isBot) {
      return;
    }

    const handle = this.setTimer(() => {
      this.botTurnTimers.delete(room.code);
      void this.handleBotTurn(room.code);
    }, BOT_ACTION_DELAY_MS);
    this.botTurnTimers.set(room.code, handle);
  }

  private scheduleResultHold(room: RoomState) {
    this.clearResultHold(room.code);

    if (
      room.phase !== 'in-match' ||
      !room.match ||
      room.match.phase !== 'showing-result'
    ) {
      return;
    }

    const result = room.match.lastShowdown ?? room.match.lastTimeout;

    if (!result) {
      return;
    }

    const kind = room.match.lastShowdown ? 'showdown' : 'timeout';
    const displayDurationMs = calculateResolutionDisplayDurationMs({
      kind,
      revealedHandCount: result.revealedHands.length,
      ...(room.match.lastShowdown
        ? { deckDrawCount: room.match.lastShowdown.deckDraws.length }
        : {}),
    });
    const startedAtMs =
      room.match.lastShowdown?.startedAtMs ??
      room.match.lastTimeout?.startedAtMs;
    const delayMs = Math.max(
      0,
      (startedAtMs ?? this.now()) + displayDurationMs - this.now(),
    );
    const handle = this.setTimer(() => {
      this.resultHoldTimers.delete(room.code);
      void this.handleResultHold(room.code);
    }, delayMs);
    this.resultHoldTimers.set(room.code, handle);
  }

  private clearBotTurn(code: string) {
    const handle = this.botTurnTimers.get(code);

    if (!handle) {
      return;
    }

    this.clearTimer(handle);
    this.botTurnTimers.delete(code);
  }

  private clearResultHold(code: string) {
    const handle = this.resultHoldTimers.get(code);

    if (!handle) {
      return;
    }

    this.clearTimer(handle);
    this.resultHoldTimers.delete(code);
  }

  private clearHostReassignment(code: string) {
    const handle = this.hostReassignmentTimers.get(code);

    if (!handle) {
      return;
    }

    this.clearTimer(handle);
    this.hostReassignmentTimers.delete(code);
  }

  private async handleTurnTimeout(code: string) {
    let shouldBroadcast = false;

    await this.withRoomLock(code, () => {
      const room = this.rooms.get(code);

      shouldBroadcast = this.resolveTurnTimeout(room);
    });

    if (shouldBroadcast) {
      this.onAutonomousRoomUpdate?.(code);
    }
  }

  private async handleBotTurn(code: string) {
    let shouldBroadcast = false;

    await this.withRoomLock(code, () => {
      const room = this.rooms.get(code);
      shouldBroadcast = this.resolveBotTurn(room);
    });

    if (shouldBroadcast) {
      this.onAutonomousRoomUpdate?.(code);
    }
  }

  private async handleDealingHold(code: string) {
    let shouldBroadcast = false;

    await this.withRoomLock(code, () => {
      const room = this.rooms.get(code);
      shouldBroadcast = this.resolveDealingHold(room);
    });

    if (shouldBroadcast) {
      this.onAutonomousRoomUpdate?.(code);
    }
  }

  private async handleResultHold(code: string) {
    let shouldBroadcast = false;

    await this.withRoomLock(code, () => {
      const room = this.rooms.get(code);
      shouldBroadcast = this.resolveResultHold(room);
    });

    if (shouldBroadcast) {
      this.onAutonomousRoomUpdate?.(code);
    }
  }

  private async handleHostReassignment(
    code: string,
    previousHostPlayerId: string,
  ) {
    let shouldBroadcast = false;

    await this.withRoomLock(code, () => {
      const room = this.rooms.get(code);

      if (!room) {
        return;
      }

      const previousHost = room.players.find(
        (player) => player.playerId === previousHostPlayerId,
      );

      if (
        !previousHost ||
        room.hostPlayerId !== previousHostPlayerId ||
        previousHost.connectionStatus === 'connected'
      ) {
        return;
      }

      shouldBroadcast = this.reassignHost(room, previousHostPlayerId, {
        excludePreviousHost: true,
      });
    });

    if (shouldBroadcast) {
      this.onAutonomousRoomUpdate?.(code);
    }
  }

  private buildRevealedHands(
    room: RoomState,
    handsByPlayerId: Record<string, Card[]>,
  ) {
    return this.getCurrentRoundPlayers(room).map((player) => ({
      playerId: player.playerId,
      cards: sortCardsDescending(handsByPlayerId[player.playerId] ?? []),
    }));
  }

  private buildSpectatorRevealedHands(
    room: RoomState,
    viewerPlayerId: string,
  ): RevealedHandSnapshot[] {
    return this.getCurrentRoundPlayers(room)
      .filter((player) => player.playerId !== viewerPlayerId)
      .map((player) => ({
        playerId: player.playerId,
        cards: sortCardsDescending(
          room.match?.round.handsByPlayerId[player.playerId] ?? [],
        ),
      }));
  }

  private healAutonomousState(room: RoomState): boolean {
    let didHeal = false;

    while (true) {
      if (this.resolveDealingHold(room)) {
        didHeal = true;
        continue;
      }

      if (this.resolveExpiredTurnIfNeeded(room)) {
        didHeal = true;
        continue;
      }

      if (this.resolveExpiredResultHoldIfNeeded(room)) {
        didHeal = true;
        continue;
      }

      break;
    }

    return didHeal;
  }

  private resolveDealingHold(room: RoomState | undefined): boolean {
    if (
      !room ||
      room.phase !== 'in-match' ||
      !room.match ||
      room.match.phase !== 'dealing' ||
      !room.match.dealing
    ) {
      return false;
    }

    const dealFinishedAtMs =
      room.match.dealing.startedAtMs + room.match.dealing.durationMs;

    if (dealFinishedAtMs > this.now()) {
      return false;
    }

    this.clearDealingHold(room.code);
    room.match.phase = 'awaiting-opening-claim';
    room.match.dealing = undefined;
    room.match.turnTimer = this.createRunningTurnTimer(
      room.settings.turnTimeLimitSeconds,
    );
    this.syncAutonomousTurn(room);
    return true;
  }

  private resolveExpiredResultHoldIfNeeded(room: RoomState): boolean {
    if (
      room.phase !== 'in-match' ||
      !room.match ||
      room.match.phase !== 'showing-result'
    ) {
      return false;
    }

    const result = room.match.lastShowdown ?? room.match.lastTimeout;

    if (!result) {
      return false;
    }

    const displayDurationMs = calculateResolutionDisplayDurationMs({
      kind: room.match.lastShowdown ? 'showdown' : 'timeout',
      revealedHandCount: result.revealedHands.length,
      ...(room.match.lastShowdown
        ? { deckDrawCount: room.match.lastShowdown.deckDraws.length }
        : {}),
    });
    const startedAtMs =
      room.match.lastShowdown?.startedAtMs ??
      room.match.lastTimeout?.startedAtMs;

    if ((startedAtMs ?? this.now()) + displayDurationMs > this.now()) {
      return false;
    }

    return this.resolveResultHold(room);
  }

  private resolveExpiredTurnIfNeeded(room: RoomState): boolean {
    if (
      room.phase !== 'in-match' ||
      room.match?.phase === 'dealing' ||
      !room.match?.turnTimer ||
      room.match.turnTimer.isPaused ||
      room.match.turnTimer.deadlineAtMs === undefined ||
      room.match.turnTimer.deadlineAtMs > this.now()
    ) {
      return false;
    }

    this.clearTurnTimeout(room.code);
    return this.resolveTurnTimeout(room);
  }

  private resolveTurnTimeout(room: RoomState | undefined): boolean {
    if (
      !room ||
      room.phase !== 'in-match' ||
      !room.match ||
      room.match.phase === 'match-complete' ||
      !room.match.turnTimer ||
      room.match.turnTimer.isPaused ||
      room.match.turnTimer.deadlineAtMs === undefined ||
      room.match.turnTimer.deadlineAtMs > this.now()
    ) {
      return false;
    }

    const match = room.match;
    const timedOutPlayer = this.requirePlayerBySeat(
      room,
      match.round.currentTurnSeatIndex,
    );
    room.playerReadsById[timedOutPlayer.playerId] = {
      ...(room.playerReadsById[timedOutPlayer.playerId] ?? createBotRead()),
      timeouts:
        (room.playerReadsById[timedOutPlayer.playerId]?.timeouts ?? 0) + 1,
    };

    if (match.round.lastClaim && match.round.lastClaimantPlayerId) {
      this.resolveShowdownForChallenger(room, timedOutPlayer.playerId, {
        startedAtMs: this.now(),
      });
      return true;
    }

    const resolution = applyRoundLoss({
      loserPlayerId: timedOutPlayer.playerId,
      players: this.toCurrentRoundPenaltyPlayerStates(room),
      eliminationHandSize: room.settings.eliminationHandSize,
    });

    for (const updatedPlayer of resolution.updatedPlayers) {
      const player = this.requirePlayer(room, updatedPlayer.playerId);
      player.handSize = updatedPlayer.handSize;
      player.isEliminated = updatedPlayer.isEliminated;
    }

    const revealedHands = this.buildRevealedHands(
      room,
      match.round.handsByPlayerId,
    );
    const remainingPlayers = room.players.filter(
      (player) => !player.isEliminated,
    );
    const timeoutBase = {
      startedAtMs: this.now(),
      timedOutPlayerId: timedOutPlayer.playerId,
      loserHandSize: resolution.loserHandSize,
      loserEliminated: resolution.loserEliminated,
      ...(match.round.lastClaim ? { lastClaim: match.round.lastClaim } : {}),
      ...(match.round.lastClaimantPlayerId
        ? { lastClaimantPlayerId: match.round.lastClaimantPlayerId }
        : {}),
      revealedHands,
    } satisfies Omit<TimeoutSnapshot, 'nextStarterPlayerId'>;

    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];

      if (!winner) {
        throw new CommandError('winner-undetermined');
      }

      match.round.currentTurnSeatIndex = winner.seatIndex;
      this.showResultPhase(room, {
        winnerPlayerId: winner.playerId,
        timeout: timeoutBase,
      });
      return true;
    }

    const nextStarterSeatIndex = getNextActiveSeatIndex(
      this.toPenaltyPlayerStates(room),
      match.round.starterSeatIndex,
    );
    const timeout: TimeoutSnapshot = {
      ...timeoutBase,
      nextStarterPlayerId: this.requirePlayerBySeat(room, nextStarterSeatIndex)
        .playerId,
    };

    this.showResultPhase(room, { timeout });
    return true;
  }

  private resolveResultHold(room: RoomState | undefined): boolean {
    if (
      !room ||
      room.phase !== 'in-match' ||
      !room.match ||
      room.match.phase !== 'showing-result'
    ) {
      return false;
    }

    const match = room.match;
    this.clearResultHold(room.code);

    if (match.winnerPlayerId) {
      room.phase = 'match-complete';
      match.phase = 'match-complete';
      return true;
    }

    const nextStarterPlayerId =
      match.lastShowdown?.nextStarterPlayerId ??
      match.lastTimeout?.nextStarterPlayerId;

    if (!nextStarterPlayerId) {
      throw new CommandError('next-starter-undetermined');
    }

    const nextStarterPlayer = this.requirePlayer(room, nextStarterPlayerId);
    const nextStarterSeatIndex = nextStarterPlayer.isEliminated
      ? getNextActiveSeatIndex(
          this.toPenaltyPlayerStates(room),
          nextStarterPlayer.seatIndex,
        )
      : nextStarterPlayer.seatIndex;

    room.phase = 'in-match';
    room.match = this.createRound(room, {
      roundNumber: match.round.roundNumber + 1,
      starterSeatIndex: nextStarterSeatIndex,
      ...(match.lastShowdown ? { lastShowdown: match.lastShowdown } : {}),
      ...(match.lastTimeout ? { lastTimeout: match.lastTimeout } : {}),
    });
    this.syncAutonomousTurn(room);
    return true;
  }

  private showResultPhase(
    room: RoomState,
    options: {
      showdown?: ShowdownSnapshot;
      timeout?: TimeoutSnapshot;
      winnerPlayerId?: string;
    },
  ) {
    const match = this.requireActiveMatch(room);

    this.clearTurnTimeout(room.code);
    this.clearDealingHold(room.code);
    this.clearBotTurn(room.code);
    this.clearResultHold(room.code);

    room.phase = 'in-match';
    match.phase = 'showing-result';
    match.dealing = undefined;
    match.turnTimer = undefined;
    match.lastShowdown = options.showdown;
    match.lastTimeout = options.timeout;
    match.winnerPlayerId = options.winnerPlayerId;
    this.syncAutonomousTurn(room);
  }

  private resolveBotTurn(room: RoomState | undefined): boolean {
    if (!room) {
      return false;
    }

    if (this.resolveExpiredTurnIfNeeded(room)) {
      return true;
    }

    if (
      room.phase !== 'in-match' ||
      !room.match ||
      room.match.phase === 'match-complete' ||
      room.match.phase === 'dealing' ||
      room.match.phase === 'showing-result' ||
      room.match.turnTimer?.isPaused
    ) {
      return false;
    }

    const currentPlayer = this.requirePlayerBySeat(
      room,
      room.match.round.currentTurnSeatIndex,
    );

    if (!currentPlayer.isBot) {
      return false;
    }

    const hand = room.match.round.handsByPlayerId[currentPlayer.playerId] ?? [];
    const totalCardsInRound = Object.values(
      room.match.round.handsByPlayerId,
    ).reduce((count, cards) => count + cards.length, 0);
    const activePlayerCount = this.getCurrentRoundPlayers(room).length;
    const claimantRead = room.match.round.lastClaimantPlayerId
      ? room.playerReadsById[room.match.round.lastClaimantPlayerId]
      : undefined;
    const decision = chooseBotAction({
      hand,
      totalCardsInRound,
      activePlayerCount,
      selfHandSize: currentPlayer.handSize,
      eliminationHandSize: room.settings.eliminationHandSize,
      claimOrderPreset: room.settings.claimOrderPreset,
      flushRule: room.settings.flushRule,
      jokerRule: room.settings.jokerRule,
      ...(room.match.round.lastClaim
        ? { lastClaim: room.match.round.lastClaim }
        : {}),
      ...(claimantRead ? { claimantRead } : {}),
    });

    if (decision.type === 'challenge') {
      this.challengeClaimForPlayer(room, currentPlayer.playerId);
      return true;
    }

    this.submitClaimForPlayer(room, currentPlayer.playerId, decision.claim);
    return true;
  }

  private toPenaltyPlayerStates(room: RoomState) {
    return room.players.map((player) => ({
      playerId: player.playerId,
      seatIndex: player.seatIndex,
      handSize: player.handSize,
      isEliminated: player.isEliminated,
    }));
  }

  private getCurrentRoundPlayers(room: RoomState): PlayerState[] {
    if (!room.match) {
      return [];
    }

    const { round } = room.match;

    return sortPlayersBySeat(room.players).filter((player) =>
      isPlayerInRound(round, player.playerId),
    );
  }

  private calculateJoinHandSize(room: RoomState): number {
    if (room.phase !== 'in-match' || !room.match) {
      return 1;
    }

    const currentRoundPlayers = this.getCurrentRoundPlayers(room);

    if (currentRoundPlayers.length === 0) {
      return 1;
    }

    const totalCardsOnTable = currentRoundPlayers.reduce(
      (count, player) =>
        count +
        (room.match?.round.handsByPlayerId[player.playerId]?.length ?? 0),
      0,
    );

    return Math.max(
      1,
      Math.floor(totalCardsOnTable / currentRoundPlayers.length),
    );
  }

  private toCurrentRoundPenaltyPlayerStates(room: RoomState) {
    return this.getCurrentRoundPlayers(room).map((player) => ({
      playerId: player.playerId,
      seatIndex: player.seatIndex,
      handSize: player.handSize,
      isEliminated: player.isEliminated,
    }));
  }

  private requireRoom(code: string): RoomState {
    const room = this.rooms.get(code);

    if (!room) {
      throw new CommandError('room-not-found', 404);
    }

    return room;
  }

  private requirePlayer(room: RoomState, playerId: string): PlayerState {
    const player = room.players.find(
      (candidate) => candidate.playerId === playerId,
    );

    if (!player) {
      throw new CommandError('player-not-found', 404);
    }

    return player;
  }

  private requirePlayerBySeat(room: RoomState, seatIndex: number): PlayerState {
    const player = room.players.find(
      (candidate) => candidate.seatIndex === seatIndex,
    );

    if (!player) {
      throw new CommandError('seat-not-found', 404);
    }

    return player;
  }

  private requireActiveMatch(room: RoomState): MatchState {
    if (!room.match || room.phase !== 'in-match') {
      throw new CommandError('no-active-match');
    }

    return room.match;
  }

  private assertHost(room: RoomState, playerId: string) {
    if (room.hostPlayerId !== playerId) {
      throw new CommandError('host-only');
    }
  }

  private assertDisplayNameAvailable(room: RoomState, name: string) {
    const normalizedName = normalizeDisplayNameKey(name);
    const duplicate = room.players.find(
      (player) => normalizeDisplayNameKey(player.name) === normalizedName,
    );

    if (duplicate) {
      throw new CommandError('display-name-in-use');
    }
  }

  private maybeReassignHost(room: RoomState, previousHostPlayerId: string) {
    return this.reassignHost(room, previousHostPlayerId, {
      excludePreviousHost: false,
    });
  }

  private reassignHost(
    room: RoomState,
    previousHostPlayerId: string,
    options: { excludePreviousHost: boolean },
  ): boolean {
    if (room.hostPlayerId !== previousHostPlayerId) {
      return false;
    }

    const candidates = sortPlayersBySeat(room.players).filter(
      (player) =>
        !options.excludePreviousHost ||
        player.playerId !== previousHostPlayerId,
    );
    const humanPlayers = candidates.filter((player) => !player.isBot);
    const nextHost =
      humanPlayers.find((player) => player.connectionStatus === 'connected') ??
      humanPlayers[0] ??
      candidates.find((player) => player.connectionStatus === 'connected') ??
      candidates[0];

    if (!nextHost) {
      return false;
    }

    room.hostPlayerId = nextHost.playerId;
    this.clearHostReassignment(room.code);
    return true;
  }

  private movePlayerToSpectator(room: RoomState, playerId: string) {
    const match = this.requireActiveMatch(room);
    const player = this.requirePlayer(room, playerId);
    const wasInCurrentRound = isPlayerInRound(match.round, player.playerId);

    if (match.phase === 'match-complete') {
      throw new CommandError('match-already-complete');
    }

    if (player.isEliminated) {
      throw new CommandError('player-already-spectating');
    }

    player.isEliminated = true;
    player.spectatorRevealEnabled = false;

    const remainingActivePlayers = sortPlayersBySeat(room.players).filter(
      (candidate) => !candidate.isEliminated,
    );

    if (remainingActivePlayers.length <= 1) {
      this.clearTurnTimeout(room.code);
      this.clearDealingHold(room.code);
      this.clearBotTurn(room.code);
      this.clearResultHold(room.code);

      room.phase = 'match-complete';
      match.phase = 'match-complete';
      match.dealing = undefined;
      match.turnTimer = undefined;
      match.winnerPlayerId = remainingActivePlayers[0]?.playerId;
      return;
    }

    if (match.phase === 'showing-result') {
      return;
    }

    if (!wasInCurrentRound) {
      return;
    }

    const nextStarterSeatIndex = remainingActivePlayers.some(
      (candidate) => candidate.seatIndex === match.round.currentTurnSeatIndex,
    )
      ? match.round.currentTurnSeatIndex
      : getNextActiveSeatIndex(
          this.toPenaltyPlayerStates(room),
          player.seatIndex,
        );

    room.phase = 'in-match';
    room.match = this.createRound(room, {
      roundNumber: match.round.roundNumber,
      starterSeatIndex: nextStarterSeatIndex,
      ...(match.lastShowdown ? { lastShowdown: match.lastShowdown } : {}),
      ...(match.lastTimeout ? { lastTimeout: match.lastTimeout } : {}),
    });
    this.syncAutonomousTurn(room);
  }

  private handleActiveMatchLeave(room: RoomState, removedPlayer: PlayerState) {
    const match = this.requireActiveMatch(room);
    const wasInCurrentRound = isPlayerInRound(
      match.round,
      removedPlayer.playerId,
    );
    const remainingActivePlayers = sortPlayersBySeat(room.players).filter(
      (player) => !player.isEliminated,
    );

    if (remainingActivePlayers.length <= 1) {
      this.clearTurnTimeout(room.code);
      this.clearDealingHold(room.code);
      this.clearBotTurn(room.code);
      this.clearResultHold(room.code);

      room.phase = 'match-complete';
      match.phase = 'match-complete';
      match.dealing = undefined;
      match.turnTimer = undefined;
      match.winnerPlayerId = remainingActivePlayers[0]?.playerId;
      this.repairMatchReferencesAfterPlayerRemoval(room, removedPlayer);
      return;
    }

    if (match.phase === 'showing-result') {
      this.repairMatchReferencesAfterPlayerRemoval(room, removedPlayer);
      return;
    }

    if (!wasInCurrentRound) {
      return;
    }

    const nextStarterSeatIndex = remainingActivePlayers.some(
      (player) => player.seatIndex === match.round.currentTurnSeatIndex,
    )
      ? match.round.currentTurnSeatIndex
      : getNextActiveSeatIndex(
          this.toPenaltyPlayerStates(room),
          removedPlayer.seatIndex,
        );

    room.phase = 'in-match';
    room.match = this.createRound(room, {
      roundNumber: match.round.roundNumber,
      starterSeatIndex: nextStarterSeatIndex,
      ...(match.lastShowdown ? { lastShowdown: match.lastShowdown } : {}),
      ...(match.lastTimeout ? { lastTimeout: match.lastTimeout } : {}),
    });
    this.syncAutonomousTurn(room);
  }

  private getReplacementSeatIndexAfterPlayerRemoval(
    room: RoomState,
    removedSeatIndex: number,
  ): number | undefined {
    if (room.players.length === 0) {
      return undefined;
    }

    const activePlayers = sortPlayersBySeat(room.players).filter(
      (player) => !player.isEliminated,
    );

    if (activePlayers.length > 0) {
      return getNextActiveSeatIndex(
        this.toPenaltyPlayerStates(room),
        removedSeatIndex,
      );
    }

    return sortPlayersBySeat(room.players)[0]?.seatIndex;
  }

  private repairMatchReferencesAfterPlayerRemoval(
    room: RoomState,
    removedPlayer: PlayerState,
  ) {
    const match = room.match;

    if (!match) {
      return;
    }

    const replacementSeatIndex = this.getReplacementSeatIndexAfterPlayerRemoval(
      room,
      removedPlayer.seatIndex,
    );

    if (replacementSeatIndex === undefined) {
      return;
    }

    const hasSeat = (seatIndex: number) =>
      room.players.some((player) => player.seatIndex === seatIndex);

    if (!hasSeat(match.round.starterSeatIndex)) {
      match.round.starterSeatIndex = replacementSeatIndex;
    }

    if (!hasSeat(match.round.currentTurnSeatIndex)) {
      match.round.currentTurnSeatIndex = replacementSeatIndex;
    }

    const replacementPlayerId = this.requirePlayerBySeat(
      room,
      replacementSeatIndex,
    ).playerId;

    if (match.lastShowdown?.nextStarterPlayerId === removedPlayer.playerId) {
      match.lastShowdown = {
        ...match.lastShowdown,
        nextStarterPlayerId: replacementPlayerId,
      };
    }

    if (match.lastTimeout?.nextStarterPlayerId === removedPlayer.playerId) {
      match.lastTimeout = {
        ...match.lastTimeout,
        nextStarterPlayerId: replacementPlayerId,
      };
    }

    if (match.winnerPlayerId === removedPlayer.playerId) {
      match.winnerPlayerId = replacementPlayerId;
    }
  }

  private async withRoomLock<T>(
    code: string,
    action: () => T | Promise<T>,
  ): Promise<T> {
    const previous = this.roomQueues.get(code) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.roomQueues.set(
      code,
      previous.catch(() => undefined).then(() => current),
    );

    await previous.catch(() => undefined);

    try {
      return await action();
    } finally {
      release();

      if (this.roomQueues.get(code) === current) {
        this.roomQueues.delete(code);
      }
    }
  }

  private submitClaimForPlayer(
    room: RoomState,
    playerId: string,
    claim: Claim,
  ) {
    const match = this.requireActiveMatch(room);
    const player = this.requirePlayer(room, playerId);

    if (this.resolveExpiredTurnIfNeeded(room)) {
      return;
    }

    if (match.turnTimer?.isPaused) {
      throw new CommandError('game-paused');
    }

    if (match.phase === 'dealing') {
      throw new CommandError('dealing-in-progress');
    }

    if (match.phase === 'showing-result') {
      throw new CommandError('result-still-showing');
    }

    if (player.seatIndex !== match.round.currentTurnSeatIndex) {
      throw new CommandError('not-your-turn');
    }

    if (
      match.round.lastClaim &&
      !isClaimStrictlyHigher(
        claim,
        match.round.lastClaim,
        room.settings.claimOrderPreset,
        room.settings.flushRule,
      )
    ) {
      throw new CommandError('claim-not-stronger');
    }

    match.round.lastClaim = claim;
    match.round.lastClaimantPlayerId = playerId;
    match.round.claimHistory.push({
      sequenceNumber: match.round.claimHistory.length + 1,
      playerId,
      claim,
    });
    match.round.currentTurnSeatIndex = getNextActiveSeatIndex(
      this.toCurrentRoundPenaltyPlayerStates(room),
      player.seatIndex,
    );
    match.phase = 'awaiting-response';
    this.resetTurnTimer(room);
  }

  private challengeClaimForPlayer(room: RoomState, playerId: string) {
    const match = this.requireActiveMatch(room);
    const challenger = this.requirePlayer(room, playerId);

    if (this.resolveExpiredTurnIfNeeded(room)) {
      return;
    }

    if (match.turnTimer?.isPaused) {
      throw new CommandError('game-paused');
    }

    if (match.phase === 'dealing') {
      throw new CommandError('dealing-in-progress');
    }

    if (match.phase === 'showing-result') {
      throw new CommandError('result-still-showing');
    }

    if (challenger.seatIndex !== match.round.currentTurnSeatIndex) {
      throw new CommandError('not-your-turn');
    }

    if (!match.round.lastClaim || !match.round.lastClaimantPlayerId) {
      throw new CommandError('no-claim-to-challenge');
    }

    this.resolveShowdownForChallenger(room, challenger.playerId);
  }

  private resolveShowdownForChallenger(
    room: RoomState,
    challengerPlayerId: string,
    options?: { startedAtMs?: number },
  ) {
    const match = this.requireActiveMatch(room);
    const challenger = this.requirePlayer(room, challengerPlayerId);

    if (!match.round.lastClaim || !match.round.lastClaimantPlayerId) {
      throw new CommandError('no-claim-to-challenge');
    }

    const resolution = resolveShowdown({
      claim: match.round.lastClaim,
      claimantPlayerId: match.round.lastClaimantPlayerId,
      challengerPlayerId: challenger.playerId,
      handsByPlayerId: match.round.handsByPlayerId,
      players: this.toCurrentRoundPenaltyPlayerStates(room),
      eliminationHandSize: room.settings.eliminationHandSize,
      remainingDeck: match.round.remainingDeck,
      showdownDrawRule: room.settings.showdownDrawRule,
    });

    this.clearTurnTimeout(room.code);
    this.clearBotTurn(room.code);

    room.playerReadsById[match.round.lastClaimantPlayerId] =
      resolution.claimWasValid
        ? {
            ...(room.playerReadsById[match.round.lastClaimantPlayerId] ??
              createBotRead()),
            provenClaims:
              (room.playerReadsById[match.round.lastClaimantPlayerId]
                ?.provenClaims ?? 0) + 1,
          }
        : {
            ...(room.playerReadsById[match.round.lastClaimantPlayerId] ??
              createBotRead()),
            caughtBluffs:
              (room.playerReadsById[match.round.lastClaimantPlayerId]
                ?.caughtBluffs ?? 0) + 1,
          };

    for (const updatedPlayer of resolution.updatedPlayers) {
      const player = this.requirePlayer(room, updatedPlayer.playerId);
      player.handSize = updatedPlayer.handSize;
      player.isEliminated = updatedPlayer.isEliminated;
    }

    const remainingPlayers = room.players.filter(
      (player) => !player.isEliminated,
    );
    const revealedHands = this.buildRevealedHands(
      room,
      match.round.handsByPlayerId,
    );
    const showdownBase = {
      startedAtMs: options?.startedAtMs ?? this.now(),
      spokenClaim: match.round.lastClaim,
      claimantPlayerId: match.round.lastClaimantPlayerId,
      challengerPlayerId: challenger.playerId,
      claimWasValid: resolution.claimWasValid,
      loserPlayerId: resolution.loserPlayerId,
      loserHandSize: resolution.loserHandSize,
      loserEliminated: resolution.loserEliminated,
      revealedHands,
      deckDraws: resolution.deckDraws,
    } satisfies Omit<ShowdownSnapshot, 'nextStarterPlayerId'>;

    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];

      if (!winner) {
        throw new CommandError('winner-undetermined');
      }

      match.round.currentTurnSeatIndex = winner.seatIndex;
      this.showResultPhase(room, {
        winnerPlayerId: winner.playerId,
        showdown: showdownBase,
      });
      return;
    }

    const nextStarterSeatIndex = getNextActiveSeatIndex(
      this.toPenaltyPlayerStates(room),
      match.round.starterSeatIndex,
    );

    const showdown: ShowdownSnapshot = {
      ...showdownBase,
      nextStarterPlayerId: this.requirePlayerBySeat(room, nextStarterSeatIndex)
        .playerId,
    };

    this.showResultPhase(room, { showdown });
  }
}

export { CommandError };
