import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { type Socket, io } from 'socket.io-client';

import {
  type RoomSnapshot,
  commandRejectedEventSchema,
  roomSnapshotSchema,
} from '@bluff-game/shared';

import { LobbyView } from './components/LobbyView.js';
import { TableView } from './components/TableView.js';
import { createRoom, joinRoom } from './lib/api.js';
import {
  getLastDisplayName,
  getRoomSession,
  removeRoomSession,
  saveRoomSession,
} from './lib/session.js';

interface RoomConnectionState {
  snapshot: RoomSnapshot | null;
  isConnected: boolean;
  pendingCommand: string | null;
  errorMessage: string | null;
}

function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          BluffGame
        </Link>
      </header>

      <main className="page-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rooms/:roomCode" element={<RoomPage />} />
        </Routes>
      </main>
    </div>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(getLastDisplayName());
  const [joinCode, setJoinCode] = useState('');
  const [busyAction, setBusyAction] = useState<'create' | 'join' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate() {
    try {
      setBusyAction('create');
      setErrorMessage(null);
      const session = await createRoom(displayName);
      saveRoomSession(session);

      startTransition(() => {
        navigate(`/rooms/${session.roomCode}`);
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to create room.',
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleJoin() {
    try {
      setBusyAction('join');
      setErrorMessage(null);
      const session = await joinRoom(joinCode, displayName);
      saveRoomSession(session);

      startTransition(() => {
        navigate(`/rooms/${session.roomCode}`);
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to join room.',
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="surface-grid home-grid">
      <article className="hero-panel">
        <p className="eyebrow">Browser bluffing</p>
        <h1>Call the hand. Push the lie.</h1>
        <p className="lead">
          A lightweight multiplayer poker-bluff game with an authoritative Node
          server, exact-claim showdowns, and no database.
        </p>
      </article>

      <article className="panel stacked-panel">
        <label className="field-label">
          Display name
          <input
            className="text-input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Enter your name"
            maxLength={24}
          />
        </label>

        <div className="split-actions">
          <button
            type="button"
            className="primary-button"
            onClick={handleCreate}
            disabled={!displayName.trim() || busyAction !== null}
          >
            {busyAction === 'create' ? 'Creating...' : 'Create room'}
          </button>

          <div className="join-box">
            <label className="field-label">
              Room code
              <input
                className="text-input code-input"
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                placeholder="ABCD"
                maxLength={4}
              />
            </label>

            <button
              type="button"
              className="secondary-button"
              onClick={handleJoin}
              disabled={
                !displayName.trim() ||
                joinCode.trim().length !== 4 ||
                busyAction !== null
              }
            >
              {busyAction === 'join' ? 'Joining...' : 'Join room'}
            </button>
          </div>
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </article>
    </section>
  );
}

function RoomPage() {
  const navigate = useNavigate();
  const params = useParams();
  const roomCode = params.roomCode?.toUpperCase() ?? '';
  const session = useMemo(() => getRoomSession(roomCode), [roomCode]);
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<RoomConnectionState>({
    snapshot: null,
    isConnected: false,
    pendingCommand: null,
    errorMessage: null,
  });

  useEffect(() => {
    if (!session) {
      return;
    }

    const socket: Socket = io({
      autoConnect: true,
      auth: {
        roomCode: session.roomCode,
        playerId: session.playerId,
        sessionToken: session.sessionToken,
      },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setState((current) => ({
        ...current,
        isConnected: true,
      }));
    });

    socket.on('disconnect', () => {
      setState((current) => ({
        ...current,
        isConnected: false,
      }));
    });

    socket.on('connect_error', (error) => {
      setState((current) => ({
        ...current,
        errorMessage: error.message,
        isConnected: false,
        pendingCommand: null,
      }));
    });

    socket.on('roomSnapshot', (payload) => {
      const snapshot = roomSnapshotSchema.parse(payload) as RoomSnapshot;

      setState((current) => ({
        ...current,
        snapshot,
        errorMessage: null,
        pendingCommand: null,
      }));
    });

    socket.on('commandRejected', (payload) => {
      const commandError = commandRejectedEventSchema.parse(payload);

      setState((current) => ({
        ...current,
        errorMessage: commandError.message,
        pendingCommand: null,
      }));
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [session]);

  if (!session) {
    return (
      <section className="panel">
        <h1>Missing room session</h1>
        <p className="lead">
          This browser does not have a saved session for room {roomCode}. Create
          or join the room from the home page first.
        </p>
        <Link className="primary-button link-button" to="/">
          Back home
        </Link>
      </section>
    );
  }

  function sendCommand(eventName: string, payload?: object) {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    setState((current) => ({
      ...current,
      pendingCommand: eventName,
      errorMessage: null,
    }));
    socket.emit(eventName, payload);
  }

  if (!state.snapshot) {
    return (
      <section className="panel">
        <h1>Connecting to room {roomCode}</h1>
        <p className="lead">Waiting for the authoritative room snapshot.</p>
        {state.errorMessage ? (
          <p className="error-text">{state.errorMessage}</p>
        ) : null}
      </section>
    );
  }

  return (
    <>
      {state.errorMessage ? (
        <p className="error-banner">{state.errorMessage}</p>
      ) : null}

      {state.snapshot.phase === 'lobby' ? (
        <LobbyView
          snapshot={state.snapshot}
          isConnected={state.isConnected}
          onSetReady={(ready) => sendCommand('setReady', { ready })}
          onStartMatch={() => sendCommand('startMatch')}
          onLeaveRoom={() => {
            removeRoomSession(roomCode);
            sendCommand('leaveRoom');
            startTransition(() => navigate('/'));
          }}
        />
      ) : (
        <TableView
          snapshot={state.snapshot}
          isConnected={state.isConnected}
          pendingCommand={state.pendingCommand}
          onSubmitClaim={(claimKey) => sendCommand('submitClaim', { claimKey })}
          onChallengeClaim={() => sendCommand('challengeClaim')}
          onRestartMatch={() => sendCommand('restartMatch')}
        />
      )}
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
