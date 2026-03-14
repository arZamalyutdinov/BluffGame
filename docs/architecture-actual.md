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
  display labels, and the precomputed `ALL_CLAIMS` list
- `rules`: exact-claim existence checks, showdown resolution, and starter
  rotation helpers
- `protocol`: Zod schemas for HTTP payloads, socket auth, commands, and room
  snapshots
- `state`: room snapshot, match snapshot, showdown snapshot, and room session
  types

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
- room/player/match/round internal state
- host assignment
- session token validation
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
- seat-based turn tracking
- previous showdown details carried into the next snapshot

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
- `yourHand` only contains the viewer's own cards
- public player rows include `cardCount`, not private card identities
- `showdown` is carried on the snapshot after a challenge resolves
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
- `startMatch`
- `submitClaim`
- `challengeClaim`
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
- the host can start the match
- players can leave

The match only starts when:

- there are at least 2 players
- every player is ready
- the caller is the host

### Starting A Match

`startMatch`:

- resets all players to `handSize = 1` and `isEliminated = false`
- chooses a random starter seat
- creates a new round with shuffled/dealt hands
- moves the room to `in-match`

### During A Round

The round keeps:

- `roundNumber`
- `starterSeatIndex`
- `currentTurnSeatIndex`
- `lastClaim`
- `lastClaimantPlayerId`
- `claimHistory`
- `handsByPlayerId`

The opening player can make any legal claim. Every later claim must be strictly
higher according to `compareClaims`.

### Challenging

`challengeClaim`:

1. collects every active player's cards
2. asks shared rules whether the exact spoken claim exists
3. decides the loser
4. updates `handSize` or elimination
5. records a showdown snapshot
6. either:
   - finishes the match if one active player remains, or
   - immediately creates the next round

There is no separate paused showdown phase on the server. Instead, the showdown
summary is attached to the next snapshot so the UI can still render it.

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
- `straight:7` requires exactly the ranks for a 7-high straight to exist
- `flush:13` requires a 5-card flush whose highest card can be king
- `royal-flush` requires one suit to contain `10 J Q K A`

`resolveShowdown` only decides:

- whether the claim was valid
- who loses
- the loser's next `handSize`
- whether the loser is eliminated

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

- `LobbyView`: readiness, start button, player list
- `TableView`: local hand, claim history, turn state, showdown summary
- `ClaimComposer`: compact category pills plus card-style previews and filtered
  rank controls built from `ALL_CLAIMS`

Notably, `ClaimComposer` does not let the client invent its own claim model. It
filters the shared precomputed claim list against the latest `lastClaim` and
only submits the resulting shared `claimKey`.

## Privacy Model

The current privacy boundary is simple:

- server knows every active player's hand
- each client only receives its own hand
- other players are represented by public rows and `cardCount`
- all active hands are only revealed through `showdown.revealedHands`

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
kicks or turn timers.

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
