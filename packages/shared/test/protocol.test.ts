import { describe, expect, it } from 'vitest';

import {
  apiErrorResponseSchema,
  becomeSpectatorCommandSchema,
  calculateDealingDurationMs,
  commandRejectedEventSchema,
  createCard,
  createJoker,
  kickPlayerCommandSchema,
  removeBotCommandSchema,
  roomSnapshotSchema,
  setSpectatorCardRevealCommandSchema,
} from '../src/index.js';

describe('shared dealing contract', () => {
  it('accepts dealing metadata on match snapshots', () => {
    const parsed = roomSnapshotSchema.parse({
      roomCode: 'ABCD',
      phase: 'in-match',
      selfPlayerId: 'p1',
      hostPlayerId: 'p1',
      settings: {
        eliminationHandSize: 5,
        claimOrderPreset: 'flush-below-straight',
        flushRule: 'suit-only',
        showdownDrawRule: 'revealed-only',
        jokerRule: 'off',
        turnTimeLimitSeconds: 45,
      },
      players: [
        {
          playerId: 'p1',
          name: 'Host',
          seatIndex: 0,
          isHost: true,
          isBot: false,
          isReady: true,
          connectionStatus: 'connected',
          handSize: 1,
          isEliminated: false,
          cardCount: 1,
        },
        {
          playerId: 'p2',
          name: 'Guest',
          seatIndex: 1,
          isHost: false,
          isBot: false,
          isReady: true,
          connectionStatus: 'connected',
          handSize: 1,
          isEliminated: false,
          cardCount: 1,
        },
      ],
      chatMessages: [],
      match: {
        phase: 'dealing',
        roundNumber: 1,
        starterPlayerId: 'p1',
        currentTurnPlayerId: 'p1',
        dealing: {
          startedAtMs: 1_710_000_000_000,
          durationMs: 780,
        },
        claimHistory: [],
        yourHand: [],
      },
    });

    expect(parsed.match?.phase).toBe('dealing');
    expect(parsed.match?.dealing).toEqual({
      startedAtMs: 1_710_000_000_000,
      durationMs: 780,
    });
    expect(parsed.match?.turnTimer).toBeUndefined();
  });

  it('returns stable dealing durations for small, medium, and large rounds', () => {
    expect(calculateDealingDurationMs({ totalCardCount: 2 })).toBe(780);
    expect(calculateDealingDurationMs({ totalCardCount: 16 })).toBe(2290);
    expect(calculateDealingDurationMs({ totalCardCount: 32 })).toBe(3430);
  });

  it('accepts the suit-plus-rank flush rule and flush claims with a named card', () => {
    const parsed = roomSnapshotSchema.parse({
      roomCode: 'WXYZ',
      phase: 'in-match',
      selfPlayerId: 'p1',
      hostPlayerId: 'p1',
      settings: {
        eliminationHandSize: 5,
        claimOrderPreset: 'flush-below-straight',
        flushRule: 'suit-plus-rank',
        showdownDrawRule: 'revealed-only',
        jokerRule: 'off',
        turnTimeLimitSeconds: 45,
      },
      players: [
        {
          playerId: 'p1',
          name: 'Host',
          seatIndex: 0,
          isHost: true,
          isBot: false,
          isReady: true,
          connectionStatus: 'connected',
          handSize: 1,
          isEliminated: false,
          cardCount: 1,
        },
        {
          playerId: 'p2',
          name: 'Guest',
          seatIndex: 1,
          isHost: false,
          isBot: false,
          isReady: true,
          connectionStatus: 'connected',
          handSize: 1,
          isEliminated: false,
          cardCount: 1,
        },
      ],
      chatMessages: [],
      match: {
        phase: 'awaiting-response',
        roundNumber: 2,
        starterPlayerId: 'p1',
        currentTurnPlayerId: 'p2',
        turnTimer: {
          durationSeconds: 45,
          remainingMs: 12_000,
          isPaused: false,
        },
        lastClaim: {
          category: 'flush',
          suit: 'hearts',
          rank: 12,
        },
        claimHistory: [],
        yourHand: [],
      },
    });

    expect(parsed.settings.flushRule).toBe('suit-plus-rank');
    expect(parsed.match?.lastClaim).toEqual({
      category: 'flush',
      suit: 'hearts',
      rank: 12,
    });
  });

  it('accepts showdown snapshots with suspense timing and revealed deck draws', () => {
    const parsed = roomSnapshotSchema.parse({
      roomCode: 'ZZZZ',
      phase: 'in-match',
      selfPlayerId: 'p1',
      hostPlayerId: 'p1',
      settings: {
        eliminationHandSize: 5,
        claimOrderPreset: 'flush-below-straight',
        flushRule: 'suit-only',
        showdownDrawRule: 'draw-until-miss',
        jokerRule: 'off',
        turnTimeLimitSeconds: 45,
      },
      players: [
        {
          playerId: 'p1',
          name: 'Host',
          seatIndex: 0,
          isHost: true,
          isBot: false,
          isReady: true,
          connectionStatus: 'connected',
          handSize: 1,
          isEliminated: false,
          cardCount: 1,
        },
        {
          playerId: 'p2',
          name: 'Guest',
          seatIndex: 1,
          isHost: false,
          isBot: false,
          isReady: true,
          connectionStatus: 'connected',
          handSize: 1,
          isEliminated: false,
          cardCount: 1,
        },
      ],
      chatMessages: [],
      match: {
        phase: 'showing-result',
        roundNumber: 3,
        starterPlayerId: 'p1',
        currentTurnPlayerId: 'p2',
        claimHistory: [],
        yourHand: [],
        showdown: {
          startedAtMs: 1_710_000_100_000,
          spokenClaim: {
            category: 'pair',
            pairRank: 14,
          },
          claimantPlayerId: 'p1',
          challengerPlayerId: 'p2',
          claimWasValid: true,
          loserPlayerId: 'p2',
          loserHandSize: 2,
          loserEliminated: false,
          revealedHands: [
            {
              playerId: 'p1',
              cards: [createCard(14, 'hearts')],
            },
            {
              playerId: 'p2',
              cards: [createCard(7, 'clubs')],
            },
          ],
          deckDraws: [createCard(14, 'spades')],
        },
      },
    });

    expect(parsed.settings.showdownDrawRule).toBe('draw-until-miss');
    expect(parsed.match?.showdown?.startedAtMs).toBe(1_710_000_100_000);
    expect(parsed.match?.showdown?.deckDraws).toEqual([
      createCard(14, 'spades'),
    ]);
  });

  it('accepts spectator-only live reveal snapshots for eliminated viewers', () => {
    const parsed = roomSnapshotSchema.parse({
      roomCode: 'SPEC',
      phase: 'in-match',
      selfPlayerId: 'p1',
      hostPlayerId: 'p2',
      settings: {
        eliminationHandSize: 5,
        claimOrderPreset: 'flush-below-straight',
        flushRule: 'suit-only',
        showdownDrawRule: 'revealed-only',
        jokerRule: 'off',
        turnTimeLimitSeconds: 45,
      },
      players: [
        {
          playerId: 'p1',
          name: 'Viewer',
          seatIndex: 0,
          isHost: false,
          isBot: false,
          isReady: true,
          connectionStatus: 'connected',
          handSize: 5,
          isEliminated: true,
          cardCount: 0,
        },
        {
          playerId: 'p2',
          name: 'Host',
          seatIndex: 1,
          isHost: true,
          isBot: false,
          isReady: true,
          connectionStatus: 'connected',
          handSize: 2,
          isEliminated: false,
          cardCount: 2,
        },
      ],
      chatMessages: [],
      match: {
        phase: 'awaiting-response',
        roundNumber: 4,
        starterPlayerId: 'p2',
        currentTurnPlayerId: 'p2',
        turnTimer: {
          durationSeconds: 45,
          remainingMs: 20_000,
          isPaused: false,
        },
        claimHistory: [],
        yourHand: [],
        spectator: {
          isSpectator: true,
          revealCardsEnabled: true,
          revealedHands: [
            {
              playerId: 'p2',
              cards: [createCard(14, 'spades'), createCard(7, 'hearts')],
            },
          ],
        },
      },
    });

    expect(parsed.match?.spectator).toEqual({
      isSpectator: true,
      revealCardsEnabled: true,
      revealedHands: [
        {
          playerId: 'p2',
          cards: [createCard(14, 'spades'), createCard(7, 'hearts')],
        },
      ],
    });
  });

  it('accepts the remove-bot lobby command payload', () => {
    expect(removeBotCommandSchema.parse({ playerId: 'bot-1' })).toEqual({
      playerId: 'bot-1',
    });
  });

  it('accepts joker-enabled room settings and joker cards in snapshots', () => {
    const parsed = roomSnapshotSchema.parse({
      roomCode: 'JOKR',
      phase: 'in-match',
      selfPlayerId: 'p1',
      hostPlayerId: 'p1',
      settings: {
        eliminationHandSize: 5,
        claimOrderPreset: 'flush-below-straight',
        flushRule: 'suit-only',
        showdownDrawRule: 'revealed-only',
        jokerRule: 'two-jokers',
        turnTimeLimitSeconds: 45,
      },
      players: [
        {
          playerId: 'p1',
          name: 'Host',
          seatIndex: 0,
          isHost: true,
          isBot: false,
          isReady: true,
          connectionStatus: 'connected',
          handSize: 1,
          isEliminated: false,
          cardCount: 1,
        },
        {
          playerId: 'p2',
          name: 'Guest',
          seatIndex: 1,
          isHost: false,
          isBot: false,
          isReady: true,
          connectionStatus: 'connected',
          handSize: 1,
          isEliminated: false,
          cardCount: 1,
        },
      ],
      chatMessages: [],
      match: {
        phase: 'awaiting-response',
        roundNumber: 5,
        starterPlayerId: 'p1',
        currentTurnPlayerId: 'p2',
        turnTimer: {
          durationSeconds: 45,
          remainingMs: 20_000,
          isPaused: false,
        },
        claimHistory: [],
        yourHand: [createJoker('red')],
        showdown: {
          startedAtMs: 1_710_000_200_000,
          spokenClaim: {
            category: 'pair',
            pairRank: 14,
          },
          claimantPlayerId: 'p1',
          challengerPlayerId: 'p2',
          claimWasValid: true,
          loserPlayerId: 'p2',
          loserHandSize: 2,
          loserEliminated: false,
          revealedHands: [
            {
              playerId: 'p1',
              cards: [createJoker('red')],
            },
            {
              playerId: 'p2',
              cards: [createCard(14, 'clubs')],
            },
          ],
          deckDraws: [],
        },
      },
    });

    expect(parsed.settings.jokerRule).toBe('two-jokers');
    expect(parsed.match?.yourHand).toEqual([createJoker('red')]);
  });

  it('accepts spectator reveal commands', () => {
    expect(
      setSpectatorCardRevealCommandSchema.parse({
        enabled: true,
      }),
    ).toEqual({ enabled: true });
  });

  it('accepts spectator transition commands', () => {
    expect(
      kickPlayerCommandSchema.parse({
        playerId: 'p2',
      }),
    ).toEqual({ playerId: 'p2' });

    expect(becomeSpectatorCommandSchema.parse(undefined)).toEqual({});
  });

  it('accepts coded socket rejection payloads', () => {
    expect(
      commandRejectedEventSchema.parse({
        code: 'claim-not-stronger',
        message: 'Each claim must be strictly stronger than the previous one.',
      }),
    ).toEqual({
      code: 'claim-not-stronger',
      message: 'Each claim must be strictly stronger than the previous one.',
    });
  });

  it('accepts coded HTTP error payloads', () => {
    expect(
      apiErrorResponseSchema.parse({
        code: 'network-unreachable',
        message:
          'Cannot reach the game server. Start the backend on port 3001 or run `pnpm dev`.',
      }),
    ).toEqual({
      code: 'network-unreachable',
      message:
        'Cannot reach the game server. Start the backend on port 3001 or run `pnpm dev`.',
    });
  });
});
