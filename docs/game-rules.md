# BluffGame Rules

## Match Setup

- Use one standard 52-card deck with no jokers.
- Support `2` to `8` players in v1.
- Seat players in a fixed clockwise order when they join the room.
- Each player starts the match with a `handSize` of `1`.

## Match Objective

Stay in the game longer than everyone else. The last non-eliminated player wins the match.

## Round Setup

1. Shuffle the deck at the start of every round.
2. Deal each active, non-eliminated player a number of private cards equal to their current `handSize`.
3. Pick the round starter:
   - Round 1 starter is random.
   - Each later round starts with the next active player clockwise after the previous round's starter.
4. The round starter must make the opening claim.

## Core Idea

Claims are made about the combined hidden card pool of all active players in the current round, not about a single player's private hand.

## Turn Flow

1. The current player states a legal claim.
2. The next active player clockwise chooses one action:
   - Raise the claim by stating a strictly higher legal claim.
   - Challenge the current claim by accusing the previous claimant of bluffing.
3. If the next player raises, play continues clockwise.
4. If the next player challenges, the round ends in a showdown immediately.

## Showdown Resolution

1. All active players reveal all of their cards for the current round.
2. Combine every revealed card into a single shared card pool.
3. Determine whether the exact final spoken claim can be formed from the shared card pool.
4. Resolve the challenge:
   - If the exact spoken claim exists, the claim was valid and the challenger loses.
   - If the exact spoken claim does not exist, the claim was invalid and the claimant loses.
5. The round ends immediately after the showdown.

## Penalties and Elimination

- A player who loses a showdown increases their `handSize` by `1` for future rounds.
- If that player already had `5` cards, they are eliminated instead of moving to `6`.
- Non-losing players keep the same `handSize`.
- Eliminated players do not participate in later rounds.
- If only one player remains active after a showdown, that player wins the match.

## Round Reset

- Discard all revealed cards after each showdown.
- Start the next round with a freshly shuffled deck.
- Keep the same seat order for the whole match.

## Legal Claim Order

Claims must always become strictly stronger using the following total order:

1. High card
2. Pair
3. Two pair
4. Three of a kind
5. Straight
6. Flush
7. Full house
8. Four of a kind
9. Straight flush
10. Royal flush

## Claim Comparison Inside a Category

When two claims share the same category, compare them by the category-specific tuple below from left to right:

| Category | Spoken shape | Comparison tuple |
| --- | --- | --- |
| High card | `high card ace` | `[highestRank]` |
| Pair | `pair of queens` | `[pairRank]` |
| Two pair | `kings and tens` | `[highPairRank, lowPairRank]` |
| Three of a kind | `three sevens` | `[tripRank]` |
| Straight | `jack-high straight` | `[highestCardInStraight]` |
| Flush | `ace-high flush` | `[highestCardInFlush]` |
| Full house | `nines full of fours` | `[tripRank, pairRank]` |
| Four of a kind | `four fives` | `[quadRank]` |
| Straight flush | `queen-high straight flush` | `[highestCardInStraightFlush]` |
| Royal flush | `royal flush` | `[]` |

## Rank Rules

- Rank order is `2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A`.
- A `5`-high straight (`A-2-3-4-5`) is the lowest straight.
- An `A`-high straight (`10-J-Q-K-A`) is the highest non-flush straight.
- Suits matter only for flush, straight flush, and royal flush detection.
- Suits do not break ties in v1.

## Practical Meaning of a Claim

A claim is valid only when the exact spoken combination can be formed from the shared pool. A stronger or different combination does not automatically satisfy the claim unless the spoken combination also exists as a subset of the revealed cards.

Examples:

- If the spoken claim is `2`-to-`6` straight, then a `3`-to-`7` straight does not save the claimant.
- If the spoken claim is `pair of queens`, then three or four queens still make the claim valid because a pair of queens can be formed from those cards.
- If the spoken claim is `high card ace`, then the claim is valid only if at least one ace is present in the shared pool.

## Additional Rulings for V1

- No player may repeat the same claim or make a lower claim.
- Players may bluff by stating claims the shared hidden pool does not actually support.
- There are no turn timers in the initial version.
- There is no partial reveal mechanic; showdown always reveals every active player's full round hand.
