# BluffGame Decisions

Initial planning baseline recorded on March 14, 2026.

## Locked In

- Use TypeScript across the whole project.
- Use React for the browser client.
- Use a separate authoritative TypeScript backend rather than trying to run gameplay logic inside React.
- Keep all room and match state in memory for v1.
- Treat the server as the only authority for shuffling, dealing, claims, challenges, and elimination.
- Use a shared package for rules, protocol schemas, and domain types.
- Keep localization client-owned in the web app, with typed locale catalogs,
  browser-language detection, persisted manual override, and English fallback.
- Send stable transport error codes over HTTP and Socket.IO so the client can
  localize user-facing failures without coupling gameplay services to UI copy.
- Cap v1 rooms at `2` to `8` players.
- Skip database work, authentication, and social systems for the initial build.
- Keep showdowns exact-claim based, but let the host choose between revealed-cards-only checks and a draw-until-miss review that uses the undealt round deck.
- Keep room settings host-controlled and lobby-only in v1.
- Ship with configurable elimination hand size in the safe range `2` to `6`.
- Ship with configurable turn time limits, with `60` seconds as the default.
- Ship with three claim-order presets, with `flush below straight` as the default.
- Ship with a host-selected flush rule toggle: classic suit-only flushes by default, with an optional suit-plus-rank variant that speaks a named suited card.
- Ship with a host-selected joker toggle: off by default, with an optional
  two-joker deck that adds one red joker and one black joker as full wild cards
  subject to red-suit and black-suit color restrictions in suit-based claims.
- Fold royal flush into ace-high straight flush instead of keeping it as a separate claim type.
- Speak straight and straight-flush claims by their low card, not their high card.
- Use `diamonds < clubs < hearts < spades` as the suit priority order for suit-based claims.
- Let the host pause and resume the live turn timer during an active match.
- Ship the first playable slice with session-token reconnect support.
- Support host-added room bots that play from fair public-information limits
  instead of reading hidden hands.
- Returning from a finished match sends the room back to the lobby while keeping the same room code.
- Use a stylized table-game presentation as the next frontend milestone, with the supplied screenshot serving as visual inspiration rather than a literal feature clone.
- Build the visual refresh as a Tailwind-first shell with specialized CSS for geometry-heavy table scenes and animations.
- Allow lightweight canvas or WebGL scene layers for decorative atmosphere when they do not own gameplay state, impair accessibility, or become required for core readability.
- Vendor textures or third-party art references locally before shipping instead of depending on remote runtime image hosts.
- Keep all animations presentation-only and snapshot-driven so they never become a second source of gameplay truth.
- Move the live match and showdown presentation toward a playful neon cartoon table style, with brighter action buttons, stronger contrast, a compact utility HUD, and a bottom action dock for turn actions.
- Keep spectator scope narrow in v1: eliminated players stay in-room as
  spectators, active seats reflow around them, and any live-card reveal control
  remains private to that eliminated viewer.
- Let the host move a live player to the spectator rail, and let a human player
  choose to stop playing and spectate themselves.
- Give a disconnected host a `10` second grace period before host control moves
  to someone else.
- Make room timers self-healing: overdue `dealing`, timeout, and result-hold
  phases should resolve from authoritative server time even if a timer callback
  is missed.

## Working Assumptions

- The host creates the room and can start the match.
- Each round uses a fresh shuffle and a fresh deal.
- The loser of a showdown is the only player whose future `handSize` changes.
- The next round starter rotates from the previous round's starter, not from the previous round's loser or winner.
- A disconnect does not auto-remove a player from an active match; their seat is held for reconnect.
- Explicit leave removes a player from the room even during an active match.
- The first art pass can rely on gradients, glows, iconography, and reusable badge frames before we consider bespoke illustrated environments or premium cosmetic systems.

## Deferred Decisions

- Whether to expose claim suggestions in the UI or keep players fully manual.
- Whether later versions should support alternate table themes or unlockable cosmetics.

## Explicitly Out of Scope for Now

- Persistent player accounts
- Cross-session stats
- Server-side storage
- Match history
- Ranked matchmaking
- Open join-as-spectator flow
- Shop or inventory systems
