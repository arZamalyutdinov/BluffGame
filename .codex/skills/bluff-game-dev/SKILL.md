---
name: bluff-game-dev
description: Project-local guide for planning, implementing, and extending BluffGame, a turn-based multiplayer browser card game about bluffing poker-style combinations. Use when working in this repository on game rules, room or match architecture, shared TypeScript domain models, React UI flows, authoritative backend turn resolution, realtime protocol changes, or delivery planning.
---

# Bluff Game Dev

## Overview

Use this skill as the repo entry point for BluffGame work. Keep the server authoritative, keep rules in shared pure TypeScript modules, and treat the docs in `docs/` as the current source of truth until code is added.

## First Pass

1. Read [`docs/architecture.md`](../../../docs/architecture.md) for package boundaries, runtime responsibilities, and protocol direction.
2. Read [`docs/game-rules.md`](../../../docs/game-rules.md) for round flow, claim ordering, and showdown resolution.
3. Read [`docs/todo.md`](../../../docs/todo.md) for current delivery order.
4. Read [`docs/decisions.md`](../../../docs/decisions.md) when the task depends on assumptions, open questions, or out-of-scope boundaries.
5. Read [references/session-checklist.md](references/session-checklist.md) when you want a concise execution checklist.

## Working Rules

- Keep all gameplay authority on the backend: shuffling, dealing, turn order, claim validation, showdown resolution, penalties, elimination, and winner detection.
- Keep pure domain logic in shared TypeScript modules so the same rules and protocol types can be consumed by both server and client.
- Avoid introducing a database, authentication, or production infrastructure unless the user explicitly expands scope.
- Prefer snapshots plus explicit commands over duplicated client-side game logic.
- Update `docs/game-rules.md` and `docs/architecture.md` in the same turn when a gameplay rule or structural decision changes.

## Task Routing

- Gameplay or balancing work: start with [`docs/game-rules.md`](../../../docs/game-rules.md).
- Backend, room, or protocol work: start with [`docs/architecture.md`](../../../docs/architecture.md).
- UI flow or state-sync work: read [`docs/architecture.md`](../../../docs/architecture.md), then verify the relevant rules in [`docs/game-rules.md`](../../../docs/game-rules.md).
- Prioritization or scoping work: read [`docs/todo.md`](../../../docs/todo.md) and [`docs/decisions.md`](../../../docs/decisions.md).

## Expected Repo Shape

- `docs/`: canonical planning, rules, architecture, and priority documents
- `apps/web/`: future React browser client
- `apps/server/`: future authoritative realtime server
- `packages/shared/`: future shared rules engine, protocol contracts, and domain types
- `packages/ui/`: optional later shared UI primitives

## Done Criteria

- Keep docs aligned with any new code or rule changes.
- Add or update tests around shared rules logic before trusting manual UI checks.
- Call out assumptions explicitly when the docs do not settle a behavior.
