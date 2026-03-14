import { randomUUID } from 'node:crypto';

import {
  type Card,
  type Claim,
  type ClaimRecordSnapshot,
  type MatchPhase,
  type RoomSnapshot,
  type ShowdownSnapshot,
  compareClaims,
  createDeck,
  dealCards,
  getNextActiveSeatIndex,
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
  winnerPlayerId?: string | undefined;
  lastShowdown?: ShowdownSnapshot | undefined;
}

interface RoomState {
  code: string;
  phase: 'lobby' | 'in-match' | 'match-complete';
  hostPlayerId: string;
  players: PlayerState[];
  match: MatchState | undefined;
}

export interface AttachConnectionResult {
  roomCode: string;
  playerId: string;
  previousSocketId?: string;
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

export class RoomRegistry {
  private readonly rooms = new Map<string, RoomState>();
  private readonly roomQueues = new Map<string, Promise<void>>();

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
      players,
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

      if (room.match.round.lastClaim) {
        matchSnapshot.lastClaim = room.match.round.lastClaim;
      }

      if (room.match.lastShowdown) {
        matchSnapshot.showdown = room.match.lastShowdown;
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
    });
  }

  async submitClaim(code: string, playerId: string, claimKey: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      const match = this.requireActiveMatch(room);
      const player = this.requirePlayer(room, playerId);

      if (player.seatIndex !== match.round.currentTurnSeatIndex) {
        throw new CommandError('It is not your turn.');
      }

      const claim = parseClaimKey(claimKey);

      if (
        match.round.lastClaim &&
        compareClaims(claim, match.round.lastClaim) <= 0
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
    });
  }

  async challengeClaim(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      const match = this.requireActiveMatch(room);
      const challenger = this.requirePlayer(room, playerId);

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
      });

      for (const updatedPlayer of resolution.updatedPlayers) {
        const player = this.requirePlayer(room, updatedPlayer.playerId);
        player.handSize = updatedPlayer.handSize;
        player.isEliminated = updatedPlayer.isEliminated;
      }

      const remainingPlayers = room.players.filter(
        (player) => !player.isEliminated,
      );
      const revealedHands = sortPlayersBySeat(room.players)
        .filter(
          (player) =>
            !player.isEliminated ||
            player.playerId === resolution.loserPlayerId,
        )
        .map((player) => ({
          playerId: player.playerId,
          cards: sortCardsDescending(
            match.round.handsByPlayerId[player.playerId] ?? [],
          ),
        }));

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
    });
  }

  async restartMatch(code: string, playerId: string) {
    return this.withRoomLock(code, () => {
      const room = this.requireRoom(code);
      this.assertHost(room, playerId);

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
      ...(options.lastShowdown ? { lastShowdown: options.lastShowdown } : {}),
    };
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
