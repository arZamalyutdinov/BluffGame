import {
  type RoomSession,
  createRoomRequestSchema,
  joinRoomRequestSchema,
  roomSessionSchema,
} from '@bluff-game/shared';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(errorBody?.message ?? 'Request failed.');
  }

  return (await response.json()) as T;
}

export async function createRoom(displayName: string): Promise<RoomSession> {
  const payload = createRoomRequestSchema.parse({
    displayName,
  });

  const response = await postJson<RoomSession>('/api/rooms', payload);
  return roomSessionSchema.parse(response);
}

export async function joinRoom(
  roomCode: string,
  displayName: string,
): Promise<RoomSession> {
  const payload = joinRoomRequestSchema.parse({
    displayName,
  });

  const response = await postJson<RoomSession>(
    `/api/rooms/${roomCode.toUpperCase()}/join`,
    payload,
  );

  return roomSessionSchema.parse(response);
}
