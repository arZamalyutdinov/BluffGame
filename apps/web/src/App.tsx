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

import { AmbientSceneCanvas } from './components/AmbientSceneCanvas.js';
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
import { type AppErrorInfo, toAppErrorInfo } from './lib/clientErrors.js';
import {
  LocaleProvider,
  SUPPORTED_LOCALES,
  getLocaleNativeName,
  useLocale,
} from './lib/i18n/index.js';
import { startRoomKeepAlive } from './lib/roomKeepAlive.js';
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
  error: AppErrorInfo | null;
  serverClockOffsetMs: number;
}

export function AppShell() {
  const location = useLocation();
  const { locale, setLocale, t } = useLocale();
  const isRoomRoute = location.pathname.startsWith('/rooms/');

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 -z-20 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#182350_0%,#0a0f24_42%,#050814_100%)]" />
        <div className="absolute inset-x-0 top-[-14rem] h-[28rem] bg-[radial-gradient(circle,rgba(102,217,255,0.18),transparent_62%)] blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(188,98,255,0.18),transparent_62%)] blur-3xl" />
        <AmbientSceneCanvas
          variant={isRoomRoute ? 'room' : 'home'}
          className="absolute inset-0 h-full w-full opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_12%,transparent_88%,rgba(255,255,255,0.03))]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#040714]/70 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-[1540px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            className="group flex items-center gap-3 text-white transition-opacity hover:opacity-100"
            to="/"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-white/5 text-cyan-100 shadow-[0_0_28px_rgba(100,217,255,0.18)] backdrop-blur-xl">
              <CardsIcon />
            </span>
            <span className="grid gap-0.5">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
                {t('privateTables')}
              </span>
              <span className="font-display text-2xl font-extrabold tracking-[-0.04em] text-white">
                {t('appTitle')}
              </span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 shadow-[0_14px_30px_rgba(4,8,24,0.22)] backdrop-blur-xl">
              <SparkIcon className="h-4 w-4 text-cyan-200" />
              {t('privateRoomFlow')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 shadow-[0_14px_30px_rgba(4,8,24,0.22)] backdrop-blur-xl">
              {isRoomRoute ? (
                <TimerIcon className="h-4 w-4 text-emerald-200" />
              ) : (
                <SeatsIcon className="h-4 w-4 text-violet-200" />
              )}
              {isRoomRoute ? t('snapshotRoomSync') : t('playersRange')}
            </span>
            <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 shadow-[0_14px_30px_rgba(4,8,24,0.22)] backdrop-blur-xl">
              <span className="sr-only">{t('languageLabel')}</span>
              <select
                aria-label={t('languageLabel')}
                className="bg-transparent text-sm font-medium text-slate-100 outline-none"
                value={locale}
                onChange={(event) =>
                  setLocale(
                    event.target.value as (typeof SUPPORTED_LOCALES)[number],
                  )
                }
              >
                {SUPPORTED_LOCALES.map((option) => (
                  <option key={option} value={option} className="bg-slate-950">
                    {getLocaleNativeName(option)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto w-full ${isRoomRoute ? 'max-w-[1540px] px-3 pb-8 pt-4 sm:px-6 lg:px-8' : 'max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8'}`}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rooms/:roomCode" element={<RoomPage />} />
        </Routes>
      </main>
    </div>
  );
}

export function HomePage() {
  const { catalog, formatError } = useLocale();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(getLastDisplayName());
  const [joinCode, setJoinCode] = useState('');
  const [busyAction, setBusyAction] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<AppErrorInfo | null>(null);

  async function handleCreate() {
    try {
      setBusyAction('create');
      setError(null);
      const session = await createRoom(displayName);
      saveRoomSession(session);

      startTransition(() => {
        navigate(`/rooms/${session.roomCode}`);
      });
    } catch (error) {
      setError(
        toAppErrorInfo(error, 'request-failed') ?? {
          message: catalog.home.createFallback,
        },
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleJoin() {
    try {
      setBusyAction('join');
      setError(null);
      const session = await joinRoom(joinCode, displayName);
      saveRoomSession(session);

      startTransition(() => {
        navigate(`/rooms/${session.roomCode}`);
      });
    } catch (error) {
      setError(
        toAppErrorInfo(error, 'request-failed') ?? {
          message: catalog.home.joinFallback,
        },
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,28rem)] xl:gap-12">
      <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_70px_rgba(4,8,24,0.28)] backdrop-blur-2xl sm:p-8 lg:min-h-[44rem] lg:p-10">
        <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(100,217,255,0.18),transparent_65%)]" />
        <div className="relative flex flex-col gap-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100">
              <SparkIcon className="h-4 w-4" />
              {catalog.home.atmosphereBadge}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">
              <SignalIcon className="h-4 w-4 text-emerald-200" />
              {catalog.home.syncBadge}
            </span>
          </div>

          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.36em] text-slate-400">
              {catalog.home.eyebrow}
            </p>
            <h1 className="font-display text-5xl font-extrabold tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
              {catalog.home.titleLead}
              <br />
              <span className="bg-[linear-gradient(90deg,#7be9ff,#64f4c5_45%,#c76cff)] bg-clip-text text-transparent">
                {catalog.home.titleAccent}
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              {catalog.home.lead}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4 backdrop-blur-xl">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/12 text-cyan-100">
                <CardsIcon className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg font-bold text-white">
                {catalog.home.legalClaimTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {catalog.home.legalClaimBody}
              </p>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4 backdrop-blur-xl">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-300/12 text-violet-100">
                <SeatsIcon className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg font-bold text-white">
                {catalog.home.humansBotsTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {catalog.home.humansBotsBody}
              </p>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/45 p-4 backdrop-blur-xl">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300/12 text-emerald-100">
                <TimerIcon className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg font-bold text-white">
                {catalog.home.livePressureTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {catalog.home.livePressureBody}
              </p>
            </div>
          </div>

          <div className="relative hidden min-h-[20rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,18,44,0.92),rgba(5,10,24,0.96))] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:block">
            <div className="absolute inset-x-[12%] top-8 h-32 rounded-full bg-[radial-gradient(circle,rgba(100,217,255,0.22),transparent_68%)] blur-3xl" />
            <div className="absolute inset-x-[18%] bottom-5 h-28 rounded-full bg-[radial-gradient(circle,rgba(188,98,255,0.22),transparent_68%)] blur-3xl" />
            <div className="absolute inset-0">
              <div className="absolute left-[12%] top-[42%] h-20 w-20 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl" />
              <div className="absolute left-[41%] top-[16%] h-20 w-20 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl" />
              <div className="absolute right-[12%] top-[42%] h-20 w-20 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl" />
              <div className="absolute inset-x-[16%] top-[20%] bottom-[18%] rounded-[999px] border border-cyan-300/30 bg-[linear-gradient(180deg,rgba(25,104,75,0.98),rgba(17,69,55,0.98))] shadow-[0_0_0_12px_rgba(100,217,255,0.12),0_0_60px_rgba(188,98,255,0.24)]" />
              <div className="absolute inset-x-[21%] top-[27%] bottom-[25%] rounded-[999px] border border-emerald-200/15" />
              <div className="absolute inset-x-[34%] top-[34%] flex items-center justify-center">
                <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/55 px-5 py-4 text-center shadow-[0_18px_50px_rgba(4,8,24,0.34)] backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    {catalog.home.privateTableLabel}
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold text-white">
                    {catalog.home.privateTableTitle}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,23,52,0.94),rgba(9,13,31,0.96))] p-6 shadow-[0_30px_80px_rgba(4,8,24,0.34)] backdrop-blur-2xl sm:p-8">
        <div className="relative">
          <div className="absolute right-[-4rem] top-[-4rem] h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="absolute bottom-[-4rem] left-[-4rem] h-32 w-32 rounded-full bg-violet-400/12 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-slate-400">
              {catalog.home.openTableEyebrow}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.04em] text-white">
              {catalog.home.openTableTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {catalog.home.openTableLead}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5">
          <label className="grid gap-2 text-sm font-medium text-slate-200">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              {catalog.home.displayName}
            </span>
            <input
              className="h-14 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-base text-white outline-none transition focus:border-cyan-300/40 focus:bg-slate-950/70"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={catalog.home.displayNamePlaceholder}
              maxLength={24}
            />
          </label>

          <button
            type="button"
            className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#5cf3c9,#3ce6d4)] px-5 font-display text-lg font-bold text-slate-950 shadow-[0_18px_48px_rgba(76,244,197,0.26)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleCreate}
            disabled={!displayName.trim() || busyAction !== null}
          >
            <CardsIcon className="h-5 w-5" />
            {busyAction === 'create'
              ? catalog.home.creating
              : catalog.home.createRoom}
          </button>

          <div className="grid gap-4 rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
            <label className="grid gap-2 text-sm font-medium text-slate-200">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {catalog.home.roomCode}
              </span>
              <input
                className="h-14 rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-base uppercase tracking-[0.28em] text-white outline-none transition focus:border-violet-300/40 focus:bg-slate-950/70"
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                placeholder={catalog.home.roomCodePlaceholder}
                maxLength={4}
              />
            </label>

            <button
              type="button"
              className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-violet-300/20 bg-[linear-gradient(135deg,rgba(188,98,255,0.28),rgba(109,66,209,0.28))] px-5 font-display text-lg font-bold text-white shadow-[0_18px_48px_rgba(188,98,255,0.2)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleJoin}
              disabled={
                !displayName.trim() ||
                joinCode.trim().length !== 4 ||
                busyAction !== null
              }
            >
              <SeatsIcon className="h-5 w-5" />
              {busyAction === 'join'
                ? catalog.home.joining
                : catalog.home.joinRoom}
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {formatError(error) ?? error.message}
          </p>
        ) : null}
      </article>
    </section>
  );
}

function RoomPage() {
  const { catalog, formatError } = useLocale();
  const navigate = useNavigate();
  const params = useParams();
  const roomCode = params.roomCode?.toUpperCase() ?? '';
  const session = useMemo(() => getRoomSession(roomCode), [roomCode]);
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<RoomConnectionState>({
    snapshot: null,
    isConnected: false,
    pendingCommand: null,
    error: null,
    serverClockOffsetMs: 0,
  });
  const [isTablePanelOpen, setIsTablePanelOpen] = useState(false);

  useEffect(() => {
    if (!session) {
      return;
    }

    return startRoomKeepAlive(session.roomCode);
  }, [session]);

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
      // Let the client reconnect aggressively after intermediary disconnects,
      // while still allowing polling fallback before upgrading to WebSocket.
      reconnection: true,
      reconnectionAttempts: Number.POSITIVE_INFINITY,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      randomizationFactor: 0.5,
      timeout: 20_000,
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
        error: {
          code: 'connect-failed',
          message: error.message,
        },
        isConnected: false,
        pendingCommand: null,
      }));
    });

    socket.on('roomSnapshot', (payload) => {
      const receivedAtMs = Date.now();
      const snapshot = roomSnapshotSchema.parse(payload) as RoomSnapshot;

      setState((current) => ({
        ...current,
        snapshot,
        error: null,
        pendingCommand: null,
        // Keep server-authored timers and reveal phases aligned even when a
        // player's local browser clock is skewed.
        serverClockOffsetMs: receivedAtMs - snapshot.serverNowMs,
      }));
    });

    socket.on('commandRejected', (payload) => {
      const commandError = commandRejectedEventSchema.parse(payload);

      setState((current) => ({
        ...current,
        error: commandError,
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
        <h1>{catalog.room.missingSessionTitle}</h1>
        <p className="lead">{catalog.room.missingSessionLead(roomCode)}</p>
        <Link className="primary-button link-button" to="/">
          {catalog.text.backHome}
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
      error: null,
    }));
    socket.emit(eventName, payload);
  }

  if (!state.snapshot) {
    return (
      <section className="panel status-panel">
        <h1>{catalog.room.connectingTitle(roomCode)}</h1>
        <p className="lead">{catalog.room.connectingLead}</p>
        {state.error ? (
          <p className="error-text">
            {formatError(state.error) ?? state.error.message}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <>
      {state.error ? (
        <p className="error-banner">
          {formatError(state.error) ?? state.error.message}
        </p>
      ) : null}

      {state.snapshot.phase === 'lobby' ? (
        <LobbyView
          snapshot={state.snapshot}
          isConnected={state.isConnected}
          pendingCommand={state.pendingCommand}
          onSetReady={(ready) => sendCommand('setReady', { ready })}
          onAddBot={() => sendCommand('addBot', {})}
          onRemoveBot={(playerId) => sendCommand('removeBot', { playerId })}
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
          serverClockOffsetMs={state.serverClockOffsetMs}
          isConnected={state.isConnected}
          pendingCommand={state.pendingCommand}
          isTablePanelOpen={isTablePanelOpen}
          onSubmitClaim={(claimKey) => sendCommand('submitClaim', { claimKey })}
          onChallengeClaim={() => sendCommand('challengeClaim')}
          onSetPauseState={(paused) =>
            sendCommand('setMatchPaused', { paused })
          }
          onKickPlayer={(playerId) => sendCommand('kickPlayer', { playerId })}
          onBecomeSpectator={() => sendCommand('becomeSpectator')}
          onSetSpectatorCardReveal={(enabled) =>
            sendCommand('setSpectatorCardReveal', { enabled })
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
    <LocaleProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </LocaleProvider>
  );
}
