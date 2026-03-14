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

## Production Build

Build the browser client:

```bash
pnpm build
```

Start the Fastify server in production mode:

```bash
pnpm start
```

If `apps/web/dist` exists, the server also serves the built React app from the
same origin. That means `/`, `/rooms/:roomCode`, `/api/*`, and `/socket.io`
can all run from one Render web service.

## Deploy To Render

Render is a reasonable hobby host for this project because it supports
long-running Node services and WebSockets. The biggest caveat on the Free tier
is that service restarts and spin-downs still wipe in-memory room state.

Recommended Render settings:

- Service type: `Web Service`
- Runtime: `Node`
- Root directory: leave empty
- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Start command: `pnpm start`
- Health check path: `/health`
- Auto-Deploy: `Off` if you want GitHub Actions to be the only deploy trigger

### Manual GitHub deploy workflow

This repo also includes a manual GitHub Actions workflow at
`.github/workflows/render-deploy.yml`.

Before using it, add this repository secret in GitHub:

- `RENDER_DEPLOY_HOOK_URL`: the deploy hook URL from your Render service

Run the workflow from the Actions tab, enter the branch you want to deploy, and
the workflow will trigger Render for that branch's current commit.

Because this uses Render's "deploy a specific commit" flow, Render disables
automatic deploys for the service after that kind of deploy. That matches the
manual-only setup above.

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
