import { z } from 'zod';

import { RANKS, SUITS } from '../cards/index.js';
import { CLAIM_CATEGORIES } from '../claims/index.js';

const claimCategorySchema = z.enum(CLAIM_CATEGORIES);
const rankSchema = z
  .number()
  .int()
  .refine((value) => RANKS.includes(value as (typeof RANKS)[number]));
const suitSchema = z.enum(SUITS);

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
    highRank: rankSchema.refine((rank) => rank >= 5),
  }),
  z.object({
    category: z.literal('flush'),
    highRank: rankSchema.refine((rank) => rank >= 6),
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
    highRank: rankSchema.refine((rank) => rank >= 5 && rank <= 13),
  }),
  z.object({
    category: z.literal('royal-flush'),
  }),
]);

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

export const roomSnapshotSchema = z.object({
  roomCode: z.string().length(4),
  phase: z.enum(['lobby', 'in-match', 'match-complete']),
  selfPlayerId: z.string().min(1),
  hostPlayerId: z.string().min(1),
  players: z.array(
    z.object({
      playerId: z.string().min(1),
      name: z.string().min(1),
      seatIndex: z.number().int().min(0),
      isHost: z.boolean(),
      isReady: z.boolean(),
      connectionStatus: z.enum(['connected', 'disconnected']),
      handSize: z.number().int().min(1).max(5),
      isEliminated: z.boolean(),
      cardCount: z.number().int().min(0).max(5),
    }),
  ),
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
          loserHandSize: z.number().int().min(1).max(5),
          loserEliminated: z.boolean(),
          revealedHands: z.array(
            z.object({
              playerId: z.string().min(1),
              cards: z.array(cardSchema),
            }),
          ),
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
