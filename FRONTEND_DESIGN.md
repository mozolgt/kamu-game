# Bluffmaster web app design

The first build is a local debug table where one person can control every seat and inspect the rules as a round plays out. The same match engine and table can later support hot seat, bots, solo practice, and online play.

## First build

**Setup.** Choose 2–10 players and start with one card each. Show the fixed hand limit before starting. Offer a shuffled deal, an optional seed for reproducing a deal, and preset scenarios for round transitions and eliminations.

**Table.** Use a charcoal background, a green felt play area, and cream card faces with clear rank and suit labels. Show the round, total cards dealt, and fixed hand limit above the table. List seats in turn order with their hand sizes and highlight the active seat. Put the latest declaration and its author in the center. Keep the active hand and turn controls at the bottom. On narrow screens, put the seats in a horizontal strip and the debug inspector in a drawer.

**Turn controls.** Hover over or activate **Declare** to open a concentric picker. The opening player sees five family sectors, including Straight Flush. The first confirmed declaration locks the family for that round. The wheel opens directly to its parameters until the next deal. Previously selected parameters can be reopened and editing one clears the choices after it. Review and confirm the completed declaration. Show the reason when the declaration fails the ordering rules. **Call bluff** sits at the center of the wheel and becomes available after the first declaration. A legal declaration can be submitted even when the inspector shows it is absent from the pool.

**Debug inspector.** Toggle between the acting player's view and a view with all dealt hands. The inspector shows the pooled cards, searchable named matches, and which cards satisfy a selected match. Add a round log that records declarations, challenges, penalties, and the next starting seat. Scenarios should show the seed or explicit hands so a result can be reproduced.

**Odds table.** Search for any named declaration and see its conditional chance of being present in the dealt pool. Use one player's cards as fixed information and count the other dealt cards as a random sample from the remaining deck. The active player is the default perspective.

**Challenge result.** Show the exact declaration, whether it was present, any matching cards, the penalized seat, and the next starter. Wait for an explicit **Next round** action so the result can be inspected. If only one player remains, show the winner and end the match.

## Match rules and state

- Store the starting player count and set the hand limit once to `floor(52 / starting player count)`.
- Store each seat's current hand size and dealt cards, the active seat, the latest declaration and its author, and the match phase. The match engine owns transitions between acting, reviewing a challenge, and game over.
- Validate declaration shape and strength independently of card availability. Represent a declaration as structured data with a display label, and use the same representation for submission and challenge resolution.
- Resolve challenges against the union of all cards dealt for the current round. An exact match penalizes the challenger. An absent match penalizes the declarer. Undealt cards are excluded.
- If the penalized player is below the cap, increase their hand size by one and have them start the next round. At the cap, eliminate them and move the starting seat to the next survivor in turn order. Shuffle the full deck, redeal to survivors using their updated sizes, and clear the declaration.

## Declaration rules to settle

- **Allowed lengths.** The README describes five-card declarations, while the taxonomy includes variable-length patterns. Decide which lengths players can declare, especially with 2–4 pooled cards in the opening round. Keep these rules in the engine so the editor and bots use the same options.
- **Strength order.** Define how sizes, families, and ranks compare. Specify which named variants tie, including whether suits affect strength, and how an ace affects the ordering of straights. Strictly stronger declarations require this comparison.
- **Exact matching.** A flush declaration specifies length and suit. Six hearts is true when the pool contains at least six hearts of any ranks. For a concrete dealt pool, use the simulator's combination output as a lookup keyed by family, length, and suit for flushes. The highest-rank field can be ignored for this lookup. For sets, confirm whether three jacks also satisfy a declaration of two jacks.

The browser prototype mirrors the Python evaluator in JavaScript and builds its lookup from the current deal. Keep the aggregate probability reports as analysis tools.

For playtesting, the prototype accepts the simulator's variable-length patterns and compares declarations in the locked family by total card count, then group sizes and ranks where applicable. Suits tie. Sets and double sets use selectable subsets, so three jacks can satisfy a two-jack declaration.

## Development order

| Stage | What the player can do |
| --- | --- |
| 1. Debug table | Control all seats, play a full match, and inspect or reproduce any challenge. |
| 2. Local hot seat | Pass one device between players. Hide the outgoing player's hand immediately and show a handoff screen before revealing the incoming player's cards. |
| 3. Solo versus bots | Play the same match against automated seats. Each bot acts on its own cards and public game state. |
| 4. Solo practice | Reserve a separate entry for guided exercises or feedback once the practice mechanics are defined. |
| 5. Online with friends | Create or join a private room. The server owns the deck and validates actions, and each client receives its own hand plus public state. Support rejoining the assigned seat. |

Use the same declare, challenge, and advance-round actions in every mode. Give players and bots a seat-specific view of the match. The all-cards inspector is available in local debugging.

The Easy policy excludes zero-odds raises and favors stronger, more likely claims. It calls impossible declarations or when no possible raise is available. Its chance of calling rises as the current declaration's estimated probability falls below 55%. When raising, it takes the bluff branch 15% of the time if a candidate has an estimated chance between 12% and 85%. The decision inspector shows the odds, weights, and chosen action.

## First-build acceptance scenarios

| Scenario | Expected outcome |
| --- | --- |
| Start with 2, 4, or 10 players | Everyone receives one card. The caps are 26, 13, and 5 respectively. |
| A stronger combination exists in a 40-card pool, and the exact declared combination also exists | The challenger takes the penalty. The inspector identifies cards for the exact declaration. |
| A similar combination exists, or the declaration could only be completed using an undealt card | The declarer takes the penalty. |
| A seat below the cap loses | That seat starts the next round with one extra card. Every other survivor keeps their previous hand size. |
| A seat at 13 loses in a four-player match | That seat is eliminated. The next survivor starts, and the cap remains 13. |
| A challenge eliminates the second-to-last player | The last survivor wins and no new round is dealt. |
