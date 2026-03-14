import { z } from 'zod';

import { RANKS, SUITS } from '../cards/index.js';
import { CLAIM_CATEGORIES, STRAIGHT_LOW_RANKS } from '../claims/index.js';
import {
  CLAIM_ORDER_PRESETS,
  MAX_ELIMINATION_HAND_SIZE,
  MAX_TURN_TIME_LIMIT_SECONDS,
  MIN_ELIMINATION_HAND_SIZE,
  MIN_TURN_TIME_LIMIT_SECONDS,
} from '../settings/index.js';
import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_ROOM_CHAT_MESSAGES,
} from '../state/index.js';

const claimCategorySchema = z.enum(CLAIM_CATEGORIES);
const rankSchema = z
  .number()
  .int()
  .refine((value) => RANKS.includes(value as (typeof RANKS)[number]));
const suitSchema = z.enum(SUITS);
const straightLowRankSchema = z
  .number()
  .int()
  .refine((value) =>
    STRAIGHT_LOW_RANKS.includes(value as (typeof STRAIGHT_LOW_RANKS)[number]),
  );

export const cardSchema = z.object({
  rank: rankSchema,
  suit: suitSchema,
});

export const claimSchema = z.discriminatedUnion('category', [
  z.object({
    category: z.literal('high-card'),
    rank: rankSchema,
  }),
  z.object({
    category: z.literal('pair'),
    pairRank: rankSchema,
  }),
  z.object({
    category: z.literal('two-pair'),
    highPairRank: rankSchema,
    lowPairRank: rankSchema,
  }),
  z.object({
    category: z.literal('three-of-a-kind'),
    tripRank: rankSchema,
  }),
  z.object({
    category: z.literal('straight'),
    lowRank: straightLowRankSchema,
  }),
  z.object({
    category: z.literal('flush'),
    suit: suitSchema,
  }),
  z.object({
    category: z.literal('full-house'),
    tripRank: rankSchema,
    pairRank: rankSchema,
  }),
  z.object({
    category: z.literal('four-of-a-kind'),
    quadRank: rankSchema,
  }),
  z.object({
    category: z.literal('straight-flush'),
    lowRank: straightLowRankSchema,
    suit: suitSchema,
  }),
]);

export const roomSettingsSchema = z.object({
  eliminationHandSize: z
    .number()
    .int()
    .min(MIN_ELIMINATION_HAND_SIZE)
    .max(MAX_ELIMINATION_HAND_SIZE),
  claimOrderPreset: z.enum(CLAIM_ORDER_PRESETS),
  turnTimeLimitSeconds: z
    .number()
    .int()
    .min(MIN_TURN_TIME_LIMIT_SECONDS)
    .max(MAX_TURN_TIME_LIMIT_SECONDS),
});

export const roomSessionSchema = z.object({
  roomCode: z.string().length(4),
  playerId: z.string().min(1),
  sessionToken: z.string().min(1),
  displayName: z.string().min(1).max(24),
});

export const createRoomRequestSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .transform((value) => value.trim()),
});

export const joinRoomRequestSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .transform((value) => value.trim()),
});

export const socketAuthSchema = z.object({
  roomCode: z.string().length(4),
  playerId: z.string().min(1),
  sessionToken: z.string().min(1),
});

export const setReadyCommandSchema = z.object({
  ready: z.boolean(),
});

export const submitClaimCommandSchema = z.object({
  claimKey: z.string().min(1),
});

export const updateRoomSettingsCommandSchema = roomSettingsSchema;

export const setMatchPausedCommandSchema = z.object({
  paused: z.boolean(),
});

export const sendChatMessageCommandSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(MAX_CHAT_MESSAGE_LENGTH)
    .transform((value) => value.trim()),
});

const revealedHandSchema = z.object({
  playerId: z.string().min(1),
  cards: z.array(cardSchema),
});

const turnTimerSchema = z.object({
  durationSeconds: z
    .number()
    .int()
    .min(MIN_TURN_TIME_LIMIT_SECONDS)
    .max(MAX_TURN_TIME_LIMIT_SECONDS),
  remainingMs: z
    .number()
    .int()
    .min(0)
    .max(MAX_TURN_TIME_LIMIT_SECONDS * 1000),
  isPaused: z.boolean(),
  deadlineAtMs: z.number().int().positive().optional(),
  pausedByPlayerId: z.string().min(1).optional(),
});

const chatMessageSchema = z.object({
  messageId: z.string().min(1),
  playerId: z.string().min(1),
  playerName: z.string().min(1).max(24),
  text: z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
  sentAtMs: z.number().int().nonnegative(),
});

export const roomSnapshotSchema = z.object({
  roomCode: z.string().length(4),
  phase: z.enum(['lobby', 'in-match', 'match-complete']),
  selfPlayerId: z.string().min(1),
  hostPlayerId: z.string().min(1),
  settings: roomSettingsSchema,
  players: z.array(
    z.object({
      playerId: z.string().min(1),
      name: z.string().min(1),
      seatIndex: z.number().int().min(0),
      isHost: z.boolean(),
      isReady: z.boolean(),
      connectionStatus: z.enum(['connected', 'disconnected']),
      handSize: z.number().int().min(1).max(MAX_ELIMINATION_HAND_SIZE),
      isEliminated: z.boolean(),
      cardCount: z.number().int().min(0).max(MAX_ELIMINATION_HAND_SIZE),
    }),
  ),
  chatMessages: z.array(chatMessageSchema).max(MAX_ROOM_CHAT_MESSAGES),
  match: z
    .object({
      phase: z.enum([
        'awaiting-opening-claim',
        'awaiting-response',
        'match-complete',
      ]),
      roundNumber: z.number().int().min(1),
      starterPlayerId: z.string().min(1),
      currentTurnPlayerId: z.string().min(1),
      turnTimer: turnTimerSchema.optional(),
      lastClaim: claimSchema.optional(),
      claimHistory: z.array(
        z.object({
          sequenceNumber: z.number().int().min(1),
          playerId: z.string().min(1),
          claim: claimSchema,
        }),
      ),
      yourHand: z.array(cardSchema),
      showdown: z
        .object({
          spokenClaim: claimSchema,
          claimantPlayerId: z.string().min(1),
          challengerPlayerId: z.string().min(1),
          claimWasValid: z.boolean(),
          loserPlayerId: z.string().min(1),
          loserHandSize: z.number().int().min(1).max(MAX_ELIMINATION_HAND_SIZE),
          loserEliminated: z.boolean(),
          revealedHands: z.array(revealedHandSchema),
          nextStarterPlayerId: z.string().min(1).optional(),
        })
        .optional(),
      timeout: z
        .object({
          timedOutPlayerId: z.string().min(1),
          loserHandSize: z.number().int().min(1).max(MAX_ELIMINATION_HAND_SIZE),
          loserEliminated: z.boolean(),
          lastClaim: claimSchema.optional(),
          lastClaimantPlayerId: z.string().min(1).optional(),
          revealedHands: z.array(revealedHandSchema),
          nextStarterPlayerId: z.string().min(1).optional(),
        })
        .optional(),
      winnerPlayerId: z.string().min(1).optional(),
    })
    .optional(),
});

export const commandRejectedEventSchema = z.object({
  message: z.string().min(1),
});
