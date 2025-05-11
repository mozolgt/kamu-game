# 🃏 Bluffmaster

**Bluffmaster** is an original card game built around deception, probability, and deduction. Inspired by poker but centered on bluffing and information tracking, it challenges players to survive through smart declarations or sharp bluff calls.

This repository contains:
- A complete ruleset for Bluffmaster
- Code to simulate and analyze gameplay
- Future plans for a CLI and digital prototype

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
| **Flush of x**          | `{x}-Flush`                          | Hand contains **x cards** of the **same suit**, any ranks                 | `{x}-Flush of {HighestRank}-{Suit}`             | x cards of given suit, highest card is HighestRank                             | `5-Flush of A-Hearts`         | 2♥ 6♥ 9♥ J♥ A♥                |
| **Straight Flush of x** | `{x}-Straight Flush`                 | Hand contains **x consecutive ranks** of the **same suit**                | `{x}-Straight Flush {StartingRank}-{Suit}`      | x consecutive cards starting at StartingRank, all in the same suit             | `5-Straight Flush 9-Clubs`    | 9♣ 10♣ J♣ Q♣ K♣              |

---

## 📜 Rules

### 🔧 Setup
- Use a standard 52-card deck (no jokers).
- Every player starts with **1 card**.
- The **maximum number of cards** a player can hold is:  
  `floor(52 / number of players)`  
  _(e.g., 5 players → max 10 cards each)_

---

### 🔁 Turn Options
On their turn, a player must:
1. **Name** a 5-card poker combination  
   - Must be **strictly stronger** than the previous declared hand  
   - No cards are revealed—just declared  

**OR**

2. **Call a Bluff**  
   - Challenges the previous declaration  
   - All players' cards are checked
   - If the declared hand is **impossible**, it was a bluff

---

### 🤥 Bluff Outcomes
- If the **bluff is real**:
  - The **bluffer gains 1 card**
  - If they are not eliminated, they **start the next round**

- If the **bluff call is incorrect**:
  - The **challenger gains 1 card**
  - If they are not eliminated, they **start the next round**

- If the penalized player is **eliminated**:
  - The next surviving player in turn order **starts the round**

---

### 🔄 New Round
- The full deck is reshuffled
- All surviving players are dealt **1 new card**

---

### 💥 Elimination
- A player is **eliminated** if they exceed their card limit after receiving a penalty card

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
