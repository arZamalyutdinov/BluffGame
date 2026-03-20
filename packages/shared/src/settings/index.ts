export const CLAIM_ORDER_PRESETS = [
  'flush-below-straight',
  'standard-poker',
  'flush-below-trips-and-straight',
] as const;

export type ClaimOrderPreset = (typeof CLAIM_ORDER_PRESETS)[number];

export const DEFAULT_CLAIM_ORDER_PRESET: ClaimOrderPreset =
  'flush-below-straight';

export const FLUSH_RULES = ['suit-only', 'suit-plus-rank'] as const;

export type FlushRule = (typeof FLUSH_RULES)[number];

export const DEFAULT_FLUSH_RULE: FlushRule = 'suit-only';

export const SHOWDOWN_DRAW_RULES = [
  'revealed-only',
  'draw-until-miss',
] as const;

export type ShowdownDrawRule = (typeof SHOWDOWN_DRAW_RULES)[number];

export const DEFAULT_SHOWDOWN_DRAW_RULE: ShowdownDrawRule = 'revealed-only';

export const JOKER_RULES = ['off', 'two-jokers'] as const;

export type JokerRule = (typeof JOKER_RULES)[number];

export const DEFAULT_JOKER_RULE: JokerRule = 'off';

export const CLAIM_ORDER_PRESET_LABELS: Record<ClaimOrderPreset, string> = {
  'flush-below-straight': 'Flush below straight',
  'standard-poker': 'Standard poker',
  'flush-below-trips-and-straight': 'Flush below trips and straight',
};

export const CLAIM_ORDER_PRESET_DESCRIPTIONS: Record<ClaimOrderPreset, string> =
  {
    'flush-below-straight':
      'Classic poker ladder, except flush ranks below straight.',
    'standard-poker': 'Standard poker hand ordering.',
    'flush-below-trips-and-straight':
      'Flush ranks below both trips and straight.',
  };

export const FLUSH_RULE_LABELS: Record<FlushRule, string> = {
  'suit-only': 'Suit only',
  'suit-plus-rank': 'Suit + card',
};

export const FLUSH_RULE_DESCRIPTIONS: Record<FlushRule, string> = {
  'suit-only':
    'Keep the current suit-spoken flush rule. A flush is raised by suit only.',
  'suit-plus-rank':
    'Speak flushes as suit first, then a named suited card. A legal raise may keep one axis the same, but neither the suit nor the named card may go down.',
};

export const SHOWDOWN_DRAW_RULE_LABELS: Record<ShowdownDrawRule, string> = {
  'revealed-only': 'Revealed only',
  'draw-until-miss': 'Draw until miss',
};

export const SHOWDOWN_DRAW_RULE_DESCRIPTIONS: Record<ShowdownDrawRule, string> =
  {
    'revealed-only':
      'Resolve checks from the revealed hands only, with no extra deck draws.',
    'draw-until-miss':
      'After a check, reveal top-deck cards one by one. Keep each draw only while it improves the spoken claim, and stop at the first dead draw or when the claim completes.',
  };

export const JOKER_RULE_LABELS: Record<JokerRule, string> = {
  off: 'No jokers',
  'two-jokers': 'Two jokers',
};

export const JOKER_RULE_DESCRIPTIONS: Record<JokerRule, string> = {
  off: 'Play with the current 52-card deck and no wild jokers.',
  'two-jokers':
    'Add one red and one black joker as full wild cards. Red joker can stand in for hearts or diamonds, and black joker can stand in for clubs or spades when suit matters.',
};

export const MIN_ELIMINATION_HAND_SIZE = 2;
export const MAX_ELIMINATION_HAND_SIZE = 6;
export const ELIMINATION_HAND_SIZE_OPTIONS = [2, 3, 4, 5, 6] as const;
export const DEFAULT_ELIMINATION_HAND_SIZE = 5;
export const MIN_TURN_TIME_LIMIT_SECONDS = 15;
export const MAX_TURN_TIME_LIMIT_SECONDS = 120;
export const TURN_TIME_LIMIT_SECONDS_OPTIONS = [
  15, 30, 45, 60, 90, 120,
] as const;
export const DEFAULT_TURN_TIME_LIMIT_SECONDS = 60;

export interface RoomSettings {
  eliminationHandSize: number;
  claimOrderPreset: ClaimOrderPreset;
  flushRule: FlushRule;
  showdownDrawRule: ShowdownDrawRule;
  jokerRule: JokerRule;
  turnTimeLimitSeconds: number;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  eliminationHandSize: DEFAULT_ELIMINATION_HAND_SIZE,
  claimOrderPreset: DEFAULT_CLAIM_ORDER_PRESET,
  flushRule: DEFAULT_FLUSH_RULE,
  showdownDrawRule: DEFAULT_SHOWDOWN_DRAW_RULE,
  jokerRule: DEFAULT_JOKER_RULE,
  turnTimeLimitSeconds: DEFAULT_TURN_TIME_LIMIT_SECONDS,
};

export function normalizeRoomSettings(input: RoomSettings): RoomSettings {
  const eliminationHandSize = Math.trunc(input.eliminationHandSize);
  const turnTimeLimitSeconds = Math.trunc(input.turnTimeLimitSeconds);

  if (
    eliminationHandSize < MIN_ELIMINATION_HAND_SIZE ||
    eliminationHandSize > MAX_ELIMINATION_HAND_SIZE
  ) {
    throw new Error(
      `Elimination hand size must be between ${MIN_ELIMINATION_HAND_SIZE} and ${MAX_ELIMINATION_HAND_SIZE}.`,
    );
  }

  if (
    turnTimeLimitSeconds < MIN_TURN_TIME_LIMIT_SECONDS ||
    turnTimeLimitSeconds > MAX_TURN_TIME_LIMIT_SECONDS
  ) {
    throw new Error(
      `Turn time limit must be between ${MIN_TURN_TIME_LIMIT_SECONDS} and ${MAX_TURN_TIME_LIMIT_SECONDS} seconds.`,
    );
  }

  return {
    eliminationHandSize,
    claimOrderPreset: input.claimOrderPreset,
    flushRule: input.flushRule,
    showdownDrawRule: input.showdownDrawRule,
    jokerRule: input.jokerRule,
    turnTimeLimitSeconds,
  };
}
