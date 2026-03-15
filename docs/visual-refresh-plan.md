# BluffGame Visual Refresh Plan

Planning update recorded on March 15, 2026.

## Goal

Make BluffGame feel closer to a stylized live card-table game: a clear table surface, stronger player presence, more expressive icons, and lightweight motion that adds energy without obscuring the rules. The current art-direction lock is a playful neon cartoon table scene for the live match and showdown overlay, with the provided screenshots serving as mood reference rather than a feature checklist.

## Non-Goals

- Do not clone the reference screen one-for-one.
- Do not add shop, inventory, spectator, or cosmetic-economy systems as part of this visual refresh.
- Do not move gameplay authority into client-only animation logic.
- Do not introduce heavy 3D or canvas rendering for the first pass.

## Experience Pillars

### 1. Table-First Composition

The match should read as a real play space first. The oval table, seat positions, active player emphasis, and room controls should feel arranged around a shared table scene rather than stacked as generic cards.

### 2. Strong Player Presence

Players need clearer visual identity through seat badges, avatar frames, host and bot markers, ready and eliminated states, and active-turn emphasis that can be read at a glance.

### 3. Readable Competitive UI

Primary actions such as `Submit claim`, `Check`, turn timer state, and the current claim must remain instantly scannable even after adding decorative art, glows, and extra chrome.

### 3a. Bright Action Hierarchy

The live match should prioritize bold, highly legible buttons and floating info cards over low-contrast dark panels. `Check`, claim-building, timer state, and showdown outcome text need to read clearly against both felt and HUD surfaces.

### 4. Delightful but Truthful Motion

Animations should reinforce state changes that already happened on the server: room entry, turn handoff, claim submission, timer urgency, and showdown resolution. Motion should never imply a different game state than the snapshot.

### 5. Responsive and Accessible Polish

The same visual language should work on desktop and mobile. Reduced-motion users still need a complete, readable experience, and contrast should stay strong enough for long sessions.

## Workstreams

### Visual Foundation

- Define the table silhouette, palette, typography, icon language, glow rules, and button chrome.
- Move shared color, spacing, radius, shadow, and motion values into a reusable token layer.
- Establish a reusable scene shell that home, lobby, and match screens can all inherit.

### Table Scene and Seating

- Build the match view around an oval felt table with layered rail, inner glow, and a clear play area.
- Anchor players to consistent seat positions with room for avatar badges, hand counts, turn indicators, and elimination states.
- Make the self seat larger and bottom-centered, with the player hand integrated into that seat presentation.
- Separate decorative backdrop layers from gameplay layers so the play space stays readable.

### HUD and Controls

- Restyle top-level room controls, settings cards, claim panels, and chat into a consistent HUD system.
- Move the live match toward a top utility strip, compact floating claim indicators, and a bottom action dock with an attached on-demand claim tray.
- Introduce icon-backed affordances for host, bot, ready, timer, chat, and settings states.
- Preserve clear text labels alongside icons so the interface stays understandable without guesswork.

### Motion and Feedback

- Add page-entry and room-entry motion to make the app feel intentional.
- Add live-turn emphasis, timer urgency states, and claim-submission transitions.
- Extend showdown and timeout presentation with layered reveal timing, while keeping the server-owned result window authoritative.
- Keep the showdown overlay in the same playful neon family as the match table so it feels like one product.

### Responsive Pass

- Keep desktop table-centric, with supporting controls arranged around the scene.
- Use sheets and drawers on mobile for secondary panels such as chat or auxiliary table detail.
- Prioritize gameplay controls over decorative layers when space gets tight.

### Quality Pass

- Audit `prefers-reduced-motion`, contrast, focus states, and text readability.
- Profile render cost so decorative effects do not create sluggish gameplay.
- Capture before or after screenshots for major milestones to keep the visual target honest.

## Proposed Rollout

### Milestone 1: Foundation

- Land the shared visual tokens and scene shell.
- Reskin home and lobby so the style system is proven outside the match view.
- Add a baseline icon set for suits, host, bot, ready, and settings states.

### Milestone 2: Match Table Rebuild

- Replace the current flat layout with a true table scene.
- Rework seating, card anchoring, and action-panel placement around the table.
- Bring the chat rail, timer, and claim panels into the same HUD language.

### Milestone 3: Motion and Result Polish

- Add turn-handoff, claim, and countdown motion.
- Refine showdown and timeout overlays so the match feels alive.
- Add reduced-motion fallbacks and tune interruptibility.

### Milestone 4: Final Fit and Finish

- Tighten mobile behavior, overflow handling, and empty states.
- Audit spacing, glow intensity, and legibility.
- Pair the new visuals with browser and server verification work from the main TODO plan.

## Likely Code Touchpoints

- `apps/web/src/App.tsx`
- `apps/web/src/components/LobbyView.tsx`
- `apps/web/src/components/TableView.tsx`
- `apps/web/src/components/ClaimPreview.tsx`
- `apps/web/src/components/RoomChat.tsx`
- `apps/web/src/components/RoundResolutionOverlay.tsx`
- `apps/web/src/styles.css`

## Acceptance Criteria

- The match screen reads as a card table at both desktop and mobile widths.
- Host, bot, active-turn, ready, and eliminated states are identifiable without opening extra panels.
- Primary actions and the current claim stay readable even with decorative art enabled.
- Motion reinforces authoritative state changes and does not create ambiguity.
- Reduced-motion mode remains fully usable.
