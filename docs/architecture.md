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
- No open join-as-spectator mode in v1. The only supported spectator flow is
  for eliminated players who stay in the room.
- No cross-room social features or moderation tooling in v1.

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
- Detect the browser language, remember per-browser locale choice, and render
  UI copy from typed locale catalogs owned by the client.
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

- `Room`: lobby metadata, room code, host, joined seats, lifecycle phase,
  optional host-added bots, and bounded in-memory room chat history.
- `RoomSettings`: lobby-configured elimination threshold, claim-order preset, flush-rule variant, showdown-draw mode, joker-deck mode, and turn-time limit.
- `Seat`: stable clockwise position for a player within a room.
- `Player`: public profile, session token, human-or-bot identity, connection
  state, elimination state, current hand-size penalty, and an in-match private
  spectator-reveal preference once eliminated.
- `RoomChatMessage`: room-scoped chat entry with sender identity, text, and server timestamp.
- `MatchState`: active players, current round number, starter rotation index, and winner state.
- `RoundState`: dealt cards, current turn seat, current claim, claim history, and showdown result.
- `Claim`: normalized poker-combination claim with category, comparison tuple, and suit metadata for suit-based categories. Flushes may be suit-only or suit-plus-rank depending on the room's selected flush rule. Straights and straight flushes are spoken by low card, and ace-high straight flush is represented inside straight flush rather than as a separate royal-flush type.
- `Card`: discriminated shared card model for standard rank+suit cards plus the optional red and black jokers.

### Important Derived Values

- `handSize`: starts at `1` for players present at match start, late joiners
  enter at the rounded-down average current card count on the table, it
  increases by `1` each time a player loses a showdown, and caps at the room's
  `eliminationHandSize`.
- `isEliminated`: true when a player loses a showdown while already at `eliminationHandSize`.
- `starterSeatIndex`: rotates clockwise from the previous round's starter, skipping eliminated seats.
- `turnTimer`: server-owned timer state for the active turn, including remaining time and pause state.
- `claimExists`: whether the exact final spoken claim can be built from the showdown review pool.
- `remainingDeck`: the undealt remainder of the current round deck, kept by the server for bots and optional draw-assisted showdowns.
- `spectatorRevealEnabled`: a private per-player flag that lets an eliminated
  human viewer see active live hands in their own snapshot only.

## Runtime Flow

1. A player creates a room and becomes the host.
2. Other players join with a room code and a room-unique display name.
3. Human players may also join while a match is already running. They take a
   random open seat immediately, stay out of the current round, and enter the
   next round with a `handSize` equal to the rounded-down average number of
   cards currently on the table.
4. A human player may leave the room entirely during an active match. If they
   were in the live round, the server removes them from the room and re-deals
   for the remaining active players unless that leaves only one active player.
5. The host may add bots in the lobby until the room reaches its seat cap, and
   may remove lobby bots again if too many were added.
6. The host starts the match once the minimum player count is met.
7. The server selects a random starting seat for round 1.
8. At the start of each round, the server shuffles the room's selected round deck and deals each active, non-spectating player a number of cards equal to their current `handSize`. Players who joined mid-round are only included once the next round is created. Rooms may use the standard 52-card deck or a 54-card deck with one red joker and one black joker.
9. The server enters an explicit `dealing` phase: the snapshot includes deal timing metadata, no gameplay actions are accepted, and no turn timer runs yet.
10. After the authoritative deal window ends, the round starter makes the opening claim.
11. The server starts an authoritative timer for the active turn.
12. Each next active player clockwise either raises the claim or checks it before that timer expires.
13. A check reveals all round cards, the server evaluates the exact spoken claim according to the room's selected showdown-draw rule, and the loser takes a penalty card for future rounds or is eliminated.
14. If the timer expires first and a previous claim exists, the server
    automatically checks that claim on behalf of the timed-out player. If the
    timer expires on the opening turn before any claim exists, the active
    player loses the round automatically and the server applies the normal
    penalty progression.
15. Eliminated players remain in the room as spectators. They leave the active
    seat ring when the next live round begins, and eliminated human viewers may
    privately toggle live-card reveal for themselves.
16. After either outcome, the server enters a non-interactive `showing-result` hold: the result layer stays open on the table, no player or bot actions are accepted, and no turn timer runs.
17. When that result hold ends, the deck is discarded, the next round begins from the next eligible starter chosen from the updated clockwise active seats, active seats reflow without eliminated players, and the server re-enters `dealing` before the next turn timer starts.
18. The match ends when only one active player remains.

## Backend Design

### Room Lifecycle

- `lobby`: players can join, leave, ready up, and configure settings.
- `lobby` is also where the host can update room settings.
- `in-match`: the room contains an active `MatchState`.
- `match-complete`: winner is shown and the host can restart or return to lobby.

### Server Modules

- `room-registry`: in-memory map of room codes to room state.
- `session-service`: issue and validate per-player session tokens for reconnect attempts.
- `game-engine`: command handlers for starting matches, submitting claims, resolving challenges, and advancing rounds.
- `rules-service`: wrappers around shared pure functions for claim comparison, suit-priority handling, joker-aware exact-claim evaluation, and draw-assisted showdown progress.
- `realtime-gateway`: Socket.IO event handlers and outbound room snapshot broadcasting.
- `http-api`: small REST surface for create-room, join-room bootstrap, and health checks.

### Command Processing

Use explicit commands instead of direct state mutation from event handlers:

- `create_room`
- `join_room`
- `leave_room`
- `set_ready`
- `add_bot`
- `update_room_settings`
- `start_match`
- `send_chat_message`
- `submit_claim`
- `challenge_claim`
- `set_match_paused`
- `set_spectator_card_reveal`
- `kick_player`
- `become_spectator`
- `restart_match`

Each room should process one command at a time through a serialized queue. This keeps turn order and showdown resolution deterministic even if two clients act nearly simultaneously.

Before a snapshot is built, a reconnect is attached, or a room command is
handled, the server should also resolve any overdue `dealing`, timeout, or
result-hold transitions against `now()`. This recovery pass prevents a missed
timer callback from leaving a room stuck in an autonomous phase.

If a live player becomes a spectator during a round, the server should discard
that round and immediately create a fresh dealt round for the remaining active
players instead of trying to surgically edit the hidden pool mid-turn.

### Transport Pattern

- HTTP handles room bootstrap and reconnect-friendly page loads.
- Room pages should also emit a lightweight periodic `/health` keepalive while
  open so free-tier hosts are less likely to sleep and discard the in-memory
  room registry between turns. This only mitigates host sleep; it does not add
  durable room recovery across true process restarts.
- Socket.IO handles realtime game commands and room snapshots.
- The server should emit one canonical snapshot shape so the client can render from a single source of truth.
- User-facing transport failures should travel as stable error codes plus an
  optional raw message, so the client can localize visible errors without
  teaching the server about presentation language.

## Frontend Design

Detailed sequencing for the visual overhaul lives in `docs/visual-refresh-plan.md`.

### Screens

- Home: create or join a room.
- Lobby: show seats, readiness, host controls, room settings, optional bot
  seats, and match start conditions.
- Match table: center the desktop experience on a brighter oval felt table with a compact utility strip above it, anchored player pods around the rail, and a larger self seat at the bottom that also presents the local hand. Compress `Claim to beat` and `Selected claim` into smaller floating cards or dock-level chips near the action area instead of keeping them as large in-table panels. Use a bottom action dock for `Check`, claim-building entry, and host restart flow, attach the claim composer as an on-demand tray or sheet, add a desktop round-claims rail near the table that collapses into a mobile claims drawer, and keep personal match options such as auto-opening the claim builder browser-local instead of promoting them to room settings. Keep players and chat available through drawers or sheets so the default desktop state stays table-first, with mobile collapsing further into simplified seat presentation plus drawer-based secondary panels. Eliminated viewers should swap to a spectator footer, leave the active seat ring on live rounds, and manage their private reveal toggle from the Players drawer. The claim composer should support both the normal step flow and a localized fuzzy search over currently legal claims. At the start of each round, render a server-owned deal from the upper-center table origin. When a showdown or timeout resolves, render a server-owned table-native result layer that reveals hands, optionally reveals top-deck showdown cards, withholds success or failure styling until the final resolve beat, and stays on screen until the server exits `showing-result`; style that layer as part of the same playful neon table language rather than as a separate dark or glass UI.
- Showdown summary: reveal cards, whether the spoken claim existed, loser, next-round starter, and remaining players.
- Match result: winner banner and restart flow.

### Visual Direction

- Treat the live room as a stylized social-card table scene rather than a generic dashboard.
- Center the desktop experience on an oval felt table, an atmospheric backdrop, floating HUD controls, and stronger seat identity for every player.
- Use icon-forward controls, suit and rank glyphs, layered lighting, and bold button chrome so the UI feels playful without hiding gameplay state.
- Use the provided screenshot as art-direction inspiration only; it does not automatically expand scope to include shops, open spectator joining, cosmetics, or other meta systems.

### Presentation Architecture

- Split the room UI into scene layers: backdrop, table surface, seat ring, gameplay HUD, and transient overlay or motion layers.
- Keep all animation snapshot-driven. Turn pulses, countdown urgency, claim transitions, and round-resolution reveals should react to authoritative server state instead of local rules guesses.
- Centralize palette, spacing, radii, shadows, glow levels, and motion timings as shared CSS custom properties before doing component-level polish.
- Prefer CSS, SVG, and lightweight image assets for the first visual refresh. Avoid introducing canvas or WebGL unless the 2D approach proves insufficient.
- Honor `prefers-reduced-motion` and keep every action legible without relying on animation.

### Responsive Layout Strategy

- Desktop should feel like a full table scene, with supporting controls orbiting the table instead of competing with it in a flat dashboard.
- Mobile should preserve the same visual language while collapsing secondary chrome into drawers or sheets so the current hand, claim, timer, and primary action stay readable.
- Decorative art must degrade gracefully on narrow screens. Gameplay controls always win space over ambiance.

### Client State Strategy

- Keep server state in a single room snapshot store.
- Keep transient UI state separate: claim-composer inputs, animations, local notifications, and reconnection banners.
- Keep locale choice client-owned and persistent in browser storage. The active
  locale should affect UI copy, card-face rank labels, claim wording, suit
  names, and client-side timestamp formatting, while player names, room codes,
  chat bodies, and gameplay keys remain language-agnostic.
- Avoid optimistic gameplay updates for accepted claims and challenges; wait for the authoritative server snapshot.
- Allow optimistic affordances only for non-authoritative UI, such as button loading states.
- Keep `Kick` and `Stop playing` server-owned as well. The Players drawer may
  render those controls, but the client should only change seat layout after
  the authoritative snapshot arrives.

### Suggested Component Boundaries

- `RoomShell`
- `LobbyView`
- `RoomScene`
- `TableView`
- `TableScene`
- `HandPanel`
- `ClaimComposer`
- `ClaimHistory`
- `SeatRing`
- `SeatBadge`
- `ActionHud`
- `RoomChat`
- `RoundResolutionOverlay`
- `MatchSummary`

## Shared Rules and Protocol

### Shared Package Modules

- `cards/`: suits, ranks, deck helpers, and shuffle utilities for tests.
- `claims/`: claim categories, serialization, comparison, and display labels.
- `resolution/`: shared timing constants and helpers for round-result display windows.
- `rules/`: exact-claim evaluator, suit-aware claim validation, showdown outcome logic, and elimination helpers.
- `protocol/`: command and event schemas, including chat commands and room snapshots.
- `settings/`: room settings defaults, supported presets, and validation helpers.
- `state/`: room, match, round, player, and room-chat TypeScript types.

### Protocol Direction

Client-to-server messages should remain command-shaped and small. Server-to-client messages should remain snapshot-shaped and complete enough for reconnects.

Suggested client commands:

- `submitClaim`
- `challengeClaim`
- `setReady`
- `addBot`
- `updateRoomSettings`
- `setMatchPaused`
- `setSpectatorCardReveal`
- `kickPlayer`
- `becomeSpectator`
- `sendChatMessage`
- `startMatch`
- `restartMatch`

Suggested server events:

- `roomSnapshot`
- `commandRejected`
- `roundStarted`
- `showdownResolved`
- `matchFinished`

## Bot Policy

- Bots are server-driven but not omniscient.
- A bot may use its own hand, public room settings, public hand sizes, public
  claim history, public past outcomes, and probability estimates over unseen
  cards.
- A bot may not inspect other players' hidden hands when deciding whether to
  raise or check.

## Match State Machine

Recommended room and match phases:

- `lobby`
- `dealing`
- `awaiting-opening-claim`
- `awaiting-response`
- `showing-result`
- paused turn timer as a property on the active match, not as a separate room phase
- `match-complete`

The server may collapse some internal phases into simpler snapshots, but the domain model should preserve these distinctions so rules code stays understandable.

## Testing Strategy

- Unit-test claim comparison, suit-priority ordering, and exact-claim detection exhaustively.
- Integration-test server command handlers against multi-player round scenarios.
- Add snapshot tests for client rendering only after the protocol shape settles.
- Add Playwright room-flow tests after the first playable vertical slice exists.

## Operational Assumptions for V1

- Single-process server with in-memory rooms.
- Max room size should stay small enough to fit one round deck comfortably; `2` to `8` players is the recommended v1 range even when the optional two jokers are enabled.
- Crash or deploy restarts wipe active rooms.
- Room chat is ephemeral and exists only in the in-memory room state.
- Disconnects keep the player's seat reserved and rely on session-token reconnect support; active matches do not auto-remove or auto-forfeit disconnected players in v1.
- Explicit leave is different from disconnect: leaving removes the player from
  the room immediately and any next-turn or next-round seat selection is
  recomputed from the updated player list.
- If the current host disconnects, they get a `10` second grace window before
  host control moves to the next available player.
- Hosts may move another player to the spectator rail, and a human player may
  choose to stop playing and spectate themselves.
- `restart_match` returns the room to the lobby while keeping the same room code and player list.

## Open Decisions to Revisit
