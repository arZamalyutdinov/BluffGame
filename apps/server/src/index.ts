import fastifyCors from '@fastify/cors';
import Fastify, { type FastifyReply } from 'fastify';
import { Server, type Socket } from 'socket.io';

import {
  commandRejectedEventSchema,
  createRoomRequestSchema,
  joinRoomRequestSchema,
  roomSnapshotSchema,
  sendChatMessageCommandSchema,
  setMatchPausedCommandSchema,
  setReadyCommandSchema,
  socketAuthSchema,
  submitClaimCommandSchema,
  updateRoomSettingsCommandSchema,
} from '@bluff-game/shared';

import { CommandError, RoomRegistry } from './room-registry.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({
  logger: true,
});

const registry = new RoomRegistry({
  onAutonomousRoomUpdate: (roomCode) => {
    broadcastRoom(roomCode);
  },
});

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

  socket.on('updateRoomSettings', async (payload) => {
    await handleSocketCommand(socket, auth.roomCode.toUpperCase(), async () => {
      const command = updateRoomSettingsCommandSchema.parse(payload);
      await registry.updateRoomSettings(
        auth.roomCode.toUpperCase(),
        auth.playerId,
        command,
      );
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

  socket.on('setMatchPaused', async (payload) => {
    await handleSocketCommand(socket, auth.roomCode.toUpperCase(), async () => {
      const command = setMatchPausedCommandSchema.parse(payload);
      await registry.setMatchPaused(
        auth.roomCode.toUpperCase(),
        auth.playerId,
        command.paused,
      );
    });
  });

  socket.on('sendChatMessage', async (payload) => {
    await handleSocketCommand(socket, auth.roomCode.toUpperCase(), async () => {
      const command = sendChatMessageCommandSchema.parse(payload);
      await registry.sendChatMessage(
        auth.roomCode.toUpperCase(),
        auth.playerId,
        command.text,
      );
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
