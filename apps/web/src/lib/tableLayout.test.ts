import { describe, expect, it } from 'vitest';

import {
  TABLE_BLOCKED_TOP_CORRIDOR,
  buildTableLayoutCollisionModel,
  doRectsOverlap,
  getDesktopOpponentSeatSlots,
} from './tableLayout.js';

describe('table layout presets', () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    'keeps opponent slots out of the blocked top-center lane for %i players',
    (playerCount) => {
      const slots = getDesktopOpponentSeatSlots(playerCount);

      for (const slot of slots) {
        const inBlockedLane =
          slot.leftPct >= TABLE_BLOCKED_TOP_CORRIDOR.minLeftPct &&
          slot.leftPct <= TABLE_BLOCKED_TOP_CORRIDOR.maxLeftPct &&
          slot.topPct <= TABLE_BLOCKED_TOP_CORRIDOR.maxTopPct;

        expect(inBlockedLane).toBe(false);
      }
    },
  );

  it.each([2, 3, 4, 5, 6, 7, 8])(
    'keeps opponent anchors clear of the claim pot, deal origin, deck, and self anchor for %i players',
    (playerCount) => {
      const layout = buildTableLayoutCollisionModel(playerCount);

      for (const seatRect of layout.opponentSeats) {
        expect(doRectsOverlap(seatRect, layout.claimPot)).toBe(false);
        expect(doRectsOverlap(seatRect, layout.dealOrigin)).toBe(false);
        expect(doRectsOverlap(seatRect, layout.deckObject)).toBe(false);
        expect(doRectsOverlap(seatRect, layout.selfAnchor)).toBe(false);
      }
    },
  );

  it.each([2, 3, 4, 5, 6, 7, 8])(
    'keeps the center deck lane clear of the claim pot for %i players',
    (playerCount) => {
      const layout = buildTableLayoutCollisionModel(playerCount);

      expect(doRectsOverlap(layout.dealOrigin, layout.claimPot)).toBe(false);
      expect(doRectsOverlap(layout.deckObject, layout.claimPot)).toBe(false);
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
