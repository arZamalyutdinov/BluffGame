import { describe, expect, it } from 'vitest';

import {
  type Card,
  applyRoundLoss,
  claimExists,
  claimToCompactLabel,
  compareClaims,
  parseClaimKey,
  resolveShowdown,
} from '../src/index.js';

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

describe('compareClaims', () => {
  it('orders claims by category before internal rank', () => {
    const highCardAce = parseClaimKey('high-card:14');
    const pairOfTwos = parseClaimKey('pair:2');

    expect(compareClaims(pairOfTwos, highCardAce)).toBeGreaterThan(0);
  });

  it('uses the configured preset when comparing flushes against straights', () => {
    const flush = parseClaimKey('flush:hearts');
    const straight = parseClaimKey('straight:6');

    expect(compareClaims(flush, straight, 'flush-below-straight')).toBeLessThan(
      0,
    );
    expect(compareClaims(flush, straight, 'standard-poker')).toBeGreaterThan(0);
  });

  it('orders straights by the spoken low card', () => {
    const threeLowStraight = parseClaimKey('straight:3');
    const tenLowStraight = parseClaimKey('straight:10');

    expect(compareClaims(tenLowStraight, threeLowStraight)).toBeGreaterThan(0);
  });

  it('uses suit order for flush claims', () => {
    const heartsFlush = parseClaimKey('flush:hearts');
    const spadesFlush = parseClaimKey('flush:spades');

    expect(compareClaims(spadesFlush, heartsFlush)).toBeGreaterThan(0);
  });
});

describe('claimToCompactLabel', () => {
  it('formats rank-based claims with short poker-style labels', () => {
    expect(claimToCompactLabel(parseClaimKey('pair:9'))).toBe('pair of 9s');
    expect(claimToCompactLabel(parseClaimKey('two-pair:9:2'))).toBe('9s & 2s');
    expect(claimToCompactLabel(parseClaimKey('full-house:12:5'))).toBe(
      'Qs full of 5s',
    );
  });

  it('formats suit-based claims with compact suit symbols', () => {
    expect(claimToCompactLabel(parseClaimKey('flush:hearts'))).toBe('♥ flush');
    expect(claimToCompactLabel(parseClaimKey('straight-flush:10:spades'))).toBe(
      '10-low ♠ straight flush',
    );
  });
});

describe('claimExists', () => {
  it('requires the exact straight that was spoken', () => {
    const cards = [
      card(3, 'clubs'),
      card(4, 'diamonds'),
      card(5, 'hearts'),
      card(6, 'spades'),
      card(7, 'clubs'),
    ];

    expect(claimExists(cards, parseClaimKey('straight:3'))).toBe(true);
    expect(claimExists(cards, parseClaimKey('straight:2'))).toBe(false);
  });

  it('allows a pair claim to be satisfied by trips or quads of the same rank', () => {
    const cards = [card(12, 'clubs'), card(12, 'diamonds'), card(12, 'hearts')];

    expect(claimExists(cards, parseClaimKey('pair:12'))).toBe(true);
  });

  it('checks flush claims by the exact spoken suit only', () => {
    const cards = [
      card(14, 'hearts'),
      card(13, 'hearts'),
      card(12, 'hearts'),
      card(11, 'hearts'),
      card(9, 'hearts'),
      card(8, 'hearts'),
    ];

    expect(claimExists(cards, parseClaimKey('flush:hearts'))).toBe(true);
    expect(claimExists(cards, parseClaimKey('flush:spades'))).toBe(false);
  });

  it('requires the exact suit and low card for straight flush claims', () => {
    const cards = [
      card(9, 'clubs'),
      card(10, 'clubs'),
      card(11, 'clubs'),
      card(12, 'clubs'),
      card(13, 'clubs'),
      card(10, 'spades'),
      card(11, 'spades'),
      card(12, 'spades'),
      card(13, 'spades'),
      card(14, 'spades'),
    ];

    expect(claimExists(cards, parseClaimKey('straight-flush:9:clubs'))).toBe(
      true,
    );
    expect(claimExists(cards, parseClaimKey('straight-flush:9:spades'))).toBe(
      false,
    );
    expect(claimExists(cards, parseClaimKey('straight-flush:10:spades'))).toBe(
      true,
    );
    expect(claimExists(cards, parseClaimKey('straight-flush:10:hearts'))).toBe(
      false,
    );
  });
});

describe('resolveShowdown', () => {
  it('penalizes the claimant when the exact claim does not exist', () => {
    const result = resolveShowdown({
      claim: parseClaimKey('straight:3'),
      claimantPlayerId: 'alpha',
      challengerPlayerId: 'beta',
      handsByPlayerId: {
        alpha: [card(3, 'clubs'), card(4, 'diamonds')],
        beta: [card(5, 'hearts'), card(6, 'spades')],
      },
      players: [
        { playerId: 'alpha', seatIndex: 0, handSize: 2, isEliminated: false },
        { playerId: 'beta', seatIndex: 1, handSize: 1, isEliminated: false },
      ],
      eliminationHandSize: 5,
    });

    expect(result.claimWasValid).toBe(false);
    expect(result.loserPlayerId).toBe('alpha');
    expect(
      result.updatedPlayers.find((player) => player.playerId === 'alpha')
        ?.handSize,
    ).toBe(3);
  });

  it('eliminates a player who loses while already at five cards', () => {
    const result = resolveShowdown({
      claim: parseClaimKey('pair:9'),
      claimantPlayerId: 'alpha',
      challengerPlayerId: 'beta',
      handsByPlayerId: {
        alpha: [card(9, 'clubs')],
        beta: [card(4, 'hearts')],
      },
      players: [
        { playerId: 'alpha', seatIndex: 0, handSize: 5, isEliminated: false },
        { playerId: 'beta', seatIndex: 1, handSize: 1, isEliminated: false },
      ],
      eliminationHandSize: 5,
    });

    expect(result.claimWasValid).toBe(false);
    expect(result.loserPlayerId).toBe('alpha');

    const alpha = result.updatedPlayers.find(
      (player) => player.playerId === 'alpha',
    );
    expect(alpha?.isEliminated).toBe(true);
  });

  it('uses the configured elimination hand size', () => {
    const result = resolveShowdown({
      claim: parseClaimKey('pair:9'),
      claimantPlayerId: 'alpha',
      challengerPlayerId: 'beta',
      handsByPlayerId: {
        alpha: [card(9, 'clubs')],
        beta: [card(4, 'hearts')],
      },
      players: [
        { playerId: 'alpha', seatIndex: 0, handSize: 4, isEliminated: false },
        { playerId: 'beta', seatIndex: 1, handSize: 1, isEliminated: false },
      ],
      eliminationHandSize: 4,
    });

    expect(result.loserPlayerId).toBe('alpha');
    expect(result.loserEliminated).toBe(true);
  });
});

describe('applyRoundLoss', () => {
  it('increments the loser hand size when they are below the elimination limit', () => {
    const result = applyRoundLoss({
      loserPlayerId: 'beta',
      players: [
        { playerId: 'alpha', seatIndex: 0, handSize: 1, isEliminated: false },
        { playerId: 'beta', seatIndex: 1, handSize: 3, isEliminated: false },
      ],
      eliminationHandSize: 5,
    });

    expect(result.loserPlayerId).toBe('beta');
    expect(result.loserHandSize).toBe(4);
    expect(result.loserEliminated).toBe(false);
  });
});
