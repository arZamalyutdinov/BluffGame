import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildRoomKeepAliveUrl,
  startRoomKeepAlive,
} from './roomKeepAlive.js';

describe('room keepalive helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('builds a room-scoped health URL', () => {
    expect(buildRoomKeepAliveUrl('ab12')).toBe(
      '/health?source=room-keepalive&roomCode=AB12',
    );
  });

  it('pings immediately, repeats on an interval, and stops after cleanup', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });

    const stop = startRoomKeepAlive('ab12', {
      fetchImpl: fetchMock as typeof fetch,
      intervalMs: 1_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/health?source=room-keepalive&roomCode=AB12',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        keepalive: true,
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('swallows keepalive fetch failures so the room page keeps running', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

    expect(() =>
      startRoomKeepAlive('ABCD', {
        fetchImpl: fetchMock as typeof fetch,
        intervalMs: 1_000,
      }),
    ).not.toThrow();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
