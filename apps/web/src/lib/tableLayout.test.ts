import { describe, expect, it } from 'vitest';

import {
  buildTableLayoutCollisionModel,
  doRectsOverlap,
} from './tableLayout.js';

describe('table layout presets', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'keeps opponent anchors clear of the claim pot, deck, and self anchor for %i players',
    (playerCount) => {
      const layout = buildTableLayoutCollisionModel(playerCount);

      for (const seatRect of layout.opponentSeats) {
        expect(doRectsOverlap(seatRect, layout.claimPot)).toBe(false);
        expect(doRectsOverlap(seatRect, layout.deckObject)).toBe(false);
        expect(doRectsOverlap(seatRect, layout.selfAnchor)).toBe(false);
      }
    },
  );

  it.each([2, 3, 4, 5, 6, 7, 8])(
    'keeps opponent seats from overlapping each other for %i players',
    (playerCount) => {
      const layout = buildTableLayoutCollisionModel(playerCount);

      layout.opponentSeats.forEach((seatRect, index) => {
        const followingSeats = layout.opponentSeats.slice(index + 1);

        for (const followingSeat of followingSeats) {
          expect(doRectsOverlap(seatRect, followingSeat)).toBe(false);
        }
      });
    },
  );
});
