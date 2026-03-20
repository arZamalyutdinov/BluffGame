import { describe, expect, it } from 'vitest';

import {
  type Card,
  applyRoundLoss,
  buildClaimConstruction,
  claimExists,
  claimToCompactLabel,
  compareClaims,
  createCard,
  createJoker,
  getClaimProgressScore,
  isClaimStrictlyHigher,
  parseClaimKey,
  resolveShowdown,
} from '../src/index.js';

function card(
  rank: number,
  suit: 'diamonds' | 'clubs' | 'hearts' | 'spades',
): Card {
  return createCard(
    rank as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14,
    suit,
  );
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

  it('requires suit-plus-rank flush raises to keep both axes flat or rising', () => {
    const clubsAceFlush = parseClaimKey('flush:clubs:14');
    const diamondsKingFlush = parseClaimKey('flush:diamonds:13');
    const clubsQueenFlush = parseClaimKey('flush:clubs:12');
    const heartsTwoFlush = parseClaimKey('flush:hearts:2');
    const clubsTenFlush = parseClaimKey('flush:clubs:10');

    expect(
      isClaimStrictlyHigher(
        clubsAceFlush,
        diamondsKingFlush,
        'flush-below-straight',
        'suit-plus-rank',
      ),
    ).toBe(true);
    expect(
      isClaimStrictlyHigher(
        clubsAceFlush,
        clubsQueenFlush,
        'flush-below-straight',
        'suit-plus-rank',
      ),
    ).toBe(true);
    expect(
      isClaimStrictlyHigher(
        heartsTwoFlush,
        clubsTenFlush,
        'flush-below-straight',
        'suit-plus-rank',
      ),
    ).toBe(false);
    expect(
      compareClaims(
        heartsTwoFlush,
        clubsTenFlush,
        'flush-below-straight',
        'suit-plus-rank',
      ),
    ).toBe(0);
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
    expect(claimToCompactLabel(parseClaimKey('flush:hearts:12'))).toBe(
      '♥ flush + Q',
    );
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

  it('requires the named suited card for suit-plus-rank flush claims', () => {
    const cards = [
      card(14, 'hearts'),
      card(13, 'hearts'),
      card(12, 'hearts'),
      card(10, 'hearts'),
      card(9, 'hearts'),
      card(8, 'hearts'),
    ];

    expect(claimExists(cards, parseClaimKey('flush:hearts:12'))).toBe(true);
    expect(claimExists(cards, parseClaimKey('flush:hearts:11'))).toBe(false);
    expect(claimExists(cards, parseClaimKey('flush:spades:12'))).toBe(false);
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

  it('lets jokers complete unsuited rank claims', () => {
    const cards = [card(12, 'clubs'), createJoker('red')];

    expect(claimExists(cards, parseClaimKey('pair:12'))).toBe(true);
  });

  it('lets both jokers participate in one exact claim', () => {
    const cards = [
      card(9, 'clubs'),
      card(9, 'hearts'),
      card(5, 'spades'),
      createJoker('red'),
      createJoker('black'),
    ];

    expect(claimExists(cards, parseClaimKey('full-house:9:5'))).toBe(true);
  });

  it('rejects a red joker for a black-suit flush target', () => {
    const cards = [
      card(14, 'spades'),
      card(13, 'spades'),
      card(12, 'spades'),
      card(11, 'spades'),
      createJoker('red'),
    ];

    expect(claimExists(cards, parseClaimKey('flush:spades'))).toBe(false);
    expect(claimExists(cards, parseClaimKey('flush:hearts'))).toBe(false);
  });
});

describe('buildClaimConstruction', () => {
  it('returns the exact cards that satisfy a valid rank claim', () => {
    const construction = buildClaimConstruction(
      [card(9, 'spades'), card(9, 'hearts'), card(4, 'clubs')],
      parseClaimKey('pair:9'),
    );

    expect(construction.isComplete).toBe(true);
    expect(construction.requiredCount).toBe(2);
    expect(construction.cards).toEqual([card(9, 'spades'), card(9, 'hearts')]);
    expect(construction.slotCards).toEqual([
      card(9, 'spades'),
      card(9, 'hearts'),
    ]);
  });

  it('returns a partial construction when the claim is missing cards', () => {
    const construction = buildClaimConstruction(
      [
        card(14, 'clubs'),
        card(2, 'spades'),
        card(3, 'clubs'),
        card(4, 'hearts'),
      ],
      parseClaimKey('straight:1'),
    );

    expect(construction.isComplete).toBe(false);
    expect(construction.requiredCount).toBe(5);
    expect(construction.cards).toEqual([
      card(14, 'clubs'),
      card(2, 'spades'),
      card(3, 'clubs'),
      card(4, 'hearts'),
    ]);
    expect(construction.slotCards).toEqual([
      card(14, 'clubs'),
      card(2, 'spades'),
      card(3, 'clubs'),
      card(4, 'hearts'),
      undefined,
    ]);
  });

  it('preserves the intended slot positions for partial grouped claims', () => {
    const construction = buildClaimConstruction(
      [card(6, 'spades'), card(3, 'hearts')],
      parseClaimKey('two-pair:6:3'),
    );

    expect(construction.isComplete).toBe(false);
    expect(construction.cards).toEqual([card(6, 'spades'), card(3, 'hearts')]);
    expect(construction.slotCards).toEqual([
      card(6, 'spades'),
      undefined,
      card(3, 'hearts'),
      undefined,
    ]);
  });

  it('anchors the named card at the end of suit-plus-rank flush construction', () => {
    const construction = buildClaimConstruction(
      [
        card(14, 'hearts'),
        card(13, 'hearts'),
        card(12, 'hearts'),
        card(10, 'hearts'),
        card(9, 'hearts'),
      ],
      parseClaimKey('flush:hearts:12'),
    );

    expect(construction.isComplete).toBe(true);
    expect(construction.slotCards).toEqual([
      card(14, 'hearts'),
      card(13, 'hearts'),
      card(10, 'hearts'),
      card(9, 'hearts'),
      card(12, 'hearts'),
    ]);
  });

  it('leaves the named flush card slot empty when the suit is present but the card is missing', () => {
    const construction = buildClaimConstruction(
      [
        card(14, 'hearts'),
        card(13, 'hearts'),
        card(10, 'hearts'),
        card(9, 'hearts'),
        card(8, 'hearts'),
      ],
      parseClaimKey('flush:hearts:12'),
    );

    expect(construction.isComplete).toBe(false);
    expect(construction.slotCards).toEqual([
      card(14, 'hearts'),
      card(13, 'hearts'),
      card(10, 'hearts'),
      card(9, 'hearts'),
      undefined,
    ]);
  });

  it('uses a color-valid joker as the named suit-plus-rank flush card', () => {
    const construction = buildClaimConstruction(
      [
        card(14, 'hearts'),
        card(13, 'hearts'),
        card(10, 'hearts'),
        card(9, 'hearts'),
        createJoker('red'),
      ],
      parseClaimKey('flush:hearts:12'),
    );

    expect(construction.isComplete).toBe(true);
    expect(construction.slotCards).toEqual([
      card(14, 'hearts'),
      card(13, 'hearts'),
      card(10, 'hearts'),
      card(9, 'hearts'),
      createJoker('red'),
    ]);
  });
});

describe('getClaimProgressScore', () => {
  it('tracks straight progress by exact required ranks', () => {
    expect(
      getClaimProgressScore(
        [card(3, 'clubs'), card(4, 'diamonds'), card(6, 'spades')],
        parseClaimKey('straight:3'),
      ),
    ).toBe(3);
  });

  it('tracks suit-plus-rank flush progress across filler cards and the named card', () => {
    expect(
      getClaimProgressScore(
        [
          card(14, 'hearts'),
          card(13, 'hearts'),
          card(10, 'hearts'),
          card(9, 'hearts'),
        ],
        parseClaimKey('flush:hearts:12'),
      ),
    ).toBe(4);
    expect(
      getClaimProgressScore(
        [
          card(14, 'hearts'),
          card(13, 'hearts'),
          card(12, 'hearts'),
          card(10, 'hearts'),
          card(9, 'hearts'),
        ],
        parseClaimKey('flush:hearts:12'),
      ),
    ).toBe(5);
  });

  it('tracks grouped claims by the best exact completion size', () => {
    expect(
      getClaimProgressScore(
        [card(9, 'clubs'), card(9, 'hearts'), card(5, 'spades')],
        parseClaimKey('full-house:9:5'),
      ),
    ).toBe(3);
  });

  it('counts a joker as progress only when it can legally improve a suited claim', () => {
    expect(
      getClaimProgressScore(
        [
          card(14, 'spades'),
          card(13, 'spades'),
          card(12, 'spades'),
          card(11, 'spades'),
          createJoker('black'),
        ],
        parseClaimKey('flush:spades'),
      ),
    ).toBe(5);
    expect(
      getClaimProgressScore(
        [
          card(14, 'spades'),
          card(13, 'spades'),
          card(12, 'spades'),
          card(11, 'spades'),
          createJoker('red'),
        ],
        parseClaimKey('flush:spades'),
      ),
    ).toBe(4);
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
    expect(result.deckDraws).toEqual([]);
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
    expect(result.deckDraws).toEqual([]);

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

  it('can complete a checked claim by drawing from the undealt deck until the claim finishes', () => {
    const result = resolveShowdown({
      claim: parseClaimKey('pair:14'),
      claimantPlayerId: 'alpha',
      challengerPlayerId: 'beta',
      handsByPlayerId: {
        alpha: [card(14, 'hearts')],
        beta: [card(7, 'clubs')],
      },
      players: [
        { playerId: 'alpha', seatIndex: 0, handSize: 1, isEliminated: false },
        { playerId: 'beta', seatIndex: 1, handSize: 1, isEliminated: false },
      ],
      eliminationHandSize: 5,
      remainingDeck: [card(14, 'spades'), card(2, 'diamonds')],
      showdownDrawRule: 'draw-until-miss',
    });

    expect(result.claimWasValid).toBe(true);
    expect(result.loserPlayerId).toBe('beta');
    expect(result.deckDraws).toEqual([card(14, 'spades')]);
  });

  it('stops at the first dead draw and penalizes the claimant', () => {
    const result = resolveShowdown({
      claim: parseClaimKey('pair:14'),
      claimantPlayerId: 'alpha',
      challengerPlayerId: 'beta',
      handsByPlayerId: {
        alpha: [card(14, 'hearts')],
        beta: [card(7, 'clubs')],
      },
      players: [
        { playerId: 'alpha', seatIndex: 0, handSize: 1, isEliminated: false },
        { playerId: 'beta', seatIndex: 1, handSize: 1, isEliminated: false },
      ],
      eliminationHandSize: 5,
      remainingDeck: [card(2, 'diamonds'), card(14, 'spades')],
      showdownDrawRule: 'draw-until-miss',
    });

    expect(result.claimWasValid).toBe(false);
    expect(result.loserPlayerId).toBe('alpha');
    expect(result.deckDraws).toEqual([card(2, 'diamonds')]);
  });

  it('treats a joker draw as an improving top-deck reveal when it advances the claim', () => {
    const result = resolveShowdown({
      claim: parseClaimKey('pair:14'),
      claimantPlayerId: 'alpha',
      challengerPlayerId: 'beta',
      handsByPlayerId: {
        alpha: [card(14, 'hearts')],
        beta: [card(7, 'clubs')],
      },
      players: [
        { playerId: 'alpha', seatIndex: 0, handSize: 1, isEliminated: false },
        { playerId: 'beta', seatIndex: 1, handSize: 1, isEliminated: false },
      ],
      eliminationHandSize: 5,
      remainingDeck: [createJoker('red'), card(2, 'diamonds')],
      showdownDrawRule: 'draw-until-miss',
    });

    expect(result.claimWasValid).toBe(true);
    expect(result.deckDraws).toEqual([createJoker('red')]);
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
