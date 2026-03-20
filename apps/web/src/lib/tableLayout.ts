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

export const TABLE_BLOCKED_TOP_CORRIDOR = {
  minLeftPct: 40,
  maxLeftPct: 60,
  maxTopPct: 30,
} as const;

export const TABLE_CLAIM_POT_RECT = rectFromCenter(50, 45, 24, 14);
export const TABLE_SELF_ANCHOR_RECT = rectFromCenter(50, 84, 30, 16);
export const TABLE_DEAL_ORIGIN = {
  leftPct: 50,
  topPct: 12,
} as const;
export const TABLE_DEAL_ORIGIN_RECT = rectFromCenter(
  TABLE_DEAL_ORIGIN.leftPct,
  TABLE_DEAL_ORIGIN.topPct,
  3.5,
  3.5,
);
export const TABLE_DECK_OBJECT_RECT = rectFromCenter(
  TABLE_DEAL_ORIGIN.leftPct,
  TABLE_DEAL_ORIGIN.topPct,
  6,
  6.5,
);

export const TABLE_SEAT_VARIANT_RECTS: Record<TableSeatVariant, LayoutRect> = {
  top: rectFromCenter(0, 0, 10.5, 11.5),
  side: rectFromCenter(0, 0, 11.5, 13),
  corner: rectFromCenter(0, 0, 11.5, 12.8),
};

const DESKTOP_OPPONENT_LAYOUTS: Record<number, TableSeatSlot[]> = {
  2: [{ leftPct: 30, topPct: 25, variant: 'top' }],
  3: [
    { leftPct: 30, topPct: 25, variant: 'top' },
    { leftPct: 70, topPct: 25, variant: 'top' },
  ],
  4: [
    { leftPct: 14, topPct: 47, variant: 'side' },
    { leftPct: 30, topPct: 25, variant: 'top' },
    { leftPct: 70, topPct: 25, variant: 'top' },
  ],
  5: [
    { leftPct: 14, topPct: 47, variant: 'side' },
    { leftPct: 30, topPct: 25, variant: 'top' },
    { leftPct: 70, topPct: 25, variant: 'top' },
    { leftPct: 86, topPct: 47, variant: 'side' },
  ],
  6: [
    { leftPct: 16, topPct: 61, variant: 'corner' },
    { leftPct: 14, topPct: 47, variant: 'side' },
    { leftPct: 30, topPct: 25, variant: 'top' },
    { leftPct: 70, topPct: 25, variant: 'top' },
    { leftPct: 86, topPct: 47, variant: 'side' },
  ],
  7: [
    { leftPct: 16, topPct: 61, variant: 'corner' },
    { leftPct: 14, topPct: 47, variant: 'side' },
    { leftPct: 30, topPct: 25, variant: 'top' },
    { leftPct: 70, topPct: 25, variant: 'top' },
    { leftPct: 86, topPct: 47, variant: 'side' },
    { leftPct: 84, topPct: 61, variant: 'corner' },
  ],
  8: [
    { leftPct: 18, topPct: 66, variant: 'corner' },
    { leftPct: 10, topPct: 52, variant: 'side' },
    { leftPct: 15, topPct: 37, variant: 'side' },
    { leftPct: 31, topPct: 25, variant: 'top' },
    { leftPct: 69, topPct: 25, variant: 'top' },
    { leftPct: 85, topPct: 37, variant: 'side' },
    { leftPct: 90, topPct: 52, variant: 'side' },
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
    dealOrigin: TABLE_DEAL_ORIGIN_RECT,
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
