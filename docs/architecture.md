# BluffGame Architecture

## Purpose

This document defines the recommended v1 architecture for BluffGame: a browser-based, turn-based multiplayer bluffing game built with TypeScript across the stack and a React web client. The goal is to keep the first version small, testable, and easy to iterate on while preserving a clean path toward future scale.

## Product Goals

- Support live multiplayer matches in the browser with room codes.
- Keep gameplay server-authoritative so bluff resolution cannot diverge between players.
- Reuse domain types and poker-combination logic across client and server.
- Stay simple for v1: no database, no login system, no payments, no matchmaking service.

## Product Non-Goals

- No persistence across process restarts.
- No spectator mode in v1.
- No bots in v1.
- No cross-room social features, chat, or moderation tooling in v1.

## Recommended Stack

- Workspace: monorepo with TypeScript project references and a single package manager (`pnpm` preferred).
- Frontend: React 19, Vite, React Router, and a lightweight client store for realtime room snapshots.
- Backend: Node.js + TypeScript with Fastify for HTTP endpoints and Socket.IO for realtime gameplay events.
- Validation: Zod for protocol payload validation and snapshot parsing.
- Testing: Vitest for unit and integration tests, Playwright later for end-to-end browser coverage.

## Why This Split

React is the right choice for the browser client, but the authoritative game server should stay framework-light. Keeping the backend as a plain TypeScript service avoids pushing turn logic into a UI abstraction and makes rules testing much simpler.

## Proposed Workspace Layout

```text
.
├── AGENTS.md
├── docs/
├── apps/
│   ├── web/
│   └── server/
├── packages/
│   ├── shared/
│   └── ui/              # optional later
└── .codex/
    └── skills/
        └── bluff-game-dev/
```

## Canonical Responsibilities

### `apps/web`

- Render lobby, table, claim history, showdown results, and winner screens.
- Manage the local player session token and room reconnect flow.
- Send explicit player commands to the server.
- Render server snapshots without becoming the source of truth for the match.

### `apps/server`

- Own rooms, players, matches, rounds, shuffling, dealing, and elimination.
- Serialize commands per room to prevent race conditions.
- Validate every incoming payload before mutating room state.
- Broadcast authoritative room and match snapshots after accepted commands.

### `packages/shared`

- Card and deck types.
- Claim model, claim comparator, and combination evaluator.
- Round and match state types.
- Zod schemas for commands and server events.
- Pure reducers or state-transition helpers that the server can call directly.

### `packages/ui`

- Optional later extraction point for reusable React components if the web app grows enough to justify it.

## Domain Model

### Core Entities

- `Room`: lobby metadata, room code, host, joined seats, and lifecycle phase.
- `Seat`: stable clockwise position for a player within a room.
- `Player`: public profile, session token, connection state, elimination state, and current hand-size penalty.
- `MatchState`: active players, current round number, starter rotation index, and winner state.
- `RoundState`: dealt cards, current turn seat, current claim, claim history, and showdown result.
- `Claim`: normalized poker-combination claim with category, comparison tuple, and suit metadata for suit-based categories.

### Important Derived Values

- `handSize`: starts at `1`, increases by `1` each time a player loses a showdown, and caps at `5`.
- `isEliminated`: true when a player loses a showdown while already at `5` cards.
- `starterSeatIndex`: rotates clockwise from the previous round's starter, skipping eliminated seats.
- `claimExists`: whether the exact final spoken claim can be built from the union of all revealed cards during showdown.

## Runtime Flow

1. A player creates a room and becomes the host.
2. Other players join with a room code and display name.
3. The host starts the match once the minimum player count is met.
4. The server selects a random starting seat for round 1.
5. At the start of each round, the server shuffles a standard 52-card deck and deals each active player a number of cards equal to their current `handSize`.
6. The round starter makes the opening claim.
7. Each next active player clockwise either raises the claim or challenges it.
8. A challenge triggers showdown: all round cards are revealed, the server checks whether the exact spoken claim exists, and the loser takes a penalty card for future rounds or is eliminated.
9. The round ends immediately after showdown, the deck is discarded, and the next round begins from the next eligible starter.
10. The match ends when only one active player remains.

## Backend Design

### Room Lifecycle

- `lobby`: players can join, leave, rename, and ready up.
- `in-match`: the room contains an active `MatchState`.
- `match-complete`: winner is shown and the host can restart or return to lobby.

### Server Modules

- `room-registry`: in-memory map of room codes to room state.
- `session-service`: issue and validate per-player session tokens for reconnect attempts.
- `game-engine`: command handlers for starting matches, submitting claims, resolving challenges, and advancing rounds.
- `rules-service`: wrappers around shared pure functions for claim comparison, suit-priority handling, and exact-claim evaluation.
- `realtime-gateway`: Socket.IO event handlers and outbound room snapshot broadcasting.
- `http-api`: small REST surface for create-room, join-room bootstrap, and health checks.

### Command Processing

Use explicit commands instead of direct state mutation from event handlers:

- `create_room`
- `join_room`
- `leave_room`
- `set_ready`
- `start_match`
- `submit_claim`
- `challenge_claim`
- `restart_match`

Each room should process one command at a time through a serialized queue. This keeps turn order and showdown resolution deterministic even if two clients act nearly simultaneously.

### Transport Pattern

- HTTP handles room bootstrap and reconnect-friendly page loads.
- Socket.IO handles realtime game commands and room snapshots.
- The server should emit one canonical snapshot shape so the client can render from a single source of truth.

## Frontend Design

### Screens

- Home: create or join a room.
- Lobby: show seats, readiness, host controls, and match start conditions.
- Match table: show the local hand, current claimant, last claim, turn indicator, claim composer, challenge action, and elimination tracker.
- Showdown summary: reveal cards, whether the spoken claim existed, loser, next-round starter, and remaining players.
- Match result: winner banner and restart flow.

### Client State Strategy

- Keep server state in a single room snapshot store.
- Keep transient UI state separate: claim-composer inputs, animations, local notifications, and reconnection banners.
- Avoid optimistic gameplay updates for accepted claims and challenges; wait for the authoritative server snapshot.
- Allow optimistic affordances only for non-authoritative UI, such as button loading states.

### Suggested Component Boundaries

- `RoomShell`
- `LobbyView`
- `TableView`
- `HandPanel`
- `ClaimComposer`
- `ClaimHistory`
- `PlayerRing`
- `ShowdownModal`
- `MatchSummary`

## Shared Rules and Protocol

### Shared Package Modules

- `cards/`: suits, ranks, deck helpers, and shuffle utilities for tests.
- `claims/`: claim categories, serialization, comparison, and display labels.
- `rules/`: exact-claim evaluator, suit-aware claim validation, showdown outcome logic, and elimination helpers.
- `protocol/`: command and event schemas.
- `state/`: room, match, round, and player TypeScript types.

### Protocol Direction

Client-to-server messages should remain command-shaped and small. Server-to-client messages should remain snapshot-shaped and complete enough for reconnects.

Suggested client commands:

- `submitClaim`
- `challengeClaim`
- `setReady`
- `startMatch`
- `restartMatch`

Suggested server events:

- `roomSnapshot`
- `commandRejected`
- `roundStarted`
- `showdownResolved`
- `matchFinished`

## Match State Machine

Recommended room and match phases:

- `lobby`
- `dealing`
- `awaiting-opening-claim`
- `awaiting-response`
- `showdown`
- `match-complete`

The server may collapse some internal phases into simpler snapshots, but the domain model should preserve these distinctions so rules code stays understandable.

## Testing Strategy

- Unit-test claim comparison, suit-priority ordering, and exact-claim detection exhaustively.
- Integration-test server command handlers against multi-player round scenarios.
- Add snapshot tests for client rendering only after the protocol shape settles.
- Add Playwright room-flow tests after the first playable vertical slice exists.

## Operational Assumptions for V1

- Single-process server with in-memory rooms.
- Max room size should stay small enough to fit one 52-card deck comfortably; `2` to `8` players is the recommended v1 range.
- Crash or deploy restarts wipe active rooms.
- Disconnects keep the player's seat reserved and rely on session-token reconnect support; active matches do not auto-remove or auto-forfeit disconnected players in v1.
- `restart_match` returns the room to the lobby while keeping the same room code and player list.

## Open Decisions to Revisit

- Whether the host can kick inactive players in v1.
- Whether to add turn timers after the core loop is stable.
