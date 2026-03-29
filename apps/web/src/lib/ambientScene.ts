export type AmbientSceneVariant = 'home' | 'room';

export const HOME_AMBIENT_FRAME_INTERVAL_MS = 1000 / 24;

interface AmbientSceneAnimationPolicyInput {
  variant: AmbientSceneVariant;
  prefersReducedMotion: boolean;
  isDocumentHidden: boolean;
}

interface AmbientSceneAnimationPolicy {
  shouldAnimate: boolean;
  minimumFrameIntervalMs: number | null;
}

export function getAmbientSceneAnimationPolicy(
  input: AmbientSceneAnimationPolicyInput,
): AmbientSceneAnimationPolicy {
  if (input.prefersReducedMotion || input.isDocumentHidden) {
    return {
      shouldAnimate: false,
      minimumFrameIntervalMs: null,
    };
  }

  if (input.variant === 'room') {
    return {
      shouldAnimate: false,
      minimumFrameIntervalMs: null,
    };
  }

  return {
    shouldAnimate: true,
    minimumFrameIntervalMs: HOME_AMBIENT_FRAME_INTERVAL_MS,
  };
}
