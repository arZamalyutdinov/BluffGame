import type { LocaleCatalog } from './en.js';
import { enCatalog } from './en.js';

export const enOrkishCatalog = {
  ...enCatalog,
  meta: {
    nativeName: 'Orkish',
  },
  text: {
    ...enCatalog.text,
    languageLabel: 'Lingo',
    privateTables: 'Private scrap tables',
    privateRoomFlow: 'Private scrap roomz',
    snapshotRoomSync: 'Warboss room sync',
    playersRange: '2-8 boyz',
    close: 'Shut it',
    backHome: 'Back ta base',
    players: 'Boyz',
    chat: 'Jawin',
    roomChat: 'Room jawin',
    pause: 'Hold up',
    resume: 'Get movin',
    connected: 'hooked up',
    offline: 'gone missin',
    reconnecting: 'hookin back up',
    host: 'Warboss',
    acting: 'Krumpin',
    out: 'Krumped',
    spectating: 'watchin',
    select: 'Grab',
    submitClaim: 'Shout claim',
    claimBuilder: 'Claim mekshop',
    buildYourClaim: 'Build yer claim',
    showdown: 'Face-off',
    timeout: 'Too slow',
    claimFound: 'Claim woz real',
    bluffCaught: 'Bluff got krumped',
    checkingClaim: 'Checkin claim',
    drawingFromDeck: 'Drawin from da deck',
    lastTableClaim: 'Last claim on da table',
    topDeckReveal: 'Top-deck flip',
    noMessagesYet: 'No jawin yet.',
    send: 'Send it',
    sending: 'Sendin...',
    hostCanEdit: 'Warboss can tweak it',
    spectators: 'Looky boyz',
    watching: 'watchin',
    active: 'scrappin',
    match: 'Scrap',
  },
  home: {
    ...enCatalog.home,
    atmosphereBadge: 'Neon scrap-table vibe',
    syncBadge: 'Warboss-approved room sync',
    eyebrow: 'Browser bluffin',
    titleLead: 'Run da table.',
    titleAccent: 'Sell da lie.',
    lead: 'Private multiplayer bluff rounds with exact-claim face-offs, room-code reconnects, and a live match scene that feels like a propa card scrap instead of a plain dashboard.',
    legalClaimBody:
      'Every raise stays inside da room rules, and every bluff can be checked against da revealed pool.',
    humansBotsTitle: 'Boyz and botz',
    humansBotsBody:
      'Fill a private room with mates or let da warboss add botz ta keep da scrap movin.',
    livePressureBody:
      'Keep da pace high with a room timer, pause control, and a server-run result sequence.',
    privateTableTitle: 'Scrap-ready rooms',
    openTableLead:
      'Use yer display name once, den spin up a private code or jump back into a live room.',
    displayNamePlaceholder: 'Enter yer name',
    createRoom: 'Make room',
    creating: 'Makin room...',
    joining: 'Joinin room...',
    createFallback: 'Could not make da room.',
    joinFallback: 'Could not join da room.',
  },
  room: {
    ...enCatalog.room,
    missingSessionLead: (roomCode: string) =>
      `Dis browser does not got a saved session for room ${roomCode}. Make or join da room from da home page first.`,
    connectingTitle: (roomCode: string) => `Hookin up ta room ${roomCode}`,
    connectingLead: 'Waitin for da boss-approved room snapshot.',
  },
  lobby: {
    ...enCatalog.lobby,
    currentLobby: 'Current camp',
    roomLead:
      'Seats stay fixed round da table. Everyboy has ta be ready before da warboss can deal da openin round, and changin room rules resets human ready states.',
    removeBot: 'Boot bot',
    startMatch: 'Start scrap',
    roomSettings: 'Room gubbinz',
    playersTitle: 'Boyz',
    hostBadge: 'warboss',
    waitingToStart: 'Waitin for da warboss ta start da scrap.',
    hostLead: 'Da warboss starts it. Tweak da rules, den deal da first round.',
    seatHostLabel: (seatIndex: number) => `Seat ${seatIndex + 1} • warboss`,
    eliminationDescription:
      'A player who loses while already holdin dis many cards gets booted instead of drawin more.',
    turnTimerDescription:
      'If da active player runs outta time, dey auto-lose da round. Da warboss can pause or resume da live turn clock during a match.',
  },
  table: {
    ...enCatalog.table,
    winnerMessage: (name: string) => `${name} won da scrap.`,
    dealingMessage: (count: number) =>
      `Dealin cards from da top rail ta ${count} seats.`,
    roundResultShown: 'Round result is showin.',
    spectatingMessage: 'You are watchin da remaining players.',
    raiseOrCheck: 'Raise da current claim or check it.',
    openRound: 'Open da round with any legal claim.',
    waitingForPlayer: (name: string) => `Waitin for ${name} ta act.`,
    dealingPotLabel: 'Dealin round',
    dealingPotDetail: 'One card at a time from da upper rail.',
    tableWaiting: 'Table waitin',
    claimSetPace: (name: string) => `${name} set da pace.`,
    hostPausedClock: 'Da warboss paused da turn clock.',
    matchWinner: 'Scrap winner',
    matchClosed: 'Da table is closed till da warboss sends everyone back ta lobby.',
    closeClaimBuilder: 'Shut claim mekshop',
    selectedClaim: (label: string) => `Picked: ${label}`,
    strongerClaimPrompt: 'Pick a stronger claim than da one on da table.',
    openingClaimPrompt: 'Pick da claim that opens da round.',
    dealingLead: 'Cards are flyin from da upper rail.',
    resolvingLead: 'Sortin out da last round.',
    yourTurnLead: 'Yer turn.',
    actingLead: (name: string) => `${name} is up.`,
    hidePlayers: 'Hide boyz',
    hideChat: 'Hide jawin',
    gameOptions: 'Gubbinz',
    gameOptionsLabel: 'Game gubbinz',
    gameOptionsTitle: 'Personal gubbinz',
    yourMove: 'Yer move',
    waitingForHost: 'Waitin for da warboss ta send everyone back ta lobby.',
    spectatingFromRail: 'Watchin from da rail',
    canSeeActiveHands: 'You can see da live hands right now.',
    revealPrompt: 'Reveal live cards if ya wanna peek at da active hands.',
    hideActiveHands: 'Hide live hands',
    spectatorMode: 'Looky mode',
    raiseTheTable: 'Raise it',
    startTheRound: 'Start da round',
    closeBuilder: 'Shut builder',
    editClaim: 'Tweak claim',
    closeSidePanels: 'Shut side panels',
    hostPausedSeat: 'Da warboss paused da clock for dis seat.',
    watchingFromRail: 'Watchin from da rail.',
    stayAsSpectator: 'You stay in da room as a looky boy.',
    reconnectKickHint:
      'Waitin for reconnect. You can kick dis player ta da spectator rail.',
    seatMeta: (seatIndex: number, isHost: boolean) =>
      `Seat ${seatIndex + 1}${isHost ? ' • warboss' : ''}`,
    backToPreviousClaimPart: 'Back ta da previous claim part',
    backToCombinationTypes: 'Back ta claim types',
    chosenParts: 'Chosen bits',
    combinationType: 'Claim type',
    claimSearchHint:
      'Search by rank, suit, category, or compact claim text ta jump straight ta a legal claim.',
    noStrongerClaimsRemain:
      'No stronger claims are left. Da next player has ta check.',
    autoOpenClaimBuilderOption:
      'Open da claim builder automatically when it is yer turn',
    autoOpenClaimBuilderHint:
      'Dis sticks in dis browser across rooms and only opens once per turn.',
    yourHand: (count: number) =>
      `Yer hand · ${count} ${count === 1 ? 'card' : 'cards'}`,
    yourSeat: 'Yer seat',
  },
  chat: {
    ...enCatalog.chat,
    placeholder: 'Say somethin ta da room',
    previewCaption: 'Wot mood are ya in?',
    loadingPicker: 'Loadin emoji picker...',
  },
  claims: {
    ...enCatalog.claims,
    categoryLabels: {
      ...enCatalog.claims.categoryLabels,
      'high-card': 'Bigga card',
      'three-of-a-kind': 'Tripz',
      'four-of-a-kind': 'Quadz',
    },
    helpers: {
      ...enCatalog.claims.helpers,
      highCard: 'Pick da card that sets da openin high-card claim.',
      pair: 'Pick da pair ya wanna shout.',
      firstPair: 'Pick da bigger pair first.',
      secondPair: 'Now pick da lower pair that finishes da hand.',
      trips: 'Pick da triplet ya wanna shout.',
      straight: 'Pick da straight by its spoken low card.',
      flushSuitFirst: 'Build da flush suit first.',
      flushNamedCard: 'Name da suited card inside da flush.',
      flushSuitOnly: 'Pick da suit for da flush.',
      fullHouseTrips: 'Pick da triplet first.',
      fullHousePair: 'Now pick da pair that completes da house.',
      quads: 'Pick da quads ya wanna claim.',
      straightFlushSuit: 'Pick da suit first.',
      straightFlushStraight: 'Now pick da straight by its spoken low card.',
    },
    legalPaths: (count: number) =>
      `${count} legal ${count === 1 ? 'path' : 'paths'}`,
    categoryButtonMeta: 'Pick',
    optionSelect: 'Grab',
    highCardFull: (rankWord: string) => `${rankWord}-high`,
    pairCompact: (rankShortPlural: string) => `pair o ${rankShortPlural}`,
    pairFull: (rankPlural: string) => `pair o ${rankPlural}`,
    twoPairCompact: (high: string, low: string) => `${high} an ${low}`,
    twoPairFull: (high: string, low: string) => `${high} an ${low}`,
    tripsCompact: (rankShortPlural: string) => `tripz ${rankShortPlural}`,
    flushFull: (suitName: string, rankWord?: string) =>
      rankWord ? `${suitName} flush wiv ${rankWord}` : `${suitName} flush`,
    fullHouseCompact: (tripShortPlural: string, pairShortPlural: string) =>
      `${tripShortPlural} full o ${pairShortPlural}`,
    fullHouseFull: (tripPlural: string, pairPlural: string) =>
      `${tripPlural} full o ${pairPlural}`,
    quadsCompact: (rankShortPlural: string) => `quadz ${rankShortPlural}`,
  },
  showdown: {
    ...enCatalog.showdown,
    drawRevealHint: 'Top-deck cards are flippin one by one.',
    timeoutTitle: (name: string) => `${name} ran outta time`,
    claimFoundText: (
      challenger: string,
      claimant: string,
      claimLabel: string,
    ) => `${challenger} checked ${claimant}, but ${claimLabel} woz there.`,
    bluffCaughtText: (
      challenger: string,
      claimant: string,
      claimLabel: string,
    ) => `${challenger} checked ${claimant}, and ${claimLabel} woz not there.`,
    timeoutWithClaim: (name: string, claimLabel: string) =>
      `${name} ran outta time with ${claimLabel} still on da table.`,
    timeoutOpening: 'Da round ended before da openin claim got shouted.',
    suspenseDeck: 'Da outcome stays hidden till da final deck card settles.',
    suspenseResolve: 'Da outcome stays hidden till da final reveal beat.',
    verdictWaits: (challenger: string, claimant: string) =>
      `${challenger} checked ${claimant}. Da verdict lands after da reveal settles.`,
    loserEliminated: (name: string) => `${name} is outta da scrap.`,
    timeoutNote: (claimLabel: string) =>
      `Da table claim stayed at ${claimLabel} when da clock ran dry.`,
    timeoutOpeningNote:
      'Da clock ran dry before any openin claim got shouted.',
    timeoutNoValidation: 'Timeout ends da round without validatin da claim.',
  },
  cards: {
    ...enCatalog.cards,
    suitNames: {
      clubs: 'clubz',
      diamonds: 'diamondz',
      hearts: 'heartz',
      spades: 'spadez',
    },
    suitChoiceLabels: {
      clubs: '♣ Clubz',
      diamonds: '♦ Diamondz',
      hearts: '♥ Heartz',
      spades: '♠ Spadez',
    },
  },
  settings: {
    ...enCatalog.settings,
    claimOrderDescriptions: {
      ...enCatalog.settings.claimOrderDescriptions,
      'flush-below-straight':
        'Classic poker ladder, only da flush sits under da straight.',
      'flush-below-trips-and-straight':
        'Flush sits under both trips and straight.',
    },
    flushRuleDescriptions: {
      ...enCatalog.settings.flushRuleDescriptions,
      'suit-only':
        'Keep da current suit-spoken flush rule. A flush gets raised by suit only.',
      'suit-plus-rank':
        'Speak flushes as suit first, den a named suited card. A legal raise can keep one bit da same, but da suit and da named card can never go down.',
    },
    showdownDrawRuleDescriptions: {
      ...enCatalog.settings.showdownDrawRuleDescriptions,
      'revealed-only':
        'Resolve checks from da revealed hands only, with no extra deck draws.',
      'draw-until-miss':
        'After a check, flip top-deck cards one by one. Keep each draw only while it improves da spoken claim, and stop on da first dead draw or when da claim is complete.',
    },
    jokerRuleDescriptions: {
      ...enCatalog.settings.jokerRuleDescriptions,
      off: 'Play with da usual 52-card deck and no wild jokers.',
      'two-jokers':
        'Add one red and one black joker as full wild cards. Da red joker stands in for hearts or diamonds, and da black joker stands in for clubs or spades when suit matters.',
    },
  },
  errors: {
    ...enCatalog.errors,
    'invalid-request': 'Dat request was busted.',
    'unexpected-server-error': 'Da server blew up in a weird way.',
    'command-rejected': 'Dat command got knocked back.',
    'connect-failed': 'Could not hook up ta da live room.',
    'network-unreachable':
      'Cannot reach da game server. Start da backend on port 3001 or run `pnpm dev`.',
    'server-unavailable':
      'Da game server is not around. Make sure da backend is runnin on port 3001.',
    'request-failed': 'Da request failed.',
    'viewer-not-in-room': 'Dat viewer aint in dis room.',
    'display-name-required': 'Ya gotta enter a display name.',
    'room-join-lobby-only':
      'You can only join rooms dat are still sittin in da lobby.',
    'room-full': 'Dis room is packed already.',
    'invalid-session-token': 'Dat session token does not fit dis player.',
    'leave-during-match-unsupported':
      'Leavin during an active match is not supported in v1.',
    'bot-add-lobby-only': 'Botz only get added while da room is in da lobby.',
    'bot-remove-lobby-only':
      'Botz only get removed while da room is in da lobby.',
    'ready-lobby-only':
      'Ready state only changes while da room is in da lobby.',
    'settings-lobby-only':
      'Room gubbinz only change while da room is in da lobby.',
    'start-match-lobby-only': 'Da scrap can only start from da lobby.',
    'start-match-min-players': 'Ya need at least two players ta start.',
    'start-match-ready-required':
      'Everyboy has ta be ready before da warboss can start da scrap.',
    'start-match-no-starter': 'Could not pick da openin seat.',
    'dealing-in-progress': 'Da cards are still flyin.',
    'no-turn-timer': 'Dere is no live turn timer ta pause.',
    'chat-message-empty': 'A message cannot be empty.',
    'spectator-reveal-for-eliminated-humans-only':
      'Only eliminated humie spectators can reveal live cards.',
    'self-spectate-use-stop-playing':
      'Use stop playin if ya wanna spectate yerself.',
    'winner-undetermined': 'Could not work out who won.',
    'next-starter-undetermined':
      'Could not work out da next starter after da result hold.',
    'room-not-found':
      'Room not found. Da server may have restarted and lost its in-memory rooms.',
    'player-not-found': 'Could not find dat player in dis room.',
    'seat-not-found': 'Could not find dat seat.',
    'no-active-match': 'Dere is no active match in dis room.',
    'host-only': 'Only da warboss can do dat.',
    'display-name-in-use': 'Dat display name is already taken in dis room.',
    'match-already-complete': 'Da match is already done.',
    'player-already-spectating': 'Dat player is already spectatin.',
    'game-paused': 'Da game is paused.',
    'result-still-showing': 'Da last round result is still showin.',
    'not-your-turn': 'It aint yer turn.',
    'claim-not-stronger':
      'Every new claim has ta be strictly stronger than da last one.',
    'no-claim-to-challenge': 'Dere is no claim ta check yet.',
    'player-not-bot': 'Dat player is not a bot.',
  },
} satisfies LocaleCatalog;
