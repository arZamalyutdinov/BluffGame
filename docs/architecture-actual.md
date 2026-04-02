# BluffGame Actual Architecture

This document describes the architecture that is implemented in the codebase
today. It is more concrete than `docs/architecture.md`, which remains the
higher-level planning document.

## Current Workspace

```text
.
├── apps/
│   ├── server/
│   │   └── src/
│   │       ├── index.ts
│   │       └── room-registry.ts
│   └── web/
│       └── src/
│           ├── App.tsx
│           ├── components/
│           └── lib/
├── docs/
│   ├── architecture.md
│   ├── architecture-actual.md
│   └── game-rules.md
└── packages/
    └── shared/
        └── src/
            ├── cards/
            ├── claims/
            ├── protocol/
            ├── resolution/
            ├── rules/
            ├── settings/
            └── state/
```

## Runtime Topology

There are two long-running processes in normal development:

1. `apps/server`: Fastify HTTP server plus Socket.IO gateway on port `3001`
2. `apps/web`: Vite dev server on port `5173`

The web app talks to the backend in two ways:

- HTTP for room bootstrap
- Socket.IO for live room updates and gameplay commands

The Vite config proxies `/api` and `/socket.io` to the backend during
development, so the browser only needs to know about the frontend origin.

In production, the Fastify server can also serve the built Vite client from
`apps/web/dist`. That lets the app run as a single Node web service on hosts
like Render while keeping the development workflow split into two processes.

## Shared Package Responsibilities

`packages/shared` is the contract layer between the server and client.

It currently contains:

- `cards`: card types, deck creation, shuffling, dealing, card labels
- `claims`: normalized claim types, comparison ordering, serialization to keys,
  display labels, and generated claim lists per preset
- `resolution`: shared timing constants and helpers for the animated
  round-result display window
- `rules`: exact-claim existence checks, showdown resolution, and starter
  rotation helpers
- `protocol`: Zod schemas for HTTP payloads, socket auth, commands, and room
  snapshots
- `settings`: room-setting defaults, preset labels, and numeric limits
- `state`: room snapshot, match snapshot, chat snapshot, showdown snapshot,
  and room session types

Important consequence: the frontend does not implement its own game rules. It
only renders shared types and sends commands.

## Backend Structure

### Entry Point

`apps/server/src/index.ts` wires together:

- Fastify
- CORS
- `/health`
- `POST /api/rooms`
- `POST /api/rooms/:roomCode/join`
- serving the built web client when `apps/web/dist` exists
- Socket.IO connection handling

The entrypoint does very little game logic directly. It delegates almost all
state changes to `RoomRegistry`.

### Room Registry

`apps/server/src/room-registry.ts` is the actual game server.

It owns:

- the in-memory `Map<string, RoomState>` of all active rooms
- per-room turn timer handles
- per-room bot turn handles
- room/player/match/round internal state
- bot seats with generated names
- per-player bluff and timeout memory for bot decision-making
- bounded per-room chat history
- host assignment
- session token validation
- duplicate-name enforcement for joins
- serialized per-room command execution
- round creation and dealing
- claim submission
- challenge resolution
- match restart
- projection of internal room state into public `RoomSnapshot` objects

### Internal State Shape

The server keeps more data than the client sees:

- player session token
- player socket id
- raw `handsByPlayerId` for the active round
- bounded room chat history
- seat-based turn tracking
- running or paused turn-clock state
- previous showdown details carried into the next snapshot
- previous timeout details carried into the next snapshot

The client never receives other players' hidden cards during normal play.

### Command Serialization

Every mutating room operation runs through `withRoomLock(code, action)`.

That method keeps a per-room promise chain in `roomQueues` so commands for the
same room execute one at a time. This is what prevents near-simultaneous socket
events from corrupting turn order or showdown resolution.

### Snapshot Projection

`buildSnapshot(code, viewerPlayerId)` takes internal room state and produces a
viewer-specific `RoomSnapshot`.

Important details:

- each connected player gets a separate snapshot
- `settings` are included on every room snapshot
- `chatMessages` are included on every room snapshot
- player rows include `isBot`
- `dealing` is included while a round is in the server-owned deal window
- `turnTimer` is included only while live turn play is active
- `yourHand` only contains the viewer's own cards
- public player rows include `cardCount`, not private card identities
- `showdown` is carried on the snapshot after a challenge resolves
- `timeout` is carried on the snapshot after a turn expires
- while `match.phase === 'dealing'` or `match.phase === 'showing-result'`, the
  result snapshot stays present but `turnTimer` is intentionally absent
- when the match ends, the snapshot includes `winnerPlayerId`

The backend always treats snapshots as authoritative render state.

## HTTP Bootstrap Flow

The browser does not create rooms through Socket.IO.

Current flow:

1. Browser calls `POST /api/rooms` with `displayName` to create a room
2. Or browser calls `POST /api/rooms/:roomCode/join` with `displayName`
3. Server returns a `RoomSession`
4. Browser stores that session in `localStorage`
5. Browser opens a Socket.IO connection using that session as auth

Bootstrap failures also return stable error payloads with a machine-readable
`code` plus an optional fallback `message`, so the web app can localize
user-facing errors without depending on raw English transport strings.

While a room page is open, the browser also sends a lightweight periodic
`GET /health` keepalive. This is a deployment mitigation for free-tier hosts
that may otherwise sleep long enough to wipe the server's in-memory room map.
It reduces sleep-related room loss, but it does not make rooms durable across a
true process restart.

`RoomSession` contains:

- `roomCode`
- `playerId`
- `sessionToken`
- `displayName`

Join requests are rejected if the room already contains the same display name
after the server's normal trimming and case-folding.

## Socket Connection Flow

On connection, the server validates:

- `roomCode`
- `playerId`
- `sessionToken`

If valid:

- the player is marked `connected`
- the new `socketId` is stored
- any previous socket for that player is disconnected
- the server broadcasts fresh snapshots

If invalid:

- the socket gets `commandRejected` with a stable error `code`
- the socket is disconnected immediately

## Current Socket Commands

Implemented inbound commands:

- `setReady`
- `addBot`
- `updateRoomSettings`
- `startMatch`
- `sendChatMessage`
- `submitClaim`
- `challengeClaim`
- `setMatchPaused`
- `restartMatch`
- `leaveRoom`

Implemented outbound events:

- `roomSnapshot`
- `commandRejected`

The planning docs mention more granular events like `roundStarted` and
`showdownResolved`, but the actual implementation currently relies on a single
snapshot event plus coded rejection payloads.

## Match Lifecycle In Code

### Lobby

While `room.phase === 'lobby'`:

- players can join
- the host can add bots until the room reaches `8` seats and can remove lobby
  bots again if needed
- players can toggle ready state
- the host can change room settings
- duplicate display names are rejected per room
- the host can start the match
- players can leave

Room settings currently include:

- `eliminationHandSize` in the range `2` to `6`
- `claimOrderPreset` with three supported presets
- `flushRule` with `suit-only` and `suit-plus-rank`
- `showdownDrawRule` with `revealed-only` and `draw-until-miss`
- `jokerRule` with `off` and `two-jokers`
- `turnTimeLimitSeconds` in the range `15` to `120`

If the host changes any setting, the server resets human player ready states to
`false` and keeps bot players ready.

The match only starts when:

- there are at least 2 players
- every player is ready
- the caller is the host

### Starting A Match

`startMatch`:

- resets all players to `handSize = 1` and `isEliminated = false`
- resets all spectator reveal preferences to `false`
- chooses a random starter seat
- creates a new round with shuffled/dealt hands from the room's selected deck
- enters the server-owned `dealing` phase first, then starts the first authoritative turn timer after the deal hold
- moves the room to `in-match`

### During A Round

The round keeps:

- `roundNumber`
- `starterSeatIndex`
- `currentTurnSeatIndex`
- `dealing`
- `turnTimer`
- `lastClaim`
- `lastClaimantPlayerId`
- `claimHistory`
- `handsByPlayerId`
- `remainingDeck`

The opening player can make any legal claim. Every later claim must be strictly
higher according to `compareClaims` using the room's selected
`claimOrderPreset`, except that `suit-plus-rank` flushes use a two-axis raise
rule where the suit and named card may each stay the same or go up, but
neither axis may go down. The legal flush-claim universe is generated from the
room's selected `flushRule`. The card pool itself may also include one red and
one black joker when the room's selected `jokerRule` enables them.

The server also owns the active turn timer. When a player acts successfully,
the next turn receives a fresh full timer. The host can pause and resume that
timer without changing the current turn owner.

Eliminated players stay in the room, but once the next live round begins they
drop out of the active seat layout and appear under a Spectators section in the
Players drawer instead. Eliminated human viewers also have a private
`spectatorRevealEnabled` preference that can expose active live hands in their
own snapshot only.

When the current turn belongs to a bot, the server also schedules a short
autonomous bot action. The bot strategy uses only the bot's own hand, public
claim history, public room state, and probability estimates over unseen cards.
It does not read other hidden hands directly.

### Challenging

`challengeClaim`:

1. collects every active player's cards
2. asks shared rules whether the exact spoken claim exists under the room's
   selected showdown draw rule
3. decides the loser
4. updates `handSize` or elimination using the room's `eliminationHandSize`
5. records a showdown snapshot with `startedAtMs` and any revealed `deckDraws`
6. moves the match into `showing-result`
7. blocks turn timers, player commands, and bot turns during that result hold
8. after the shared display duration expires:
   - finishes the match if one active player remains, or
   - creates the next round in `dealing`, then starts its timer only after the
     deal hold completes

The result overlay is server-owned. Clients render it from the snapshot, but
they do not dismiss it or decide when live play resumes. For showdowns, the
client also keeps success/failure styling and loser copy hidden until the final
resolve beat, even though the server already knows the outcome.

### Timing Out

If the active player's timer reaches zero, `RoomRegistry` resolves the round
without waiting for another socket command:

1. the active player is marked as the round loser
2. the shared penalty progression is applied
3. active hands are revealed into a timeout summary snapshot
4. the match moves into `showing-result`
5. after the shared display duration expires, the match either ends or the next
   round starts in `dealing`

Late commands are not accepted. Before a claim, check, or pause command is
processed, the registry first checks whether the turn clock has already expired
and resolves the timeout if needed.

`RoomRegistry` now also runs the same kind of autonomous recovery before
building snapshots, attaching reconnecting sockets, and handling room commands.
If `dealing`, a turn timeout, or a result hold is already overdue according to
`Date.now()`, the registry resolves that stale phase synchronously and
reschedules the next authoritative timer. This is the recovery layer that keeps
rooms from freezing when a timer callback is missed.

### Restarting

`restartMatch` currently means:

- same room
- same room code
- same player list
- back to `lobby`
- human ready states reset to `false`
- bot ready states stay `true`
- hand sizes reset to `1`

## Shared Rules Behavior

The implemented rules are exact-claim rules, not lower-bound rules.

That means a showdown checks whether the spoken claim itself can be formed from
the review pool selected by the room's `showdownDrawRule`:

- `revealed-only`: use the revealed shared pool only
- `draw-until-miss`: reveal undealt top-deck cards in order while each draw
  strictly improves progress toward the exact spoken claim, then stop on the
  first dead draw or when the claim completes

Examples of what the shared rules package currently does:

- `pair of queens` is valid if there are at least two queens
- `pair of queens` is also valid with one queen plus a joker when jokers are enabled
- `straight:3` requires exactly the ranks `3 4 5 6 7` to exist
- `flush:hearts` requires at least five hearts anywhere in the shared pool
- `flush:hearts:12` requires at least five hearts and the queen of hearts in
  the shared pool
- `straight-flush:9:clubs` requires a club 9-to-king straight flush
- `straight-flush:10:spades` covers what used to be a royal flush
- red joker may only stand in for diamonds or hearts in suit-based claims
- black joker may only stand in for clubs or spades in suit-based claims

`resolveShowdown` only decides:

- whether the claim was valid
- who loses
- the loser's next `handSize`
- whether the loser is eliminated
- which top-deck cards were revealed during a draw-assisted showdown

`applyRoundLoss` is the shared helper the server reuses for timeout losses.

The backend is still responsible for:

- building revealed-hand snapshots
- deciding winner state
- starting the next round

## Frontend Structure

### App Routing

`apps/web/src/App.tsx` contains the whole routing shell today.

Current routes:

- `/`: create/join page
- `/rooms/:roomCode`: room page

There is no dedicated global state library yet. The room page holds socket
state in React component state, and the app shell also provides a client-owned
locale context for English and Russian UI catalogs.

### Session Storage

The browser stores room sessions in `localStorage` under:

- `bluffgame/session/<ROOM_CODE>`
- `bluffgame/display-name`
- `bluffgame/locale`
- `bluffgame/ui-preferences`

This enables simple reconnect behavior after refresh, as long as the room still
exists in server memory, while locale choice persists independently per
browser.

### Room Page State

`RoomPage` manages:

- active Socket.IO connection
- latest `RoomSnapshot`
- connection state
- pending command name
- last transport error payload

When a `roomSnapshot` arrives, the snapshot fully replaces the previous render
state.

### UI Components

Current components are intentionally thin:

- `LobbyView`: readiness, host settings controls, host-only `Add bot` button,
  and player list with bot markers
- `TableView`: local hand, separate claim-to-beat panel, turn state,
  authoritative countdown, host pause control, an animated round-resolution
  overlay that reveals hands and tries to build the spoken claim before the
  textual result panels appear, a table-side chronological round-claims rail on
  desktop that collapses into a mobile sheet, a browser-local game-options
  popover for personal match preferences such as automatically opening the
  claim builder on your turn, a right-side room-chat rail with the live turn
  clock above it, and a persistent `Check` action placed directly near the
  claim-to-beat panel instead of inside it; on mobile, the match header exposes
  `Show table`, `Show chat`, and `Claims` drawers, and eliminated viewers
  switch to a spectator footer plus a Players drawer split between Active and
  Spectators rows
- `RoomChat`: snapshot-backed chat log plus a single send-message form with a
  dependency-backed emoji picker
- `ClaimComposer`: compact category pills plus filtered rank/suit controls built
  from the room's selected claim-order preset and flush rule; composite claims
  are spoken progressively by parts, flushes optionally use a suit-first then
  named-card flow when the room enables `suit-plus-rank`, and a localized fuzzy
  search indexes the finite legal claim list so players can jump directly to a
  valid claim without bypassing the normal submit step
- locale catalogs under `apps/web/src/lib/i18n/`: typed English and Russian
  UI copy, suit names, combination names, localized face-rank display labels,
  and transport-error messages

On narrow screens, the web app does not keep the chat rail as a stacked page
section. The main gameplay stays full width, the unified top play strip stacks
vertically, the table opens as an overlay drawer from the left, and the chat
plus turn clock open as a separate drawer from the right. On desktop, the
player list now lives in a dedicated left side panel instead of the bottom of
the main gameplay panel. The round-result overlay also switches to a full-screen
stacked sheet on mobile, with a sticky header, the claim construction pinned
near the top, and the revealed player panels flowing vertically underneath.

Notably, `ClaimComposer` does not let the client invent its own claim model. It
filters the shared generated claim list against the latest `lastClaim` and only
submits the resulting shared `claimKey`.

## Privacy Model

The current privacy boundary is simple:

- server knows every active player's hand
- each client only receives its own hand
- other players are represented by public rows and `cardCount`
- all active hands are only revealed through `showdown.revealedHands` or
  `timeout.revealedHands`
- eliminated human spectators may additionally receive
  `match.spectator.revealedHands`, but only in their own viewer-specific
  snapshot and only when they explicitly enable that private toggle
- bots follow that same privacy model for their decisions even though the
  server process holds all hands in memory

This is enforced by snapshot projection, not by trusting the client.

## Disconnect And Reconnect Behavior

Current implemented behavior:

- disconnect marks the player `disconnected`
- the seat is kept
- active matches do not auto-skip, auto-remove, or auto-forfeit that player
- reconnect with the same `playerId` and `sessionToken` restores the session
- if the host disconnects, a `10` second timer starts; if they do not return in
  time, host responsibility moves to the next available player
- a host can move another active player to the spectator rail
- a human player can use `Stop playing` to become a spectator themselves
- if a live player becomes a spectator mid-round, the server discards that
  round and immediately re-deals for the remaining active players

This is still deliberately simple and leaves room for future policies like
disconnect-time pauses or broader moderation tooling.

## Differences From The Planning Architecture

The code currently differs from the broader planned architecture in a few ways:

- there is no `packages/ui` package yet
- the web app uses local component state instead of a dedicated store library
- there are only two outbound socket event types in use:
  `roomSnapshot` and `commandRejected`
- the web app now owns locale selection locally instead of delegating any UI
  wording or formatting to the server
- the room lifecycle is still intentionally compact, but rounds now expose both
  `dealing` and `showing-result` as explicit authoritative match phases
- there is still no rename flow or open join-as-spectator flow
- there is now a limited eliminated-player spectator mode with a private reveal
  toggle
- there is now a host-controlled kick-to-spectator flow and a self
  stop-playing flow
- tests are present for shared rules, but not yet for server integration or
  browser end-to-end flows

## Practical Debugging Map

When you need to trace a behavior, start here:

- room creation/join issue: `apps/server/src/index.ts`
- room mutation logic: `apps/server/src/room-registry.ts`
- claim ordering or claim parsing: `packages/shared/src/claims/`
- showdown truth check: `packages/shared/src/rules/`
- snapshot shape mismatch: `packages/shared/src/state/` and
  `packages/shared/src/protocol/`
- client bootstrap or socket issue: `apps/web/src/App.tsx`
- client room/session persistence: `apps/web/src/lib/`
