import { cardToKey } from '@bluff-game/shared';
import { describe, expect, it } from 'vitest';

import {
  claimToBuilderIllustrationCards,
  claimToIllustrationCards,
} from './claimVisuals.js';

describe('claim visuals', () => {
  it('shows only the opening pair while building the first half of two pair', () => {
    const cards = claimToBuilderIllustrationCards(
      {
        category: 'two-pair',
        highPairRank: 12,
        lowPairRank: 8,
      },
      'highPairRank',
    );

    expect(cards.map(cardToKey)).toEqual([
      'standard:12:spades',
      'standard:12:hearts',
    ]);
  });

  it('shows only the trips while building the first half of a full house', () => {
    const cards = claimToBuilderIllustrationCards(
      {
        category: 'full-house',
        tripRank: 11,
        pairRank: 4,
      },
      'tripRank',
    );

    expect(cards.map(cardToKey)).toEqual([
      'standard:11:spades',
      'standard:11:hearts',
      'standard:11:clubs',
    ]);
  });

  it('keeps the full illustration once the finishing step is being chosen', () => {
    const claim = {
      category: 'full-house' as const,
      tripRank: 10 as const,
      pairRank: 3 as const,
    };

    expect(claimToBuilderIllustrationCards(claim)).toEqual(
      claimToIllustrationCards(claim),
    );
  });
});
