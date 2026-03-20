import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type Claim,
  DEALING_CARD_FLIGHT_MS,
  DEALING_START_DELAY_MS,
  type PlayerSnapshot,
  type RoomSnapshot,
  claimToKey,
  getDealingCardStepMs,
  sortCardsDescending,
} from '@bluff-game/shared';

import { claimToIllustrationCards } from '../lib/claimVisuals.js';
import { useLocale } from '../lib/i18n/index.js';
import {
  getPlayerInitials,
  getSeatToneClass,
} from '../lib/playerPresentation.js';
import {
  TABLE_DEAL_ORIGIN,
  type TableSeatSlot,
  getDesktopOpponentSeatSlots,
} from '../lib/tableLayout.js';
import { ClaimComposer } from './ClaimComposer.js';
import { ClaimCardStack } from './ClaimPreview.js';
import {
  BotIcon,
  CardsIcon,
  ChatIcon,
  CrownIcon,
  ReadyIcon,
  SeatsIcon,
  SignalIcon,
  TimerIcon,
} from './Icons.js';
import { PlayerAvatar } from './PlayerAvatar.js';
import { RoomChat } from './RoomChat.js';
import {
  type ResolutionSeatPosition,
  RoundResolutionOverlay,
} from './RoundResolutionOverlay.js';
import '../tableScene.css';

interface TableViewProps {
  snapshot: RoomSnapshot;
  isConnected: boolean;
  pendingCommand: string | null;
  isTablePanelOpen: boolean;
  onSubmitClaim: (claimKey: string) => void;
  onChallengeClaim: () => void;
  onSetPauseState: (paused: boolean) => void;
  onRestartMatch: () => void;
  onKickPlayer: (playerId: string) => void;
  onBecomeSpectator: () => void;
  onSetSpectatorCardReveal: (enabled: boolean) => void;
  onSendChatMessage: (text: string) => void;
  onSetTablePanelOpen: (open: boolean) => void;
}

type ClaimHistoryEntry = NonNullable<
  RoomSnapshot['match']
>['claimHistory'][number];

interface DealFlight {
  playerId: string;
  cardOrdinal: number;
  startsAtMs: number;
  arrivesAtMs: number;
}

function formatRemainingMs(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function sortPlayersBySeat(snapshot: RoomSnapshot): PlayerSnapshot[] {
  return [...snapshot.players].sort(
    (left, right) => left.seatIndex - right.seatIndex,
  );
}

function rotatePlayersForTable(
  players: PlayerSnapshot[],
  anchorPlayerId: string,
): PlayerSnapshot[] {
  const anchorIndex = players.findIndex(
    (player) => player.playerId === anchorPlayerId,
  );

  if (anchorIndex === -1) {
    return players;
  }

  return [...players.slice(anchorIndex), ...players.slice(0, anchorIndex)];
}

function buildTableSeatStyle(slot: TableSeatSlot): CSSProperties {
  return {
    '--poker-seat-left': `${slot.leftPct}%`,
    '--poker-seat-top': `${slot.topPct}%`,
  } as CSSProperties;
}

function buildDealingFlights(
  players: PlayerSnapshot[],
  starterPlayerId: string,
): DealFlight[] {
  const activePlayers = rotatePlayersForTable(
    players.filter((player) => !player.isEliminated),
    starterPlayerId,
  );
  const totalCardCount = activePlayers.reduce(
    (count, player) => count + player.cardCount,
    0,
  );
  const stepMs = getDealingCardStepMs(totalCardCount);
  const maxCardsPerSeat = Math.max(
    0,
    ...activePlayers.map((player) => player.cardCount),
  );
  const flights: DealFlight[] = [];
  let flightIndex = 0;

  for (let cardOrdinal = 1; cardOrdinal <= maxCardsPerSeat; cardOrdinal += 1) {
    for (const player of activePlayers) {
      if (player.cardCount < cardOrdinal) {
        continue;
      }

      const startsAtMs = DEALING_START_DELAY_MS + flightIndex * stepMs;

      flights.push({
        playerId: player.playerId,
        cardOrdinal,
        startsAtMs,
        arrivesAtMs: startsAtMs + DEALING_CARD_FLIGHT_MS,
      });
      flightIndex += 1;
    }
  }

  return flights;
}

interface SeatAnchorCopy {
  roleChipLabel?: string;
  stateChipLabel?: string;
}

function buildSeatAnchorCopy({
  labels,
  player,
  isCurrentTurn,
  isLowCards,
  isDisconnected,
  isSelf,
  isPaused,
}: {
  labels: {
    you: string;
    bot: string;
    host: string;
    out: string;
    offline: string;
    acting: string;
    paused: string;
    pressure: string;
  };
  player: PlayerSnapshot;
  isCurrentTurn: boolean;
  isLowCards: boolean;
  isDisconnected: boolean;
  isSelf: boolean;
  isPaused: boolean;
}): SeatAnchorCopy {
  const roleChipLabel = isSelf
    ? labels.you
    : player.isBot
      ? labels.bot
      : player.isHost
        ? labels.host
        : undefined;
  const stateChipLabel = player.isEliminated
    ? labels.out
    : isDisconnected
      ? labels.offline
      : isCurrentTurn
        ? isPaused
          ? labels.paused
          : labels.acting
        : isLowCards
          ? labels.pressure
          : undefined;

  return {
    ...(roleChipLabel ? { roleChipLabel } : {}),
    ...(stateChipLabel ? { stateChipLabel } : {}),
  };
}

function buildResolutionKey(match: NonNullable<RoomSnapshot['match']>) {
  if (match.showdown) {
    return [
      'showdown',
      match.roundNumber,
      match.showdown.startedAtMs,
      match.showdown.claimantPlayerId,
      match.showdown.challengerPlayerId,
      match.showdown.loserPlayerId,
      match.showdown.claimWasValid ? 'valid' : 'invalid',
      match.showdown.deckDraws.length,
      claimToKey(match.showdown.spokenClaim),
    ].join(':');
  }

  if (match.timeout) {
    return [
      'timeout',
      match.roundNumber,
      match.timeout.startedAtMs,
      match.timeout.timedOutPlayerId,
      match.timeout.lastClaim ? claimToKey(match.timeout.lastClaim) : 'opening',
    ].join(':');
  }

  return null;
}

function buildSeatDealTargetPosition(seatPosition: ResolutionSeatPosition): {
  leftPct: number;
  topPct: number;
} {
  switch (seatPosition.placement) {
    case 'top':
      return {
        leftPct: seatPosition.leftPct,
        topPct: seatPosition.topPct + 8.5,
      };
    case 'side-left':
      return {
        leftPct: seatPosition.leftPct + 8.4,
        topPct: seatPosition.topPct + 1.4,
      };
    case 'side-right':
      return {
        leftPct: seatPosition.leftPct - 8.4,
        topPct: seatPosition.topPct + 1.4,
      };
    case 'corner-left':
      return {
        leftPct: seatPosition.leftPct + 6.9,
        topPct: seatPosition.topPct - 1.2,
      };
    case 'corner-right':
      return {
        leftPct: seatPosition.leftPct - 6.9,
        topPct: seatPosition.topPct - 1.2,
      };
    case 'self':
      return {
        leftPct: 54.5,
        topPct: 78.2,
      };
  }
}

function buildDealFlightStyle(
  target: { leftPct: number; topPct: number },
  elapsedMs: number,
  startsAtMs: number,
): CSSProperties {
  return {
    '--poker-deal-x': `${target.leftPct - TABLE_DEAL_ORIGIN.leftPct}%`,
    '--poker-deal-y': `${target.topPct - TABLE_DEAL_ORIGIN.topPct}%`,
    animationDuration: `${DEALING_CARD_FLIGHT_MS}ms`,
    animationDelay: `${Math.min(0, startsAtMs - elapsedMs)}ms`,
  } as CSSProperties;
}

export function TableView({
  snapshot,
  isConnected,
  pendingCommand,
  isTablePanelOpen,
  onSubmitClaim,
  onChallengeClaim,
  onSetPauseState,
  onRestartMatch,
  onKickPlayer,
  onBecomeSpectator,
  onSetSpectatorCardReveal,
  onSendChatMessage,
  onSetTablePanelOpen,
}: TableViewProps) {
  const { catalog, formatClaimCompactLabel, formatClaimLabel, t } = useLocale();
  const match = snapshot.match;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [claimComposerStage, setClaimComposerStage] = useState<
    'closed' | 'opening' | 'open' | 'closing'
  >('closed');
  const [selectedComposerClaim, setSelectedComposerClaim] = useState<
    Claim | undefined
  >(undefined);
  const [turnAnnouncement, setTurnAnnouncement] = useState<{
    playerId: string;
    token: number;
  } | null>(null);
  const [claimPulse, setClaimPulse] = useState<{
    playerId: string;
    sequenceNumber: number;
  } | null>(null);
  const [claimTransition, setClaimTransition] = useState<{
    phase: 'idle' | 'entering' | 'swapping';
    token: number;
    outgoingEntry: ClaimHistoryEntry | null;
  }>({
    phase: 'idle',
    token: 0,
    outgoingEntry: null,
  });
  const previousTurnPlayerIdRef = useRef<string | null>(null);
  const previousClaimSequenceRef = useRef<number | null>(null);
  const previousRenderedClaimRef = useRef<ClaimHistoryEntry | null>(null);
  const dealing = match?.dealing;
  const turnTimer = match?.turnTimer;
  const isDealingPhase = match?.phase === 'dealing' && Boolean(dealing);
  const isResultPhase =
    match?.phase === 'showing-result' &&
    Boolean(match.showdown || match.timeout);

  useEffect(() => {
    setNowMs(Date.now());

    if (
      !isDealingPhase &&
      !isResultPhase &&
      (!turnTimer || turnTimer.isPaused || turnTimer.deadlineAtMs === undefined)
    ) {
      return;
    }

    const intervalId = window.setInterval(
      () => {
        setNowMs(Date.now());
      },
      isDealingPhase || isResultPhase ? 80 : 250,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isDealingPhase, isResultPhase, turnTimer]);

  useEffect(() => {
    const isClaimComposerVisible = claimComposerStage !== 'closed';

    if (!isTablePanelOpen && !isChatPanelOpen && !isClaimComposerVisible) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onSetTablePanelOpen(false);
        setIsChatPanelOpen(false);
        if (isClaimComposerVisible) {
          setClaimComposerStage('closing');
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    claimComposerStage,
    isChatPanelOpen,
    isTablePanelOpen,
    onSetTablePanelOpen,
  ]);

  useEffect(() => {
    if (
      match &&
      (match.currentTurnPlayerId !== snapshot.selfPlayerId ||
        match.winnerPlayerId)
    ) {
      setSelectedComposerClaim(undefined);
    }
  }, [match, snapshot.selfPlayerId]);

  if (!match) {
    return null;
  }

  const currentMatch = match;
  const yourHand = currentMatch.yourHand;

  const resolutionKey = buildResolutionKey(currentMatch);
  const activeResolution = useMemo(() => {
    if (currentMatch.showdown) {
      return {
        kind: 'showdown' as const,
        key: resolutionKey ?? 'showdown',
        data: currentMatch.showdown,
      };
    }

    if (currentMatch.timeout) {
      return {
        kind: 'timeout' as const,
        key: resolutionKey ?? 'timeout',
        data: currentMatch.timeout,
      };
    }

    return undefined;
  }, [currentMatch.showdown, currentMatch.timeout, resolutionKey]);
  const isDealing =
    currentMatch.phase === 'dealing' && Boolean(currentMatch.dealing);
  const isShowingResult = currentMatch.phase === 'showing-result';
  const isResolutionStageOpen = Boolean(activeResolution) && isShowingResult;
  const spectatorView = currentMatch.spectator;
  const isSpectator = spectatorView?.isSpectator ?? false;

  const isMyTurn = currentMatch.currentTurnPlayerId === snapshot.selfPlayerId;
  const isHost = snapshot.hostPlayerId === snapshot.selfPlayerId;
  const playersById = useMemo(
    () => new Map(snapshot.players.map((player) => [player.playerId, player])),
    [snapshot.players],
  );
  const currentPlayer = playersById.get(currentMatch.currentTurnPlayerId);
  const orderedPlayers = useMemo(() => sortPlayersBySeat(snapshot), [snapshot]);
  const liveActivePlayers = useMemo(
    () => orderedPlayers.filter((player) => !player.isEliminated),
    [orderedPlayers],
  );
  const roundParticipantIds = useMemo(
    () =>
      new Set(
        activeResolution?.data.revealedHands.map((hand) => hand.playerId) ?? [],
      ),
    [activeResolution],
  );
  const stagePlayers = useMemo(() => {
    if (!isResolutionStageOpen) {
      return liveActivePlayers;
    }

    return orderedPlayers.filter((player) =>
      roundParticipantIds.has(player.playerId),
    );
  }, [
    isResolutionStageOpen,
    liveActivePlayers,
    orderedPlayers,
    roundParticipantIds,
  ]);
  const tablePlayers = useMemo(() => {
    if (
      !stagePlayers.some((player) => player.playerId === snapshot.selfPlayerId)
    ) {
      return stagePlayers;
    }

    return rotatePlayersForTable(stagePlayers, snapshot.selfPlayerId);
  }, [snapshot.selfPlayerId, stagePlayers]);
  const selfPlayer = tablePlayers.find(
    (player) => player.playerId === snapshot.selfPlayerId,
  );
  const opponentPlayers = selfPlayer
    ? tablePlayers.filter((player) => player.playerId !== snapshot.selfPlayerId)
    : tablePlayers;
  const opponentSeatSlots = getDesktopOpponentSeatSlots(
    selfPlayer ? tablePlayers.length : tablePlayers.length + 1,
  );
  const resolutionSeatPositions = useMemo(() => {
    const positions: Record<string, ResolutionSeatPosition> = {};

    opponentPlayers.forEach((player, index) => {
      const slot = opponentSeatSlots[index];

      if (!slot) {
        return;
      }

      let placement: ResolutionSeatPosition['placement'];

      if (slot.variant === 'top') {
        placement = 'top';
      } else if (slot.variant === 'corner') {
        placement = slot.leftPct < 50 ? 'corner-left' : 'corner-right';
      } else {
        placement = slot.leftPct < 50 ? 'side-left' : 'side-right';
      }

      positions[player.playerId] = {
        leftPct: slot.leftPct,
        topPct: slot.topPct,
        placement,
      };
    });

    if (selfPlayer) {
      positions[selfPlayer.playerId] = {
        leftPct: 50,
        topPct: isResolutionStageOpen ? 91 : 84,
        placement: 'self',
      };
    }

    return positions;
  }, [isResolutionStageOpen, opponentPlayers, opponentSeatSlots, selfPlayer]);
  const dealTablePlayers = useMemo(() => {
    if (
      !liveActivePlayers.some(
        (player) => player.playerId === snapshot.selfPlayerId,
      )
    ) {
      return liveActivePlayers;
    }

    return rotatePlayersForTable(liveActivePlayers, snapshot.selfPlayerId);
  }, [liveActivePlayers, snapshot.selfPlayerId]);
  const dealSelfPlayer = dealTablePlayers.find(
    (player) => player.playerId === snapshot.selfPlayerId,
  );
  const dealOpponentPlayers = dealSelfPlayer
    ? dealTablePlayers.filter(
        (player) => player.playerId !== snapshot.selfPlayerId,
      )
    : dealTablePlayers;
  const dealOpponentSeatSlots = getDesktopOpponentSeatSlots(
    dealSelfPlayer ? dealTablePlayers.length : dealTablePlayers.length + 1,
  );
  const dealSeatPositions = useMemo(() => {
    const positions: Record<string, ResolutionSeatPosition> = {};

    dealOpponentPlayers.forEach((player, index) => {
      const slot = dealOpponentSeatSlots[index];

      if (!slot) {
        return;
      }

      let placement: ResolutionSeatPosition['placement'];

      if (slot.variant === 'top') {
        placement = 'top';
      } else if (slot.variant === 'corner') {
        placement = slot.leftPct < 50 ? 'corner-left' : 'corner-right';
      } else {
        placement = slot.leftPct < 50 ? 'side-left' : 'side-right';
      }

      positions[player.playerId] = {
        leftPct: slot.leftPct,
        topPct: slot.topPct,
        placement,
      };
    });

    if (dealSelfPlayer) {
      positions[dealSelfPlayer.playerId] = {
        leftPct: 50,
        topPct: 84,
        placement: 'self',
      };
    }

    return positions;
  }, [dealOpponentPlayers, dealOpponentSeatSlots, dealSelfPlayer]);
  const dealingFlights = useMemo(
    () => buildDealingFlights(liveActivePlayers, currentMatch.starterPlayerId),
    [currentMatch.starterPlayerId, liveActivePlayers],
  );
  const dealElapsedMs =
    isDealing && currentMatch.dealing
      ? Math.min(
          Math.max(nowMs - currentMatch.dealing.startedAtMs, 0),
          currentMatch.dealing.durationMs,
        )
      : 0;
  const dealtCountByPlayerId = useMemo(() => {
    const counts = new Map<string, number>();

    if (!isDealing) {
      return counts;
    }

    for (const flight of dealingFlights) {
      if (dealElapsedMs < flight.arrivesAtMs) {
        continue;
      }

      counts.set(flight.playerId, (counts.get(flight.playerId) ?? 0) + 1);
    }

    return counts;
  }, [dealElapsedMs, dealingFlights, isDealing]);
  const activeDealFlights = useMemo(
    () =>
      isDealing
        ? dealingFlights.filter(
            (flight) =>
              dealElapsedMs >= flight.startsAtMs &&
              dealElapsedMs < flight.arrivesAtMs,
          )
        : [],
    [dealElapsedMs, dealingFlights, isDealing],
  );
  const cardsInRound = liveActivePlayers.reduce(
    (total, player) => total + player.cardCount,
    0,
  );
  const spectatorRevealedHandsByPlayerId = useMemo(
    () =>
      new Map(
        spectatorView?.revealedHands?.map((hand) => [
          hand.playerId,
          hand.cards,
        ]) ?? [],
      ),
    [spectatorView],
  );
  const claimsByPlayerId = new Map<
    string,
    Array<(typeof currentMatch.claimHistory)[number]>
  >();

  for (const entry of currentMatch.claimHistory) {
    const playerClaims = claimsByPlayerId.get(entry.playerId) ?? [];
    playerClaims.push(entry);
    claimsByPlayerId.set(entry.playerId, playerClaims);
  }

  const currentTurnPlayerId = currentMatch.currentTurnPlayerId;
  const winner = currentMatch.winnerPlayerId
    ? playersById.get(currentMatch.winnerPlayerId)
    : undefined;
  const lastClaimEntry = currentMatch.claimHistory.at(-1);
  const lastClaimPlayer = lastClaimEntry
    ? playersById.get(lastClaimEntry.playerId)
    : undefined;
  const remainingMs = turnTimer
    ? turnTimer.isPaused || turnTimer.deadlineAtMs === undefined
      ? turnTimer.remainingMs
      : Math.max(0, turnTimer.deadlineAtMs - nowMs)
    : null;
  const turnProgress =
    turnTimer && remainingMs !== null
      ? Math.min(
          Math.max(remainingMs / (turnTimer.durationSeconds * 1000), 0),
          1,
        )
      : undefined;
  const isPaused = turnTimer?.isPaused ?? false;
  const timerUrgency =
    isPaused || remainingMs === null
      ? 'paused'
      : remainingMs <= 10_000
        ? 'critical'
        : remainingMs <= 20_000
          ? 'warning'
          : 'steady';
  const actionDisabled =
    !isConnected ||
    pendingCommand !== null ||
    isSpectator ||
    isDealing ||
    isPaused ||
    remainingMs === 0 ||
    isShowingResult;
  const checkDisabled =
    isSpectator ||
    !currentMatch.lastClaim ||
    !isMyTurn ||
    !!winner ||
    actionDisabled;
  const canOpenClaimComposer =
    !isSpectator &&
    isMyTurn &&
    !winner &&
    !isPaused &&
    !isShowingResult &&
    !actionDisabled;
  const dockMessage = winner
    ? catalog.table.winnerMessage(winner.name)
    : isDealing
      ? catalog.table.dealingMessage(liveActivePlayers.length)
      : isPaused
        ? catalog.table.pausedClock
        : isShowingResult
          ? catalog.table.roundResultShown
          : isSpectator
            ? catalog.table.spectatingMessage
            : isMyTurn
              ? currentMatch.lastClaim
                ? catalog.table.raiseOrCheck
                : catalog.table.openRound
              : catalog.table.waitingForPlayer(
                  currentPlayer?.name ?? catalog.table.activePlayer,
                );
  const claimPotCopy = winner
    ? null
    : isDealing
      ? {
          label: catalog.table.dealingPotLabel,
          title: catalog.table.dealingPotTitle,
          detail: catalog.table.dealingPotDetail,
        }
      : isPaused
        ? {
            label: catalog.table.clockPausedLabel,
            title: currentMatch.lastClaim
              ? formatClaimCompactLabel(currentMatch.lastClaim)
              : catalog.table.tableWaiting,
            detail: currentPlayer
              ? catalog.table.pausedOnPlayer(currentPlayer.name)
              : catalog.table.hostPausedClock,
          }
        : currentMatch.lastClaim
          ? {
              label: catalog.table.claimOnTable,
              title: formatClaimCompactLabel(currentMatch.lastClaim),
              detail: lastClaimPlayer
                ? catalog.table.claimSetPace(lastClaimPlayer.name)
                : catalog.table.raiseOrCheck,
            }
          : {
              label: catalog.table.openTable,
              title: catalog.table.noClaimYet,
            };
  const displayedCardCountByPlayerId = useMemo(
    () =>
      new Map(
        orderedPlayers.map((player) => [
          player.playerId,
          isDealing
            ? (dealtCountByPlayerId.get(player.playerId) ?? 0)
            : player.cardCount,
        ]),
      ),
    [dealtCountByPlayerId, isDealing, orderedPlayers],
  );
  const isClaimComposerVisible = claimComposerStage !== 'closed';

  useEffect(() => {
    if (winner || isShowingResult || isDealing) {
      previousTurnPlayerIdRef.current = currentTurnPlayerId;
      setTurnAnnouncement(null);
      return;
    }

    const previousTurnPlayerId = previousTurnPlayerIdRef.current;

    if (previousTurnPlayerId && previousTurnPlayerId !== currentTurnPlayerId) {
      setTurnAnnouncement({
        playerId: currentTurnPlayerId,
        token: Date.now(),
      });
    }

    previousTurnPlayerIdRef.current = currentTurnPlayerId;
  }, [currentTurnPlayerId, isDealing, isShowingResult, winner]);

  useEffect(() => {
    if (!turnAnnouncement) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTurnAnnouncement(null);
    }, 1_500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [turnAnnouncement]);

  useEffect(() => {
    const nextSequenceNumber = lastClaimEntry?.sequenceNumber ?? null;
    const previousSequenceNumber = previousClaimSequenceRef.current;

    if (
      previousSequenceNumber !== null &&
      nextSequenceNumber !== null &&
      nextSequenceNumber !== previousSequenceNumber &&
      lastClaimEntry
    ) {
      setClaimPulse({
        playerId: lastClaimEntry.playerId,
        sequenceNumber: nextSequenceNumber,
      });
    }

    previousClaimSequenceRef.current = nextSequenceNumber;
  }, [lastClaimEntry]);

  useEffect(() => {
    if (!claimPulse) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setClaimPulse(null);
    }, 1_150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [claimPulse]);

  useEffect(() => {
    if (!canOpenClaimComposer) {
      setClaimComposerStage('closed');
    }
  }, [canOpenClaimComposer]);

  useEffect(() => {
    if (!isShowingResult) {
      return;
    }

    onSetTablePanelOpen(false);
    setIsChatPanelOpen(false);
  }, [isShowingResult, onSetTablePanelOpen]);

  useEffect(() => {
    if (claimComposerStage !== 'opening') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setClaimComposerStage('open');
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [claimComposerStage]);

  useEffect(() => {
    if (claimComposerStage !== 'closing') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setClaimComposerStage('closed');
    }, 260);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [claimComposerStage]);

  useEffect(() => {
    const nextEntry = lastClaimEntry ?? null;
    const previousEntry = previousRenderedClaimRef.current;
    const previousSequenceNumber = previousEntry?.sequenceNumber ?? null;
    const nextSequenceNumber = nextEntry?.sequenceNumber ?? null;

    if (previousSequenceNumber === nextSequenceNumber) {
      return;
    }

    previousRenderedClaimRef.current = nextEntry;

    if (!nextEntry) {
      setClaimTransition({
        phase: 'idle',
        token: Date.now(),
        outgoingEntry: null,
      });
      return;
    }

    const nextToken = Date.now();

    setClaimTransition({
      phase: previousEntry ? 'swapping' : 'entering',
      token: nextToken,
      outgoingEntry: previousEntry,
    });

    const timeoutId = window.setTimeout(() => {
      setClaimTransition((current) =>
        current.token === nextToken
          ? {
              phase: 'idle',
              token: current.token,
              outgoingEntry: null,
            }
          : current,
      );
    }, 480);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastClaimEntry]);

  function openClaimComposer() {
    if (!canOpenClaimComposer) {
      return;
    }

    setClaimComposerStage((current) =>
      current === 'closed' ? 'opening' : current,
    );
  }

  function closeClaimComposer() {
    setClaimComposerStage((current) => {
      if (current === 'closed' || current === 'closing') {
        return current;
      }

      return 'closing';
    });
  }

  function renderChatRailContent(hideChatHeader = false) {
    return (
      <>
        {turnTimer && remainingMs !== null && !winner ? (
          <section
            className={`side-panel-section side-panel-card turn-timer-panel turn-timer-side-panel is-${timerUrgency}`}
          >
            <div className="turn-timer-header">
              <div>
                <p className="claim-panel-label">{catalog.table.turnClock}</p>
                <h2>{currentPlayer?.name ?? catalog.table.activePlayer}</h2>
              </div>

              <span className={`turn-timer-state is-${timerUrgency}`}>
                {isPaused
                  ? t('paused')
                  : timerUrgency === 'critical'
                    ? catalog.table.critical
                    : timerUrgency === 'warning'
                      ? catalog.table.warning
                      : t('live')}
              </span>
            </div>

            <div
              className={`turn-timer-value ${isPaused ? 'is-paused' : ''} ${timerUrgency === 'warning' ? 'is-warning' : ''} ${timerUrgency === 'critical' ? 'is-critical' : ''}`}
            >
              {formatRemainingMs(remainingMs)}
            </div>

            <p className="claim-helper-text">
              {isPaused
                ? catalog.table.hostPausedSeat
                : catalog.table.playerOnClock(
                    currentPlayer?.name ?? catalog.table.activePlayer,
                  )}
            </p>

            {isHost ? (
              <div className="turn-timer-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onSetPauseState(!isPaused)}
                  disabled={!isConnected || pendingCommand !== null}
                >
                  {isPaused ? t('resume') : t('pause')}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <RoomChat
          messages={snapshot.chatMessages}
          selfPlayerId={snapshot.selfPlayerId}
          disabled={!isConnected || pendingCommand !== null}
          isConnected={isConnected}
          pendingCommand={pendingCommand}
          hideHeader={hideChatHeader}
          onSendMessage={onSendChatMessage}
        />
      </>
    );
  }

  function renderPlayerTableSection() {
    const activeDrawerPlayers = orderedPlayers.filter(
      (player) => !player.isEliminated,
    );
    const spectatorPlayers = orderedPlayers.filter(
      (player) => player.isEliminated,
    );

    function renderPlayerRow(
      player: PlayerSnapshot,
      section: 'active' | 'spectator',
    ) {
      const playerClaims = claimsByPlayerId.get(player.playerId) ?? [];
      const isDisconnected = player.connectionStatus === 'disconnected';
      const displayedCardCount =
        displayedCardCountByPlayerId.get(player.playerId) ?? player.cardCount;
      const revealedHand = spectatorRevealedHandsByPlayerId.get(
        player.playerId,
      );
      const isSelfSpectatorRow =
        section === 'spectator' &&
        isSpectator &&
        player.playerId === snapshot.selfPlayerId &&
        !player.isBot;
      const canKickPlayer =
        section === 'active' &&
        isHost &&
        player.playerId !== snapshot.selfPlayerId &&
        !winner;
      const canStopPlaying =
        section === 'active' &&
        player.playerId === snapshot.selfPlayerId &&
        !player.isBot &&
        !isSpectator &&
        !winner;

      return (
        <li
          key={player.playerId}
          className={`player-row ${player.playerId === currentTurnPlayerId ? 'turn-row' : ''}`}
        >
          <details className="player-details">
            <summary className="player-details-summary">
              <div
                className={`seat-emblem ${getSeatToneClass(player.seatIndex)}`}
                aria-hidden="true"
              >
                <span className="seat-emblem-seat">{player.seatIndex + 1}</span>
                <span className="seat-emblem-initials">
                  {getPlayerInitials(player.name)}
                </span>
              </div>

              <div className="player-card-body">
                <div className="player-primary">
                  <div className="player-name-row">
                    <strong>{player.name}</strong>
                    {player.playerId === snapshot.selfPlayerId ? (
                      <span className="scene-chip scene-chip-compact">
                        {t('you')}
                      </span>
                    ) : null}
                  </div>

                  <p className="row-meta">
                    {catalog.table.seatMeta(player.seatIndex, player.isHost)}
                  </p>
                </div>

                <div className="status-pills player-status-pills">
                  {player.isHost ? (
                    <span className="pill connected">
                      <CrownIcon className="status-icon" />
                      {t('host')}
                    </span>
                  ) : null}
                  {player.isBot ? (
                    <span className="pill bot">
                      <BotIcon className="status-icon" />
                      {t('bot')}
                    </span>
                  ) : null}
                  <span
                    className={player.isEliminated ? 'pill idle' : 'pill ready'}
                  >
                    <CardsIcon className="status-icon" />
                    {player.isEliminated
                      ? t('spectating')
                      : isDealing
                        ? catalog.table.dealtProgress(
                            displayedCardCount,
                            player.cardCount,
                          )
                        : catalog.table.dealtCount(player.cardCount)}
                  </span>
                  {isDisconnected ? (
                    <span className="pill idle">
                      <SignalIcon className="status-icon" />
                      {t('offline')}
                    </span>
                  ) : null}
                </div>
              </div>
            </summary>

            <div className="player-details-body">
              {revealedHand && revealedHand.length > 0 ? (
                <div className="player-live-hand">
                  <p className="claim-panel-label">{catalog.table.liveHand}</p>
                  <ClaimCardStack cards={revealedHand} compact />
                </div>
              ) : null}

              {isSelfSpectatorRow ? (
                <div className="player-spectator-controls">
                  <p className="row-meta">
                    {spectatorView?.revealCardsEnabled
                      ? catalog.table.spectatorRevealOn
                      : catalog.table.spectatorRevealOff}
                  </p>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={
                      !isConnected ||
                      pendingCommand !== null ||
                      currentMatch.phase === 'showing-result'
                    }
                    onClick={() =>
                      onSetSpectatorCardReveal(
                        !(spectatorView?.revealCardsEnabled ?? false),
                      )
                    }
                  >
                    {spectatorView?.revealCardsEnabled
                      ? catalog.table.hideLiveCards
                      : catalog.table.revealLiveCards}
                  </button>
                </div>
              ) : null}

              {section === 'active' && (canKickPlayer || canStopPlaying) ? (
                <div className="player-row-actions">
                  {canKickPlayer ? (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!isConnected || pendingCommand !== null}
                      onClick={() => onKickPlayer(player.playerId)}
                    >
                      {catalog.table.kick}
                    </button>
                  ) : null}

                  {canStopPlaying ? (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!isConnected || pendingCommand !== null}
                      onClick={onBecomeSpectator}
                    >
                      {catalog.table.stopPlaying}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {playerClaims.length > 0 ? (
                <div className="player-claim-history">
                  {playerClaims.map((entry) => (
                    <div
                      key={entry.sequenceNumber}
                      className="player-claim-chip"
                      aria-label={formatClaimLabel(entry.claim)}
                      title={formatClaimCompactLabel(entry.claim)}
                    >
                      <ClaimCardStack
                        cards={claimToIllustrationCards(entry.claim)}
                        compact
                      />
                      <span className="player-claim-label">
                        {formatClaimCompactLabel(entry.claim)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="row-meta">
                  {section === 'spectator'
                    ? isSelfSpectatorRow
                      ? catalog.table.stayAsSpectator
                      : catalog.table.watchingFromRail
                    : isDisconnected && canKickPlayer
                      ? catalog.table.reconnectKickHint
                      : catalog.table.noClaimsYet}
                </p>
              )}
            </div>
          </details>
        </li>
      );
    }

    return (
      <section className="side-panel-section">
        <div className="side-panel-header">
          <h2>{t('players')}</h2>

          <span className="pill connected">
            <ReadyIcon className="status-icon" />
            {catalog.table.activeCount(liveActivePlayers.length)}
          </span>
        </div>

        <ul className="player-list">
          {activeDrawerPlayers.map((player) =>
            renderPlayerRow(player, 'active'),
          )}
        </ul>

        {spectatorPlayers.length > 0 ? (
          <div className="side-panel-section split-top">
            <div className="side-panel-header">
              <h2>{t('spectators')}</h2>
              <span className="pill idle">
                {catalog.table.watchingCount(spectatorPlayers.length)}
              </span>
            </div>

            <ul className="player-list">
              {spectatorPlayers.map((player) =>
                renderPlayerRow(player, 'spectator'),
              )}
            </ul>
          </div>
        ) : null}
      </section>
    );
  }

  function renderHiddenCardFan({
    count,
    className,
  }: {
    count: number;
    className?: string;
  }) {
    const visibleCount = Math.max(1, Math.min(count, 3));
    const hiddenCardOffsets = Array.from(
      { length: visibleCount },
      (_, slotIndex) => slotIndex - (visibleCount - 1) / 2,
    );

    return (
      <div
        className={`poker-hidden-card-fan ${className ?? ''}`.trim()}
        aria-hidden="true"
      >
        {hiddenCardOffsets.map((offset) => {
          return (
            <span
              key={`${count}-${offset}`}
              className="poker-hidden-card"
              style={
                {
                  '--poker-hidden-card-offset': `${offset * 0.72}rem`,
                  '--poker-hidden-card-rotation': `${offset * 10}deg`,
                } as CSSProperties
              }
            />
          );
        })}
      </div>
    );
  }

  function renderOpponentAnchors() {
    return (
      <div className="poker-seat-ring" aria-label="Opponent seats">
        {opponentPlayers.map((player, index) => {
          const slot = opponentSeatSlots[index];

          if (!slot) {
            return null;
          }

          const isCurrentTurn = player.playerId === currentTurnPlayerId;
          const isTurnArriving = turnAnnouncement?.playerId === player.playerId;
          const isDisconnected = player.connectionStatus === 'disconnected';
          const displayedCardCount =
            displayedCardCountByPlayerId.get(player.playerId) ??
            player.cardCount;
          const revealedHand = spectatorRevealedHandsByPlayerId.get(
            player.playerId,
          );
          const visibleRevealedHand =
            spectatorView?.revealCardsEnabled && revealedHand
              ? sortCardsDescending(revealedHand).slice(
                  0,
                  isDealing ? displayedCardCount : revealedHand.length,
                )
              : [];
          const isLowCards = !player.isEliminated && player.cardCount <= 1;
          const isJustClaimed = claimPulse?.playerId === player.playerId;
          const seatCopy = buildSeatAnchorCopy({
            labels: {
              you: t('you'),
              bot: t('bot'),
              host: t('host'),
              out: t('out'),
              offline: t('offline'),
              acting: t('acting'),
              paused: t('paused'),
              pressure: t('pressure'),
            },
            player,
            isCurrentTurn,
            isLowCards,
            isDisconnected,
            isSelf: false,
            isPaused,
          });
          const timerTone = isCurrentTurn ? timerUrgency : undefined;
          const slotSideClass =
            slot.leftPct < 50
              ? 'is-left'
              : slot.leftPct > 50
                ? 'is-right'
                : 'is-center';

          return (
            <article
              key={player.playerId}
              className={`poker-seat-anchor poker-seat-anchor-opponent seat-slot-${slot.variant} ${slotSideClass} ${getSeatToneClass(player.seatIndex)} ${isCurrentTurn ? 'is-current-turn' : ''} ${player.isEliminated ? 'is-eliminated' : ''} ${isTurnArriving ? 'is-turn-arriving' : ''} ${isJustClaimed ? 'is-just-claimed' : ''} ${isDisconnected ? 'is-disconnected' : ''} ${isLowCards ? 'is-low-cards' : ''}`}
              style={buildTableSeatStyle(slot)}
              aria-label={catalog.table.seatHandAria(
                player.name,
                displayedCardCount,
                isDealing,
              )}
            >
              <div className="poker-seat-anchor-head">
                <div className="poker-seat-avatar-wrap">
                  <PlayerAvatar
                    name={player.name}
                    seatIndex={player.seatIndex}
                    size="sm"
                    {...(isCurrentTurn && turnProgress !== undefined
                      ? {
                          timerProgress: turnProgress,
                          timerTone,
                        }
                      : {})}
                  />
                  <span
                    className={`poker-seat-count ${player.isEliminated ? 'is-eliminated' : ''} ${isCurrentTurn ? 'is-current-turn' : ''} ${isLowCards ? 'is-low-cards' : ''}`}
                  >
                    {player.isEliminated ? t('out') : displayedCardCount}
                  </span>
                </div>

                {!isShowingResult && visibleRevealedHand.length > 0 ? (
                  <div className="poker-seat-live-hand" aria-hidden="true">
                    <ClaimCardStack cards={visibleRevealedHand} compact />
                  </div>
                ) : !isShowingResult &&
                  (!isDealing || displayedCardCount > 0) ? (
                  renderHiddenCardFan({
                    count: Math.max(displayedCardCount, 1),
                    className: 'poker-seat-fan',
                  })
                ) : null}
              </div>

              <div className="poker-seat-chip">
                <strong>{player.name}</strong>
                <div className="poker-seat-flags">
                  {seatCopy.roleChipLabel ? (
                    <span className="poker-seat-tag">
                      {player.isBot ? (
                        <BotIcon className="poker-seat-chip-icon" />
                      ) : null}
                      {player.isHost && !player.isBot ? (
                        <CrownIcon className="poker-seat-chip-icon" />
                      ) : null}
                      {seatCopy.roleChipLabel}
                    </span>
                  ) : null}
                  {seatCopy.stateChipLabel ? (
                    <span
                      className={`poker-seat-tag is-state ${player.isEliminated ? 'is-eliminated' : ''} ${isDisconnected ? 'is-offline' : ''} ${isCurrentTurn ? 'is-current-turn' : ''} ${isLowCards ? 'is-pressure' : ''}`}
                    >
                      {seatCopy.stateChipLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  function renderSelfAnchor() {
    if (!selfPlayer) {
      return null;
    }

    const isCurrentTurn = selfPlayer.playerId === currentTurnPlayerId;
    const isDisconnected = selfPlayer.connectionStatus === 'disconnected';
    const displayedCardCount =
      displayedCardCountByPlayerId.get(selfPlayer.playerId) ??
      selfPlayer.cardCount;
    const isLowCards = !selfPlayer.isEliminated && selfPlayer.cardCount <= 1;
    const seatCopy = buildSeatAnchorCopy({
      labels: {
        you: t('you'),
        bot: t('bot'),
        host: t('host'),
        out: t('out'),
        offline: t('offline'),
        acting: t('acting'),
        paused: t('paused'),
        pressure: t('pressure'),
      },
      player: selfPlayer,
      isCurrentTurn,
      isLowCards,
      isDisconnected,
      isSelf: true,
      isPaused,
    });

    return (
      <section
        className={`poker-self-rail ${getSeatToneClass(selfPlayer.seatIndex)} ${isCurrentTurn ? 'is-current-turn' : ''} ${selfPlayer.isEliminated ? 'is-eliminated' : ''} ${isDisconnected ? 'is-disconnected' : ''} ${isShowingResult ? 'is-showing-result' : ''}`}
        aria-label={catalog.table.yourSeat}
      >
        <div className="poker-self-identity">
          <div className="poker-seat-avatar-wrap">
            <PlayerAvatar
              name={selfPlayer.name}
              seatIndex={selfPlayer.seatIndex}
              size="md"
              {...(isCurrentTurn && turnProgress !== undefined
                ? {
                    timerProgress: turnProgress,
                    timerTone: timerUrgency,
                  }
                : {})}
            />
            <span
              className={`poker-seat-count ${selfPlayer.isEliminated ? 'is-eliminated' : ''} ${isCurrentTurn ? 'is-current-turn' : ''} ${isLowCards ? 'is-low-cards' : ''}`}
            >
              {selfPlayer.isEliminated ? t('out') : displayedCardCount}
            </span>
          </div>

          <div className="poker-self-copy">
            <div className="poker-seat-chip is-self">
              <strong>{selfPlayer.name}</strong>
              <div className="poker-seat-flags">
                {seatCopy.roleChipLabel ? (
                  <span className="poker-seat-tag">
                    {seatCopy.roleChipLabel}
                  </span>
                ) : null}
                {seatCopy.stateChipLabel ? (
                  <span
                    className={`poker-seat-tag is-state ${selfPlayer.isEliminated ? 'is-eliminated' : ''} ${isDisconnected ? 'is-offline' : ''} ${isCurrentTurn ? 'is-current-turn' : ''} ${isLowCards ? 'is-pressure' : ''}`}
                  >
                    {seatCopy.stateChipLabel}
                  </span>
                ) : null}
              </div>
            </div>

            <span className="poker-self-hand-label">
              {catalog.table.yourHand(
                isDealing ? displayedCardCount : yourHand.length,
              )}
            </span>
          </div>
        </div>

        {!isShowingResult ? (
          <div className="poker-self-hand">
            {isDealing ? (
              <div
                className="poker-self-dealt-hand"
                aria-label={catalog.table.selfDealtHandAria}
              >
                {Array.from({ length: displayedCardCount }, (_, cardIndex) => (
                  <span
                    key={`${selfPlayer.playerId}-deal-${cardIndex + 1}`}
                    className="poker-self-dealt-card"
                  />
                ))}
              </div>
            ) : (
              <ClaimCardStack cards={sortCardsDescending(yourHand)} />
            )}
          </div>
        ) : null}
      </section>
    );
  }

  function renderClaimPot() {
    if (winner || isShowingResult || !claimPotCopy) {
      return null;
    }

    const outgoingClaim = claimTransition.outgoingEntry?.claim;
    const outgoingPlayerName = claimTransition.outgoingEntry
      ? (playersById.get(claimTransition.outgoingEntry.playerId)?.name ??
        catalog.showdown.unknownPlayer)
      : undefined;
    const activeClaim = currentMatch.lastClaim;

    return (
      <section
        className={`poker-claim-pot ${activeClaim ? 'has-claim' : 'is-opening'} ${isDealing ? 'is-dealing' : ''} ${isPaused ? 'is-paused' : ''} ${claimTransition.phase === 'entering' ? 'is-entering' : ''} ${claimTransition.phase === 'swapping' ? 'is-swapping' : ''}`}
        aria-label={catalog.table.currentClaimLabel}
      >
        <div className="poker-claim-pot-frame">
          <div className="poker-claim-pot-visual">
            {outgoingClaim && claimTransition.phase === 'swapping' ? (
              <div className="poker-claim-pot-layer is-outgoing">
                <ClaimCardStack
                  cards={claimToIllustrationCards(outgoingClaim)}
                  compact
                />
                <span className="poker-claim-pot-layer-text">
                  {outgoingPlayerName
                    ? catalog.table.claimPotLine(
                        outgoingPlayerName,
                        formatClaimCompactLabel(outgoingClaim),
                      )
                    : formatClaimCompactLabel(outgoingClaim)}
                </span>
              </div>
            ) : null}

            {activeClaim ? (
              <div className="poker-claim-pot-layer is-current">
                <ClaimCardStack
                  cards={claimToIllustrationCards(activeClaim)}
                  compact
                />
                <span className="poker-claim-pot-layer-text">
                  {lastClaimPlayer
                    ? catalog.table.claimPotLine(
                        lastClaimPlayer.name,
                        formatClaimCompactLabel(activeClaim),
                      )
                    : formatClaimCompactLabel(activeClaim)}
                </span>
              </div>
            ) : (
              <div className="poker-claim-pot-opening" aria-hidden="true">
                <span className="poker-claim-pot-opening-dot" />
              </div>
            )}
          </div>

          <div className="poker-claim-pot-copy">
            <span className="poker-object-label">{claimPotCopy.label}</span>
            <strong className="poker-claim-pot-title">
              {claimPotCopy.title}
            </strong>
            {claimPotCopy.detail ? (
              <span className="poker-claim-pot-detail">
                {claimPotCopy.detail}
              </span>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  function renderDeckObject() {
    if (winner || isShowingResult) {
      return null;
    }

    return (
      <div
        className={`poker-table-deck ${isDealing ? 'is-dealing' : ''}`}
        aria-label={`${catalog.table.cardsInRound} ${cardsInRound}`}
      >
        <div className="poker-table-deck-stack" aria-hidden="true">
          <span className="poker-table-deck-card poker-table-deck-card-back" />
          <span className="poker-table-deck-card poker-table-deck-card-back" />
          <span className="poker-table-deck-card poker-table-deck-card-back is-front" />
        </div>

        <div className="poker-table-deck-chip">
          <span className="poker-object-label">
            {isDealing ? catalog.table.dealingNow : catalog.table.cardsInRound}
          </span>
          <strong>{cardsInRound}</strong>
        </div>
      </div>
    );
  }

  function renderDealLayer() {
    if (!isDealing || !currentMatch.dealing) {
      return null;
    }

    return (
      <div className="poker-deal-layer" aria-label={catalog.table.dealingAria}>
        <div className="poker-deal-origin" aria-hidden="true" />

        {activeDealFlights.map((flight) => {
          const seatPosition = dealSeatPositions[flight.playerId];

          if (!seatPosition) {
            return null;
          }

          return (
            <span
              key={`${flight.playerId}:${flight.cardOrdinal}:${flight.startsAtMs}`}
              className="poker-deal-flight-card"
              style={buildDealFlightStyle(
                buildSeatDealTargetPosition(seatPosition),
                dealElapsedMs,
                flight.startsAtMs,
              )}
            />
          );
        })}
      </div>
    );
  }

  function renderWinnerPot() {
    if (!winner || isShowingResult) {
      return null;
    }

    return (
      <section
        className="poker-winner-pot"
        aria-label={catalog.table.matchWinner}
      >
        <PlayerAvatar
          name={winner.name}
          seatIndex={winner.seatIndex}
          size="lg"
        />
        <div className="poker-winner-copy">
          <span className="poker-object-label">
            {catalog.table.matchWinner}
          </span>
          <strong>{winner.name}</strong>
          <span>{catalog.table.matchClosed}</span>
        </div>
      </section>
    );
  }

  function renderClaimComposerPopup() {
    if (!isClaimComposerVisible) {
      return null;
    }

    const currentLastClaim = currentMatch.lastClaim;

    return (
      <div
        className={`poker-claim-popup-overlay is-${claimComposerStage}`}
        role="presentation"
      >
        <button
          type="button"
          className="poker-claim-popup-scrim"
          onClick={closeClaimComposer}
          aria-label={catalog.table.closeClaimBuilder}
        />

        <dialog
          open
          className="poker-claim-popup-shell"
          aria-modal="true"
          aria-label={t('claimBuilder')}
        >
          <div className="poker-claim-popup-header">
            <div className="poker-claim-popup-copy">
              <p className="eyebrow">{t('claimBuilder')}</p>
              <h2>{t('buildYourClaim')}</h2>
              <p className="claim-helper-text">
                {selectedComposerClaim
                  ? catalog.table.selectedClaim(
                      formatClaimCompactLabel(selectedComposerClaim),
                    )
                  : currentLastClaim
                    ? catalog.table.strongerClaimPrompt
                    : catalog.table.openingClaimPrompt}
              </p>
            </div>

            <button
              type="button"
              className="ghost-button poker-table-control-button poker-claim-popup-close"
              onClick={closeClaimComposer}
            >
              {t('close')}
            </button>
          </div>

          <ClaimComposer
            claimOrderPreset={snapshot.settings.claimOrderPreset}
            flushRule={snapshot.settings.flushRule}
            yourHand={yourHand}
            cardsInRound={cardsInRound}
            disabled={actionDisabled}
            {...(currentLastClaim ? { lastClaim: currentLastClaim } : {})}
            onSelectedClaimChange={setSelectedComposerClaim}
            onSubmit={(claimKey) => {
              closeClaimComposer();
              onSubmitClaim(claimKey);
            }}
          />
        </dialog>
      </div>
    );
  }

  return (
    <section className="surface-grid match-layout">
      <article className="hero-panel poker-match-shell">
        <div className="poker-match-header">
          <div className="poker-match-copy">
            <p className="eyebrow">{t('match')}</p>
            <h1>{catalog.table.roundTitle(match.roundNumber)}</h1>
            <p className="lead">
              {winner
                ? catalog.table.winnerMessage(winner.name)
                : isDealing
                  ? catalog.table.dealingLead
                  : isShowingResult
                    ? catalog.table.resolvingLead
                    : isPaused
                      ? catalog.table.pausedLead(
                          currentPlayer?.name ?? catalog.table.activePlayer,
                        )
                      : isMyTurn
                        ? catalog.table.yourTurnLead
                        : catalog.table.actingLead(
                            currentPlayer?.name ?? catalog.table.activePlayer,
                          )}
            </p>
          </div>
        </div>

        <div
          className={`poker-table-stage ${timerUrgency === 'warning' ? 'is-warning-clock' : ''} ${timerUrgency === 'critical' ? 'is-critical-clock' : ''} ${isResolutionStageOpen ? 'is-showing-result' : ''}`}
        >
          <div className="poker-table-scenery" aria-hidden="true">
            <div className="poker-table-ambient poker-table-ambient-left" />
            <div className="poker-table-ambient poker-table-ambient-right" />
            <div className="poker-table-ambient-center" />
            <div className="poker-table-foreground-glow" />
          </div>

          <div className="poker-table-stage-inner">
            <div
              className={`poker-table-controls poker-table-controls-left ${isResolutionStageOpen ? 'is-result-dimmed' : ''}`}
            >
              <button
                type="button"
                className="ghost-button poker-table-control-button"
                aria-expanded={isTablePanelOpen}
                aria-controls="table-drawer"
                disabled={isShowingResult}
                onClick={() => {
                  setIsChatPanelOpen(false);
                  onSetTablePanelOpen(!isTablePanelOpen);
                }}
              >
                <SeatsIcon className="status-icon" />
                {isTablePanelOpen ? catalog.table.hidePlayers : t('players')}
              </button>

              <button
                type="button"
                className="ghost-button poker-table-control-button"
                aria-expanded={isChatPanelOpen}
                aria-controls="chat-drawer"
                disabled={isShowingResult}
                onClick={() => {
                  onSetTablePanelOpen(false);
                  setIsChatPanelOpen((current) => !current);
                }}
              >
                <ChatIcon className="status-icon" />
                {isChatPanelOpen ? catalog.table.hideChat : t('chat')}
              </button>

              {isHost && turnTimer && !winner ? (
                <button
                  type="button"
                  className="ghost-button poker-table-control-button"
                  onClick={() => onSetPauseState(!isPaused)}
                  disabled={
                    !isConnected || pendingCommand !== null || isShowingResult
                  }
                >
                  {isPaused ? t('resume') : t('pause')}
                </button>
              ) : null}
            </div>

            <div
              className={`poker-table-controls poker-table-controls-right ${isResolutionStageOpen ? 'is-result-dimmed' : ''}`}
            >
              <span className="pill ready poker-table-status">
                <CardsIcon className="status-icon" />
                {catalog.table.roomCode(snapshot.roomCode)}
              </span>
              {isDealing ? (
                <span className="pill ready poker-table-status poker-table-dealing-status">
                  <CardsIcon className="status-icon" />
                  {catalog.table.dealingNow}
                </span>
              ) : null}
              {turnTimer && remainingMs !== null ? (
                <span
                  className={`${isPaused ? 'pill idle' : 'pill connected'} poker-table-status poker-table-timer timer-pill-${timerUrgency}`}
                >
                  <TimerIcon className="status-icon" />
                  {isPaused ? t('paused') : formatRemainingMs(remainingMs)}
                </span>
              ) : null}
              <span
                className={`${isConnected ? 'pill connected' : 'pill idle'} poker-table-status`}
              >
                <SignalIcon className="status-icon" />
                {isConnected ? t('live') : t('reconnecting')}
              </span>
            </div>

            {turnAnnouncement ? (
              <div
                key={turnAnnouncement.token}
                className={`poker-turn-banner ${turnAnnouncement.playerId === snapshot.selfPlayerId ? 'is-self' : ''}`}
              >
                <span className="poker-turn-banner-kicker">
                  {catalog.table.turnHandoff}
                </span>
                <strong>
                  {turnAnnouncement.playerId === snapshot.selfPlayerId
                    ? catalog.table.yourMove
                    : catalog.table.playerToAct(
                        playersById.get(turnAnnouncement.playerId)?.name ??
                          catalog.table.activePlayer,
                      )}
                </strong>
              </div>
            ) : null}

            {renderClaimPot()}
            {renderDeckObject()}
            {renderDealLayer()}
            {renderWinnerPot()}
            {renderOpponentAnchors()}
            {renderSelfAnchor()}
            {activeResolution && isResolutionStageOpen ? (
              <RoundResolutionOverlay
                result={activeResolution}
                players={snapshot.players}
                seatPositions={resolutionSeatPositions}
                nowMs={nowMs}
              />
            ) : null}
            {renderClaimComposerPopup()}
          </div>
        </div>

        <div
          className={`poker-footer ${isClaimComposerVisible ? 'has-open-tray' : ''} ${isResolutionStageOpen ? 'is-result-dimmed' : ''}`}
        >
          <div className="poker-footer-note">{dockMessage}</div>

          {winner ? (
            <div className="poker-footer-dock">
              {isHost ? (
                <button
                  type="button"
                  className="poker-footer-button poker-footer-button-primary poker-footer-button-wide"
                  onClick={onRestartMatch}
                >
                  {catalog.table.returnToLobby}
                </button>
              ) : (
                <div className="poker-footer-placeholder">
                  {catalog.table.waitingForHost}
                </div>
              )}
            </div>
          ) : isSpectator ? (
            <div className="poker-footer-dock poker-footer-dock-spectator">
              <div className="poker-footer-placeholder poker-footer-spectator-note">
                <strong>{catalog.table.spectatingFromRail}</strong>
                <span>
                  {spectatorView?.revealCardsEnabled
                    ? catalog.table.canSeeActiveHands
                    : catalog.table.revealPrompt}
                </span>
              </div>
              <button
                type="button"
                className={`poker-footer-button poker-footer-button-wide ${
                  spectatorView?.revealCardsEnabled
                    ? 'poker-footer-button-check'
                    : 'poker-footer-button-primary'
                }`}
                disabled={
                  !isConnected ||
                  pendingCommand !== null ||
                  currentMatch.phase === 'showing-result'
                }
                onClick={() =>
                  onSetSpectatorCardReveal(
                    !(spectatorView?.revealCardsEnabled ?? false),
                  )
                }
              >
                <span className="poker-footer-button-copy">
                  <span className="poker-footer-button-kicker">
                    {spectatorView?.revealCardsEnabled
                      ? catalog.table.hideActiveHands
                      : catalog.table.spectatorMode}
                  </span>
                  <strong className="poker-footer-button-label">
                    {spectatorView?.revealCardsEnabled
                      ? catalog.table.hideLiveCards
                      : catalog.table.revealLiveCards}
                  </strong>
                </span>
              </button>
            </div>
          ) : (
            <>
              <div className="poker-footer-zone">
                <div className="poker-footer-dock">
                  <button
                    type="button"
                    className={`poker-footer-button poker-footer-button-primary ${isClaimComposerVisible ? 'is-open' : ''}`}
                    onClick={() => {
                      if (isClaimComposerVisible) {
                        closeClaimComposer();
                        return;
                      }

                      openClaimComposer();
                    }}
                    disabled={!canOpenClaimComposer}
                  >
                    <span className="poker-footer-button-copy">
                      <span className="poker-footer-button-kicker">
                        {selectedComposerClaim
                          ? formatClaimCompactLabel(selectedComposerClaim)
                          : match.lastClaim
                            ? catalog.table.raiseTheTable
                            : catalog.table.startTheRound}
                      </span>
                      <strong className="poker-footer-button-label">
                        {isClaimComposerVisible
                          ? catalog.table.closeBuilder
                          : selectedComposerClaim
                            ? catalog.table.editClaim
                            : match.lastClaim
                              ? catalog.table.buildClaim
                              : catalog.table.openClaim}
                      </strong>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="poker-footer-button poker-footer-button-check"
                    onClick={onChallengeClaim}
                    disabled={checkDisabled}
                  >
                    <span className="poker-footer-button-copy">
                      <span className="poker-footer-button-kicker">
                        {catalog.table.callItNow}
                      </span>
                      <strong className="poker-footer-button-label">
                        {catalog.table.check}
                      </strong>
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </article>

      <button
        type="button"
        className={`table-drawer-backdrop ${isTablePanelOpen || isChatPanelOpen ? 'is-open' : ''}`}
        onClick={() => {
          onSetTablePanelOpen(false);
          setIsChatPanelOpen(false);
        }}
        aria-label={catalog.table.closeSidePanels}
        tabIndex={isTablePanelOpen || isChatPanelOpen ? 0 : -1}
      />

      <aside
        id="table-drawer"
        className={`panel table-drawer ${isTablePanelOpen ? 'is-open' : ''}`}
        aria-hidden={!isTablePanelOpen}
      >
        <div className="table-drawer-header">
          <div>
            <p className="eyebrow">{t('players')}</p>
            <h2>{t('tableOrder')}</h2>
          </div>

          <button
            type="button"
            className="ghost-button"
            onClick={() => onSetTablePanelOpen(false)}
          >
            {t('close')}
          </button>
        </div>

        {renderPlayerTableSection()}
      </aside>

      <aside
        id="chat-drawer"
        className={`panel chat-drawer ${isChatPanelOpen ? 'is-open' : ''}`}
        aria-hidden={!isChatPanelOpen}
      >
        <div className="table-drawer-header">
          <div>
            <p className="eyebrow">{t('chat')}</p>
            <h2>{t('roomChat')}</h2>
          </div>

          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsChatPanelOpen(false)}
          >
            {t('close')}
          </button>
        </div>

        <div className="chat-drawer-content">{renderChatRailContent(true)}</div>
      </aside>
    </section>
  );
}
