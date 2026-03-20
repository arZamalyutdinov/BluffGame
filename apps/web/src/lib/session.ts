import type { RoomSession } from '@bluff-game/shared';

const ROOM_SESSION_PREFIX = 'bluffgame/session/';
const DISPLAY_NAME_KEY = 'bluffgame/display-name';

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function saveRoomSession(session: RoomSession) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(
    `${ROOM_SESSION_PREFIX}${session.roomCode}`,
    JSON.stringify(session),
  );
  storage.setItem(DISPLAY_NAME_KEY, session.displayName);
}

export function getRoomSession(roomCode: string): RoomSession | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const value = storage.getItem(`${ROOM_SESSION_PREFIX}${roomCode}`);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as RoomSession;
  } catch {
    storage.removeItem(`${ROOM_SESSION_PREFIX}${roomCode}`);
    return null;
  }
}

export function removeRoomSession(roomCode: string) {
  getStorage()?.removeItem(`${ROOM_SESSION_PREFIX}${roomCode}`);
}

export function getLastDisplayName(): string {
  return getStorage()?.getItem(DISPLAY_NAME_KEY) ?? '';
}
