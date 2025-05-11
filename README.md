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
