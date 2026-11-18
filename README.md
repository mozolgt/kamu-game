# 🃏 Bluffmaster

**Bluffmaster** is an original card game built around deception, probability, and deduction. Inspired by poker but centered on bluffing and information tracking, it challenges players to survive through smart declarations or sharp bluff calls.

This repository contains:
- A complete ruleset for Bluffmaster
- Code to simulate and analyze gameplay
- A playable browser prototype and plans for additional modes

## Browser prototype

Open [prototype/index.html](prototype/index.html) in a browser. The debug table uses plain HTML, CSS, and JavaScript and runs without an install or server.

Select **New match** to choose 2–10 players and fill any number of those seats with Easy bots. Mixed matches autoplay bot turns by default, with 2.5 seconds between moves. All-bot matches start paused, so you can use **Step bot** or turn on **Autoplay bots**. Both modes pause after a challenge for round review.

In **Inspector → Bots**, select a past decision to see the bot's hand, its estimated odds, the weight of each possible raise, and the chance of picking it. A seed reproduces the opening deal, bot seats, and bot decisions when the same actions are taken. The six-hearts and elimination presets are available in setup.

Hover over or press **Declare** to open the wheel. The opening player of each round can choose Set, Double Set, Straight, Flush, or Straight Flush. The first confirmed declaration locks that family until the next deal. Select a previous parameter to edit it before confirming. **Call bluff** is in the center while the wheel is open.

**Declaration history** is visible below the table and shows who declared each combination. Its sample cards use ✦ for an unspecified rank or suit. After a challenge, the table reveals every dealt card, groups relevant cards first, and highlights the cards that prove a successful match. Select **Next round** when ready, or enable **Auto-deal after 5 seconds** in the result controls.

In **Inspector → Odds**, search for a named combination such as “six hearts.” The table uses the selected player's hand and the number of other cards dealt. It assumes those cards are drawn uniformly from the unseen deck, including when you're inspecting a debug preset.

The prototype allows variable-length declarations. Within the locked family, it compares total card count first, then group sizes and ranks where applicable. Suits tie. Sets match selectable subsets, so three jacks can satisfy a two-jack declaration. These are provisional playtest rules. See the [frontend design](FRONTEND_DESIGN.md) for the planned modes.

## Reusing the JavaScript engine

The modules in [prototype/engine/](prototype/engine/) work without a DOM. The prototype loads them as scripts under `BluffmasterEngine`. A desktop or mobile JavaScript project can import the same files through a bundler that supports CommonJS.

| Module | API |
| --- | --- |
| `cards.js` | Standard deck, numeric ranks, suits, and seeded shuffling |
| `combinations.js` | Declaration options and validation, strength comparison, named matches, and matching cards |
| `odds.js` | `oddsForDeal(knownCards, otherCardsDealt)` returns a calculator that takes a structured declaration and returns a probability from 0 to 1 |
| `match.js` | `start` creates a match. `declare`, `challenge`, and `advance` update it and record structured events in `state.log`. `bidError` and `canChallenge` let callers check available actions. |
| `easy-bot.js` | `decide({ hand, otherCardsDealt, latestBid, family }, random)` returns an action and its decision trace. Callers supply the bot's own hand and public information, including the family once it is locked for the current round. |

For example, a calculator can feed an odds table, a card graphic, or a bot.

```js
const { oddsForDeal } = require("./prototype/engine/odds.js");

const knownCards = [{ rank: 14, suit: "Hearts" }];
const probability = oddsForDeal(knownCards, 11);
const sixHearts = probability({ family: "Flush", length: 6, suit: "Hearts" });
```

Card ranks run from 2 to 14, with 14 representing an ace. A straight declaration uses a starting rank of 1 for an ace-low run. The browser presentation layer supplies labels, suit symbols, log text, search, and percentage formatting.

---

## 🎮 Game Concept

Bluffmaster is a **survive-the-longest** card game. Players take turns either declaring increasingly strong poker hands or calling a bluff. But there's a twist: cards are never shown unless challenged. Can you lie convincingly? Can you detect the impossible?

---

## 🃏 Combination Family Taxonomy Table

| **Family**              | **Family Naming Rule**               | **Family Rule**                                                           | **Subset Naming Rule**                           | **Subset Rule**                                                               | **Example Name**                | **Example Cards**             |
|-------------------------|--------------------------------------|---------------------------------------------------------------------------|--------------------------------------------------|--------------------------------------------------------------------------------|-------------------------------|------------------------------|
| **Set**                 | `Set {x}`                            | Hand contains exactly **x cards** of the **same rank**                    | `Set {x} {Rank}`                                 | Contains exactly x cards of the given rank                                     | `Set 3 Jack`                  | J♠ J♦ J♣ 7♥ 2♠                |
| **Double Set**          | `Double Set {x} {y}`                 | Hand contains **x of one rank** and **y of another rank**                 | `Double Set {x} {Rank1} {y} {Rank2}`             | Contains x cards of Rank1 and y cards of Rank2                                 | `Double Set 3 Jack 2 7`       | J♠ J♦ J♣ 7♥ 7♠                |
| **Straight of x**       | `{x}-Straight`                       | Hand contains **x consecutive ranks**, any suits                          | `{x}-Straight of {StartingRank}`                | Contains x consecutive ranks starting from StartingRank                        | `5-Straight of 5`             | 5♠ 6♦ 7♣ 8♠ 9♥                |
| **Flush of x**          | `{x}-Flush`                          | Hand contains **x cards** of the **same suit**, any ranks                 | `{x}-Flush of {Suit}`                           | At least x cards of the declared suit are in the pool                         | `6-Flush of Hearts`           | 2♥ 6♥ 8♥ 9♥ J♥ A♥             |
| **Straight Flush of x** | `{x}-Straight Flush`                 | Hand contains **x consecutive ranks** of the **same suit**                | `{x}-Straight Flush {StartingRank}-{Suit}`      | x consecutive cards starting at StartingRank, all in the same suit             | `5-Straight Flush 9-Clubs`    | 9♣ 10♣ J♣ Q♣ K♣              |

---

## 📜 Rules

### 🔧 Setup
- Use a standard 52-card deck (no jokers).
- Every player starts with **1 card**.
- Set the **maximum hand size** at the start of the game to `floor(52 / starting player count)`. This limit stays fixed after eliminations. With four starting players, each player can hold up to 13 cards.

---

### 🔁 Turn Options
On their turn, a player must:
1. **Name** a 5-card poker combination  
   - The first declaration of each round locks its family for that round. The next round’s starting player can choose a different family.
   - Must be **strictly stronger** than the previous declared hand  
   - No cards are revealed—just declared  

**OR**

2. **Call a Bluff**  
   - Challenges the previous declaration  
   - Pool the cards dealt to all players still in the round. For example, if 40 cards were dealt, check those 40 cards.
   - The challenge succeeds if the **exact named combination** is absent from the pool. Check every matching combination, including those below the strongest match.

---

### 🤥 Bluff Outcomes
- If the **bluff is real**:
  - The **bluffer's hand size increases by 1** for the next round, subject to the card limit
  - If they are not eliminated, they **start the next round**

- If the **bluff call is incorrect**:
  - The **challenger's hand size increases by 1** for the next round, subject to the card limit
  - If they are not eliminated, they **start the next round**

- If the penalized player is **eliminated**:
  - The next surviving player in turn order **starts the round**

---

### 🔄 New Round
- The full deck is reshuffled
- Deal each surviving player a fresh hand of the same size as in the previous round, with **one extra card** for the penalized player if they survived.

---

### 💥 Elimination
- A player who takes a penalty while already at the card limit is **eliminated** before the next deal. In a four-player game, a player who loses while holding 13 cards is eliminated.
- The **last player standing wins**.

---

### 🧠 Strategy Focus

This is a **pure information game**—no cards are played on the table. The more cards you have, the more plausible your bluffs, but the closer you are to elimination. Victory comes from:
- Understanding poker probabilities
- Deducting opponent hands
- Bluffing at the right time
- Calling lies wisely

---

## 🗺️ Roadmap

- [ ] Hand validator and poker logic engine (Python)
- [ ] Bluff plausibility checker (based on all players’ known cards)
- [ ] Game simulation CLI
- [ ] Digital version (TBD)
- [ ] Optional support for jokers or Hungarian deck variants

---

## 📄 License
To be added.

---

## 🤝 Contributions

Contributions, ideas, and forks are welcome! This game is in early development, and your feedback can help shape its future.
