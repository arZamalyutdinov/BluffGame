import {
  CLAIM_ORDER_PRESETS,
  type ClaimOrderPreset,
  ELIMINATION_HAND_SIZE_OPTIONS,
  FLUSH_RULES,
  type FlushRule,
  JOKER_RULES,
  type JokerRule,
  type RoomSnapshot,
  SHOWDOWN_DRAW_RULES,
  type ShowdownDrawRule,
  TURN_TIME_LIMIT_SECONDS_OPTIONS,
} from '@bluff-game/shared';

import { useLocale } from '../lib/i18n/index.js';
import {
  BotIcon,
  CardsIcon,
  CrownIcon,
  DoorIcon,
  PlayIcon,
  ReadyIcon,
  SeatsIcon,
  SignalIcon,
  TimerIcon,
} from './Icons.js';
import { PlayerAvatar } from './PlayerAvatar.js';

interface LobbyViewProps {
  snapshot: RoomSnapshot;
  isConnected: boolean;
  pendingCommand: string | null;
  onSetReady: (ready: boolean) => void;
  onAddBot: () => void;
  onRemoveBot: (playerId: string) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
  onUpdateSettings: (settings: RoomSnapshot['settings']) => void;
}

const actionButtonBase =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-display text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50';

const settingCardClass =
  'rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-5 backdrop-blur-xl';

export function LobbyView({
  snapshot,
  isConnected,
  pendingCommand,
  onSetReady,
  onAddBot,
  onRemoveBot,
  onStartMatch,
  onLeaveRoom,
  onUpdateSettings,
}: LobbyViewProps) {
  const { catalog, t } = useLocale();
  const self = snapshot.players.find(
    (player) => player.playerId === snapshot.selfPlayerId,
  );
  const everyoneReady =
    snapshot.players.length >= 2 &&
    snapshot.players.every((player) => player.isReady);
  const isHost = snapshot.hostPlayerId === snapshot.selfPlayerId;
  const controlsDisabled = !isConnected || pendingCommand !== null;
  const roomIsFull = snapshot.players.length >= 8;
  const readyCount = snapshot.players.filter((player) => player.isReady).length;

  if (!self) {
    return null;
  }

  return (
    <section className="mx-auto flex w-full max-w-[1420px] flex-col gap-8">
      <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_28px_80px_rgba(4,8,24,0.3)] backdrop-blur-2xl sm:p-8">
        <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top,rgba(100,217,255,0.18),transparent_65%)]" />
        <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100">
                <SeatsIcon className="h-4 w-4" />
                {catalog.lobby.seatedCount(snapshot.players.length, 8)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">
                <TimerIcon className="h-4 w-4 text-emerald-200" />
                {catalog.lobby.turnTimer(
                  snapshot.settings.turnTimeLimitSeconds,
                )}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">
                <CardsIcon className="h-4 w-4 text-violet-200" />
                {
                  catalog.settings.claimOrderLabels[
                    snapshot.settings.claimOrderPreset
                  ]
                }
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">
                <CardsIcon className="h-4 w-4 text-cyan-200" />
                {catalog.settings.flushRuleLabels[snapshot.settings.flushRule]}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">
                <CardsIcon className="h-4 w-4 text-lime-200" />
                {
                  catalog.settings.showdownDrawRuleLabels[
                    snapshot.settings.showdownDrawRule
                  ]
                }
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200">
                <CardsIcon className="h-4 w-4 text-rose-200" />
                {catalog.settings.jokerRuleLabels[snapshot.settings.jokerRule]}
              </span>
            </div>

            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.34em] text-slate-400">
              {catalog.lobby.currentLobby}
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
              {catalog.lobby.roomTitle(snapshot.roomCode)}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              {catalog.lobby.roomLead}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[25rem]">
            <button
              type="button"
              className={`${actionButtonBase} ${
                self.isReady
                  ? 'border border-white/10 bg-white/5 text-white'
                  : 'bg-[linear-gradient(135deg,#64f4c5,#22e7d4)] text-slate-950 shadow-[0_18px_48px_rgba(76,244,197,0.24)]'
              }`}
              onClick={() => onSetReady(!self.isReady)}
              disabled={controlsDisabled}
            >
              <ReadyIcon className="h-5 w-5" />
              {self.isReady
                ? catalog.lobby.markNotReady
                : catalog.lobby.markReady}
            </button>

            {isHost ? (
              <button
                type="button"
                className={`${actionButtonBase} border border-violet-300/20 bg-violet-400/12 text-violet-100 shadow-[0_18px_48px_rgba(188,98,255,0.18)]`}
                onClick={onAddBot}
                disabled={controlsDisabled || roomIsFull}
              >
                <BotIcon className="h-5 w-5" />
                {catalog.lobby.addBot}
              </button>
            ) : (
              <div className="hidden sm:block" />
            )}

            {isHost ? (
              <button
                type="button"
                className={`${actionButtonBase} bg-[linear-gradient(135deg,#64d9ff,#7b6bff)] text-white shadow-[0_18px_48px_rgba(100,217,255,0.22)] sm:col-span-2`}
                onClick={onStartMatch}
                disabled={!everyoneReady || controlsDisabled}
              >
                <PlayIcon className="h-5 w-5" />
                {catalog.lobby.startMatch}
              </button>
            ) : null}

            <button
              type="button"
              className={`${actionButtonBase} border border-white/10 bg-black/20 text-slate-300 ${isHost ? 'sm:col-span-2' : 'sm:col-span-2 xl:col-span-2'}`}
              onClick={onLeaveRoom}
              disabled={controlsDisabled}
            >
              <DoorIcon className="h-5 w-5" />
              {catalog.lobby.leaveRoom}
            </button>
          </div>
        </div>
      </article>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(16,22,50,0.94),rgba(7,10,24,0.96))] p-6 shadow-[0_28px_80px_rgba(4,8,24,0.32)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                {catalog.lobby.houseRules}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-white">
                {catalog.lobby.roomSettings}
              </h2>
            </div>

            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] ${
                isHost
                  ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              <SignalIcon className="h-4 w-4" />
              {isHost ? t('hostCanEdit') : t('readOnly')}
            </span>
          </div>

          <div className="mt-6 grid gap-4">
            <div className={settingCardClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {catalog.lobby.combinationOrder}
              </p>
              <div className="mt-3">
                {isHost ? (
                  <select
                    className="h-14 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition focus:border-cyan-300/35"
                    value={snapshot.settings.claimOrderPreset}
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateSettings({
                        ...snapshot.settings,
                        claimOrderPreset: event.target
                          .value as ClaimOrderPreset,
                      })
                    }
                  >
                    {CLAIM_ORDER_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>
                        {catalog.settings.claimOrderLabels[preset]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-4 text-sm text-white">
                    {
                      catalog.settings.claimOrderLabels[
                        snapshot.settings.claimOrderPreset
                      ]
                    }
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {
                  catalog.settings.claimOrderDescriptions[
                    snapshot.settings.claimOrderPreset
                  ]
                }
              </p>
            </div>

            <div className={settingCardClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {catalog.lobby.flushRule}
              </p>
              <div className="mt-3">
                {isHost ? (
                  <select
                    className="h-14 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition focus:border-cyan-300/35"
                    value={snapshot.settings.flushRule}
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateSettings({
                        ...snapshot.settings,
                        flushRule: event.target.value as FlushRule,
                      })
                    }
                  >
                    {FLUSH_RULES.map((rule) => (
                      <option key={rule} value={rule}>
                        {catalog.settings.flushRuleLabels[rule]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-4 text-sm text-white">
                    {
                      catalog.settings.flushRuleLabels[
                        snapshot.settings.flushRule
                      ]
                    }
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {
                  catalog.settings.flushRuleDescriptions[
                    snapshot.settings.flushRule
                  ]
                }
              </p>
            </div>

            <div className={settingCardClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {catalog.lobby.showdownDeckRule}
              </p>
              <div className="mt-3">
                {isHost ? (
                  <select
                    className="h-14 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition focus:border-cyan-300/35"
                    value={snapshot.settings.showdownDrawRule}
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateSettings({
                        ...snapshot.settings,
                        showdownDrawRule: event.target
                          .value as ShowdownDrawRule,
                      })
                    }
                  >
                    {SHOWDOWN_DRAW_RULES.map((rule) => (
                      <option key={rule} value={rule}>
                        {catalog.settings.showdownDrawRuleLabels[rule]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-4 text-sm text-white">
                    {
                      catalog.settings.showdownDrawRuleLabels[
                        snapshot.settings.showdownDrawRule
                      ]
                    }
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {
                  catalog.settings.showdownDrawRuleDescriptions[
                    snapshot.settings.showdownDrawRule
                  ]
                }
              </p>
            </div>

            <div className={settingCardClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {catalog.lobby.jokers}
              </p>
              <div className="mt-3">
                {isHost ? (
                  <select
                    className="h-14 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition focus:border-cyan-300/35"
                    value={snapshot.settings.jokerRule}
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateSettings({
                        ...snapshot.settings,
                        jokerRule: event.target.value as JokerRule,
                      })
                    }
                  >
                    {JOKER_RULES.map((rule) => (
                      <option key={rule} value={rule}>
                        {catalog.settings.jokerRuleLabels[rule]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-4 text-sm text-white">
                    {
                      catalog.settings.jokerRuleLabels[
                        snapshot.settings.jokerRule
                      ]
                    }
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {
                  catalog.settings.jokerRuleDescriptions[
                    snapshot.settings.jokerRule
                  ]
                }
              </p>
            </div>

            <div className={settingCardClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {catalog.lobby.eliminationHandSize}
              </p>
              <div className="mt-3">
                {isHost ? (
                  <select
                    className="h-14 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition focus:border-cyan-300/35"
                    value={snapshot.settings.eliminationHandSize}
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateSettings({
                        ...snapshot.settings,
                        eliminationHandSize: Number(event.target.value),
                      })
                    }
                  >
                    {ELIMINATION_HAND_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {catalog.lobby.eliminationValue(size)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-4 text-sm text-white">
                    {catalog.lobby.eliminationValue(
                      snapshot.settings.eliminationHandSize,
                    )}
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {catalog.lobby.eliminationDescription}
              </p>
            </div>

            <div className={settingCardClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {catalog.lobby.turnTimeLimit}
              </p>
              <div className="mt-3">
                {isHost ? (
                  <select
                    className="h-14 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition focus:border-cyan-300/35"
                    value={snapshot.settings.turnTimeLimitSeconds}
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onUpdateSettings({
                        ...snapshot.settings,
                        turnTimeLimitSeconds: Number(event.target.value),
                      })
                    }
                  >
                    {TURN_TIME_LIMIT_SECONDS_OPTIONS.map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {catalog.lobby.turnTimeValue(seconds)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-4 text-sm text-white">
                    {catalog.lobby.turnTimeValue(
                      snapshot.settings.turnTimeLimitSeconds,
                    )}
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {catalog.lobby.turnTimerDescription}
              </p>
            </div>
          </div>
        </article>

        <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(16,22,50,0.94),rgba(7,10,24,0.96))] p-6 shadow-[0_28px_80px_rgba(4,8,24,0.32)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                {t('tableOrder')}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-white">
                {catalog.lobby.playersTitle}
              </h2>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
              <ReadyIcon className="h-4 w-4" />
              {catalog.lobby.readyCount(readyCount, snapshot.players.length)}
            </span>
          </div>

          <ul className="mt-6 grid gap-3">
            {snapshot.players.map((player) => {
              const isSelf = player.playerId === snapshot.selfPlayerId;
              const isDisconnected = player.connectionStatus !== 'connected';

              return (
                <li
                  key={player.playerId}
                  className={`rounded-[1.6rem] border p-4 backdrop-blur-xl transition ${
                    player.isReady
                      ? 'border-emerald-300/18 bg-emerald-300/7'
                      : 'border-white/10 bg-slate-950/45'
                  } ${isDisconnected ? 'opacity-70' : ''}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <PlayerAvatar
                          name={player.name}
                          seatIndex={player.seatIndex}
                          size="md"
                        />
                        <span className="absolute -bottom-1 -right-1 rounded-full border border-white/10 bg-slate-950 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-slate-300">
                          {player.seatIndex + 1}
                        </span>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="font-display text-lg font-bold text-white">
                            {player.name}
                          </strong>
                          {isSelf ? (
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                              {t('you')}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          {player.isHost
                            ? catalog.lobby.seatHostLabel(player.seatIndex)
                            : catalog.lobby.seatLabel(player.seatIndex)}
                          {player.isBot ? ` • ${t('bot').toLowerCase()}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {isHost && player.isBot ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-400/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:border-rose-200/35 hover:bg-rose-400/18 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => onRemoveBot(player.playerId)}
                          disabled={controlsDisabled}
                        >
                          <BotIcon className="h-4 w-4" />
                          {catalog.lobby.removeBot}
                        </button>
                      ) : null}

                      {player.isHost ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                          <CrownIcon className="h-4 w-4" />
                          {t('host')}
                        </span>
                      ) : null}

                      {player.isBot ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-100">
                          <BotIcon className="h-4 w-4" />
                          {t('bot')}
                        </span>
                      ) : null}

                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${
                          player.isReady
                            ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                            : 'border-white/10 bg-white/5 text-slate-300'
                        }`}
                      >
                        <ReadyIcon className="h-4 w-4" />
                        {player.isReady
                          ? catalog.lobby.readyStatus
                          : catalog.lobby.notReadyStatus}
                      </span>

                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${
                          isDisconnected
                            ? 'border-white/10 bg-white/5 text-slate-300'
                            : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
                        }`}
                      >
                        <SignalIcon className="h-4 w-4" />
                        {player.connectionStatus === 'connected'
                          ? catalog.lobby.connectedStatus
                          : catalog.lobby.disconnectedStatus}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      </div>
    </section>
  );
}
