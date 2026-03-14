import type { Card } from '../cards/index.js';
import type { Claim } from '../claims/index.js';
import type { RoomSettings } from '../settings/index.js';

export type ConnectionStatus = 'connected' | 'disconnected';
export type RoomPhase = 'lobby' | 'in-match' | 'match-complete';
export type MatchPhase =
  | 'awaiting-opening-claim'
  | 'awaiting-response'
  | 'match-complete';

export const MAX_CHAT_MESSAGE_LENGTH = 280;
export const MAX_ROOM_CHAT_MESSAGES = 80;

export interface PlayerSnapshot {
  playerId: string;
  name: string;
  seatIndex: number;
  isHost: boolean;
  isBot: boolean;
  isReady: boolean;
  connectionStatus: ConnectionStatus;
  handSize: number;
  isEliminated: boolean;
  cardCount: number;
}

export interface ClaimRecordSnapshot {
  sequenceNumber: number;
  playerId: string;
  claim: Claim;
}

export interface RevealedHandSnapshot {
  playerId: string;
  cards: Card[];
}

export interface ShowdownSnapshot {
  spokenClaim: Claim;
  claimantPlayerId: string;
  challengerPlayerId: string;
  claimWasValid: boolean;
  loserPlayerId: string;
  loserHandSize: number;
  loserEliminated: boolean;
  revealedHands: RevealedHandSnapshot[];
  nextStarterPlayerId?: string;
}

export interface TimeoutSnapshot {
  timedOutPlayerId: string;
  loserHandSize: number;
  loserEliminated: boolean;
  lastClaim?: Claim;
  lastClaimantPlayerId?: string;
  revealedHands: RevealedHandSnapshot[];
  nextStarterPlayerId?: string;
}

export interface TurnTimerSnapshot {
  durationSeconds: number;
  remainingMs: number;
  isPaused: boolean;
  deadlineAtMs?: number;
  pausedByPlayerId?: string;
}

export interface RoomChatMessageSnapshot {
  messageId: string;
  playerId: string;
  playerName: string;
  text: string;
  sentAtMs: number;
}

export interface MatchSnapshot {
  phase: MatchPhase;
  roundNumber: number;
  starterPlayerId: string;
  currentTurnPlayerId: string;
  turnTimer?: TurnTimerSnapshot;
  lastClaim?: Claim;
  claimHistory: ClaimRecordSnapshot[];
  yourHand: Card[];
  showdown?: ShowdownSnapshot;
  timeout?: TimeoutSnapshot;
  winnerPlayerId?: string;
}

export interface RoomSnapshot {
  roomCode: string;
  phase: RoomPhase;
  selfPlayerId: string;
  hostPlayerId: string;
  settings: RoomSettings;
  players: PlayerSnapshot[];
  chatMessages: RoomChatMessageSnapshot[];
  match?: MatchSnapshot;
}

export interface RoomSession {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  displayName: string;
}
