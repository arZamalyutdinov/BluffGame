# BluffGame Decisions

Initial planning baseline recorded on March 14, 2026.

## Locked In

- Use TypeScript across the whole project.
- Use React for the browser client.
- Use a separate authoritative TypeScript backend rather than trying to run gameplay logic inside React.
- Keep all room and match state in memory for v1.
- Treat the server as the only authority for shuffling, dealing, claims, challenges, and elimination.
- Use a shared package for rules, protocol schemas, and domain types.
- Cap v1 rooms at `2` to `8` players.
- Skip database work, authentication, and social systems for the initial build.

## Working Assumptions

- The host creates the room and can start the match.
- Each round uses a fresh shuffle and a fresh deal.
- The loser of a showdown is the only player whose future `handSize` changes.
- The next round starter rotates from the previous round's starter, not from the previous round's loser or winner.

## Deferred Decisions

- Whether reconnect support ships in the first playable slice or comes immediately after.
- Whether the host can remove disconnected or idle players.
- Whether rematch returns the room to lobby first or restarts directly.
- Whether to add turn timers once the base loop feels good.
- Whether to expose claim suggestions in the UI or keep players fully manual.

## Explicitly Out of Scope for Now

- Persistent player accounts
- Cross-session stats
- Server-side storage
- Match history
- Ranked matchmaking
- AI opponents
- Spectators
- In-game chat
