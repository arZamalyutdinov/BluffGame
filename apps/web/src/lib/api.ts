import {
  type RoomSession,
  apiErrorResponseSchema,
  createRoomRequestSchema,
  joinRoomRequestSchema,
  roomSessionSchema,
} from '@bluff-game/shared';

import { ClientAppError } from './clientErrors.js';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ClientAppError('network-unreachable');
  }

  if (!response.ok) {
    const errorBody = apiErrorResponseSchema.safeParse(
      await response.json().catch(() => null),
    );

    if (errorBody.success) {
      throw new ClientAppError(errorBody.data.code, errorBody.data.message);
    }

    if (response.status >= 500) {
      throw new ClientAppError('server-unavailable');
    }

    throw new ClientAppError('request-failed');
  }

  return (await response.json()) as T;
}

export async function createRoom(displayName: string): Promise<RoomSession> {
  if (!displayName.trim()) {
    throw new ClientAppError('display-name-required');
  }

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
  if (!displayName.trim()) {
    throw new ClientAppError('display-name-required');
  }

  const payload = joinRoomRequestSchema.parse({
    displayName,
  });

  const response = await postJson<RoomSession>(
    `/api/rooms/${roomCode.toUpperCase()}/join`,
    payload,
  );

  return roomSessionSchema.parse(response);
}
