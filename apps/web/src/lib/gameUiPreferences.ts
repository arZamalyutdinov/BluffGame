import type { MatchSnapshot } from '@bluff-game/shared';

export interface GameUiPreferences {
  autoOpenClaimBuilderOnTurn: boolean;
}

export interface ClaimComposerAutoOpenInput {
  preferences: GameUiPreferences;
  canOpenClaimComposer: boolean;
  isClaimComposerVisible: boolean;
  turnToken: string | null;
  dismissedTurnToken: string | null;
  autoOpenedTurnToken: string | null;
}

const GAME_UI_PREFERENCES_STORAGE_KEY = 'bluffgame/ui-preferences';

export const DEFAULT_GAME_UI_PREFERENCES: GameUiPreferences = {
  autoOpenClaimBuilderOnTurn: false,
};

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function parseGameUiPreferences(value: unknown): GameUiPreferences {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !('autoOpenClaimBuilderOnTurn' in value) ||
    typeof value.autoOpenClaimBuilderOnTurn !== 'boolean'
  ) {
    return DEFAULT_GAME_UI_PREFERENCES;
  }

  return {
    autoOpenClaimBuilderOnTurn: value.autoOpenClaimBuilderOnTurn,
  };
}

export function getStoredGameUiPreferences(): GameUiPreferences {
  const storage = getStorage();

  if (!storage) {
    return DEFAULT_GAME_UI_PREFERENCES;
  }

  const value = storage.getItem(GAME_UI_PREFERENCES_STORAGE_KEY);

  if (!value) {
    return DEFAULT_GAME_UI_PREFERENCES;
  }

  try {
    return parseGameUiPreferences(JSON.parse(value));
  } catch {
    storage.removeItem(GAME_UI_PREFERENCES_STORAGE_KEY);
    return DEFAULT_GAME_UI_PREFERENCES;
  }
}

export function saveGameUiPreferences(preferences: GameUiPreferences) {
  getStorage()?.setItem(
    GAME_UI_PREFERENCES_STORAGE_KEY,
    JSON.stringify(preferences),
  );
}

export function buildClaimComposerTurnToken(
  match: MatchSnapshot | undefined,
  selfPlayerId: string,
): string | null {
  if (!match || match.currentTurnPlayerId !== selfPlayerId) {
    return null;
  }

  return [
    match.roundNumber,
    match.currentTurnPlayerId,
    match.claimHistory.at(-1)?.sequenceNumber ?? 0,
  ].join(':');
}

export function shouldAutoOpenClaimComposer(
  input: ClaimComposerAutoOpenInput,
): boolean {
  if (!input.preferences.autoOpenClaimBuilderOnTurn) {
    return false;
  }

  if (
    !input.turnToken ||
    input.isClaimComposerVisible ||
    !input.canOpenClaimComposer
  ) {
    return false;
  }

  if (
    input.turnToken === input.dismissedTurnToken ||
    input.turnToken === input.autoOpenedTurnToken
  ) {
    return false;
  }

  return true;
}
