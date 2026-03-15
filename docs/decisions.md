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
- Resolve showdowns by checking whether the exact spoken claim can be formed from the revealed shared pool.
- Keep room settings host-controlled and lobby-only in v1.
- Ship with configurable elimination hand size in the safe range `2` to `6`.
- Ship with configurable turn time limits, with `60` seconds as the default.
- Ship with three claim-order presets, with `flush below straight` as the default.
- Treat plain flush claims as suit-only claims; they do not carry a high-card value.
- Fold royal flush into ace-high straight flush instead of keeping it as a separate claim type.
- Speak straight and straight-flush claims by their low card, not their high card.
- Use `diamonds < clubs < hearts < spades` as the suit priority order for suit-based claims.
- Let the host pause and resume the live turn timer during an active match.
- Ship the first playable slice with session-token reconnect support.
- Support host-added room bots that play from fair public-information limits
  instead of reading hidden hands.
- Returning from a finished match sends the room back to the lobby while keeping the same room code.
- Use a stylized table-game presentation as the next frontend milestone, with the supplied screenshot serving as visual inspiration rather than a literal feature clone.
- Build the first visual refresh primarily with CSS, SVG, and lightweight 2D assets instead of introducing canvas, WebGL, or bespoke 3D rendering.
- Keep all animations presentation-only and snapshot-driven so they never become a second source of gameplay truth.
- Move the live match and showdown presentation toward a playful neon cartoon table style, with brighter action buttons, stronger contrast, a compact utility HUD, and a bottom action dock for turn actions.

## Working Assumptions

- The host creates the room and can start the match.
- Each round uses a fresh shuffle and a fresh deal.
- The loser of a showdown is the only player whose future `handSize` changes.
- The next round starter rotates from the previous round's starter, not from the previous round's loser or winner.
- A disconnect does not auto-remove a player from an active match; their seat is held for reconnect.
- Explicit leave is only supported outside an active match in v1.
- The first art pass can rely on gradients, glows, iconography, and reusable badge frames before we consider bespoke illustrated environments or premium cosmetic systems.

## Deferred Decisions

- Whether the host can remove disconnected or idle players.
- Whether to expose claim suggestions in the UI or keep players fully manual.
- Whether later versions should support alternate table themes or unlockable cosmetics.

## Explicitly Out of Scope for Now

- Persistent player accounts
- Cross-session stats
- Server-side storage
- Match history
- Ranked matchmaking
- Spectators
- Shop or inventory systems
