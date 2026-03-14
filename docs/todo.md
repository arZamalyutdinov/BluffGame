# BluffGame TODO

## Phase 0: Project Setup

- [ ] Choose the workspace manager and scaffold the monorepo layout (`apps/web`, `apps/server`, `packages/shared`).
- [ ] Add shared TypeScript, linting, formatting, and testing configuration.
- [ ] Add a lightweight CI check for typecheck, lint, and unit tests.
- [ ] Expand the root README once the first code scaffolding exists.

## Phase 1: Shared Domain and Rules Engine

- [ ] Define shared card, rank, suit, player, room, round, and match types.
- [ ] Define the normalized claim model and claim comparator, including suit priority for suit-based claims.
- [ ] Implement exact-claim existence evaluation for the revealed shared pool.
- [ ] Implement showdown resolution, penalty progression, elimination, and starter rotation.
- [ ] Add exhaustive unit tests for claim ordering, suit priority, exact-claim detection, and showdown edge cases.

## Phase 2: Backend Vertical Slice

- [ ] Scaffold the Fastify server and Socket.IO gateway.
- [ ] Implement in-memory room creation, join flow, leave flow, and host controls.
- [ ] Implement serialized room command handling to prevent race conditions.
- [ ] Wire match start, round dealing, claim submission, challenge resolution, and match completion.
- [ ] Decide and implement the initial disconnect policy.

## Phase 3: Frontend Vertical Slice

- [ ] Scaffold the React app and routing.
- [ ] Build the create/join room flow.
- [ ] Build the lobby view with seats, ready state, and host start action.
- [ ] Build the match table with local hand, last claim, current turn, claim composer, and challenge button.
- [ ] Build showdown and winner states driven entirely by server snapshots.

## Phase 4: Quality and Polish

- [ ] Add integration tests for multi-player command sequences on the server.
- [ ] Add end-to-end browser coverage for room creation through match completion.
- [ ] Improve reconnect UX and error handling.
- [ ] Tune mobile layout and interaction affordances.
- [ ] Add basic observability and structured logging for room events.

## Later, Not Now

- [ ] Spectator support
- [ ] Turn timers
- [ ] Rematch shortcuts
- [ ] Bots
- [ ] Persistent profiles and statistics
- [ ] Chat and social features
