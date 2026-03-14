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

## Shared Package Responsibilities

`packages/shared` is the contract layer between the server and client.

It currently contains:

- `cards`: card types, deck creation, shuffling, dealing, card labels
- `claims`: normalized claim types, comparison ordering, serialization to keys,
  display labels, and generated claim lists per preset
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
- Socket.IO connection handling

The entrypoint does very little game logic directly. It delegates almost all
state changes to `RoomRegistry`.

### Room Registry

`apps/server/src/room-registry.ts` is the actual game server.

It owns:

- the in-memory `Map<string, RoomState>` of all active rooms
- per-room turn timer handles
- room/player/match/round internal state
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
- `turnTimer` is included while a match is active
- `yourHand` only contains the viewer's own cards
- public player rows include `cardCount`, not private card identities
- `showdown` is carried on the snapshot after a challenge resolves
- `timeout` is carried on the snapshot after a turn expires
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

- the socket gets `commandRejected`
- the socket is disconnected immediately

## Current Socket Commands

Implemented inbound commands:

- `setReady`
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
snapshot event plus rejection messages.

## Match Lifecycle In Code

### Lobby

While `room.phase === 'lobby'`:

- players can join
- players can toggle ready state
- the host can change room settings
- duplicate display names are rejected per room
- the host can start the match
- players can leave

Room settings currently include:

- `eliminationHandSize` in the range `2` to `6`
- `claimOrderPreset` with three supported presets
- `turnTimeLimitSeconds` in the range `15` to `120`

If the host changes any setting, the server resets all player ready states to
`false`.

The match only starts when:

- there are at least 2 players
- every player is ready
- the caller is the host

### Starting A Match

`startMatch`:

- resets all players to `handSize = 1` and `isEliminated = false`
- chooses a random starter seat
- creates a new round with shuffled/dealt hands
- starts the first authoritative turn timer
- moves the room to `in-match`

### During A Round

The round keeps:

- `roundNumber`
- `starterSeatIndex`
- `currentTurnSeatIndex`
- `turnTimer`
- `lastClaim`
- `lastClaimantPlayerId`
- `claimHistory`
- `handsByPlayerId`

The opening player can make any legal claim. Every later claim must be strictly
higher according to `compareClaims` using the room's selected
`claimOrderPreset`.

The server also owns the active turn timer. When a player acts successfully,
the next turn receives a fresh full timer. The host can pause and resume that
timer without changing the current turn owner.

### Challenging

`challengeClaim`:

1. collects every active player's cards
2. asks shared rules whether the exact spoken claim exists
3. decides the loser
4. updates `handSize` or elimination using the room's `eliminationHandSize`
5. records a showdown snapshot
6. either:
   - finishes the match if one active player remains, or
   - immediately creates the next round

There is no separate paused showdown phase on the server. Instead, the showdown
summary is attached to the next snapshot so the UI can still render it.

### Timing Out

If the active player's timer reaches zero, `RoomRegistry` resolves the round
without waiting for another socket command:

1. the active player is marked as the round loser
2. the shared penalty progression is applied
3. active hands are revealed into a timeout summary snapshot
4. the match either ends or the next round starts immediately

Late commands are not accepted. Before a claim, check, or pause command is
processed, the registry first checks whether the turn clock has already expired
and resolves the timeout if needed.

### Restarting

`restartMatch` currently means:

- same room
- same room code
- same player list
- back to `lobby`
- ready states reset to `false`
- hand sizes reset to `1`

## Shared Rules Behavior

The implemented rules are exact-claim rules, not lower-bound rules.

That means a showdown checks whether the spoken claim itself can be formed from
the revealed shared pool.

Examples of what the shared rules package currently does:

- `pair of queens` is valid if there are at least two queens
- `straight:3` requires exactly the ranks `3 4 5 6 7` to exist
- `flush:hearts` requires at least five hearts anywhere in the shared pool
- `straight-flush:9:clubs` requires a club 9-to-king straight flush
- `straight-flush:10:spades` covers what used to be a royal flush

`resolveShowdown` only decides:

- whether the claim was valid
- who loses
- the loser's next `handSize`
- whether the loser is eliminated

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
state in React component state.

### Session Storage

The browser stores room sessions in `localStorage` under:

- `bluffgame/session/<ROOM_CODE>`
- `bluffgame/display-name`

This enables simple reconnect behavior after refresh, as long as the room still
exists in server memory.

### Room Page State

`RoomPage` manages:

- active Socket.IO connection
- latest `RoomSnapshot`
- connection state
- pending command name
- last error message

When a `roomSnapshot` arrives, the snapshot fully replaces the previous render
state.

### UI Components

Current components are intentionally thin:

- `LobbyView`: readiness, host settings controls, start button, player list
- `TableView`: local hand, separate claim-to-beat panel, claim history, turn
  state, authoritative countdown, host pause control, showdown/timeout summary,
  and a right-side rail with the turn-ordered table plus room chat
- `RoomChat`: snapshot-backed chat log plus a single send-message form
- `ClaimComposer`: compact category pills plus filtered rank/suit controls built
  from the room's selected claim-order preset

On narrow screens, the web app does not keep the table rail as a narrow
sidebar. The layout collapses to one column so gameplay remains full width, and
the table/chat rail stacks below the main match content.

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

This is enforced by snapshot projection, not by trusting the client.

## Disconnect And Reconnect Behavior

Current implemented behavior:

- disconnect marks the player `disconnected`
- the seat is kept
- active matches do not auto-skip, auto-remove, or auto-forfeit that player
- reconnect with the same `playerId` and `sessionToken` restores the session
- if the host disconnects outside a match, host responsibility may move to the
  next available player

This is deliberately simple and still leaves room for future policies like host
kicks or disconnect-time pause rules.

## Differences From The Planning Architecture

The code currently differs from the broader planned architecture in a few ways:

- there is no `packages/ui` package yet
- the web app uses local component state instead of a dedicated store library
- there are only two outbound socket event types in use:
  `roomSnapshot` and `commandRejected`
- the server collapses `dealing` and `showdown` into immediate snapshot updates
  instead of keeping long-lived separate phases
- there is no rename flow, spectator flow, or kick flow
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
