import type { RoomSession } from '@bluff-game/shared';

const ROOM_SESSION_PREFIX = 'bluffgame/session/';
const DISPLAY_NAME_KEY = 'bluffgame/display-name';

export function saveRoomSession(session: RoomSession) {
  window.localStorage.setItem(
    `${ROOM_SESSION_PREFIX}${session.roomCode}`,
    JSON.stringify(session),
  );
  window.localStorage.setItem(DISPLAY_NAME_KEY, session.displayName);
}

export function getRoomSession(roomCode: string): RoomSession | null {
  const value = window.localStorage.getItem(
    `${ROOM_SESSION_PREFIX}${roomCode}`,
  );

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as RoomSession;
  } catch {
    window.localStorage.removeItem(`${ROOM_SESSION_PREFIX}${roomCode}`);
    return null;
  }
}

export function removeRoomSession(roomCode: string) {
  window.localStorage.removeItem(`${ROOM_SESSION_PREFIX}${roomCode}`);
}

export function getLastDisplayName(): string {
  return window.localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
}
