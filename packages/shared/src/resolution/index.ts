import type { Claim } from '../claims/index.js';

export const RESULT_HOLD_AFTER_ANIMATION_MS = 5000;
export const RESOLUTION_REVEAL_START_DELAY_MS = 320;
export const RESOLUTION_REVEAL_STEP_MS = 820;
export const RESOLUTION_CONSTRUCTION_START_DELAY_MS = 420;
export const RESOLUTION_CONSTRUCTION_STEP_MS = 440;
export const RESOLUTION_CONSTRUCTION_SETTLE_MS = 860;
export const RESOLUTION_NO_CONSTRUCTION_SETTLE_MS = 720;

export function getClaimRequiredCardCount(claim: Claim): number {
  switch (claim.category) {
    case 'high-card':
      return 1;
    case 'pair':
      return 2;
    case 'two-pair':
      return 4;
    case 'three-of-a-kind':
      return 3;
    case 'straight':
    case 'flush':
    case 'full-house':
    case 'straight-flush':
      return 5;
    case 'four-of-a-kind':
      return 4;
  }
}

export function calculateResolutionAnimationDurationMs(input: {
  revealedHandCount: number;
  claim?: Claim;
}): number {
  const revealFinishedAtMs =
    RESOLUTION_REVEAL_START_DELAY_MS +
    input.revealedHandCount * RESOLUTION_REVEAL_STEP_MS;

  if (!input.claim) {
    return revealFinishedAtMs + RESOLUTION_NO_CONSTRUCTION_SETTLE_MS;
  }

  return (
    revealFinishedAtMs +
    RESOLUTION_CONSTRUCTION_START_DELAY_MS +
    Math.max(getClaimRequiredCardCount(input.claim), 1) *
      RESOLUTION_CONSTRUCTION_STEP_MS +
    RESOLUTION_CONSTRUCTION_SETTLE_MS
  );
}

export function calculateResolutionDisplayDurationMs(input: {
  revealedHandCount: number;
  claim?: Claim;
}): number {
  return (
    calculateResolutionAnimationDurationMs(input) +
    RESULT_HOLD_AFTER_ANIMATION_MS
  );
}
