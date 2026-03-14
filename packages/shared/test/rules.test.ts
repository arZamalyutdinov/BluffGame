import { describe, expect, it } from 'vitest';

import {
  type Card,
  claimExists,
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

    expect(claimExists(cards, parseClaimKey('straight:7'))).toBe(true);
    expect(claimExists(cards, parseClaimKey('straight:6'))).toBe(false);
  });

  it('allows a pair claim to be satisfied by trips or quads of the same rank', () => {
    const cards = [card(12, 'clubs'), card(12, 'diamonds'), card(12, 'hearts')];

    expect(claimExists(cards, parseClaimKey('pair:12'))).toBe(true);
  });

  it('checks flush claims by the exact spoken high card', () => {
    const cards = [
      card(14, 'hearts'),
      card(13, 'hearts'),
      card(12, 'hearts'),
      card(11, 'hearts'),
      card(9, 'hearts'),
      card(8, 'hearts'),
    ];

    expect(claimExists(cards, parseClaimKey('flush:14'))).toBe(true);
    expect(claimExists(cards, parseClaimKey('flush:13'))).toBe(true);
    expect(claimExists(cards, parseClaimKey('flush:12'))).toBe(false);
  });
});

describe('resolveShowdown', () => {
  it('penalizes the claimant when the exact claim does not exist', () => {
    const result = resolveShowdown({
      claim: parseClaimKey('straight:7'),
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
    });

    expect(result.claimWasValid).toBe(false);
    expect(result.loserPlayerId).toBe('alpha');

    const alpha = result.updatedPlayers.find(
      (player) => player.playerId === 'alpha',
    );
    expect(alpha?.isEliminated).toBe(true);
  });
});
