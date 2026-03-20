import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRoom } from './api.js';

describe('api helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a helpful error when the game server cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    await expect(createRoom('Test')).rejects.toMatchObject({
      code: 'network-unreachable',
      message:
        'Cannot reach the game server. Start the backend on port 3001 or run `pnpm dev`.',
    });
  });

  it('reports a helpful error when the backend returns a server failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: vi.fn().mockRejectedValue(new Error('not json')),
      } satisfies Partial<Response>),
    );

    await expect(createRoom('Test')).rejects.toMatchObject({
      code: 'server-unavailable',
      message:
        'The game server is unavailable. Make sure the backend is running on port 3001.',
    });
  });
});
