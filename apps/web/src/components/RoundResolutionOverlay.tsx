import { type CSSProperties, useMemo, useRef } from 'react';

import {
  type Card,
  type Claim,
  type PlayerSnapshot,
  RESOLUTION_REVEAL_START_DELAY_MS,
  RESOLUTION_REVEAL_STEP_MS,
  RESOLUTION_SHOWDOWN_DRAW_STEP_MS,
  RESOLUTION_SHOWDOWN_FINAL_RESOLVE_MS,
  RESOLUTION_SHOWDOWN_SUSPENSE_DELAY_MS,
  RESOLUTION_TIMEOUT_FINAL_RESOLVE_MS,
  type Rank,
  SUIT_SYMBOLS,
  type ShowdownSnapshot,
  type TimeoutSnapshot,
  buildClaimConstruction,
  cardToKey,
  sortCardsDescending,
} from '@bluff-game/shared';

import { claimToIllustrationCards } from '../lib/claimVisuals.js';
import { useLocale } from '../lib/i18n/index.js';
import { ClaimCardStack } from './ClaimPreview.js';
import { PokerCardFace } from './PokerCardFace.js';

type ResolutionResult =
  | {
      kind: 'showdown';
      key: string;
      data: ShowdownSnapshot;
    }
  | {
      kind: 'timeout';
      key: string;
      data: TimeoutSnapshot;
    };

interface RoundResolutionOverlayProps {
  result: ResolutionResult;
  players: PlayerSnapshot[];
  seatPositions: Record<string, ResolutionSeatPosition>;
  nowMs: number;
}

export interface ResolutionSeatPosition {
  leftPct: number;
  topPct: number;
  placement:
    | 'top'
    | 'side-left'
    | 'side-right'
    | 'corner-left'
    | 'corner-right'
    | 'self';
}

const SUCCESS_FIREFLIES = [
  {
    leftPct: 12,
    topPct: 18,
    driftXPx: 14,
    driftYPx: -10,
    durationMs: 1960,
    delayMs: -340,
  },
  {
    leftPct: 22,
    topPct: 28,
    driftXPx: -10,
    driftYPx: 14,
    durationMs: 2280,
    delayMs: -680,
  },
  {
    leftPct: 33,
    topPct: 14,
    driftXPx: 12,
    driftYPx: 10,
    durationMs: 1880,
    delayMs: -1260,
  },
  {
    leftPct: 41,
    topPct: 24,
    driftXPx: -8,
    driftYPx: -16,
    durationMs: 2140,
    delayMs: -910,
  },
  {
    leftPct: 54,
    topPct: 12,
    driftXPx: 8,
    driftYPx: 12,
    durationMs: 2400,
    delayMs: -430,
  },
  {
    leftPct: 67,
    topPct: 18,
    driftXPx: -12,
    driftYPx: 12,
    durationMs: 2100,
    delayMs: -1180,
  },
  {
    leftPct: 79,
    topPct: 30,
    driftXPx: 10,
    driftYPx: -14,
    durationMs: 2320,
    delayMs: -520,
  },
  {
    leftPct: 86,
    topPct: 20,
    driftXPx: -14,
    driftYPx: 8,
    durationMs: 2020,
    delayMs: -1430,
  },
  {
    leftPct: 18,
    topPct: 54,
    driftXPx: 10,
    driftYPx: -12,
    durationMs: 2210,
    delayMs: -760,
  },
  {
    leftPct: 34,
    topPct: 62,
    driftXPx: -12,
    driftYPx: 10,
    durationMs: 1940,
    delayMs: -1510,
  },
  {
    leftPct: 62,
    topPct: 58,
    driftXPx: 14,
    driftYPx: -8,
    durationMs: 2360,
    delayMs: -860,
  },
  {
    leftPct: 80,
    topPct: 48,
    driftXPx: -10,
    driftYPx: 14,
    durationMs: 2060,
    delayMs: -1110,
  },
] as const;

const DRAW_CARD_FLIGHT_MS = 520;
const REVEAL_FLIP_DELAY_MS = 220;

interface DisplayHand {
  playerId: string;
  cards: Card[];
}

interface ExpectedSlotSpec {
  rankLabel?: string;
  suitSymbol?: string;
}

interface ConstructionSource {
  card: Card;
  key: string;
  sourceType: 'seat' | 'deck';
  playerId?: string;
  revealIndex?: number;
  drawIndex?: number;
  placement: ResolutionSeatPosition['placement'] | undefined;
}

function rotateHandsForReveal(
  hands: DisplayHand[],
  players: PlayerSnapshot[],
  startPlayerId: string,
): DisplayHand[] {
  const handsByPlayerId = new Map(hands.map((hand) => [hand.playerId, hand]));
  const orderedPlayers = [...players]
    .filter((player) => handsByPlayerId.has(player.playerId))
    .sort((left, right) => left.seatIndex - right.seatIndex);
  const startIndex = orderedPlayers.findIndex(
    (player) => player.playerId === startPlayerId,
  );

  if (startIndex === -1) {
    return orderedPlayers
      .map((player) => handsByPlayerId.get(player.playerId))
      .filter((hand): hand is DisplayHand => Boolean(hand));
  }

  return [
    ...orderedPlayers.slice(startIndex),
    ...orderedPlayers.slice(0, startIndex),
  ]
    .map((player) => handsByPlayerId.get(player.playerId))
    .filter((hand): hand is DisplayHand => Boolean(hand));
}

function buildStraightRankLabels(
  lowRank: number,
  rankLabels: Record<Rank, string>,
): string[] {
  if (lowRank === 1) {
    return [
      rankLabels[14],
      rankLabels[2],
      rankLabels[3],
      rankLabels[4],
      rankLabels[5],
    ];
  }

  return Array.from(
    { length: 5 },
    (_, index) => rankLabels[(lowRank + index) as Rank],
  );
}

function buildExpectedSlotSpecs(
  claim: Claim,
  formatRankLabel: (rank: Rank) => string,
): ExpectedSlotSpec[] {
  switch (claim.category) {
    case 'high-card':
      return [{ rankLabel: formatRankLabel(claim.rank) }];
    case 'pair':
      return Array.from({ length: 2 }, () => ({
        rankLabel: formatRankLabel(claim.pairRank),
      }));
    case 'two-pair':
      return [
        ...Array.from({ length: 2 }, () => ({
          rankLabel: formatRankLabel(claim.highPairRank),
        })),
        ...Array.from({ length: 2 }, () => ({
          rankLabel: formatRankLabel(claim.lowPairRank),
        })),
      ];
    case 'three-of-a-kind':
      return Array.from({ length: 3 }, () => ({
        rankLabel: formatRankLabel(claim.tripRank),
      }));
    case 'straight':
      return buildStraightRankLabels(claim.lowRank, {
        2: formatRankLabel(2),
        3: formatRankLabel(3),
        4: formatRankLabel(4),
        5: formatRankLabel(5),
        6: formatRankLabel(6),
        7: formatRankLabel(7),
        8: formatRankLabel(8),
        9: formatRankLabel(9),
        10: formatRankLabel(10),
        11: formatRankLabel(11),
        12: formatRankLabel(12),
        13: formatRankLabel(13),
        14: formatRankLabel(14),
      }).map((rankLabel) => ({
        rankLabel,
      }));
    case 'flush':
      return claim.rank === undefined
        ? Array.from({ length: 5 }, () => ({
            suitSymbol: SUIT_SYMBOLS[claim.suit],
          }))
        : [
            ...Array.from({ length: 4 }, () => ({
              suitSymbol: SUIT_SYMBOLS[claim.suit],
            })),
            {
              rankLabel: formatRankLabel(claim.rank),
              suitSymbol: SUIT_SYMBOLS[claim.suit],
            },
          ];
    case 'full-house':
      return [
        ...Array.from({ length: 3 }, () => ({
          rankLabel: formatRankLabel(claim.tripRank),
        })),
        ...Array.from({ length: 2 }, () => ({
          rankLabel: formatRankLabel(claim.pairRank),
        })),
      ];
    case 'four-of-a-kind':
      return Array.from({ length: 4 }, () => ({
        rankLabel: formatRankLabel(claim.quadRank),
      }));
    case 'straight-flush':
      return buildStraightRankLabels(claim.lowRank, {
        2: formatRankLabel(2),
        3: formatRankLabel(3),
        4: formatRankLabel(4),
        5: formatRankLabel(5),
        6: formatRankLabel(6),
        7: formatRankLabel(7),
        8: formatRankLabel(8),
        9: formatRankLabel(9),
        10: formatRankLabel(10),
        11: formatRankLabel(11),
        12: formatRankLabel(12),
        13: formatRankLabel(13),
        14: formatRankLabel(14),
      }).map((rankLabel) => ({
        rankLabel,
        suitSymbol: SUIT_SYMBOLS[claim.suit],
      }));
  }
}

function buildPlayerRole(
  playerId: string,
  result: ResolutionResult,
  isResolved: boolean,
  labels: {
    lost: string;
    checked: string;
    checker: string;
    timedOut: string;
  },
): string | null {
  if (result.kind === 'showdown') {
    if (playerId === result.data.loserPlayerId) {
      return isResolved ? labels.lost : null;
    }

    if (playerId === result.data.claimantPlayerId) {
      return labels.checked;
    }

    if (playerId === result.data.challengerPlayerId) {
      return labels.checker;
    }

    return null;
  }

  if (playerId === result.data.timedOutPlayerId) {
    return isResolved ? labels.timedOut : null;
  }

  return null;
}

function buildSeatRevealStyle(
  seatPosition: ResolutionSeatPosition,
): CSSProperties {
  return {
    '--poker-result-seat-left': `${seatPosition.leftPct}%`,
    '--poker-result-seat-top': `${seatPosition.topPct}%`,
  } as CSSProperties;
}

function getConstructionFlightOrigin(source: ConstructionSource | undefined): {
  xPx: number;
  yPx: number;
} {
  if (!source) {
    return { xPx: 0, yPx: 0 };
  }

  if (source.sourceType === 'deck') {
    return { xPx: -118, yPx: -148 };
  }

  switch (source.placement) {
    case 'top':
      return { xPx: 0, yPx: -176 };
    case 'side-left':
      return { xPx: -210, yPx: -36 };
    case 'side-right':
      return { xPx: 210, yPx: -36 };
    case 'corner-left':
      return { xPx: -196, yPx: -128 };
    case 'corner-right':
      return { xPx: 196, yPx: -128 };
    case 'self':
      return { xPx: 0, yPx: 188 };
    default:
      return { xPx: 0, yPx: 0 };
  }
}

function getConstructionFlightStartMs(input: {
  source: ConstructionSource | undefined;
  revealHandCount: number;
}): number {
  const { source, revealHandCount } = input;

  if (!source) {
    return 0;
  }

  if (source.sourceType === 'deck') {
    return (
      RESOLUTION_REVEAL_START_DELAY_MS +
      revealHandCount * RESOLUTION_REVEAL_STEP_MS +
      RESOLUTION_SHOWDOWN_SUSPENSE_DELAY_MS +
      (source.drawIndex ?? 0) * RESOLUTION_SHOWDOWN_DRAW_STEP_MS +
      140
    );
  }

  return (
    RESOLUTION_REVEAL_START_DELAY_MS +
    (source.revealIndex ?? 0) * RESOLUTION_REVEAL_STEP_MS +
    REVEAL_FLIP_DELAY_MS +
    120
  );
}

function buildConstructionArrivalStyle(input: {
  source: ConstructionSource | undefined;
  elapsedMs: number;
  revealHandCount: number;
}): CSSProperties {
  const origin = getConstructionFlightOrigin(input.source);
  const startAtMs = getConstructionFlightStartMs({
    source: input.source,
    revealHandCount: input.revealHandCount,
  });

  return {
    '--poker-result-slot-origin-x': `${origin.xPx}px`,
    '--poker-result-slot-origin-y': `${origin.yPx}px`,
    animationDelay: `${Math.min(0, startAtMs - input.elapsedMs)}ms`,
  } as CSSProperties;
}

function buildConstructionSources(input: {
  slotCards: Array<Card | undefined>;
  revealHands: DisplayHand[];
  settledDeckDraws: Card[];
  seatPositions: Record<string, ResolutionSeatPosition>;
}): Array<ConstructionSource | undefined> {
  const seatSourcesByKey = new Map<string, ConstructionSource>();
  const deckSourcesByKey = new Map<string, ConstructionSource>();

  for (const [revealIndex, hand] of input.revealHands.entries()) {
    for (const card of hand.cards) {
      const cardKey = cardToKey(card);

      if (seatSourcesByKey.has(cardKey)) {
        continue;
      }

      seatSourcesByKey.set(cardKey, {
        card,
        key: `${hand.playerId}:${cardToKey(card)}`,
        sourceType: 'seat',
        playerId: hand.playerId,
        revealIndex,
        placement: input.seatPositions[hand.playerId]?.placement,
      });
    }
  }

  for (const [drawIndex, card] of input.settledDeckDraws.entries()) {
    const cardKey = cardToKey(card);

    if (deckSourcesByKey.has(cardKey)) {
      continue;
    }

    deckSourcesByKey.set(cardKey, {
      card,
      key: `deck:${drawIndex}:${cardToKey(card)}`,
      sourceType: 'deck',
      drawIndex,
      placement: undefined,
    });
  }

  return input.slotCards.map((card) => {
    if (!card) {
      return undefined;
    }

    const cardKey = cardToKey(card);
    return seatSourcesByKey.get(cardKey) ?? deckSourcesByKey.get(cardKey);
  });
}

function buildOverlayHeading(input: {
  result: ResolutionResult;
  playersById: Map<string, PlayerSnapshot>;
  isResolved: boolean;
  unknownPlayerName: string;
  formatClaimCompactLabel: (claim: Claim) => string;
  copy: {
    showdown: string;
    timeout: string;
    checkingClaim: string;
    drawingFromDeck: string;
    claimFound: string;
    bluffCaught: string;
    drawRevealHint: string;
    verdictWaits: (challenger: string, claimant: string) => string;
    claimFoundText: (
      challenger: string,
      claimant: string,
      claimLabel: string,
    ) => string;
    bluffCaughtText: (
      challenger: string,
      claimant: string,
      claimLabel: string,
    ) => string;
    timeoutTitle: (name: string) => string;
    timeoutWithClaim: (name: string, claimLabel: string) => string;
    timeoutOpening: string;
  };
}): { eyebrow: string; title: string; text: string } {
  const {
    result,
    playersById,
    isResolved,
    unknownPlayerName,
    formatClaimCompactLabel,
    copy,
  } = input;

  if (result.kind === 'showdown') {
    const claimantName =
      playersById.get(result.data.claimantPlayerId)?.name ?? unknownPlayerName;
    const challengerName =
      playersById.get(result.data.challengerPlayerId)?.name ??
      unknownPlayerName;

    if (!isResolved) {
      return {
        eyebrow: copy.showdown,
        title:
          result.data.deckDraws.length > 0
            ? copy.drawingFromDeck
            : copy.checkingClaim,
        text:
          result.data.deckDraws.length > 0
            ? copy.drawRevealHint
            : copy.verdictWaits(challengerName, claimantName),
      };
    }

    if (result.data.claimWasValid) {
      return {
        eyebrow: copy.showdown,
        title: copy.claimFound,
        text: copy.claimFoundText(
          challengerName,
          claimantName,
          formatClaimCompactLabel(result.data.spokenClaim),
        ),
      };
    }

    return {
      eyebrow: copy.showdown,
      title: copy.bluffCaught,
      text: copy.bluffCaughtText(
        challengerName,
        claimantName,
        formatClaimCompactLabel(result.data.spokenClaim),
      ),
    };
  }

  const timedOutName =
    playersById.get(result.data.timedOutPlayerId)?.name ?? unknownPlayerName;

  return {
    eyebrow: copy.timeout,
    title: copy.timeoutTitle(timedOutName),
    text: result.data.lastClaim
      ? copy.timeoutWithClaim(
          timedOutName,
          formatClaimCompactLabel(result.data.lastClaim),
        )
      : copy.timeoutOpening,
  };
}

function buildOverlayFooterText(input: {
  result: ResolutionResult;
  playersById: Map<string, PlayerSnapshot>;
  isResolved: boolean;
  unknownPlayerName: string;
  copy: {
    suspenseDeck: string;
    suspenseResolve: string;
    loserEliminated: (name: string) => string;
    loserNextRound: (name: string, handSize: number) => string;
  };
}): string {
  const { result, playersById, isResolved, unknownPlayerName, copy } = input;

  if (result.kind === 'showdown' && !isResolved) {
    return result.data.deckDraws.length > 0
      ? copy.suspenseDeck
      : copy.suspenseResolve;
  }

  const loserName =
    playersById.get(
      result.kind === 'showdown'
        ? result.data.loserPlayerId
        : result.data.timedOutPlayerId,
    )?.name ?? unknownPlayerName;

  if (result.data.loserEliminated) {
    return copy.loserEliminated(loserName);
  }

  return copy.loserNextRound(loserName, result.data.loserHandSize);
}

function ResolutionCardFace({ card }: { card: Card }) {
  return <PokerCardFace card={card} className="poker-result-card-face-shell" />;
}

function ResolutionPlaceholderCardFace({
  spec,
  missing = false,
}: {
  spec: ExpectedSlotSpec;
  missing?: boolean;
}) {
  const rankLabel = spec.rankLabel ?? '•';
  const suitSymbol = spec.suitSymbol ?? '•';

  return (
    <div
      className={`claim-visual-card poker-result-placeholder-face ${missing ? 'is-missing' : ''}`.trim()}
    >
      <div className="claim-visual-corners">
        <span className="claim-visual-rank">{rankLabel}</span>
        <span className="claim-visual-suit">{suitSymbol}</span>
      </div>
      <div className="claim-visual-center">
        <span className="claim-visual-center-suit">{suitSymbol}</span>
        <span className="claim-visual-center-rank">{rankLabel}</span>
      </div>
      <div className="claim-visual-corners claim-visual-corners-bottom">
        <span className="claim-visual-rank">{rankLabel}</span>
        <span className="claim-visual-suit">{suitSymbol}</span>
      </div>
    </div>
  );
}

function ResolutionCard({
  card,
  faceUp,
  highlighted = false,
}: {
  card: Card;
  faceUp: boolean;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`poker-result-card ${faceUp ? 'is-face-up' : ''} ${highlighted ? 'is-highlighted' : ''}`.trim()}
    >
      <div className="poker-result-card-body">
        <div className="poker-result-card-inner">
          <div className="poker-result-card-face">
            <ResolutionCardFace card={card} />
          </div>
          <div className="poker-result-card-back" />
        </div>
      </div>
    </div>
  );
}

function countRevealedHands(elapsedMs: number, handCount: number): number {
  return Array.from({ length: handCount }).filter((_, index) => {
    const revealAtMs =
      RESOLUTION_REVEAL_START_DELAY_MS +
      index * RESOLUTION_REVEAL_STEP_MS +
      REVEAL_FLIP_DELAY_MS;

    return elapsedMs >= revealAtMs;
  }).length;
}

function getActiveRevealPlayerId(
  elapsedMs: number,
  revealHands: DisplayHand[],
): string | null {
  const activeIndex = revealHands.findIndex((_, index) => {
    const revealStartAtMs =
      RESOLUTION_REVEAL_START_DELAY_MS + index * RESOLUTION_REVEAL_STEP_MS;

    return (
      elapsedMs >= revealStartAtMs &&
      elapsedMs <
        revealStartAtMs +
          Math.min(REVEAL_FLIP_DELAY_MS, RESOLUTION_REVEAL_STEP_MS)
    );
  });

  return activeIndex === -1
    ? null
    : (revealHands[activeIndex]?.playerId ?? null);
}

export function RoundResolutionOverlay({
  result,
  players,
  seatPositions,
  nowMs,
}: RoundResolutionOverlayProps) {
  const { catalog, formatClaimCompactLabel, formatRankLabel } = useLocale();
  const frozenResolutionRef = useRef<{
    key: string;
    result: ResolutionResult;
    players: PlayerSnapshot[];
    startedAtMs: number;
  } | null>(null);

  if (
    !frozenResolutionRef.current ||
    frozenResolutionRef.current.key !== result.key
  ) {
    frozenResolutionRef.current = {
      key: result.key,
      result,
      players,
      startedAtMs: result.data.startedAtMs,
    };
  }

  const stableResult = frozenResolutionRef.current.result;
  const stablePlayers = frozenResolutionRef.current.players;
  const startedAtMs = frozenResolutionRef.current.startedAtMs;
  const elapsedMs = Math.max(0, nowMs - startedAtMs);

  const {
    claimConstruction,
    claimUnderReview,
    expectedSlotSpecs,
    footerText,
    heading,
    isResolved,
    overlayTone,
    playersById,
    revealHands,
    revealCount,
    activeRevealPlayerId,
    revealedDeckDrawCount,
    settledDeckDrawCount,
    activeDeckDrawIndex,
    displayedConstructionSources,
    visibleConstruction,
    visibleConstructionCardKeys,
    finalConstructionCardKeys,
  } = useMemo(() => {
    const nextPlayersById = new Map(
      stablePlayers.map((player) => [player.playerId, player]),
    );
    const revealStartPlayerId =
      stableResult.kind === 'showdown'
        ? stableResult.data.claimantPlayerId
        : stableResult.data.timedOutPlayerId;
    const nextRevealHands = rotateHandsForReveal(
      stableResult.data.revealedHands.map((hand) => ({
        playerId: hand.playerId,
        cards: sortCardsDescending(hand.cards),
      })),
      stablePlayers,
      revealStartPlayerId,
    );
    const nextClaimUnderReview: Claim | undefined =
      stableResult.kind === 'showdown'
        ? stableResult.data.spokenClaim
        : stableResult.data.lastClaim;
    const finalPool =
      stableResult.kind === 'showdown'
        ? [
            ...nextRevealHands.flatMap((hand) => hand.cards),
            ...stableResult.data.deckDraws,
          ]
        : nextRevealHands.flatMap((hand) => hand.cards);
    const nextClaimConstruction = nextClaimUnderReview
      ? buildClaimConstruction(finalPool, nextClaimUnderReview)
      : undefined;
    const revealFinishedAtMs =
      RESOLUTION_REVEAL_START_DELAY_MS +
      nextRevealHands.length * RESOLUTION_REVEAL_STEP_MS;
    const showdownResolvedAtMs =
      revealFinishedAtMs +
      RESOLUTION_SHOWDOWN_SUSPENSE_DELAY_MS +
      (stableResult.kind === 'showdown'
        ? stableResult.data.deckDraws.length * RESOLUTION_SHOWDOWN_DRAW_STEP_MS
        : 0) +
      RESOLUTION_SHOWDOWN_FINAL_RESOLVE_MS;
    const timeoutResolvedAtMs =
      revealFinishedAtMs + RESOLUTION_TIMEOUT_FINAL_RESOLVE_MS;
    const nextIsResolved =
      stableResult.kind === 'showdown'
        ? elapsedMs >= showdownResolvedAtMs
        : elapsedMs >= timeoutResolvedAtMs;
    const drawStartAtMs =
      revealFinishedAtMs + RESOLUTION_SHOWDOWN_SUSPENSE_DELAY_MS;
    const nextRevealedDeckDrawCount =
      stableResult.kind !== 'showdown'
        ? 0
        : Array.from({ length: stableResult.data.deckDraws.length }).filter(
            (_, index) =>
              elapsedMs >=
              drawStartAtMs + index * RESOLUTION_SHOWDOWN_DRAW_STEP_MS,
          ).length;
    const nextSettledDeckDrawCount =
      stableResult.kind !== 'showdown'
        ? 0
        : Array.from({ length: stableResult.data.deckDraws.length }).filter(
            (_, index) =>
              nextIsResolved ||
              elapsedMs >=
                drawStartAtMs +
                  index * RESOLUTION_SHOWDOWN_DRAW_STEP_MS +
                  DRAW_CARD_FLIGHT_MS,
          ).length;
    const nextActiveDeckDrawIndex =
      stableResult.kind !== 'showdown'
        ? -1
        : stableResult.data.deckDraws.findIndex((_, index) => {
            const drawRevealAtMs =
              drawStartAtMs + index * RESOLUTION_SHOWDOWN_DRAW_STEP_MS;

            return (
              elapsedMs >= drawRevealAtMs &&
              elapsedMs < drawRevealAtMs + DRAW_CARD_FLIGHT_MS
            );
          });
    const visiblePool = [
      ...nextRevealHands
        .slice(0, countRevealedHands(elapsedMs, nextRevealHands.length))
        .flatMap((hand) => hand.cards),
      ...(stableResult.kind === 'showdown'
        ? stableResult.data.deckDraws.slice(0, nextSettledDeckDrawCount)
        : []),
    ];
    const nextVisibleConstruction = nextClaimUnderReview
      ? buildClaimConstruction(visiblePool, nextClaimUnderReview)
      : undefined;
    const displayedConstruction = nextIsResolved
      ? nextClaimConstruction
      : nextVisibleConstruction;
    const finalCards = nextClaimConstruction?.cards ?? [];
    const visibleCards = nextVisibleConstruction?.cards ?? [];
    const nextDisplayedConstructionSources = displayedConstruction
      ? buildConstructionSources({
          slotCards: displayedConstruction.slotCards,
          revealHands: nextRevealHands.slice(
            0,
            countRevealedHands(elapsedMs, nextRevealHands.length),
          ),
          settledDeckDraws:
            stableResult.kind === 'showdown'
              ? stableResult.data.deckDraws.slice(0, nextSettledDeckDrawCount)
              : [],
          seatPositions,
        })
      : [];

    return {
      claimConstruction: nextClaimConstruction,
      claimUnderReview: nextClaimUnderReview,
      expectedSlotSpecs: nextClaimUnderReview
        ? buildExpectedSlotSpecs(nextClaimUnderReview, formatRankLabel)
        : [],
      footerText: buildOverlayFooterText({
        result: stableResult,
        playersById: nextPlayersById,
        isResolved: nextIsResolved,
        unknownPlayerName: catalog.showdown.unknownPlayer,
        copy: {
          suspenseDeck: catalog.showdown.suspenseDeck,
          suspenseResolve: catalog.showdown.suspenseResolve,
          loserEliminated: catalog.showdown.loserEliminated,
          loserNextRound: catalog.showdown.loserNextRound,
        },
      }),
      heading: buildOverlayHeading({
        result: stableResult,
        playersById: nextPlayersById,
        isResolved: nextIsResolved,
        unknownPlayerName: catalog.showdown.unknownPlayer,
        formatClaimCompactLabel,
        copy: {
          showdown: catalog.text.showdown,
          timeout: catalog.text.timeout,
          checkingClaim: catalog.text.checkingClaim,
          drawingFromDeck: catalog.text.drawingFromDeck,
          claimFound: catalog.text.claimFound,
          bluffCaught: catalog.text.bluffCaught,
          drawRevealHint: catalog.showdown.drawRevealHint,
          verdictWaits: catalog.showdown.verdictWaits,
          claimFoundText: catalog.showdown.claimFoundText,
          bluffCaughtText: catalog.showdown.bluffCaughtText,
          timeoutTitle: catalog.showdown.timeoutTitle,
          timeoutWithClaim: catalog.showdown.timeoutWithClaim,
          timeoutOpening: catalog.showdown.timeoutOpening,
        },
      }),
      isResolved: nextIsResolved,
      overlayTone:
        stableResult.kind === 'showdown'
          ? stableResult.data.claimWasValid
            ? 'is-success'
            : 'is-failure'
          : 'is-timeout',
      playersById: nextPlayersById,
      revealHands: nextRevealHands,
      revealCount: countRevealedHands(elapsedMs, nextRevealHands.length),
      activeRevealPlayerId: getActiveRevealPlayerId(elapsedMs, nextRevealHands),
      revealedDeckDrawCount: nextRevealedDeckDrawCount,
      settledDeckDrawCount: nextSettledDeckDrawCount,
      activeDeckDrawIndex: nextActiveDeckDrawIndex,
      displayedConstructionSources: nextDisplayedConstructionSources,
      visibleConstruction: nextVisibleConstruction,
      visibleConstructionCardKeys: new Set(
        visibleCards.map((card) => cardToKey(card)),
      ),
      finalConstructionCardKeys: new Set(
        finalCards.map((card) => cardToKey(card)),
      ),
    };
  }, [
    catalog.showdown.bluffCaughtText,
    catalog.showdown.claimFoundText,
    catalog.showdown.drawRevealHint,
    catalog.showdown.loserEliminated,
    catalog.showdown.loserNextRound,
    catalog.showdown.suspenseDeck,
    catalog.showdown.suspenseResolve,
    catalog.showdown.timeoutOpening,
    catalog.showdown.timeoutTitle,
    catalog.showdown.timeoutWithClaim,
    catalog.showdown.unknownPlayer,
    catalog.showdown.verdictWaits,
    catalog.text.bluffCaught,
    catalog.text.checkingClaim,
    catalog.text.claimFound,
    catalog.text.drawingFromDeck,
    catalog.text.showdown,
    catalog.text.timeout,
    elapsedMs,
    formatClaimCompactLabel,
    formatRankLabel,
    seatPositions,
    stablePlayers,
    stableResult,
  ]);

  const visibleDeckDraws =
    stableResult.kind === 'showdown'
      ? stableResult.data.deckDraws.slice(0, settledDeckDrawCount)
      : [];

  return (
    <div
      className={`poker-result-stage ${stableResult.kind === 'timeout' || isResolved ? overlayTone : ''}`.trim()}
      aria-labelledby="poker-result-title"
      aria-live="polite"
    >
      <div className="poker-result-seat-layer">
        {revealHands.map((hand, index) => {
          const seatPosition = seatPositions[hand.playerId];

          if (!seatPosition) {
            return null;
          }

          const playerRole = buildPlayerRole(
            hand.playerId,
            stableResult,
            isResolved,
            {
              lost: catalog.table.lost,
              checked: catalog.table.checked,
              checker: catalog.table.checker,
              timedOut: catalog.table.timedOut,
            },
          );
          const isRevealed = revealCount > index;
          const isRevealing = activeRevealPlayerId === hand.playerId;
          const isContributing = hand.cards.some((card) =>
            (isResolved
              ? finalConstructionCardKeys
              : visibleConstructionCardKeys
            ).has(cardToKey(card)),
          );
          const isPenaltySeat =
            stableResult.kind === 'showdown'
              ? hand.playerId === stableResult.data.loserPlayerId
              : hand.playerId === stableResult.data.timedOutPlayerId;

          return (
            <article
              key={hand.playerId}
              className={`poker-result-seat-reveal seat-placement-${seatPosition.placement} ${isRevealed ? 'is-revealed' : ''} ${isRevealing ? 'is-revealing' : ''} ${isContributing ? 'is-contributing' : ''} ${isPenaltySeat && isResolved ? 'is-penalty-seat' : ''}`.trim()}
              style={buildSeatRevealStyle(seatPosition)}
            >
              {playerRole ? (
                <span className="poker-result-role-pill">{playerRole}</span>
              ) : null}

              <div className="poker-result-seat-hand">
                {hand.cards.map((card) => (
                  <ResolutionCard
                    key={`${hand.playerId}:${cardToKey(card)}`}
                    card={card}
                    faceUp={isRevealed}
                    highlighted={
                      isResolved &&
                      finalConstructionCardKeys.has(cardToKey(card))
                    }
                  />
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <section
        className={`poker-result-claim-marker ${isResolved ? 'is-resolved' : 'is-pending'} ${stableResult.kind === 'showdown' && stableResult.data.deckDraws.length > 0 ? 'has-draws' : ''}`.trim()}
      >
        <div className="poker-result-copy">
          <p className="poker-object-label">{heading.eyebrow}</p>
          <span className="poker-result-status">{heading.title}</span>
          <strong id="poker-result-title" className="poker-result-center-title">
            {claimUnderReview
              ? formatClaimCompactLabel(claimUnderReview)
              : catalog.table.noClaimYet}
          </strong>
        </div>

        {claimUnderReview ? (
          <div className="poker-result-reference">
            <ClaimCardStack
              cards={claimToIllustrationCards(claimUnderReview)}
              compact
            />
            <span className="poker-result-reference-label">
              {stableResult.kind === 'showdown'
                ? catalog.text.spokenClaim
                : catalog.text.lastTableClaim}
            </span>
          </div>
        ) : null}

        {stableResult.kind === 'showdown' &&
        stableResult.data.deckDraws.length > 0 ? (
          <div className="poker-result-deck-draw-lane">
            <div className="poker-result-deck-source" aria-hidden="true">
              <span className="poker-result-deck-source-card is-back layer-3" />
              <span className="poker-result-deck-source-card is-back layer-2" />
              <span className="poker-result-deck-source-card is-back layer-1" />
            </div>
            <span className="poker-result-deck-draw-label">
              {catalog.text.topDeckReveal}
            </span>
            <div className="poker-result-deck-draw-row">
              {visibleDeckDraws.map((card, index) => (
                <div
                  key={`drawn-card-${index + 1}-${cardToKey(card)}`}
                  className="poker-result-deck-draw-card is-settled"
                >
                  <ResolutionCardFace card={card} />
                </div>
              ))}
            </div>
            {activeDeckDrawIndex !== -1 &&
            activeDeckDrawIndex < revealedDeckDrawCount ? (
              <div
                className="poker-result-deck-draw-flight"
                style={
                  {
                    '--poker-result-draw-slot-index':
                      String(activeDeckDrawIndex),
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                <ResolutionCardFace
                  card={
                    stableResult.data.deckDraws[activeDeckDrawIndex] as Card
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {stableResult.kind === 'showdown' &&
        claimUnderReview &&
        (visibleConstruction || claimConstruction) ? (
          <div className="poker-result-construction-slots">
            {Array.from({
              length:
                (isResolved ? claimConstruction : visibleConstruction)
                  ?.requiredCount ?? 0,
            }).map((_, slotIndex) => {
              const displayedConstruction = isResolved
                ? claimConstruction
                : visibleConstruction;
              const slotCard = displayedConstruction?.slotCards[slotIndex];
              const expectedSlotSpec = expectedSlotSpecs[slotIndex];
              const isMissing =
                isResolved && !slotCard && !claimConstruction?.isComplete;

              if (slotCard) {
                return (
                  <div
                    key={`slot-${slotIndex + 1}`}
                    className="poker-result-construction-slot is-filled"
                    style={buildConstructionArrivalStyle({
                      source: displayedConstructionSources[slotIndex],
                      elapsedMs,
                      revealHandCount: revealHands.length,
                    })}
                  >
                    <ResolutionCardFace card={slotCard} />
                  </div>
                );
              }

              return (
                <div
                  key={`slot-${slotIndex + 1}`}
                  className={`poker-result-construction-slot is-empty ${isMissing ? 'is-missing' : ''}`.trim()}
                >
                  {expectedSlotSpec ? (
                    <ResolutionPlaceholderCardFace
                      spec={expectedSlotSpec}
                      missing={isMissing}
                    />
                  ) : (
                    <span>?</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : stableResult.kind === 'timeout' && claimUnderReview ? (
          <p className="poker-result-timeout-note">
            {catalog.showdown.timeoutNoValidation}
          </p>
        ) : stableResult.kind === 'timeout' ? (
          <p className="poker-result-timeout-note">
            {catalog.showdown.timeoutOpeningNote}
          </p>
        ) : (
          <div className="poker-result-suspense-shell" aria-hidden="true">
            <div className="poker-result-suspense-glow" />
          </div>
        )}

        {isResolved && overlayTone === 'is-success' ? (
          <div className="poker-result-fireflies" aria-hidden="true">
            {SUCCESS_FIREFLIES.map((firefly, fireflyIndex) => (
              <span
                key={`firefly-${fireflyIndex + 1}`}
                className="poker-result-firefly"
                style={
                  {
                    '--poker-firefly-left': `${firefly.leftPct}%`,
                    '--poker-firefly-top': `${firefly.topPct}%`,
                    '--poker-firefly-drift-x': `${firefly.driftXPx}px`,
                    '--poker-firefly-drift-y': `${firefly.driftYPx}px`,
                    '--poker-firefly-duration': `${firefly.durationMs}ms`,
                    '--poker-firefly-delay': `${firefly.delayMs}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}

        {isResolved && overlayTone === 'is-failure' ? (
          <>
            <div className="poker-result-shock-ring" aria-hidden="true" />
            <div className="poker-result-failure-burst" aria-hidden="true" />
          </>
        ) : null}

        {(stableResult.kind === 'timeout' || isResolved) &&
        overlayTone === 'is-timeout' ? (
          <div className="poker-result-timeout-pulse" aria-hidden="true" />
        ) : null}

        <p className="poker-result-detail">{heading.text}</p>
        <p className="poker-result-footer">{footerText}</p>
      </section>
    </div>
  );
}
