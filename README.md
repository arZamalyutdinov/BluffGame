# BluffGame

BluffGame is a browser-based multiplayer bluffing card game built with
TypeScript across the stack. The current implementation is a small playable
vertical slice with:

- an in-memory Fastify + Socket.IO server
- a shared rules and protocol package
- a React + Vite web client
- exact-claim showdown resolution based on the combined revealed card pool

## Requirements

- Node.js `22+`
- `pnpm`

If `pnpm` is not installed yet, one common setup is:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Install

From the repo root:

```bash
pnpm install
```

## Run The App

Start both backend and frontend together:

```bash
pnpm dev
```

This starts:

- backend: `http://localhost:3001`
- frontend: `http://localhost:5173`

Open `http://localhost:5173` in a browser, enter a display name, then create a
room or join one with a 4-letter room code.

## Run The Parts Separately

Backend only:

```bash
pnpm --filter @bluff-game/server run dev
```

Frontend only:

```bash
pnpm --filter @bluff-game/web run dev
```

The Vite dev server proxies `/api` and `/socket.io` traffic to the backend on
port `3001`.

## Verify It Is Working

Backend health check:

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{"ok":true}
```

Code quality checks:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm --filter @bluff-game/web run build
```

## Current Scope

- No database
- No authentication system
- No persistence across restarts
- Room and match state stored in memory only

## Docs

- Planned architecture: [docs/architecture.md](/Users/ffisin/projects/BluffGame/docs/architecture.md)
- Actual implemented architecture: [docs/architecture-actual.md](/Users/ffisin/projects/BluffGame/docs/architecture-actual.md)
- Game rules: [docs/game-rules.md](/Users/ffisin/projects/BluffGame/docs/game-rules.md)
- Project decisions: [docs/decisions.md](/Users/ffisin/projects/BluffGame/docs/decisions.md)
