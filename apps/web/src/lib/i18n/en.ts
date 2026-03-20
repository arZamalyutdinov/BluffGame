import type {
  AppErrorCode,
  ClaimCategory,
  ClaimOrderPreset,
  FlushRule,
  JokerRule,
  Rank,
  ShowdownDrawRule,
  StraightLowRank,
  Suit,
} from '@bluff-game/shared';

const enRankLabels: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const enRankWordSingular: Record<Rank, string> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'jack',
  12: 'queen',
  13: 'king',
  14: 'ace',
};

const enRankWordPlural: Record<Rank, string> = {
  2: 'twos',
  3: 'threes',
  4: 'fours',
  5: 'fives',
  6: 'sixes',
  7: 'sevens',
  8: 'eights',
  9: 'nines',
  10: 'tens',
  11: 'jacks',
  12: 'queens',
  13: 'kings',
  14: 'aces',
};

const enRankShortPlural: Record<Rank, string> = {
  2: '2s',
  3: '3s',
  4: '4s',
  5: '5s',
  6: '6s',
  7: '7s',
  8: '8s',
  9: '9s',
  10: '10s',
  11: 'Js',
  12: 'Qs',
  13: 'Ks',
  14: 'As',
};

const enStraightLowRankLabels: Record<StraightLowRank, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
};

const enStraightLowRankWords: Record<StraightLowRank, string> = {
  1: 'ace',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
};

const enSuitNames: Record<Suit, string> = {
  clubs: 'clubs',
  diamonds: 'diamonds',
  hearts: 'hearts',
  spades: 'spades',
};

const enSuitChoiceLabels: Record<Suit, string> = {
  clubs: '♣ Clubs',
  diamonds: '♦ Diamonds',
  hearts: '♥ Hearts',
  spades: '♠ Spades',
};

const enClaimCategoryLabels: Record<ClaimCategory, string> = {
  'high-card': 'High card',
  pair: 'Pair',
  'two-pair': 'Two pair',
  'three-of-a-kind': 'Trips',
  straight: 'Straight',
  flush: 'Flush',
  'full-house': 'Full house',
  'four-of-a-kind': 'Quads',
  'straight-flush': 'Straight flush',
};

const enClaimOrderLabels: Record<ClaimOrderPreset, string> = {
  'flush-below-straight': 'Flush below straight',
  'standard-poker': 'Standard poker',
  'flush-below-trips-and-straight': 'Flush below trips and straight',
};

const enClaimOrderDescriptions: Record<ClaimOrderPreset, string> = {
  'flush-below-straight':
    'Classic poker ladder, except flush ranks below straight.',
  'standard-poker': 'Standard poker hand ordering.',
  'flush-below-trips-and-straight':
    'Flush ranks below both trips and straight.',
};

const enFlushRuleLabels: Record<FlushRule, string> = {
  'suit-only': 'Suit only',
  'suit-plus-rank': 'Suit + card',
};

const enFlushRuleDescriptions: Record<FlushRule, string> = {
  'suit-only':
    'Keep the current suit-spoken flush rule. A flush is raised by suit only.',
  'suit-plus-rank':
    'Speak flushes as suit first, then a named suited card. A legal raise may keep one axis the same, but neither the suit nor the named card may go down.',
};

const enShowdownDrawRuleLabels: Record<ShowdownDrawRule, string> = {
  'revealed-only': 'Revealed only',
  'draw-until-miss': 'Draw until miss',
};

const enShowdownDrawRuleDescriptions: Record<ShowdownDrawRule, string> = {
  'revealed-only':
    'Resolve checks from the revealed hands only, with no extra deck draws.',
  'draw-until-miss':
    'After a check, reveal top-deck cards one by one. Keep each draw only while it improves the spoken claim, and stop at the first dead draw or when the claim completes.',
};

const enJokerRuleLabels: Record<JokerRule, string> = {
  off: 'No jokers',
  'two-jokers': 'Two jokers',
};

const enJokerRuleDescriptions: Record<JokerRule, string> = {
  off: 'Play with the current 52-card deck and no wild jokers.',
  'two-jokers':
    'Add one red and one black joker as full wild cards. Red joker can stand in for hearts or diamonds, and black joker can stand in for clubs or spades when suit matters.',
};

const enErrors: Record<AppErrorCode, string> = {
  'invalid-request': 'The request was invalid.',
  'unexpected-server-error': 'Unexpected server error.',
  'command-rejected': 'The command could not be processed.',
  'connect-failed': 'The live room connection could not be established.',
  'network-unreachable':
    'Cannot reach the game server. Start the backend on port 3001 or run `pnpm dev`.',
  'server-unavailable':
    'The game server is unavailable. Make sure the backend is running on port 3001.',
  'request-failed': 'Request failed.',
  'viewer-not-in-room': 'Viewer is not part of this room.',
  'display-name-required': 'Display name is required.',
  'room-join-lobby-only':
    'You can only join rooms that are still in the lobby.',
  'room-full': 'This room is already full.',
  'invalid-session-token': 'Session token is invalid for this player.',
  'leave-during-match-unsupported':
    'Leaving during an active match is not supported in v1.',
  'bot-add-lobby-only':
    'Bots can only be added while the room is in the lobby.',
  'bot-remove-lobby-only':
    'Bots can only be removed while the room is in the lobby.',
  'ready-lobby-only':
    'Ready state can only change while the room is in the lobby.',
  'settings-lobby-only':
    'Room settings can only change while the room is in the lobby.',
  'start-match-lobby-only': 'The match can only start from the lobby.',
  'start-match-min-players': 'At least two players are required to start.',
  'start-match-ready-required':
    'Every player must be marked ready before the host can start.',
  'start-match-no-starter': 'Unable to choose a starting seat.',
  'dealing-in-progress': 'Cards are still being dealt.',
  'no-turn-timer': 'There is no active turn timer to pause.',
  'chat-message-empty': 'Chat message cannot be empty.',
  'spectator-reveal-for-eliminated-humans-only':
    'Only eliminated human spectators can reveal live cards.',
  'self-spectate-use-stop-playing':
    'Use the stop-playing action to spectate yourself.',
  'winner-undetermined': 'A winning player could not be determined.',
  'next-starter-undetermined':
    'The next starter could not be determined after result hold.',
  'room-not-found': 'Room not found.',
  'player-not-found': 'Player not found in this room.',
  'seat-not-found': 'Seat not found in this room.',
  'no-active-match': 'There is no active match in this room.',
  'host-only': 'Only the host can do that.',
  'display-name-in-use': 'That display name is already in use in this room.',
  'match-already-complete': 'The match is already complete.',
  'player-already-spectating': 'That player is already spectating.',
  'game-paused': 'The game is paused.',
  'result-still-showing': 'The previous round is still being shown.',
  'not-your-turn': 'It is not your turn.',
  'claim-not-stronger':
    'Each claim must be strictly stronger than the previous one.',
  'no-claim-to-challenge': 'There is no claim to challenge yet.',
  'player-not-bot': 'That player is not a bot.',
};

export const enCatalog = {
  meta: {
    nativeName: 'English',
  },
  text: {
    languageLabel: 'Language',
    privateTables: 'Private bluff tables',
    appTitle: 'BluffGame',
    privateRoomFlow: 'Private room flow',
    snapshotRoomSync: 'Snapshot room sync',
    playersRange: '2-8 players',
    close: 'Close',
    backHome: 'Back home',
    players: 'Players',
    chat: 'Chat',
    roomChat: 'Room chat',
    pause: 'Pause',
    resume: 'Resume',
    connected: 'connected',
    offline: 'offline',
    live: 'live',
    reconnecting: 'reconnecting',
    you: 'You',
    bot: 'Bot',
    host: 'Host',
    acting: 'Acting',
    paused: 'Paused',
    pressure: 'Pressure',
    out: 'Out',
    ready: 'Ready',
    spectating: 'spectating',
    choose: 'Choose',
    select: 'Select',
    submitClaim: 'Submit claim',
    claimBuilder: 'Claim builder',
    buildYourClaim: 'Build your claim',
    showdown: 'Showdown',
    timeout: 'Timeout',
    claimFound: 'Claim found',
    bluffCaught: 'Bluff caught',
    checkingClaim: 'Checking claim',
    drawingFromDeck: 'Drawing from deck',
    spokenClaim: 'Spoken claim',
    lastTableClaim: 'Last table claim',
    topDeckReveal: 'Top-deck reveal',
    noMessagesYet: 'No messages yet.',
    message: 'Message',
    send: 'Send',
    sending: 'Sending...',
    readOnly: 'Read only',
    hostCanEdit: 'Host can edit',
    tableOrder: 'Table order',
    spectators: 'Spectators',
    watching: 'watching',
    active: 'active',
    match: 'Match',
  },
  home: {
    atmosphereBadge: 'Neon table atmosphere',
    syncBadge: 'Authoritative room sync',
    eyebrow: 'Browser bluffing',
    titleLead: 'Run the table.',
    titleAccent: 'Sell the lie.',
    lead: 'Private multiplayer bluff rounds with exact-claim showdowns, room-code reconnects, and a live match scene that feels closer to a stylized card table than a plain dashboard.',
    legalClaimTitle: 'Legal claim ladder',
    legalClaimBody:
      'Every raise stays inside the room rules and every bluff can be checked against the revealed pool.',
    humansBotsTitle: 'Humans and bots',
    humansBotsBody:
      'Fill a private room with friends or use host-added bots to keep the bluff table moving.',
    livePressureTitle: 'Live turn pressure',
    livePressureBody:
      'Keep the pace high with a room timer, pause control, and a server-owned result sequence.',
    privateTableLabel: 'Private table',
    privateTableTitle: 'Match-ready rooms',
    openTableEyebrow: 'Open a table',
    openTableTitle: 'Create or join a room',
    openTableLead:
      'Use your display name once, then spin up a private code or jump back into a live room.',
    displayName: 'Display name',
    displayNamePlaceholder: 'Enter your name',
    roomCode: 'Room code',
    roomCodePlaceholder: 'ABCD',
    createRoom: 'Create room',
    creating: 'Creating...',
    joinRoom: 'Join room',
    joining: 'Joining...',
    createFallback: 'Unable to create room.',
    joinFallback: 'Unable to join room.',
  },
  room: {
    missingSessionTitle: 'Missing room session',
    missingSessionLead: (roomCode: string) =>
      `This browser does not have a saved session for room ${roomCode}. Create or join the room from the home page first.`,
    connectingTitle: (roomCode: string) => `Connecting to room ${roomCode}`,
    connectingLead: 'Waiting for the authoritative room snapshot.',
  },
  lobby: {
    seatedCount: (count: number, max: number) => `${count}/${max} seated`,
    turnTimer: (seconds: number) => `${seconds}s turn timer`,
    currentLobby: 'Current lobby',
    roomTitle: (code: string) => `Room ${code}`,
    roomLead:
      'Seats stay fixed clockwise around the table. Everyone must be ready before the host can deal the opening round, and changing lobby rules resets human ready states.',
    markReady: 'Mark ready',
    markNotReady: 'Mark not ready',
    addBot: 'Add bot',
    removeBot: 'Remove bot',
    startMatch: 'Start match',
    leaveRoom: 'Leave room',
    houseRules: 'House rules',
    roomSettings: 'Room settings',
    combinationOrder: 'Combination order',
    flushRule: 'Flush rule',
    showdownDeckRule: 'Showdown deck rule',
    jokers: 'Jokers',
    eliminationHandSize: 'Elimination hand size',
    turnTimeLimit: 'Turn time limit',
    playersTitle: 'Players',
    readyCount: (ready: number, total: number) => `${ready}/${total} ready`,
    hostBadge: 'host',
    waitingToStart: 'Waiting for the host to start the match.',
    hostLead:
      'Host controls the launch. Adjust rules, then deal the first round.',
    seatLabel: (seatIndex: number) => `Seat ${seatIndex + 1}`,
    seatHostLabel: (seatIndex: number) => `Seat ${seatIndex + 1} • host`,
    readyStatus: 'ready',
    notReadyStatus: 'not ready',
    connectedStatus: 'connected',
    disconnectedStatus: 'disconnected',
    eliminationValue: (value: number) => `${value} cards`,
    turnTimeValue: (seconds: number) => `${seconds} seconds`,
    eliminationDescription:
      'A player who loses while already holding this many cards is eliminated instead of drawing more.',
    turnTimerDescription:
      'If the active player runs out of time, they automatically lose the round. The host can pause or resume the live turn clock during a match.',
  },
  table: {
    winnerMessage: (name: string) => `${name} won the match.`,
    dealingMessage: (count: number) =>
      `Dealing cards from the top rail to ${count} seats.`,
    pausedClock: 'The turn clock is paused.',
    roundResultShown: 'Round result is being shown.',
    spectatingMessage: 'You are spectating the remaining players.',
    raiseOrCheck: 'Raise the current claim or check it.',
    openRound: 'Open the round with any legal claim.',
    waitingForPlayer: (name: string) => `Waiting for ${name} to act.`,
    dealingPotLabel: 'Dealing round',
    dealingPotTitle: 'Cards on the way',
    dealingPotDetail: 'One card at a time from the upper rail.',
    clockPausedLabel: 'Clock paused',
    tableWaiting: 'Table waiting',
    pausedOnPlayer: (name: string) => `Paused on ${name}.`,
    claimSetPace: (name: string) => `${name} set the pace.`,
    hostPausedClock: 'The host paused the turn clock.',
    claimOnTable: 'Claim on table',
    openTable: 'Open table',
    noClaimYet: 'No claim yet',
    currentClaimLabel: 'Current claim',
    cardsInRound: 'Cards in round',
    dealingNow: 'Dealing now',
    dealingAria: 'Dealing cards from the deck',
    matchWinner: 'Match winner',
    matchClosed: 'The table is closed until the host returns to the lobby.',
    closeClaimBuilder: 'Close claim builder',
    selectedClaim: (label: string) => `Selected: ${label}`,
    strongerClaimPrompt: 'Choose a stronger claim than the one on the table.',
    openingClaimPrompt: 'Choose the claim that opens the round.',
    roundTitle: (roundNumber: number) => `Round ${roundNumber}`,
    dealingLead: 'Cards are being dealt from the upper rail.',
    resolvingLead: 'Resolving the last round.',
    pausedLead: (name: string) => `Paused on ${name}.`,
    yourTurnLead: 'Your turn.',
    actingLead: (name: string) => `${name} is acting.`,
    hidePlayers: 'Hide players',
    hideChat: 'Hide chat',
    roomCode: (code: string) => `Room ${code}`,
    turnHandoff: 'Turn handoff',
    yourMove: 'Your move',
    playerToAct: (name: string) => `${name} to act`,
    returnToLobby: 'Return to lobby',
    waitingForHost: 'Waiting for the host to return to the lobby.',
    spectatingFromRail: 'Spectating from the rail',
    canSeeActiveHands: 'You can currently see the active hands live.',
    revealPrompt: 'Reveal live cards if you want to peek at the active hands.',
    hideActiveHands: 'Hide active hands',
    spectatorMode: 'Spectator mode',
    hideLiveCards: 'Hide live cards',
    revealLiveCards: 'Reveal live cards',
    raiseTheTable: 'Raise the table',
    startTheRound: 'Start the round',
    closeBuilder: 'Close builder',
    editClaim: 'Edit claim',
    buildClaim: 'Build claim',
    openClaim: 'Open claim',
    callItNow: 'Call it now',
    check: 'Check',
    closeSidePanels: 'Close side panels',
    turnClock: 'Turn clock',
    activePlayer: 'Active player',
    critical: 'Critical',
    warning: 'Warning',
    hostPausedSeat: 'The host has paused the clock for the current seat.',
    playerOnClock: (name: string) => `${name} is on the clock.`,
    liveHand: 'Live hand',
    spectatorRevealOn: 'Live card reveal is on for you.',
    spectatorRevealOff: 'Live card reveal is off for you.',
    kick: 'Kick',
    stopPlaying: 'Stop playing',
    noClaimsYet: 'No claims yet.',
    checked: 'Checked',
    checker: 'Checker',
    lost: 'Lost',
    timedOut: 'Timed out',
    watchingFromRail: 'Watching from the rail.',
    stayAsSpectator: 'You will stay in the room as a spectator.',
    reconnectKickHint:
      'Waiting for reconnect. You can kick this player to the spectator rail.',
    claimPotLine: (name: string, claimLabel: string) =>
      `${name} ${claimLabel}.`,
    seatHandAria: (name: string, count: number, isDealing: boolean) =>
      `${name}, ${count} ${count === 1 ? 'card' : 'cards'} ${isDealing ? 'dealt so far' : 'in hand'}`,
    cardsReady: (count: number) =>
      `${count} ${count === 1 ? 'card' : 'cards'} ready`,
    cardCount: (count: number) => `${count} ${count === 1 ? 'card' : 'cards'}`,
    dealtCount: (count: number) => `${count} dealt`,
    dealtProgress: (shown: number, total: number) => `${shown}/${total} dealt`,
    activeCount: (count: number) => `${count} active`,
    watchingCount: (count: number) => `${count} watching`,
    seatMeta: (seatIndex: number, isHost: boolean) =>
      `Seat ${seatIndex + 1}${isHost ? ' • host' : ''}`,
    totalLiveCards: 'Total live cards still in play.',
    backToPreviousClaimPart: 'Back to the previous claim part',
    backToCombinationTypes: 'Back to combination types',
    chosenParts: 'Chosen parts',
    combinationType: 'Combination type',
    claimFallback: 'Claim',
    noStrongerClaimsRemain:
      'No stronger claims remain. The next player must check.',
    dealtSoFar: 'dealt so far',
    inHand: 'in hand',
    selfDealtHandAria: 'Dealt cards so far',
    yourHand: (count: number) =>
      `Your hand · ${count} ${count === 1 ? 'card' : 'cards'}`,
    yourSeat: 'Your seat',
  },
  chat: {
    placeholder: 'Say something to the room',
    openEmojiPicker: 'Open emoji picker',
    closeEmojiPicker: 'Close emoji picker',
    searchPlaceholder: 'Search emojis',
    searchClearButtonLabel: 'Clear emoji search',
    previewCaption: "What's your mood?",
    loadingPicker: 'Loading emoji picker...',
  },
  claims: {
    categoryLabels: enClaimCategoryLabels,
    stepTitles: {
      rank: 'High card',
      pairRank: 'Pair rank',
      highPairRank: 'First pair',
      lowPairRank: 'Second pair',
      tripRank: 'Triplet',
      lowRank: 'Straight',
      suit: 'Flush suit',
      flushRank: 'Named card',
      fullHousePairRank: 'Pair',
      quadRank: 'Quad rank',
      straightFlushSuit: 'Straight-flush suit',
    },
    helpers: {
      highCard: 'Choose the card that sets the opening high-card claim.',
      pair: 'Choose the pair you want to speak.',
      firstPair: 'Choose the higher pair first.',
      secondPair: 'Choose the lower pair that completes the hand.',
      trips: 'Choose the triplet you want to speak.',
      straight: 'Choose the straight by its spoken low card.',
      flushSuitFirst: 'Build the flush suit first.',
      flushNamedCard: 'Name the suited card contained inside the flush.',
      flushSuitOnly: 'Choose the suit for the flush.',
      fullHouseTrips: 'Choose the triplet first.',
      fullHousePair: 'Choose the pair that completes the house.',
      quads: 'Choose the quads you want to claim.',
      straightFlushSuit: 'Choose the suit first.',
      straightFlushStraight: 'Choose the straight by its spoken low card.',
    },
    legalPaths: (count: number) =>
      `${count} legal ${count === 1 ? 'path' : 'paths'}`,
    categoryButtonMeta: 'Choose',
    optionSelect: 'Select',
    highCardCompact: (rank: string) => `${rank}-high`,
    highCardFull: (rankWord: string) => `high card ${rankWord}`,
    pairCompact: (rankShortPlural: string) => `pair of ${rankShortPlural}`,
    pairFull: (rankPlural: string) => `pair of ${rankPlural}`,
    twoPairCompact: (high: string, low: string) => `${high} & ${low}`,
    twoPairFull: (high: string, low: string) => `${high} and ${low}`,
    tripsCompact: (rankShortPlural: string) => `trips ${rankShortPlural}`,
    tripsFull: (rankPlural: string) => `three ${rankPlural}`,
    straightCompact: (lowLabel: string) => `${lowLabel}-low straight`,
    straightFull: (lowWord: string) => `${lowWord}-low straight`,
    flushCompact: (suitSymbol: string, rankLabel?: string) =>
      rankLabel ? `${suitSymbol} flush + ${rankLabel}` : `${suitSymbol} flush`,
    flushFull: (suitName: string, rankWord?: string) =>
      rankWord ? `${suitName} flush with ${rankWord}` : `${suitName} flush`,
    fullHouseCompact: (tripShortPlural: string, pairShortPlural: string) =>
      `${tripShortPlural} full of ${pairShortPlural}`,
    fullHouseFull: (tripPlural: string, pairPlural: string) =>
      `${tripPlural} full of ${pairPlural}`,
    quadsCompact: (rankShortPlural: string) => `quads ${rankShortPlural}`,
    quadsFull: (rankPlural: string) => `four ${rankPlural}`,
    straightFlushCompact: (lowLabel: string, suitSymbol: string) =>
      `${lowLabel}-low ${suitSymbol} straight flush`,
    straightFlushFull: (lowWord: string, suitName: string) =>
      `${lowWord}-low ${suitName} straight flush`,
  },
  showdown: {
    unknownPlayer: 'Unknown',
    drawRevealHint: 'Top-deck cards are being revealed one by one.',
    timeoutTitle: (name: string) => `${name} ran out of time`,
    claimFoundText: (
      challenger: string,
      claimant: string,
      claimLabel: string,
    ) => `${challenger} checked ${claimant}, but ${claimLabel} was there.`,
    bluffCaughtText: (
      challenger: string,
      claimant: string,
      claimLabel: string,
    ) => `${challenger} checked ${claimant}, and ${claimLabel} was not there.`,
    timeoutWithClaim: (name: string, claimLabel: string) =>
      `${name} ran out of time with ${claimLabel} still on the table.`,
    timeoutOpening: 'The round ended before the opening claim was made.',
    suspenseDeck: 'The outcome stays hidden until the final deck card settles.',
    suspenseResolve: 'The outcome stays hidden until the final resolve beat.',
    verdictWaits: (challenger: string, claimant: string) =>
      `${challenger} checked ${claimant}. The verdict lands after the reveal settles.`,
    loserNextRound: (name: string, handSize: number) =>
      `${name} goes to ${handSize} ${handSize === 1 ? 'card' : 'cards'} next round.`,
    loserEliminated: (name: string) => `${name} is out of the match.`,
    timeoutNote: (claimLabel: string) =>
      `The table claim stayed at ${claimLabel} when the clock expired.`,
    timeoutOpeningNote:
      'The clock expired before any opening claim was spoken.',
    timeoutNoValidation: 'Timeout ends the round without validating the claim.',
  },
  cards: {
    rankLabels: enRankLabels,
    rankWordSingular: enRankWordSingular,
    rankWordPlural: enRankWordPlural,
    rankShortPlural: enRankShortPlural,
    straightLowRankLabels: enStraightLowRankLabels,
    straightLowRankWords: enStraightLowRankWords,
    suitNames: enSuitNames,
    suitChoiceLabels: enSuitChoiceLabels,
    jokerCornerLabels: {
      red: 'RJ',
      black: 'BJ',
    },
    jokerCenterLabel: 'JOKER',
  },
  settings: {
    claimOrderLabels: enClaimOrderLabels,
    claimOrderDescriptions: enClaimOrderDescriptions,
    flushRuleLabels: enFlushRuleLabels,
    flushRuleDescriptions: enFlushRuleDescriptions,
    showdownDrawRuleLabels: enShowdownDrawRuleLabels,
    showdownDrawRuleDescriptions: enShowdownDrawRuleDescriptions,
    jokerRuleLabels: enJokerRuleLabels,
    jokerRuleDescriptions: enJokerRuleDescriptions,
  },
  errors: enErrors,
} as const;

type WidenLocaleValue<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends (...args: infer Args) => infer Result
        ? (...args: Args) => Result
        : T extends readonly (infer Item)[]
          ? ReadonlyArray<WidenLocaleValue<Item>>
          : T extends object
            ? { [Key in keyof T]: WidenLocaleValue<T[Key]> }
            : T;

export type LocaleCatalog = WidenLocaleValue<typeof enCatalog>;
