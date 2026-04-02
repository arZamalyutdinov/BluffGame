export const ROOM_KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;

export function buildRoomKeepAliveUrl(roomCode: string): string {
  const params = new URLSearchParams({
    source: 'room-keepalive',
    roomCode: roomCode.toUpperCase(),
  });

  return `/health?${params.toString()}`;
}

export async function pingRoomKeepAlive(
  roomCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await fetchImpl(buildRoomKeepAliveUrl(roomCode), {
    method: 'GET',
    cache: 'no-store',
    keepalive: true,
  });
}

export function startRoomKeepAlive(
  roomCode: string,
  options: {
    fetchImpl?: typeof fetch;
    intervalMs?: number;
  } = {},
): () => void {
  const fetchImpl = options.fetchImpl ?? fetch;
  const intervalMs = options.intervalMs ?? ROOM_KEEP_ALIVE_INTERVAL_MS;
  const ping = () => {
    void pingRoomKeepAlive(roomCode, fetchImpl).catch(() => undefined);
  };

  // Keep free-tier hosts warm while a room is open so in-memory room state is
  // less likely to disappear underneath connected players.
  ping();
  const intervalId = globalThis.setInterval(ping, intervalMs);

  return () => {
    globalThis.clearInterval(intervalId);
  };
}
