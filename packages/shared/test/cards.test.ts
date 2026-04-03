import { describe, expect, it } from 'vitest';

import { createCard, createDeckShoe, dealCards } from '../src/index.js';

describe('createDeckShoe', () => {
  it('adds enough selected-deck copies to satisfy larger rounds', () => {
    const shoe = createDeckShoe(55, 'two-jokers');

    expect(shoe).toHaveLength(108);
    expect(
      shoe.filter((card) => card.kind === 'joker' && card.color === 'red'),
    ).toHaveLength(2);
    expect(
      shoe.filter((card) => card.kind === 'joker' && card.color === 'black'),
    ).toHaveLength(2);
  });
});

describe('dealCards', () => {
  it('throws when the provided deck cannot satisfy every request', () => {
    expect(() =>
      dealCards(
        [createCard(14, 'spades')],
        [
          { playerId: 'alpha', count: 1 },
          { playerId: 'beta', count: 1 },
        ],
      ),
    ).toThrow('Not enough cards to satisfy deal requests.');
  });
});
