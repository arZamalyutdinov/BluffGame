# BluffGame TODO

## Phase 0: Project Setup

- [x] Choose the workspace manager and scaffold the monorepo layout (`apps/web`, `apps/server`, `packages/shared`).
- [x] Add shared TypeScript, linting, formatting, and testing configuration.
- [x] Add a lightweight CI check for typecheck, lint, and unit tests.
- [x] Expand the root README once the first code scaffolding exists.

## Phase 1: Shared Domain and Rules Engine

- [x] Define shared card, rank, suit, player, room, round, and match types.
- [x] Define the normalized claim model and claim comparator.
- [x] Implement exact-claim existence evaluation for the revealed shared pool.
- [x] Implement showdown resolution, penalty progression, elimination, and starter rotation.
- [ ] Add exhaustive unit tests for claim ordering, exact-claim detection, and showdown edge cases.

## Phase 2: Backend Vertical Slice

- [x] Scaffold the Fastify server and Socket.IO gateway.
- [x] Implement in-memory room creation, join flow, leave flow, and host controls.
- [x] Implement serialized room command handling to prevent race conditions.
- [x] Wire match start, round dealing, claim submission, challenge resolution, and match completion.
- [x] Decide and implement the initial disconnect policy.

## Phase 3: Frontend Vertical Slice

- [x] Scaffold the React app and routing.
- [x] Build the create/join room flow.
- [x] Build the lobby view with seats, ready state, and host start action.
- [x] Build the match table with local hand, last claim, current turn, claim composer, and challenge button.
- [x] Build showdown and winner states driven entirely by server snapshots.

## Phase 4: Visual Refresh

- [ ] Lock the target art direction, table geometry, palette, typography, and icon language in `docs/visual-refresh-plan.md`.
- [ ] Introduce a shared scene shell, design tokens, and reusable HUD styles across home, lobby, and match screens.
- [ ] Rebuild the match layout around an oval table scene with anchored seats, clearer player identity, and floating room controls.
- [ ] Add reusable suit, rank, and status icon assets plus host, bot, ready, active-turn, and eliminated badges.
- [ ] Add motion for room entry, turn emphasis, claim submission, timer urgency, and result reveals, with reduced-motion fallbacks.
- [ ] Tune the refreshed layout across desktop and mobile, including drawer or sheet behavior for secondary panels.

## Phase 5: Quality and Hardening

- [ ] Add integration tests for multi-player command sequences on the server.
- [ ] Add end-to-end browser coverage for room creation through match completion.
- [ ] Improve reconnect UX and error handling inside the new scene shell.
- [ ] Profile render performance so decorative layers do not hurt gameplay responsiveness.
- [ ] Add basic observability and structured logging for room events.

## Later, Not Now

- [ ] Spectator support
- [ ] Rematch shortcuts
- [ ] Bots
- [ ] Persistent profiles and statistics
- [ ] Chat and social features
