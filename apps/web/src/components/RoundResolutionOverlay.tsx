import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type Card,
  type Claim,
  type PlayerSnapshot,
  RANK_LABELS,
  RESOLUTION_CONSTRUCTION_SETTLE_MS,
  RESOLUTION_CONSTRUCTION_START_DELAY_MS,
  RESOLUTION_CONSTRUCTION_STEP_MS,
  RESOLUTION_NO_CONSTRUCTION_SETTLE_MS,
  RESOLUTION_REVEAL_START_DELAY_MS,
  RESOLUTION_REVEAL_STEP_MS,
  SUIT_SYMBOLS,
  type ShowdownSnapshot,
  type TimeoutSnapshot,
  buildClaimConstruction,
  claimToCompactLabel,
  sortCardsDescending,
} from '@bluff-game/shared';

import { claimToIllustrationCards } from '../lib/claimVisuals.js';
import { ClaimCardStack } from './ClaimPreview.js';

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

const FIREWORK_IDS = ['alpha', 'beta', 'gamma'] as const;
const PARTICLE_IDS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

interface DisplayHand {
  playerId: string;
  cards: Card[];
}

interface ConstructionSource {
  card: Card;
  playerId: string;
  key: string;
  slotIndex: number;
}

interface ExpectedSlotSpec {
  rankLabel?: string;
  suitSymbol?: string;
}

interface MovingCardState {
  sourceKey: string;
  card: Card;
  left: number;
  top: number;
  deltaX: number;
  deltaY: number;
}

function buildCardKey(card: Card): string {
  return `${card.rank}:${card.suit}`;
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

  const rotatedPlayers = [
    ...orderedPlayers.slice(startIndex),
    ...orderedPlayers.slice(0, startIndex),
  ];

  return rotatedPlayers
    .map((player) => handsByPlayerId.get(player.playerId))
    .filter((hand): hand is DisplayHand => Boolean(hand));
}

function findConstructionSources(
  hands: DisplayHand[],
  slotCards: Array<Card | undefined>,
): Array<ConstructionSource | undefined> {
  const sourceCards = new Map<string, Omit<ConstructionSource, 'slotIndex'>>();

  for (const hand of hands) {
    for (const card of hand.cards) {
      sourceCards.set(buildCardKey(card), {
        card,
        playerId: hand.playerId,
        key: `${hand.playerId}:${card.rank}:${card.suit}`,
      });
    }
  }

  return slotCards.map((card, slotIndex) => {
    if (!card) {
      return undefined;
    }

    const source = sourceCards.get(buildCardKey(card));

    return source
      ? {
          ...source,
          slotIndex,
        }
      : undefined;
  });
}

function buildStraightRankLabels(lowRank: number): string[] {
  if (lowRank === 1) {
    return ['A', '2', '3', '4', '5'];
  }

  return Array.from({ length: 5 }, (_, index) => {
    const rank = lowRank + index;

    if (rank === 11) {
      return 'J';
    }

    if (rank === 12) {
      return 'Q';
    }

    if (rank === 13) {
      return 'K';
    }

    if (rank === 14) {
      return 'A';
    }

    return String(rank);
  });
}

function buildExpectedSlotSpecs(claim: Claim): ExpectedSlotSpec[] {
  switch (claim.category) {
    case 'high-card':
      return [{ rankLabel: RANK_LABELS[claim.rank] }];
    case 'pair':
      return Array.from({ length: 2 }, () => ({
        rankLabel: RANK_LABELS[claim.pairRank],
      }));
    case 'two-pair':
      return [
        ...Array.from({ length: 2 }, () => ({
          rankLabel: RANK_LABELS[claim.highPairRank],
        })),
        ...Array.from({ length: 2 }, () => ({
          rankLabel: RANK_LABELS[claim.lowPairRank],
        })),
      ];
    case 'three-of-a-kind':
      return Array.from({ length: 3 }, () => ({
        rankLabel: RANK_LABELS[claim.tripRank],
      }));
    case 'straight':
      return buildStraightRankLabels(claim.lowRank).map((rankLabel) => ({
        rankLabel,
      }));
    case 'flush':
      return Array.from({ length: 5 }, () => ({
        suitSymbol: SUIT_SYMBOLS[claim.suit],
      }));
    case 'full-house':
      return [
        ...Array.from({ length: 3 }, () => ({
          rankLabel: RANK_LABELS[claim.tripRank],
        })),
        ...Array.from({ length: 2 }, () => ({
          rankLabel: RANK_LABELS[claim.pairRank],
        })),
      ];
    case 'four-of-a-kind':
      return Array.from({ length: 4 }, () => ({
        rankLabel: RANK_LABELS[claim.quadRank],
      }));
    case 'straight-flush':
      return buildStraightRankLabels(claim.lowRank).map((rankLabel) => ({
        rankLabel,
        suitSymbol: SUIT_SYMBOLS[claim.suit],
      }));
  }
}

function buildPlayerRole(
  playerId: string,
  result: ResolutionResult,
): string | null {
  if (result.kind === 'showdown') {
    if (playerId === result.data.loserPlayerId) {
      return 'lost';
    }

    if (playerId === result.data.claimantPlayerId) {
      return 'checked';
    }

    if (playerId === result.data.challengerPlayerId) {
      return 'checker';
    }

    return null;
  }

  if (playerId === result.data.timedOutPlayerId) {
    return 'timed out';
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

function buildOverlayHeading(
  result: ResolutionResult,
  playersById: Map<string, PlayerSnapshot>,
): { eyebrow: string; title: string; text: string } {
  if (result.kind === 'showdown') {
    const claimantName =
      playersById.get(result.data.claimantPlayerId)?.name ?? 'Unknown';
    const challengerName =
      playersById.get(result.data.challengerPlayerId)?.name ?? 'Unknown';

    if (result.data.claimWasValid) {
      return {
        eyebrow: 'Showdown',
        title: 'Claim found',
        text: `${challengerName} checked ${claimantName}, but ${claimToCompactLabel(result.data.spokenClaim)} was there.`,
      };
    }

    return {
      eyebrow: 'Showdown',
      title: 'Bluff caught',
      text: `${claimantName} could not build ${claimToCompactLabel(result.data.spokenClaim)} after ${challengerName} checked.`,
    };
  }

  const timedOutName =
    playersById.get(result.data.timedOutPlayerId)?.name ?? 'Unknown';

  return {
    eyebrow: 'Timeout',
    title: `${timedOutName} ran out of time`,
    text: result.data.lastClaim
      ? `The round ended before anyone checked ${claimToCompactLabel(result.data.lastClaim)}.`
      : 'The round ended before the opening claim was made.',
  };
}

function buildOverlayFooterText(
  result: ResolutionResult,
  playersById: Map<string, PlayerSnapshot>,
): string {
  const loserName =
    playersById.get(
      result.kind === 'showdown'
        ? result.data.loserPlayerId
        : result.data.timedOutPlayerId,
    )?.name ?? 'Unknown';

  if (result.data.loserEliminated) {
    return `${loserName} is eliminated.`;
  }

  return `${loserName} goes to ${result.data.loserHandSize} cards next round.`;
}

function ResolutionCardFace({ card }: { card: Card }) {
  return (
    <div
      className={`claim-visual-card poker-result-card-face-shell suit-${card.suit}`}
    >
      <div className="claim-visual-corners">
        <span className="claim-visual-rank">{RANK_LABELS[card.rank]}</span>
        <span className="claim-visual-suit">{SUIT_SYMBOLS[card.suit]}</span>
      </div>
      <div className="claim-visual-center">
        <span className="claim-visual-center-suit">
          {SUIT_SYMBOLS[card.suit]}
        </span>
        <span className="claim-visual-center-rank">
          {RANK_LABELS[card.rank]}
        </span>
      </div>
      <div className="claim-visual-corners claim-visual-corners-bottom">
        <span className="claim-visual-rank">{RANK_LABELS[card.rank]}</span>
        <span className="claim-visual-suit">{SUIT_SYMBOLS[card.suit]}</span>
      </div>
    </div>
  );
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
  current = false,
  consumed = false,
  cardRef,
}: {
  card: Card;
  faceUp: boolean;
  highlighted?: boolean;
  current?: boolean;
  consumed?: boolean;
  cardRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={cardRef}
      className={`poker-result-card ${faceUp ? 'is-face-up' : ''} ${highlighted ? 'is-highlighted' : ''} ${current ? 'is-current' : ''} ${consumed ? 'is-source-consumed' : ''}`.trim()}
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

export function RoundResolutionOverlay({
  result,
  players,
  seatPositions,
}: RoundResolutionOverlayProps) {
  const frozenResolutionRef = useRef<{
    key: string;
    result: ResolutionResult;
    players: PlayerSnapshot[];
  } | null>(null);
  const [phase, setPhase] = useState<'revealing' | 'constructing' | 'resolved'>(
    'revealing',
  );
  const [revealedCount, setRevealedCount] = useState(0);
  const [activeRevealPlayerId, setActiveRevealPlayerId] = useState<
    string | null
  >(null);
  const [constructedSlotIndexes, setConstructedSlotIndexes] = useState<
    number[]
  >([]);
  const [activeConstructionSourceKey, setActiveConstructionSourceKey] =
    useState<string | null>(null);
  const [activeConstructionSlotIndex, setActiveConstructionSlotIndex] =
    useState<number | null>(null);
  const scheduledTimersRef = useRef<number[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sourceCardRefs = useRef(new Map<string, HTMLDivElement>());
  const slotRefs = useRef(new Map<string, HTMLDivElement>());
  const [movingCard, setMovingCard] = useState<MovingCardState | null>(null);

  if (
    !frozenResolutionRef.current ||
    frozenResolutionRef.current.key !== result.key
  ) {
    frozenResolutionRef.current = {
      key: result.key,
      result,
      players,
    };
  }

  const stableResult = frozenResolutionRef.current.result;
  const stablePlayers = frozenResolutionRef.current.players;
  const {
    claimConstruction,
    claimUnderReview,
    expectedSlotSpecs,
    constructionSourceIndexes,
    constructionSourcesBySlot,
    presentConstructionSources,
    footerText,
    heading,
    overlayTone,
    playersById,
    revealHands,
    showConstructionArea,
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
    const nextClaimConstruction = nextClaimUnderReview
      ? buildClaimConstruction(
          nextRevealHands.flatMap((hand) => hand.cards),
          nextClaimUnderReview,
        )
      : undefined;
    const nextConstructionSourcesBySlot = nextClaimConstruction
      ? findConstructionSources(
          nextRevealHands,
          nextClaimConstruction.slotCards,
        )
      : [];
    const nextPresentConstructionSources = nextConstructionSourcesBySlot.filter(
      (source): source is ConstructionSource => Boolean(source),
    );

    return {
      claimConstruction: nextClaimConstruction,
      claimUnderReview: nextClaimUnderReview,
      expectedSlotSpecs: nextClaimUnderReview
        ? buildExpectedSlotSpecs(nextClaimUnderReview)
        : [],
      constructionSourceIndexes: new Map(
        nextPresentConstructionSources.map(
          (source) => [source.key, source.slotIndex] as const,
        ),
      ),
      constructionSourcesBySlot: nextConstructionSourcesBySlot,
      presentConstructionSources: nextPresentConstructionSources,
      footerText: buildOverlayFooterText(stableResult, nextPlayersById),
      heading: buildOverlayHeading(stableResult, nextPlayersById),
      overlayTone:
        stableResult.kind === 'showdown'
          ? stableResult.data.claimWasValid
            ? 'is-success'
            : 'is-failure'
          : 'is-timeout',
      playersById: nextPlayersById,
      revealHands: nextRevealHands,
      showConstructionArea:
        stableResult.kind === 'showdown' &&
        Boolean(nextClaimUnderReview && nextClaimConstruction),
    };
  }, [stablePlayers, stableResult]);
  const visibleConstructedSlots = useMemo(
    () =>
      new Set(
        phase === 'resolved'
          ? presentConstructionSources.map((source) => source.slotIndex)
          : constructedSlotIndexes,
      ),
    [constructedSlotIndexes, phase, presentConstructionSources],
  );
  const useMovingConstruction =
    showConstructionArea && presentConstructionSources.length > 0;

  useLayoutEffect(() => {
    if (!useMovingConstruction || !activeConstructionSourceKey) {
      setMovingCard(null);
      return;
    }

    const sourceIndex = constructionSourceIndexes.get(
      activeConstructionSourceKey,
    );
    const slotId =
      sourceIndex === undefined ? undefined : `slot-${sourceIndex + 1}`;
    const sourceNode = sourceCardRefs.current.get(activeConstructionSourceKey);
    const slotNode =
      slotId === undefined ? undefined : slotRefs.current.get(slotId);
    const stageNode = stageRef.current;

    if (sourceIndex === undefined || !sourceNode || !slotNode || !stageNode) {
      setMovingCard(null);
      return;
    }

    const source = constructionSourcesBySlot[sourceIndex];

    if (!source) {
      setMovingCard(null);
      return;
    }

    const stageRect = stageNode.getBoundingClientRect();
    const sourceRect = sourceNode.getBoundingClientRect();
    const slotRect = slotNode.getBoundingClientRect();

    setMovingCard({
      sourceKey: source.key,
      card: source.card,
      left: sourceRect.left - stageRect.left,
      top: sourceRect.top - stageRect.top,
      deltaX: slotRect.left - sourceRect.left,
      deltaY: slotRect.top - sourceRect.top,
    });
  }, [
    activeConstructionSourceKey,
    constructionSourceIndexes,
    constructionSourcesBySlot,
    useMovingConstruction,
  ]);

  useEffect(() => {
    if (!movingCard) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setMovingCard((current) =>
        current?.sourceKey === movingCard.sourceKey ? null : current,
      );
    }, 260);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [movingCard]);

  useEffect(() => {
    for (const timerId of scheduledTimersRef.current) {
      window.clearTimeout(timerId);
    }

    scheduledTimersRef.current = [];
    setPhase('revealing');
    setRevealedCount(0);
    setActiveRevealPlayerId(null);
    setConstructedSlotIndexes([]);
    setActiveConstructionSourceKey(null);
    setActiveConstructionSlotIndex(null);
    setMovingCard(null);

    const revealStartDelayMs = RESOLUTION_REVEAL_START_DELAY_MS;
    const revealStepMs = RESOLUTION_REVEAL_STEP_MS;
    const revealFlipDelayMs = 220;

    revealHands.forEach((hand, index) => {
      scheduledTimersRef.current.push(
        window.setTimeout(
          () => {
            setActiveRevealPlayerId(hand.playerId);
          },
          revealStartDelayMs + index * revealStepMs,
        ),
      );
      scheduledTimersRef.current.push(
        window.setTimeout(
          () => {
            setRevealedCount(index + 1);
          },
          revealStartDelayMs + index * revealStepMs + revealFlipDelayMs,
        ),
      );
    });

    const revealFinishedAtMs =
      revealStartDelayMs + revealHands.length * revealStepMs;

    scheduledTimersRef.current.push(
      window.setTimeout(() => {
        setActiveRevealPlayerId(null);
      }, revealFinishedAtMs),
    );

    if (showConstructionArea && claimConstruction) {
      const constructStartAtMs =
        revealFinishedAtMs + RESOLUTION_CONSTRUCTION_START_DELAY_MS;
      const constructStepMs = RESOLUTION_CONSTRUCTION_STEP_MS;
      const constructCardDelayMs = 220;

      scheduledTimersRef.current.push(
        window.setTimeout(() => {
          setPhase('constructing');
        }, constructStartAtMs),
      );

      presentConstructionSources.forEach((source, index) => {
        scheduledTimersRef.current.push(
          window.setTimeout(
            () => {
              setActiveConstructionSourceKey(source.key);
              setActiveConstructionSlotIndex(source.slotIndex);
            },
            constructStartAtMs + index * constructStepMs,
          ),
        );
        scheduledTimersRef.current.push(
          window.setTimeout(
            () => {
              setConstructedSlotIndexes((current) =>
                current.includes(source.slotIndex)
                  ? current
                  : [...current, source.slotIndex],
              );
            },
            constructStartAtMs + index * constructStepMs + constructCardDelayMs,
          ),
        );
      });

      scheduledTimersRef.current.push(
        window.setTimeout(
          () => {
            setActiveConstructionSourceKey(null);
            setActiveConstructionSlotIndex(null);
            setPhase('resolved');
          },
          constructStartAtMs +
            Math.max(presentConstructionSources.length, 1) * constructStepMs +
            RESOLUTION_CONSTRUCTION_SETTLE_MS,
        ),
      );

      return () => {
        for (const timerId of scheduledTimersRef.current) {
          window.clearTimeout(timerId);
        }
      };
    }

    scheduledTimersRef.current.push(
      window.setTimeout(() => {
        setPhase('resolved');
      }, revealFinishedAtMs + RESOLUTION_NO_CONSTRUCTION_SETTLE_MS),
    );

    return () => {
      for (const timerId of scheduledTimersRef.current) {
        window.clearTimeout(timerId);
      }
    };
  }, [
    claimConstruction,
    presentConstructionSources,
    revealHands,
    showConstructionArea,
  ]);

  return (
    <div
      ref={stageRef}
      className={`poker-result-stage ${overlayTone}`.trim()}
      aria-labelledby="poker-result-title"
      aria-live="polite"
    >
      <div className="poker-result-seat-layer">
        {revealHands.map((hand, index) => {
          const seatPosition = seatPositions[hand.playerId];

          if (!seatPosition) {
            return null;
          }

          const playerRole = buildPlayerRole(hand.playerId, stableResult);
          const isRevealed = revealedCount > index;
          const isRevealing = activeRevealPlayerId === hand.playerId;
          const isContributing = presentConstructionSources.some(
            (source) => source.playerId === hand.playerId,
          );

          return (
            <article
              key={hand.playerId}
              className={`poker-result-seat-reveal seat-placement-${seatPosition.placement} ${isRevealed ? 'is-revealed' : ''} ${isRevealing ? 'is-revealing' : ''} ${isContributing ? 'is-contributing' : ''}`.trim()}
              style={buildSeatRevealStyle(seatPosition)}
            >
              {playerRole ? (
                <span className="poker-result-role-pill">
                  {playerRole}
                </span>
              ) : null}

              <div className="poker-result-seat-hand">
                {hand.cards.map((card) => {
                  const sourceKey = `${hand.playerId}:${card.rank}:${card.suit}`;
                  const slotIndex = constructionSourceIndexes.get(sourceKey);
                  const isConstructed =
                    slotIndex !== undefined &&
                    visibleConstructedSlots.has(slotIndex);
                  const isCurrentSource =
                    activeConstructionSourceKey === sourceKey;
                  const isConsumed =
                    useMovingConstruction &&
                    slotIndex !== undefined &&
                    (visibleConstructedSlots.has(slotIndex) || isCurrentSource);

                  return (
                    <ResolutionCard
                      key={sourceKey}
                      card={card}
                      faceUp={isRevealed}
                      highlighted={isConstructed || isCurrentSource}
                      current={isCurrentSource}
                      consumed={isConsumed}
                      cardRef={(node) => {
                        if (node) {
                          sourceCardRefs.current.set(sourceKey, node);
                          return;
                        }

                        sourceCardRefs.current.delete(sourceKey);
                      }}
                    />
                  );
                })}
              </div>
            </article>
          );
        })}

        {movingCard ? (
          <div className="poker-result-moving-layer" aria-hidden="true">
            <div
              key={movingCard.sourceKey}
              className="poker-result-moving-card"
              style={
                {
                  left: `${movingCard.left}px`,
                  top: `${movingCard.top}px`,
                  '--poker-result-move-x': `${movingCard.deltaX}px`,
                  '--poker-result-move-y': `${movingCard.deltaY}px`,
                } as CSSProperties
              }
            >
              <ResolutionCardFace card={movingCard.card} />
            </div>
          </div>
        ) : null}
      </div>

      <section
        className={`poker-result-centerpiece ${phase === 'constructing' ? 'is-constructing' : ''} ${phase === 'resolved' ? 'is-resolved' : ''}`.trim()}
      >
        <div className="poker-result-copy">
          <p className="poker-object-label">{heading.eyebrow}</p>
          <span className="poker-result-status">{heading.title}</span>
          {claimUnderReview ? (
            <strong id="poker-result-title" className="poker-result-center-title">
              {claimToCompactLabel(claimUnderReview)}
            </strong>
          ) : (
            <strong id="poker-result-title" className="poker-result-center-title">
              No claim on the table
            </strong>
          )}
          <p className="poker-result-detail">{heading.text}</p>
        </div>

        {claimUnderReview ? (
          <div className="poker-result-reference">
            <ClaimCardStack
              cards={claimToIllustrationCards(claimUnderReview)}
              compact
            />
            <span className="poker-result-reference-label">
              {stableResult.kind === 'showdown'
                ? 'Spoken claim'
                : 'Last table claim'}
            </span>
          </div>
        ) : null}

        {showConstructionArea && claimConstruction ? (
          <div className="poker-result-construction-slots">
            {Array.from({
              length: claimConstruction.requiredCount,
            }).map((_, slotIndex) => {
              const slotId = `slot-${slotIndex + 1}`;
              const expectedSlotSpec = expectedSlotSpecs[slotIndex];
              const source = constructionSourcesBySlot[slotIndex];
              const isFilled =
                Boolean(source) && visibleConstructedSlots.has(slotIndex);
              const isReceiving = source
                ? activeConstructionSlotIndex === slotIndex
                : false;
              const isMissing =
                phase === 'resolved' &&
                !claimConstruction.isComplete &&
                !source;

              if (source && isFilled) {
                return (
                  <div
                    key={slotId}
                    ref={(node) => {
                      if (node) {
                        slotRefs.current.set(slotId, node);
                        return;
                      }

                      slotRefs.current.delete(slotId);
                    }}
                    className="poker-result-construction-slot is-filled"
                  >
                    <ResolutionCardFace card={source.card} />
                  </div>
                );
              }

              return (
                <div
                  key={slotId}
                  ref={(node) => {
                    if (node) {
                      slotRefs.current.set(slotId, node);
                      return;
                    }

                    slotRefs.current.delete(slotId);
                  }}
                  className={`poker-result-construction-slot is-empty ${isReceiving ? 'is-receiving' : ''} ${isMissing ? 'is-missing' : ''}`.trim()}
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
            Timeout ends the round without validating the claim.
          </p>
        ) : stableResult.kind === 'timeout' ? (
          <p className="poker-result-timeout-note">
            The opening player timed out before speaking.
          </p>
        ) : null}

        <p className="poker-result-footer">{footerText}</p>

        {phase === 'resolved' && overlayTone === 'is-success' ? (
          <div className="poker-result-fireworks" aria-hidden="true">
            {FIREWORK_IDS.map((fireworkId, fireworkIndex) => (
              <div
                key={fireworkId}
                className={`poker-result-firework poker-result-firework-${fireworkIndex + 1}`}
              >
                {PARTICLE_IDS.map((particleId) => (
                  <span
                    key={`${fireworkId}:${particleId}`}
                    className="poker-result-firework-particle"
                  />
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {phase === 'resolved' && overlayTone === 'is-failure' ? (
          <div className="poker-result-failure-burst" aria-hidden="true" />
        ) : null}
      </section>
    </div>
  );
}
