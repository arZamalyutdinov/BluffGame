import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { type Socket, io } from 'socket.io-client';

import {
  type RoomSnapshot,
  commandRejectedEventSchema,
  roomSnapshotSchema,
} from '@bluff-game/shared';

import {
  CardsIcon,
  SeatsIcon,
  SignalIcon,
  SparkIcon,
  TimerIcon,
} from './components/Icons.js';
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
  const location = useLocation();
  const isRoomRoute = location.pathname.startsWith('/rooms/');

  return (
    <div
      className={`app-shell ${isRoomRoute ? 'app-shell-room' : 'app-shell-home'}`}
    >
      <div className="scene-backdrop" aria-hidden="true">
        <div className="scene-glow scene-glow-left" />
        <div className="scene-glow scene-glow-right" />
        <div className="scene-grid-lines" />
        <div className="scene-horizon" />
      </div>

      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <span className="brand-mark">
              <CardsIcon />
            </span>
            <span className="brand-copy">
              <span className="brand-overline">Private bluff tables</span>
              <span className="brand-title">BluffGame</span>
            </span>
          </Link>

          <div className="scene-chip-row topbar-chip-row">
            <span className="scene-chip">
              <SparkIcon className="chip-icon" />
              Snapshot-driven play
            </span>
            <span className="scene-chip">
              {isRoomRoute ? (
                <TimerIcon className="chip-icon" />
              ) : (
                <SeatsIcon className="chip-icon" />
              )}
              {isRoomRoute ? 'Live room sync' : '2-8 players'}
            </span>
          </div>
        </div>
      </header>

      <main
        className={isRoomRoute ? 'page-shell page-shell-room' : 'page-shell'}
      >
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
    <section className="surface-grid home-grid home-scene-grid">
      <article className="hero-panel home-hero-panel">
        <div className="scene-chip-row">
          <span className="scene-chip scene-chip-accent">
            <SparkIcon className="chip-icon" />
            Night-table atmosphere
          </span>
          <span className="scene-chip">
            <SignalIcon className="chip-icon" />
            Realtime authoritative rounds
          </span>
        </div>

        <div className="home-copy-stack">
          <div>
            <p className="eyebrow">Browser bluffing</p>
            <h1>Run the table. Sell the lie.</h1>
          </div>

          <p className="lead">
            Private multiplayer bluff rounds with exact-claim showdowns,
            persistent room sync, and a table-first presentation that feels like
            a live card night instead of a plain dashboard.
          </p>
        </div>

        <div className="home-feature-grid">
          <div className="feature-chip">
            <CardsIcon className="chip-icon" />
            Raise with legal claim steps
          </div>
          <div className="feature-chip">
            <SeatsIcon className="chip-icon" />
            Bring humans and host-added bots
          </div>
          <div className="feature-chip">
            <TimerIcon className="chip-icon" />
            Live turn timer with host pause
          </div>
        </div>

        <div className="home-stage" aria-hidden="true">
          <div className="home-stage-orbit orbit-left" />
          <div className="home-stage-orbit orbit-right" />
          <div className="home-stage-table">
            <div className="home-stage-seat top-seat" />
            <div className="home-stage-seat left-seat" />
            <div className="home-stage-seat right-seat" />
            <div className="home-stage-center-chip">Private table</div>
          </div>
        </div>
      </article>

      <article className="panel stacked-panel control-deck">
        <div className="panel-heading">
          <p className="eyebrow">Open a table</p>
          <h2>Create or join a room</h2>
          <p className="claim-helper-text">
            Use your display name once, then spin up a private code or jump back
            into an existing table.
          </p>
        </div>

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
            <span className="button-content">
              <CardsIcon className="button-icon" />
              {busyAction === 'create' ? 'Creating...' : 'Create room'}
            </span>
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
              <span className="button-content">
                <SeatsIcon className="button-icon" />
                {busyAction === 'join' ? 'Joining...' : 'Join room'}
              </span>
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
  const [isTablePanelOpen, setIsTablePanelOpen] = useState(false);

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

  useEffect(() => {
    if (state.snapshot?.phase === 'lobby') {
      setIsTablePanelOpen(false);
    }
  }, [state.snapshot?.phase]);

  if (!session) {
    return (
      <section className="panel status-panel">
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
      <section className="panel status-panel">
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
          pendingCommand={state.pendingCommand}
          onSetReady={(ready) => sendCommand('setReady', { ready })}
          onAddBot={() => sendCommand('addBot', {})}
          onStartMatch={() => sendCommand('startMatch')}
          onUpdateSettings={(settings) =>
            sendCommand('updateRoomSettings', settings)
          }
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
          isTablePanelOpen={isTablePanelOpen}
          onSubmitClaim={(claimKey) => sendCommand('submitClaim', { claimKey })}
          onChallengeClaim={() => sendCommand('challengeClaim')}
          onSetPauseState={(paused) =>
            sendCommand('setMatchPaused', { paused })
          }
          onSendChatMessage={(text) => sendCommand('sendChatMessage', { text })}
          onRestartMatch={() => sendCommand('restartMatch')}
          onSetTablePanelOpen={setIsTablePanelOpen}
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
