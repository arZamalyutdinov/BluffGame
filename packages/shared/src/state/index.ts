import type { Card } from '../cards/index.js';
import type { Claim } from '../claims/index.js';

export type ConnectionStatus = 'connected' | 'disconnected';
export type RoomPhase = 'lobby' | 'in-match' | 'match-complete';
export type MatchPhase =
  | 'awaiting-opening-claim'
  | 'awaiting-response'
  | 'match-complete';

export interface PlayerSnapshot {
  playerId: string;
  name: string;
  seatIndex: number;
  isHost: boolean;
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

export interface MatchSnapshot {
  phase: MatchPhase;
  roundNumber: number;
  starterPlayerId: string;
  currentTurnPlayerId: string;
  lastClaim?: Claim;
  claimHistory: ClaimRecordSnapshot[];
  yourHand: Card[];
  showdown?: ShowdownSnapshot;
  winnerPlayerId?: string;
}

export interface RoomSnapshot {
  roomCode: string;
  phase: RoomPhase;
  selfPlayerId: string;
  hostPlayerId: string;
  players: PlayerSnapshot[];
  match?: MatchSnapshot;
}

export interface RoomSession {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  displayName: string;
}
