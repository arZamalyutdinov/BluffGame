# BluffGame Rules

## Match Setup

- Use one standard 52-card deck with no jokers.
- Support `2` to `8` players in v1.
- Seat players in a fixed clockwise order when they join the room.
- While the room is in the lobby, the host may add bots to fill open seats.
- Bots use the same information limits as human players: their own hand, public
  room state, and the unseen remainder of the deck.
- Each player starts the match with a `handSize` of `1`.

## Room Settings

Every room carries three host-controlled settings that can only change in the
lobby:

- `eliminationHandSize`: the hand size at which a player is eliminated if they
  lose another showdown. Supported range: `2` to `6`. Default: `5`.
- `claimOrderPreset`: the category ordering used for legal raises and UI claim
  ordering. Default: `flush below straight`.
- `turnTimeLimitSeconds`: the maximum time allowed for the active player to act.
  Supported range: `15` to `120`. Default: `60`.

Changing any setting resets all human lobby ready states. Bots stay ready
automatically.

## Match Objective

Stay in the game longer than everyone else. The last non-eliminated player wins
the match.

## Round Setup

1. Shuffle the deck at the start of every round.
2. Deal each active, non-eliminated player a number of private cards equal to
   their current `handSize`.
3. Pick the round starter:
   - Round 1 starter is random.
   - Each later round starts with the next active player clockwise after the
     previous round's starter.
4. The round starter must make the opening claim.

## Core Idea

Claims are made about the combined hidden card pool of all active players in
the current round, not about a single player's private hand.

## Turn Flow

1. The current player states a legal claim.
2. The next active player clockwise chooses one action:
   - Raise the claim by stating a strictly higher legal claim.
   - Check the claim by accusing the previous claimant of bluffing.
3. The active player must act before the room's turn timer reaches zero.
4. The host may pause or resume the live turn timer during an active match.
5. While the game is paused, no player actions are accepted.
6. If the next player raises, play continues clockwise.
7. If the next player checks, the round ends in a showdown immediately.

## Timeout Resolution

1. If the active player's timer reaches zero before they act, that player loses
   the round automatically.
2. All active players reveal all of their cards for the round.
3. No claim-validity check is performed for a timeout loss.
4. Apply the same hand-size penalty or elimination rule as any other round loss.
5. The round ends immediately after the timeout reveal.

## Showdown Resolution

1. All active players reveal all of their cards for the current round.
2. Combine every revealed card into a single shared card pool.
3. Determine whether the exact final spoken claim can be formed from the shared
   card pool.
4. Resolve the check:
   - If the exact spoken claim exists, the claim was valid and the checker
     loses.
   - If the exact spoken claim does not exist, the claim was invalid and the
     claimant loses.
5. The round ends immediately after the showdown.

## Penalties and Elimination

- A player who loses a showdown or times out increases their `handSize` by `1`
  for future rounds.
- If that player already had `eliminationHandSize` cards, they are eliminated
  instead of moving higher.
- Non-losing players keep the same `handSize`.
- Eliminated players do not participate in later rounds.
- If only one player remains active after a showdown, that player wins the
  match.

## Round Reset

- Discard all revealed cards after each showdown or timeout reveal.
- Start the next round with a freshly shuffled deck.
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
| Flush | `hearts flush` | `[flushSuitPriority]` |
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
- When two same-category suit-based claims have the same rank tuple, compare
  them by suit priority.
- The exact spoken suit must exist for the claim to be valid at showdown.

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
- If the spoken claim is `high card ace`, then the claim is valid only if at
  least one ace is present in the shared pool.
- If the spoken claim is `hearts flush`, then a clubs-only flush does not save
  the claimant because the exact spoken suit is missing.

## Suit-Raise Examples

- If the previous claim is `diamonds flush`, the next player may raise to
  `clubs flush`, `hearts flush`, or `spades flush`.
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
