import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import fastifyCors from '@fastify/cors';
import Fastify, { type FastifyReply } from 'fastify';
import { Server, type Socket } from 'socket.io';

import {
  commandRejectedEventSchema,
  createRoomRequestSchema,
  joinRoomRequestSchema,
  roomSnapshotSchema,
  setReadyCommandSchema,
  socketAuthSchema,
  submitClaimCommandSchema,
} from '@bluff-game/shared';

import { CommandError, RoomRegistry } from './room-registry.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_DIST_DIR = resolve(CURRENT_DIR, '../../web/dist');
const WEB_DIST_INDEX = resolve(WEB_DIST_DIR, 'index.html');
const WEB_DIST_ASSETS = resolve(WEB_DIST_DIR, 'assets');
const HAS_BUILT_WEB = existsSync(WEB_DIST_INDEX);
const BUILT_WEB_INDEX = HAS_BUILT_WEB
  ? await readFile(WEB_DIST_INDEX, 'utf8')
  : null;

const app = Fastify({
  logger: true,
});

const registry = new RoomRegistry();

await app.register(fastifyCors, {
  origin: true,
  credentials: true,
});

app.get('/health', async () => ({ ok: true }));

app.post('/api/rooms', async (request, reply) => {
  try {
    const payload = createRoomRequestSchema.parse(request.body);
    const session = registry.createRoom(payload.displayName);
    return reply.code(201).send(session);
  } catch (error) {
    return sendHttpError(reply, error);
  }
});

app.post('/api/rooms/:roomCode/join', async (request, reply) => {
  try {
    const payload = joinRoomRequestSchema.parse(request.body);
    const session = await registry.joinRoom(
      String((request.params as { roomCode: string }).roomCode).toUpperCase(),
      payload.displayName,
    );

    broadcastRoom(session.roomCode);
    return reply.code(201).send(session);
  } catch (error) {
    return sendHttpError(reply, error);
  }
});

if (HAS_BUILT_WEB) {
  app.get('/', async (_request, reply) => sendBuiltWebIndex(reply));

  app.get('/rooms/:roomCode', async (_request, reply) =>
    sendBuiltWebIndex(reply),
  );

  app.get('/assets/*', async (request, reply) => {
    const assetPath = resolveBuiltWebAsset(
      String((request.params as { '*': string })['*'] ?? ''),
    );

    if (!assetPath) {
      return reply.code(404).send({ message: 'Asset not found.' });
    }

    try {
      const asset = await readFile(assetPath);
      return reply
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .type(getContentType(assetPath))
        .send(asset);
    } catch {
      return reply.code(404).send({ message: 'Asset not found.' });
    }
  });

  app.log.info('Serving built web client from apps/web/dist.');
} else {
  app.log.info('Built web client not found; serving API and Socket.IO only.');
}

const io = new Server(app.server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

io.on('connection', async (socket) => {
  let auth: ReturnType<typeof socketAuthSchema.parse>;

  try {
    auth = socketAuthSchema.parse(socket.handshake.auth);
    const attached = await registry.attachConnection({
      ...auth,
      roomCode: auth.roomCode.toUpperCase(),
      socketId: socket.id,
    });

    if (attached.previousSocketId && attached.previousSocketId !== socket.id) {
      io.sockets.sockets.get(attached.previousSocketId)?.disconnect(true);
    }

    broadcastRoom(auth.roomCode.toUpperCase());
  } catch (error) {
    emitCommandRejected(socket, error);
    socket.disconnect(true);
    return;
  }

  socket.on('setReady', async (payload) => {
    await handleSocketCommand(socket, auth.roomCode.toUpperCase(), async () => {
      const command = setReadyCommandSchema.parse(payload);
      await registry.setReady(
        auth.roomCode.toUpperCase(),
        auth.playerId,
        command.ready,
      );
    });
  });

  socket.on('startMatch', async () => {
    await handleSocketCommand(socket, auth.roomCode.toUpperCase(), async () => {
      await registry.startMatch(auth.roomCode.toUpperCase(), auth.playerId);
    });
  });

  socket.on('submitClaim', async (payload) => {
    await handleSocketCommand(socket, auth.roomCode.toUpperCase(), async () => {
      const command = submitClaimCommandSchema.parse(payload);
      await registry.submitClaim(
        auth.roomCode.toUpperCase(),
        auth.playerId,
        command.claimKey,
      );
    });
  });

  socket.on('challengeClaim', async () => {
    await handleSocketCommand(socket, auth.roomCode.toUpperCase(), async () => {
      await registry.challengeClaim(auth.roomCode.toUpperCase(), auth.playerId);
    });
  });

  socket.on('restartMatch', async () => {
    await handleSocketCommand(socket, auth.roomCode.toUpperCase(), async () => {
      await registry.restartMatch(auth.roomCode.toUpperCase(), auth.playerId);
    });
  });

  socket.on('leaveRoom', async () => {
    try {
      await registry.leaveRoom(auth.roomCode.toUpperCase(), auth.playerId);
      socket.disconnect(true);
      broadcastRoom(auth.roomCode.toUpperCase());
    } catch (error) {
      emitCommandRejected(socket, error);
    }
  });

  socket.on('disconnect', async () => {
    await registry.disconnect(
      auth.roomCode.toUpperCase(),
      auth.playerId,
      socket.id,
    );
    broadcastRoom(auth.roomCode.toUpperCase());
  });
});

await app.listen({
  port: PORT,
  host: HOST,
});

function broadcastRoom(roomCode: string) {
  const recipients = registry.getConnectedRecipients(roomCode);

  for (const recipient of recipients) {
    const snapshot = roomSnapshotSchema.parse(
      registry.buildSnapshot(roomCode, recipient.playerId),
    );
    io.to(recipient.socketId).emit('roomSnapshot', snapshot);
  }
}

function sendBuiltWebIndex(reply: FastifyReply) {
  if (!BUILT_WEB_INDEX) {
    return reply.code(503).send({ message: 'Built web client is unavailable.' });
  }

  return reply
    .header('Cache-Control', 'no-cache')
    .type('text/html; charset=utf-8')
    .send(BUILT_WEB_INDEX);
}

function resolveBuiltWebAsset(assetName: string) {
  if (!assetName) {
    return null;
  }

  const assetPath = resolve(WEB_DIST_ASSETS, assetName);
  const relativePath = relative(WEB_DIST_ASSETS, assetPath);

  if (relativePath.startsWith('..') || relativePath === '') {
    return null;
  }

  return assetPath;
}

function getContentType(filePath: string) {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.ico':
      return 'image/x-icon';
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

async function handleSocketCommand(
  socket: Socket,
  roomCode: string,
  action: () => Promise<void>,
) {
  try {
    await action();
    broadcastRoom(roomCode);
  } catch (error) {
    emitCommandRejected(socket, error);
  }
}

function emitCommandRejected(socket: Socket, error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : 'The command could not be processed.';
  socket.emit(
    'commandRejected',
    commandRejectedEventSchema.parse({
      message,
    }),
  );
}

function sendHttpError(reply: FastifyReply, error: unknown) {
  if (error instanceof CommandError) {
    return reply.code(error.statusCode).send({ message: error.message });
  }

  if (error instanceof Error) {
    return reply.code(400).send({ message: error.message });
  }

  return reply.code(500).send({ message: 'Unexpected server error.' });
}
