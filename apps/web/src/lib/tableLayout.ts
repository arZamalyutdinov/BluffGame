export type TableSeatVariant = 'top' | 'side' | 'corner';

export interface TableSeatSlot {
  leftPct: number;
  topPct: number;
  variant: TableSeatVariant;
}

export interface LayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const TABLE_CLAIM_POT_RECT = rectFromCenter(50, 39, 24, 16);
export const TABLE_SELF_ANCHOR_RECT = rectFromCenter(50, 84, 30, 16);
export const TABLE_DECK_OBJECT_RECT = rectFromCenter(31, 55, 10, 12);

export const TABLE_SEAT_VARIANT_RECTS: Record<TableSeatVariant, LayoutRect> = {
  top: rectFromCenter(0, 0, 10.5, 11.5),
  side: rectFromCenter(0, 0, 11.5, 13),
  corner: rectFromCenter(0, 0, 11.5, 12.8),
};

const DESKTOP_OPPONENT_LAYOUTS: Record<number, TableSeatSlot[]> = {
  2: [{ leftPct: 50, topPct: 24, variant: 'top' }],
  3: [
    { leftPct: 24, topPct: 24, variant: 'top' },
    { leftPct: 76, topPct: 24, variant: 'top' },
  ],
  4: [
    { leftPct: 14, topPct: 47, variant: 'side' },
    { leftPct: 50, topPct: 24, variant: 'top' },
    { leftPct: 86, topPct: 47, variant: 'side' },
  ],
  5: [
    { leftPct: 14, topPct: 47, variant: 'side' },
    { leftPct: 24, topPct: 24, variant: 'top' },
    { leftPct: 76, topPct: 24, variant: 'top' },
    { leftPct: 86, topPct: 47, variant: 'side' },
  ],
  6: [
    { leftPct: 16, topPct: 61, variant: 'corner' },
    { leftPct: 14, topPct: 47, variant: 'side' },
    { leftPct: 50, topPct: 24, variant: 'top' },
    { leftPct: 86, topPct: 47, variant: 'side' },
    { leftPct: 84, topPct: 61, variant: 'corner' },
  ],
  7: [
    { leftPct: 16, topPct: 61, variant: 'corner' },
    { leftPct: 14, topPct: 47, variant: 'side' },
    { leftPct: 24, topPct: 24, variant: 'top' },
    { leftPct: 76, topPct: 24, variant: 'top' },
    { leftPct: 86, topPct: 47, variant: 'side' },
    { leftPct: 84, topPct: 61, variant: 'corner' },
  ],
  8: [
    { leftPct: 18, topPct: 64, variant: 'corner' },
    { leftPct: 10, topPct: 49, variant: 'side' },
    { leftPct: 14, topPct: 34, variant: 'side' },
    { leftPct: 50, topPct: 24, variant: 'top' },
    { leftPct: 86, topPct: 34, variant: 'side' },
    { leftPct: 90, topPct: 49, variant: 'side' },
    { leftPct: 82, topPct: 64, variant: 'corner' },
  ],
};

export function getDesktopOpponentSeatSlots(
  totalPlayers: number,
): TableSeatSlot[] {
  const clampedPlayers = Math.min(Math.max(Math.round(totalPlayers), 2), 8);
  const slots = DESKTOP_OPPONENT_LAYOUTS[clampedPlayers];

  return slots ?? DESKTOP_OPPONENT_LAYOUTS[8] ?? [];
}

export function buildTableLayoutCollisionModel(totalPlayers: number) {
  const opponentSlots = getDesktopOpponentSeatSlots(totalPlayers);

  return {
    claimPot: TABLE_CLAIM_POT_RECT,
    selfAnchor: TABLE_SELF_ANCHOR_RECT,
    deckObject: TABLE_DECK_OBJECT_RECT,
    opponentSeats: opponentSlots.map((slot) =>
      rectFromCenter(
        slot.leftPct,
        slot.topPct,
        TABLE_SEAT_VARIANT_RECTS[slot.variant].width,
        TABLE_SEAT_VARIANT_RECTS[slot.variant].height,
      ),
    ),
  };
}

export function doRectsOverlap(left: LayoutRect, right: LayoutRect): boolean {
  return !(
    left.left + left.width <= right.left ||
    right.left + right.width <= left.left ||
    left.top + left.height <= right.top ||
    right.top + right.height <= left.top
  );
}

function rectFromCenter(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): LayoutRect {
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  };
}
