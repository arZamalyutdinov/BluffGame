import { describe, expect, it } from 'vitest';

import {
  HOME_AMBIENT_FRAME_INTERVAL_MS,
  getAmbientSceneAnimationPolicy,
} from './ambientScene.js';

describe('ambient scene animation policy', () => {
  it('keeps the home scene animated when motion is allowed and the document is visible', () => {
    expect(
      getAmbientSceneAnimationPolicy({
        variant: 'home',
        prefersReducedMotion: false,
        isDocumentHidden: false,
      }),
    ).toEqual({
      shouldAnimate: true,
      minimumFrameIntervalMs: HOME_AMBIENT_FRAME_INTERVAL_MS,
    });
  });

  it('keeps the room scene static so gameplay does not repaint the ambient background every frame', () => {
    expect(
      getAmbientSceneAnimationPolicy({
        variant: 'room',
        prefersReducedMotion: false,
        isDocumentHidden: false,
      }),
    ).toEqual({
      shouldAnimate: false,
      minimumFrameIntervalMs: null,
    });
  });

  it('disables ambient animation when reduced motion is requested', () => {
    expect(
      getAmbientSceneAnimationPolicy({
        variant: 'home',
        prefersReducedMotion: true,
        isDocumentHidden: false,
      }),
    ).toEqual({
      shouldAnimate: false,
      minimumFrameIntervalMs: null,
    });
  });

  it('disables ambient animation when the document is hidden', () => {
    expect(
      getAmbientSceneAnimationPolicy({
        variant: 'home',
        prefersReducedMotion: false,
        isDocumentHidden: true,
      }),
    ).toEqual({
      shouldAnimate: false,
      minimumFrameIntervalMs: null,
    });
  });
});
