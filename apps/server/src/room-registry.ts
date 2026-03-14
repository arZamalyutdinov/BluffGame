import { randomUUID } from 'node:crypto';

import {
  type Card,
  type Claim,
  type ClaimRecordSnapshot,
  DEFAULT_ROOM_SETTINGS,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_ROOM_CHAT_MESSAGES,
  type MatchPhase,
  type RoomChatMessageSnapshot,
  type RoomSettings,
  type RoomSnapshot,
  type ShowdownSnapshot,
  type TimeoutSnapshot,
  applyRoundLoss,
  compareClaims,
  createDeck,
  dealCards,
  getNextActiveSeatIndex,
  normalizeRoomSettings,
  parseClaimKey,
  resolveShowdown,
  roomSessionSchema,
  shuffleDeck,
  sortCardsDescending,
} from '@bluff-game/shared';

class CommandError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
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
  isReady: boolean;
  connectionStatus: 'connected' | 'disconnected';
  handSize: number;
  isEliminated: boolean;
}

interface RoundState {
  roundNumber: number;
  starterSeatIndex: number;
  currentTurnSeatIndex: number;
  lastClaim?: Claim | undefined;
  lastClaimantPlayerId?: string | undefined;
  claimHistory: ClaimRecordSnapshot[];
  handsByPlayerId: Record<string, Card[]>;
}

interface MatchState {
  phase: MatchPhase;
  round: RoundState;
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

export class RoomRegistry {
  private readonly rooms = new Map<string, RoomState>();
  private readonly roomQueues = new Map<string, Promise<void>>();
  private readonly turnTimers = new Map<
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
    const viewer = room.players.find(
      (player) => player.playerId === viewerPlayerId,
    );

    if (!viewer) {
      throw new CommandError('Viewer is not part of this room.', 404);
    }

    const players = sortPlayersBySeat(room.players).map((player) => ({
      playerId: player.playerId,
      name: player.name,
      seatIndex: player.seatIndex,
      isHost: player.playerId === room.hostPlayerId,
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
      throw new CommandError('Display name is required.');
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
          isReady: false,
          connectionStatus: 'disconnected',
          handSize: 1,
          isEliminated: false,
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

      if (room.phase !== 'lobby') {
        throw new CommandError(
          'You can only join rooms that are still in the lobby.',
        );
      }

      if (room.players.length >= 8) {
        throw new CommandError('This room is already full.');
      }

      const name = sanitizeDisplayName(displayName);

      if (!name) {
        throw new CommandError('Display name is required.');
      }

      this.assertDisplayNameAvailable(room, name);

      const playerId = randomUUID();
      const sessionToken = randomUUID();

      room.players.push({
        playerId,
        sessionToken,
        socketId: undefined,
        name,
        seatIndex: room.players.length,
        isHost: false,
        isReady: false,
        connectionStatus: 'disconnected',
        handSize: 1,
        isEliminated: false,
      });

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
      const player = this.requirePlayer(room, input.playerId);

      if (player.sessionToken !== input.sessionToken) {
        throw new CommandError(
          'Session token is invalid for this player.',
          401,
        );
      }

      const previousSocketId = player.socketId;

      player.socketId = input.socketId;
      player.connectionStatus = 'connected';

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

      this.maybeReassignHost(room, player.playerId);
    });
  }

  async leaveRoom(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);

      if (room.phase === 'in-match') {
        throw new CommandError(
          'Leaving during an active match is not supported in v1.',
        );
      }

      room.players = room.players.filter(
        (player) => player.playerId !== playerId,
      );

      if (room.players.length === 0) {
        this.clearTurnTimeout(code);
        this.rooms.delete(code);
        return;
      }

      this.maybeReassignHost(room, playerId);
    });
  }

  async setReady(code: string, playerId: string, ready: boolean) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);

      if (room.phase !== 'lobby') {
        throw new CommandError(
          'Ready state can only change while the room is in the lobby.',
        );
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
        throw new CommandError(
          'Room settings can only change while the room is in the lobby.',
        );
      }

      this.assertHost(room, playerId);

      const nextSettings = normalizeRoomSettings(settings);
      const settingsChanged =
        room.settings.eliminationHandSize !==
          nextSettings.eliminationHandSize ||
        room.settings.claimOrderPreset !== nextSettings.claimOrderPreset ||
        room.settings.turnTimeLimitSeconds !==
          nextSettings.turnTimeLimitSeconds;

      room.settings = nextSettings;

      if (settingsChanged) {
        room.players = room.players.map((player) => ({
          ...player,
          isReady: false,
        }));
      }
    });
  }

  async startMatch(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);

      if (room.phase !== 'lobby') {
        throw new CommandError('The match can only start from the lobby.');
      }

      this.assertHost(room, playerId);

      if (room.players.length < 2) {
        throw new CommandError('At least two players are required to start.');
      }

      if (room.players.some((player) => !player.isReady)) {
        throw new CommandError(
          'Every player must be marked ready before the host can start.',
        );
      }

      const starterSeatIndex =
        room.players[Math.floor(Math.random() * room.players.length)]
          ?.seatIndex;

      if (starterSeatIndex === undefined) {
        throw new CommandError('Unable to choose a starting seat.');
      }

      room.players = room.players.map((player) => ({
        ...player,
        handSize: 1,
        isEliminated: false,
      }));

      room.phase = 'in-match';
      room.match = this.createRound(room, {
        roundNumber: 1,
        starterSeatIndex,
      });
      this.scheduleTurnTimeout(room);
    });
  }

  async setMatchPaused(code: string, playerId: string, paused: boolean) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      const match = this.requireActiveMatch(room);

      if (this.resolveExpiredTurnIfNeeded(room)) {
        return;
      }

      this.assertHost(room, playerId);

      if (!match.turnTimer) {
        throw new CommandError('There is no active turn timer to pause.');
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
      const player = this.requirePlayer(room, playerId);
      const messageText = sanitizeChatMessage(text);

      if (!messageText) {
        throw new CommandError('Chat message cannot be empty.');
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
      const match = this.requireActiveMatch(room);
      const player = this.requirePlayer(room, playerId);

      if (this.resolveExpiredTurnIfNeeded(room)) {
        return;
      }

      if (match.turnTimer?.isPaused) {
        throw new CommandError('The game is paused.');
      }

      if (player.seatIndex !== match.round.currentTurnSeatIndex) {
        throw new CommandError('It is not your turn.');
      }

      const claim = parseClaimKey(claimKey);

      if (
        match.round.lastClaim &&
        compareClaims(
          claim,
          match.round.lastClaim,
          room.settings.claimOrderPreset,
        ) <= 0
      ) {
        throw new CommandError(
          'Each claim must be strictly stronger than the previous one.',
        );
      }

      match.round.lastClaim = claim;
      match.round.lastClaimantPlayerId = playerId;
      match.round.claimHistory.push({
        sequenceNumber: match.round.claimHistory.length + 1,
        playerId,
        claim,
      });
      match.round.currentTurnSeatIndex = getNextActiveSeatIndex(
        this.toPenaltyPlayerStates(room),
        player.seatIndex,
      );
      match.phase = 'awaiting-response';
      this.resetTurnTimer(room);
    });
  }

  async challengeClaim(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      const match = this.requireActiveMatch(room);
      const challenger = this.requirePlayer(room, playerId);

      if (this.resolveExpiredTurnIfNeeded(room)) {
        return;
      }

      if (match.turnTimer?.isPaused) {
        throw new CommandError('The game is paused.');
      }

      if (challenger.seatIndex !== match.round.currentTurnSeatIndex) {
        throw new CommandError('It is not your turn.');
      }

      if (!match.round.lastClaim || !match.round.lastClaimantPlayerId) {
        throw new CommandError('There is no claim to challenge yet.');
      }

      const resolution = resolveShowdown({
        claim: match.round.lastClaim,
        claimantPlayerId: match.round.lastClaimantPlayerId,
        challengerPlayerId: challenger.playerId,
        handsByPlayerId: match.round.handsByPlayerId,
        players: this.toPenaltyPlayerStates(room),
        eliminationHandSize: room.settings.eliminationHandSize,
      });

      this.clearTurnTimeout(code);

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
        resolution.loserPlayerId,
      );

      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0];

        if (!winner) {
          throw new CommandError('A winning player could not be determined.');
        }

        room.phase = 'match-complete';
        match.phase = 'match-complete';
        match.winnerPlayerId = winner.playerId;
        match.lastShowdown = {
          spokenClaim: match.round.lastClaim,
          claimantPlayerId: match.round.lastClaimantPlayerId,
          challengerPlayerId: challenger.playerId,
          claimWasValid: resolution.claimWasValid,
          loserPlayerId: resolution.loserPlayerId,
          loserHandSize: resolution.loserHandSize,
          loserEliminated: resolution.loserEliminated,
          revealedHands,
        };
        match.lastTimeout = undefined;
        match.turnTimer = undefined;
        match.round.currentTurnSeatIndex = winner.seatIndex;
        return;
      }

      const nextStarterSeatIndex = getNextActiveSeatIndex(
        this.toPenaltyPlayerStates(room),
        match.round.starterSeatIndex,
      );

      const showdown: ShowdownSnapshot = {
        spokenClaim: match.round.lastClaim,
        claimantPlayerId: match.round.lastClaimantPlayerId,
        challengerPlayerId: challenger.playerId,
        claimWasValid: resolution.claimWasValid,
        loserPlayerId: resolution.loserPlayerId,
        loserHandSize: resolution.loserHandSize,
        loserEliminated: resolution.loserEliminated,
        revealedHands,
        nextStarterPlayerId: this.requirePlayerBySeat(
          room,
          nextStarterSeatIndex,
        ).playerId,
      };

      room.phase = 'in-match';
      room.match = this.createRound(room, {
        roundNumber: match.round.roundNumber + 1,
        starterSeatIndex: nextStarterSeatIndex,
        lastShowdown: showdown,
      });
      this.scheduleTurnTimeout(room);
    });
  }

  async restartMatch(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.assertHost(room, playerId);

      this.clearTurnTimeout(code);
      room.phase = 'lobby';
      room.players = room.players.map((player) => ({
        ...player,
        handSize: 1,
        isEliminated: false,
        isReady: false,
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
    const shuffledDeck = shuffleDeck(createDeck());
    const handsByPlayerId = dealCards(
      shuffledDeck,
      activePlayers.map((player) => ({
        playerId: player.playerId,
        count: player.handSize,
      })),
    );

    return {
      phase: 'awaiting-opening-claim',
      round: {
        roundNumber: options.roundNumber,
        starterSeatIndex: options.starterSeatIndex,
        currentTurnSeatIndex: options.starterSeatIndex,
        claimHistory: [],
        handsByPlayerId,
      },
      turnTimer: this.createRunningTurnTimer(
        room.settings.turnTimeLimitSeconds,
      ),
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
    this.scheduleTurnTimeout(room);
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
    this.scheduleTurnTimeout(room);
  }

  private scheduleTurnTimeout(room: RoomState) {
    this.clearTurnTimeout(room.code);

    if (
      room.phase !== 'in-match' ||
      !room.match ||
      room.match.phase === 'match-complete' ||
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

  private buildRevealedHands(
    room: RoomState,
    handsByPlayerId: Record<string, Card[]>,
    loserPlayerId: string,
  ) {
    return sortPlayersBySeat(room.players)
      .filter(
        (player) => !player.isEliminated || player.playerId === loserPlayerId,
      )
      .map((player) => ({
        playerId: player.playerId,
        cards: sortCardsDescending(handsByPlayerId[player.playerId] ?? []),
      }));
  }

  private resolveExpiredTurnIfNeeded(room: RoomState): boolean {
    if (
      room.phase !== 'in-match' ||
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
    const resolution = applyRoundLoss({
      loserPlayerId: timedOutPlayer.playerId,
      players: this.toPenaltyPlayerStates(room),
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
      resolution.loserPlayerId,
    );
    const remainingPlayers = room.players.filter(
      (player) => !player.isEliminated,
    );

    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];

      if (!winner) {
        throw new CommandError('A winning player could not be determined.');
      }

      room.phase = 'match-complete';
      match.phase = 'match-complete';
      match.winnerPlayerId = winner.playerId;
      match.lastShowdown = undefined;
      match.lastTimeout = {
        timedOutPlayerId: timedOutPlayer.playerId,
        loserHandSize: resolution.loserHandSize,
        loserEliminated: resolution.loserEliminated,
        ...(match.round.lastClaim ? { lastClaim: match.round.lastClaim } : {}),
        ...(match.round.lastClaimantPlayerId
          ? { lastClaimantPlayerId: match.round.lastClaimantPlayerId }
          : {}),
        revealedHands,
      };
      match.turnTimer = undefined;
      match.round.currentTurnSeatIndex = winner.seatIndex;

      return true;
    }

    const nextStarterSeatIndex = getNextActiveSeatIndex(
      this.toPenaltyPlayerStates(room),
      match.round.starterSeatIndex,
    );
    const timeout: TimeoutSnapshot = {
      timedOutPlayerId: timedOutPlayer.playerId,
      loserHandSize: resolution.loserHandSize,
      loserEliminated: resolution.loserEliminated,
      ...(match.round.lastClaim ? { lastClaim: match.round.lastClaim } : {}),
      ...(match.round.lastClaimantPlayerId
        ? { lastClaimantPlayerId: match.round.lastClaimantPlayerId }
        : {}),
      revealedHands,
      nextStarterPlayerId: this.requirePlayerBySeat(room, nextStarterSeatIndex)
        .playerId,
    };

    room.phase = 'in-match';
    room.match = this.createRound(room, {
      roundNumber: match.round.roundNumber + 1,
      starterSeatIndex: nextStarterSeatIndex,
      lastTimeout: timeout,
    });
    this.scheduleTurnTimeout(room);
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

  private requireRoom(code: string): RoomState {
    const room = this.rooms.get(code);

    if (!room) {
      throw new CommandError('Room not found.', 404);
    }

    return room;
  }

  private requirePlayer(room: RoomState, playerId: string): PlayerState {
    const player = room.players.find(
      (candidate) => candidate.playerId === playerId,
    );

    if (!player) {
      throw new CommandError('Player not found in this room.', 404);
    }

    return player;
  }

  private requirePlayerBySeat(room: RoomState, seatIndex: number): PlayerState {
    const player = room.players.find(
      (candidate) => candidate.seatIndex === seatIndex,
    );

    if (!player) {
      throw new CommandError('Seat not found in this room.', 404);
    }

    return player;
  }

  private requireActiveMatch(room: RoomState): MatchState {
    if (!room.match || room.phase !== 'in-match') {
      throw new CommandError('There is no active match in this room.');
    }

    return room.match;
  }

  private assertHost(room: RoomState, playerId: string) {
    if (room.hostPlayerId !== playerId) {
      throw new CommandError('Only the host can do that.');
    }
  }

  private assertDisplayNameAvailable(room: RoomState, name: string) {
    const normalizedName = normalizeDisplayNameKey(name);
    const duplicate = room.players.find(
      (player) => normalizeDisplayNameKey(player.name) === normalizedName,
    );

    if (duplicate) {
      throw new CommandError(
        'That display name is already in use in this room.',
      );
    }
  }

  private maybeReassignHost(room: RoomState, previousHostPlayerId: string) {
    if (room.hostPlayerId !== previousHostPlayerId) {
      return;
    }

    const nextHost =
      sortPlayersBySeat(room.players).find(
        (player) => player.connectionStatus === 'connected',
      ) ?? sortPlayersBySeat(room.players)[0];

    if (!nextHost) {
      return;
    }

    room.hostPlayerId = nextHost.playerId;
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
}

export { CommandError };
