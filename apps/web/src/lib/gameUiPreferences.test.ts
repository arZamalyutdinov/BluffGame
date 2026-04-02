import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_GAME_UI_PREFERENCES,
  buildClaimComposerTurnToken,
  getStoredGameUiPreferences,
  saveGameUiPreferences,
  shouldAutoOpenClaimComposer,
} from './gameUiPreferences.js';

describe('game UI preferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns defaults when nothing is stored', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    });

    expect(getStoredGameUiPreferences()).toEqual(DEFAULT_GAME_UI_PREFERENCES);
  });

  it('persists and reloads browser-global preferences', () => {
    const storage = {
      value: null as string | null,
      getItem(key: string) {
        return key === 'bluffgame/ui-preferences' ? this.value : null;
      },
      setItem(key: string, value: string) {
        if (key === 'bluffgame/ui-preferences') {
          this.value = value;
        }
      },
      removeItem() {},
    };

    vi.stubGlobal('window', { localStorage: storage });

    saveGameUiPreferences({ autoOpenClaimBuilderOnTurn: true });

    expect(getStoredGameUiPreferences()).toEqual({
      autoOpenClaimBuilderOnTurn: true,
    });
  });

  it('drops invalid stored JSON and falls back to defaults', () => {
    const removeItem = vi.fn();

    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => '{not-json',
        setItem: () => {},
        removeItem,
      },
    });

    expect(getStoredGameUiPreferences()).toEqual(DEFAULT_GAME_UI_PREFERENCES);
    expect(removeItem).toHaveBeenCalledWith('bluffgame/ui-preferences');
  });

  it('builds a deterministic turn token from the round and current claim state', () => {
    expect(
      buildClaimComposerTurnToken(
        {
          phase: 'awaiting-response',
          roundNumber: 4,
          starterPlayerId: 'p1',
          currentTurnPlayerId: 'p1',
          claimHistory: [
            {
              sequenceNumber: 2,
              playerId: 'p3',
              claim: {
                category: 'pair',
                pairRank: 11,
              },
            },
          ],
          yourHand: [],
        },
        'p1',
      ),
    ).toBe('4:p1:2');
  });

  it('auto-opens only once for an actionable turn and stays closed after a manual dismissal', () => {
    expect(
      shouldAutoOpenClaimComposer({
        preferences: { autoOpenClaimBuilderOnTurn: true },
        canOpenClaimComposer: true,
        isClaimComposerVisible: false,
        turnToken: '4:p1:2',
        dismissedTurnToken: null,
        autoOpenedTurnToken: null,
      }),
    ).toBe(true);

    expect(
      shouldAutoOpenClaimComposer({
        preferences: { autoOpenClaimBuilderOnTurn: true },
        canOpenClaimComposer: true,
        isClaimComposerVisible: false,
        turnToken: '4:p1:2',
        dismissedTurnToken: '4:p1:2',
        autoOpenedTurnToken: null,
      }),
    ).toBe(false);

    expect(
      shouldAutoOpenClaimComposer({
        preferences: { autoOpenClaimBuilderOnTurn: true },
        canOpenClaimComposer: false,
        isClaimComposerVisible: false,
        turnToken: '4:p1:2',
        dismissedTurnToken: null,
        autoOpenedTurnToken: null,
      }),
    ).toBe(false);
  });
});
