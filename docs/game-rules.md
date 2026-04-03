# BluffGame Rules

## Match Setup

- Use a standard 52-card deck by default, with an optional 54-card variant that
  adds one red joker and one black joker.
- Support `2` to `8` players in v1.
- Assign each joining player a random open seat. That clockwise seat order then
  stays fixed for the rest of the match.
- While the room is in the lobby, the host may add bots to fill open seats and
  remove lobby bots again if too many were added.
- Bots use the same information limits as human players: their own hand, public
  room state, and the unseen remainder of the deck.
- Each player present when the match starts begins with a `handSize` of `1`.
- If a human joins during an active match, they take a random open seat
  immediately, sit out the current round, and enter the next round with a
  `handSize` equal to the rounded-down average number of cards currently on the
  table.

## Room Settings

Every room carries six host-controlled settings that can only change in the
lobby:

- `eliminationHandSize`: the hand size at which a player is eliminated if they
  lose another showdown. Supported range: `2` to `6`. Default: `5`.
- `claimOrderPreset`: the category ordering used for legal raises and UI claim
  ordering. Default: `flush below straight`.
- `flushRule`: how plain flushes are spoken and compared. Supported values:
  `suit only` and `suit plus rank`. Default: `suit only`.
- `showdownDrawRule`: how checked claims are verified. Supported values:
  `revealed only` and `draw until miss`. Default: `revealed only`.
- `jokerRule`: whether the round deck includes jokers. Supported values:
  `off` and `two jokers`. Default: `off`.
- `turnTimeLimitSeconds`: the maximum time allowed for the active player to act.
  Supported range: `15` to `120`. Default: `60`.

Changing any setting resets all human lobby ready states. Bots stay ready
automatically.

## Match Objective

Stay in the game longer than everyone else. The last non-eliminated player wins
the match.

## Round Setup

1. Shuffle the room's selected round deck at the start of every round:
   - `off`: use the standard 52-card deck.
   - `two jokers`: add one red joker and one black joker to make a 54-card deck.
2. Deal each active, non-eliminated player a number of private cards equal to
   their current `handSize`.
3. Enter a short server-owned `dealing` phase before live play begins:
   - Cards are presented one at a time from the upper-center of the table.
   - No gameplay commands are accepted during this deal window.
   - The turn timer is not running yet.
4. Pick the round starter:
   - Round 1 starter is random.
   - Each later round starts with the next active player clockwise after the
     previous round's starter.
5. The round starter must make the opening claim.

## Core Idea

Claims are made about the combined hidden card pool of all active players in
the current round, not about a single player's private hand.

## Turn Flow

1. The current player states a legal claim.
2. The next active player clockwise chooses one action:
   - Raise the claim by stating a strictly higher legal claim.
   - Check the claim by accusing the previous claimant of bluffing.
3. The active player must act before the room's turn timer reaches zero.
4. The host may pause or resume the live turn timer during an active turn.
5. While the game is paused, no player actions are accepted.
6. While the round is in `dealing`, no player actions are accepted and no turn
   timer is running.
7. If the round is in its result-display sequence, no player actions or bot
   actions are accepted and no turn timer is running.
8. Eliminated spectators cannot make gameplay actions. They may still use room
   chat and open the Players drawer.
9. A human who joins during an active match does not receive cards for the
   current round and does not affect its hidden pool, turn order, or showdown.
10. During an active match, a human player may choose `Stop playing` and become
    a spectator.
11. During an active match, a human player may also leave the room entirely.
    They are removed from the player list instead of staying as a spectator.
12. During an active match, the host may move another player to the spectator
    rail from the Players drawer.
13. If the next player raises, play continues clockwise.
14. If the next player checks, the round ends in a showdown immediately.

## Timeout Resolution

1. If the active player's timer reaches zero before they act and there is a
   previous claim to answer, the server automatically checks that claim on the
   timed-out player's behalf.
2. That automatic check uses the same showdown rules as a manual check.
3. If the active player's timer reaches zero before an opening claim exists,
   that player loses the round automatically.
4. Opening-turn timeout losses do not perform any claim-validity check.
5. Show a non-dismissible result sequence for the revealed hands.
6. After the reveal animation finishes, keep that result sequence visible for
   an additional `5` seconds.
7. Only after that full result-display window ends does the next round start.
8. Each new round then goes through the server-owned `dealing` phase before
   its turn timer begins.

## Showdown Resolution

1. All active players reveal all of their cards for the current round.
2. Combine every revealed card into a single shared card pool.
3. Use the room's `showdownDrawRule`:
   - `revealed only`: determine whether the exact final spoken claim can be
     formed from the revealed shared card pool.
   - `draw until miss`: start from the same revealed shared card pool, then
     inspect undealt round-deck cards from the top one at a time. Keep drawing
     only while the newly revealed card improves progress toward the exact
     spoken claim. Stop immediately when the claim completes or when the first
     revealed deck card fails to improve it.
4. Resolve the check:
   - If the exact spoken claim exists, the claim was valid and the checker
     loses.
   - If the exact spoken claim does not exist, the claim was invalid and the
     claimant loses.
5. Show a non-dismissible result sequence for the revealed hands and claim
   review.
6. During showdown presentation, keep the center result marker visually neutral
   until the final resolve beat:
   - `revealed only`: reveal hands first, then reveal the verdict and final
     claim construction.
   - `draw until miss`: reveal hands first, then reveal any top-deck cards one
     at a time, then reveal the verdict and final claim construction.
7. After the reveal animation finishes, keep that result sequence visible for
   an additional `5` seconds.
8. Only after that full result-display window ends does the next round start.
9. Each new round then goes through the server-owned `dealing` phase before
   its turn timer begins.

## Penalties and Elimination

- A player who loses a showdown or an opening-turn timeout increases their
  `handSize` by `1` for future rounds.
- If that player already had `eliminationHandSize` cards, they are eliminated
  instead of moving higher.
- Non-losing players keep the same `handSize`.
- Eliminated players do not participate in later rounds.
- Eliminated players stay in the room as spectators.
- Starting with the next live round, active table seats are recomputed without
  eliminated players.
- An eliminated human spectator may privately enable live-card reveal for
  themselves during later rounds. This does not change what other clients see.
- If a live player becomes a spectator during `dealing`,
  `awaiting-opening-claim`, or `awaiting-response`, the current round is
  discarded and immediately re-dealt for the remaining active players.
- If a live player leaves the room during `dealing`, `awaiting-opening-claim`,
  or `awaiting-response`, remove them from the room, then discard that round
  and immediately re-deal for the remaining active players.
- Whenever a round is re-dealt or a new round begins after players joined or
  left active play, choose the next acting seat from the updated clockwise seat
  order.
- If that leaves only one active player, the match ends immediately.
- If only one player remains active after a showdown, that player wins the
  match.

## Round Reset

- Discard all revealed cards after each showdown or timeout result-display
  sequence finishes.
- Start the next round with a freshly shuffled deck only after the server-owned
  result-display window ends.
- After that new round is created, run the server-owned `dealing` sequence
  before the opening claimant's timer begins.
- Keep the same seat order for the whole match.

## Claim Order Presets

Claims must always become strictly stronger according to the room's selected
preset.

### Default: Flush Below Straight

1. High card
2. Pair
3. Two pair
4. Three of a kind
5. Flush
6. Straight
7. Full house
8. Four of a kind
9. Straight flush

### Standard Poker

1. High card
2. Pair
3. Two pair
4. Three of a kind
5. Straight
6. Flush
7. Full house
8. Four of a kind
9. Straight flush

### Flush Below Trips And Straight

1. High card
2. Pair
3. Two pair
4. Flush
5. Three of a kind
6. Straight
7. Full house
8. Four of a kind
9. Straight flush

## Claim Comparison Inside A Category

When two claims share the same category, compare them by the category-specific
tuple below from left to right:

| Category | Spoken shape | Comparison tuple |
| --- | --- | --- |
| High card | `high card ace` | `[highestRank]` |
| Pair | `pair of queens` | `[pairRank]` |
| Two pair | `kings and tens` | `[highPairRank, lowPairRank]` |
| Three of a kind | `three sevens` | `[tripRank]` |
| Straight | `three-low straight` | `[lowestCardInStraight]` |
| Flush | `hearts flush` or `hearts flush with queen` | `suit only`: `[flushSuitPriority]`; `suit plus rank`: raise only if suit and named rank both stay the same or go up, with at least one of them increasing |
| Full house | `nines full of fours` | `[tripRank, pairRank]` |
| Four of a kind | `four fives` | `[quadRank]` |
| Straight flush | `nine-low clubs straight flush` | `[lowestCardInStraightFlush, straightFlushSuitPriority]` |

## Rank Rules

- Rank order is `2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A`.
- A `5`-high straight (`A-2-3-4-5`) is the lowest straight.
- An `A`-high straight (`10-J-Q-K-A`) is the highest non-flush straight.

## Suit Rules

- Suit order is `diamonds < clubs < hearts < spades`.
- Suits matter for flush and straight flush claims.
- When the room uses `suit plus rank` flushes, a new flush claim is legal only
  if the suit and the named card rank both stay the same or go up compared to
  the previous flush claim, and at least one of those axes goes up.
- When two same-category suit-based claims have the same rank tuple, compare
  them by suit priority.
- The exact spoken suit must exist for the claim to be valid at showdown.

## Joker Rules

- When `jokerRule` is `off`, jokers do not exist in the round deck.
- When `jokerRule` is `two jokers`, the deck contains:
  - one red joker
  - one black joker
- Jokers are full wild cards for exact-claim validation. They do not create new
  spoken claim types or change claim ordering.
- A joker may stand in for any missing rank in non-suited claims.
- When suit matters:
  - red joker may only stand in for diamonds or hearts
  - black joker may only stand in for clubs or spades
- Both jokers may participate in the same exact spoken claim if that claim can
  be formed from the available real cards plus those two joker substitutions.
- Claim construction, showdown validation, and draw-until-miss progress all use
  the best legal joker assignment for the exact spoken claim.

## Practical Meaning Of A Claim

A claim is valid only when the exact spoken combination can be formed from the
shared pool. A stronger or different combination does not automatically satisfy
the claim unless the spoken combination also exists as a subset of the revealed
cards.

Examples:

- If the spoken claim is `2`-to-`6` straight, then a `3`-to-`7` straight does
  not save the claimant.
- If the spoken claim is `pair of queens`, then three or four queens still make
  the claim valid because a pair of queens can be formed from those cards.
- If the spoken claim is `pair of queens`, then one queen plus a joker also
  makes the claim valid when jokers are enabled.
- If the spoken claim is `high card ace`, then the claim is valid only if at
  least one ace is present in the shared pool.
- If the spoken claim is `hearts flush`, then a clubs-only flush does not save
  the claimant because the exact spoken suit is missing.
- If the spoken claim is `hearts flush with queen`, then five hearts without
  the queen of hearts do not save the claimant.
- If the spoken claim is `hearts flush with queen`, then four other hearts plus
  the red joker do satisfy the claim when jokers are enabled, because the red
  joker may stand in for the queen of hearts.

## Suit-Raise Examples

- If the previous claim is `diamonds flush`, the next player may raise to
  `clubs flush`, `hearts flush`, or `spades flush`.
- If the room uses `suit plus rank` flushes and the previous claim is
  `clubs flush with 10`, the next player may raise to `hearts flush with 10`,
  `spades flush with 10`, `clubs flush with J`, or `hearts flush with J`.
  `hearts flush with 2` is not legal because the named card rank went down.
- If the previous claim is `nine-low clubs straight flush`, the next player may
  raise to `nine-low hearts straight flush` because hearts outrank clubs.
- If the previous claim is `ten-low hearts straight flush`, only
  `ten-low spades straight flush` is a higher same-rank straight flush claim.

## Additional Rulings For V1

- No player may repeat the same claim or make a lower claim.
- Players may bluff by stating claims the shared hidden pool does not actually
  support.
- There is no partial reveal mechanic; showdown always reveals every active
  player's full round hand.
- Clients may not dismiss the round-result screen early; the server controls
  when live play resumes.
- Disconnects keep a player's place in the room. If the disconnected player is
  also the host, they get a `10` second reconnect window before host control is
  reassigned.
- Explicit leave is different from disconnect: leaving removes that player from
  the room immediately and does not reserve their seat for reconnect.
