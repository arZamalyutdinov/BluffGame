import { z } from 'zod';

export const APP_ERROR_CODES = [
  'invalid-request',
  'unexpected-server-error',
  'command-rejected',
  'connect-failed',
  'network-unreachable',
  'server-unavailable',
  'request-failed',
  'viewer-not-in-room',
  'display-name-required',
  'room-join-lobby-only',
  'room-full',
  'invalid-session-token',
  'leave-during-match-unsupported',
  'bot-add-lobby-only',
  'bot-remove-lobby-only',
  'player-not-bot',
  'ready-lobby-only',
  'settings-lobby-only',
  'start-match-lobby-only',
  'start-match-min-players',
  'start-match-ready-required',
  'start-match-no-starter',
  'dealing-in-progress',
  'no-turn-timer',
  'chat-message-empty',
  'spectator-reveal-for-eliminated-humans-only',
  'self-spectate-use-stop-playing',
  'winner-undetermined',
  'next-starter-undetermined',
  'room-not-found',
  'player-not-found',
  'seat-not-found',
  'no-active-match',
  'host-only',
  'display-name-in-use',
  'match-already-complete',
  'player-already-spectating',
  'game-paused',
  'result-still-showing',
  'not-your-turn',
  'claim-not-stronger',
  'no-claim-to-challenge',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export const appErrorCodeSchema = z.enum(APP_ERROR_CODES);

export const appErrorPayloadSchema = z.object({
  code: appErrorCodeSchema,
  message: z.string().min(1).optional(),
});

export type AppErrorPayload = z.infer<typeof appErrorPayloadSchema>;

export function getDefaultAppErrorMessage(code: AppErrorCode): string {
  switch (code) {
    case 'invalid-request':
      return 'The request was invalid.';
    case 'unexpected-server-error':
      return 'Unexpected server error.';
    case 'command-rejected':
      return 'The command could not be processed.';
    case 'connect-failed':
      return 'The live room connection could not be established.';
    case 'network-unreachable':
      return 'Cannot reach the game server. Start the backend on port 3001 or run `pnpm dev`.';
    case 'server-unavailable':
      return 'The game server is unavailable. Make sure the backend is running on port 3001.';
    case 'request-failed':
      return 'Request failed.';
    case 'viewer-not-in-room':
      return 'Viewer is not part of this room.';
    case 'display-name-required':
      return 'Display name is required.';
    case 'room-join-lobby-only':
      return 'You can only join rooms that are still in the lobby.';
    case 'room-full':
      return 'This room is already full.';
    case 'invalid-session-token':
      return 'Session token is invalid for this player.';
    case 'leave-during-match-unsupported':
      return 'Leaving during an active match is not supported in v1.';
    case 'bot-add-lobby-only':
      return 'Bots can only be added while the room is in the lobby.';
    case 'bot-remove-lobby-only':
      return 'Bots can only be removed while the room is in the lobby.';
    case 'player-not-bot':
      return 'That player is not a bot.';
    case 'ready-lobby-only':
      return 'Ready state can only change while the room is in the lobby.';
    case 'settings-lobby-only':
      return 'Room settings can only change while the room is in the lobby.';
    case 'start-match-lobby-only':
      return 'The match can only start from the lobby.';
    case 'start-match-min-players':
      return 'At least two players are required to start.';
    case 'start-match-ready-required':
      return 'Every player must be marked ready before the host can start.';
    case 'start-match-no-starter':
      return 'Unable to choose a starting seat.';
    case 'dealing-in-progress':
      return 'Cards are still being dealt.';
    case 'no-turn-timer':
      return 'There is no active turn timer to pause.';
    case 'chat-message-empty':
      return 'Chat message cannot be empty.';
    case 'spectator-reveal-for-eliminated-humans-only':
      return 'Only eliminated human spectators can reveal live cards.';
    case 'self-spectate-use-stop-playing':
      return 'Use the stop-playing action to spectate yourself.';
    case 'winner-undetermined':
      return 'A winning player could not be determined.';
    case 'next-starter-undetermined':
      return 'The next starter could not be determined after result hold.';
    case 'room-not-found':
      return 'Room not found.';
    case 'player-not-found':
      return 'Player not found in this room.';
    case 'seat-not-found':
      return 'Seat not found in this room.';
    case 'no-active-match':
      return 'There is no active match in this room.';
    case 'host-only':
      return 'Only the host can do that.';
    case 'display-name-in-use':
      return 'That display name is already in use in this room.';
    case 'match-already-complete':
      return 'The match is already complete.';
    case 'player-already-spectating':
      return 'That player is already spectating.';
    case 'game-paused':
      return 'The game is paused.';
    case 'result-still-showing':
      return 'The previous round is still being shown.';
    case 'not-your-turn':
      return 'It is not your turn.';
    case 'claim-not-stronger':
      return 'Each claim must be strictly stronger than the previous one.';
    case 'no-claim-to-challenge':
      return 'There is no claim to challenge yet.';
  }
}
