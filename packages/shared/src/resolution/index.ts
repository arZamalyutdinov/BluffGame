export const RESULT_HOLD_AFTER_ANIMATION_MS = 5000;
export const DEALING_START_DELAY_MS = 220;
export const DEALING_CARD_FLIGHT_MS = 420;
export const RESOLUTION_REVEAL_START_DELAY_MS = 320;
export const RESOLUTION_REVEAL_STEP_MS = 820;
export const RESOLUTION_SHOWDOWN_SUSPENSE_DELAY_MS = 520;
export const RESOLUTION_SHOWDOWN_DRAW_STEP_MS = 760;
export const RESOLUTION_SHOWDOWN_FINAL_RESOLVE_MS = 860;
export const RESOLUTION_TIMEOUT_FINAL_RESOLVE_MS = 720;

export function getDealingCardStepMs(totalCardCount: number): number {
  if (totalCardCount <= 12) {
    return 140;
  }

  if (totalCardCount <= 24) {
    return 110;
  }

  return 90;
}

export function calculateDealingDurationMs(input: {
  totalCardCount: number;
}): number {
  const safeCardCount = Math.max(0, Math.floor(input.totalCardCount));

  if (safeCardCount === 0) {
    return DEALING_START_DELAY_MS;
  }

  return (
    DEALING_START_DELAY_MS +
    Math.max(safeCardCount - 1, 0) * getDealingCardStepMs(safeCardCount) +
    DEALING_CARD_FLIGHT_MS
  );
}

export function calculateShowdownAnimationDurationMs(input: {
  revealedHandCount: number;
  deckDrawCount?: number;
}): number {
  const safeRevealedHandCount = Math.max(
    0,
    Math.floor(input.revealedHandCount),
  );
  const safeDeckDrawCount = Math.max(0, Math.floor(input.deckDrawCount ?? 0));
  const revealFinishedAtMs =
    RESOLUTION_REVEAL_START_DELAY_MS +
    safeRevealedHandCount * RESOLUTION_REVEAL_STEP_MS;

  return (
    revealFinishedAtMs +
    RESOLUTION_SHOWDOWN_SUSPENSE_DELAY_MS +
    safeDeckDrawCount * RESOLUTION_SHOWDOWN_DRAW_STEP_MS +
    RESOLUTION_SHOWDOWN_FINAL_RESOLVE_MS
  );
}

export function calculateTimeoutAnimationDurationMs(input: {
  revealedHandCount: number;
}): number {
  const safeRevealedHandCount = Math.max(
    0,
    Math.floor(input.revealedHandCount),
  );

  return (
    RESOLUTION_REVEAL_START_DELAY_MS +
    safeRevealedHandCount * RESOLUTION_REVEAL_STEP_MS +
    RESOLUTION_TIMEOUT_FINAL_RESOLVE_MS
  );
}

export function calculateResolutionAnimationDurationMs(input: {
  kind?: 'showdown' | 'timeout';
  revealedHandCount: number;
  deckDrawCount?: number;
}): number {
  if (input.kind === 'timeout') {
    return calculateTimeoutAnimationDurationMs({
      revealedHandCount: input.revealedHandCount,
    });
  }

  return calculateShowdownAnimationDurationMs({
    revealedHandCount: input.revealedHandCount,
    ...(input.deckDrawCount === undefined
      ? {}
      : { deckDrawCount: input.deckDrawCount }),
  });
}

export function calculateResolutionDisplayDurationMs(input: {
  kind?: 'showdown' | 'timeout';
  revealedHandCount: number;
  deckDrawCount?: number;
}): number {
  return (
    calculateResolutionAnimationDurationMs(input) +
    RESULT_HOLD_AFTER_ANIMATION_MS
  );
}
