export const CLAIM_ORDER_PRESETS = [
  'flush-below-straight',
  'standard-poker',
  'flush-below-trips-and-straight',
] as const;

export type ClaimOrderPreset = (typeof CLAIM_ORDER_PRESETS)[number];

export const DEFAULT_CLAIM_ORDER_PRESET: ClaimOrderPreset =
  'flush-below-straight';

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
  turnTimeLimitSeconds: number;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  eliminationHandSize: DEFAULT_ELIMINATION_HAND_SIZE,
  claimOrderPreset: DEFAULT_CLAIM_ORDER_PRESET,
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
    turnTimeLimitSeconds,
  };
}
