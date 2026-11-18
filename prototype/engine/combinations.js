"use strict";

((factory) => {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./cards.js"));
  } else {
    const modules = (globalThis.BluffmasterEngine ??= {});
    modules.combinations = factory(modules.cards);
  }
})((cards) => {
  const { suits, ranks, deck } = cards;
  const families = Object.freeze(["Set", "Double Set", "Straight", "Flush", "Straight Flush"]);

  function lengths(family) {
    if (family === "Set" || family === "Double Set") return 4;
    return 13;
  }

  function normalize(bid) {
    const { family, length, rank, suit, secondLength, secondRank } = bid;
    if (family === "Flush") return { family, length, suit };
    if (family === "Straight Flush") return { family, length, rank, suit };
    if (family !== "Double Set") return { family, length, rank };
    if (bid.length > bid.secondLength ||
        (bid.length === bid.secondLength && bid.rank >= bid.secondRank)) return { family, length, rank, secondLength, secondRank };
    return {
      family: bid.family,
      length: bid.secondLength,
      rank: bid.secondRank,
      secondLength: bid.length,
      secondRank: bid.rank,
    };
  }

  function validBid(bid) {
    if (!bid || typeof bid !== "object") return false;
    const { family, length, rank, suit, secondLength, secondRank } = bid;
    const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
    if (!families.includes(family) || !inRange(length, 1, lengths(family))) return false;
    if (family === "Flush") return suits.includes(suit);
    if (family === "Straight" || family === "Straight Flush") {
      return inRange(rank, 1, 15 - length)
        && (family === "Straight" || suits.includes(suit));
    }
    if (!inRange(rank, 2, 14)) return false;
    return family === "Set" || (
      inRange(secondLength, 1, 4) && inRange(secondRank, 2, 14) && rank !== secondRank
    );
  }

  function key(bid) {
    const { family, length, rank, suit, secondLength, secondRank } = normalize(bid);
    if (family === "Flush") return JSON.stringify([family, length, suit]);
    if (family === "Straight Flush") return JSON.stringify([family, length, rank, suit]);
    if (family === "Double Set") return JSON.stringify([family, length, rank, secondLength, secondRank]);
    return JSON.stringify([family, length, rank]);
  }

  function strength(bid) {
    const { family, length, rank, secondLength, secondRank } = normalize(bid);
    return [length + (secondLength ?? 0), families.indexOf(family), length, rank ?? 0, secondRank ?? 0];
  }

  function compare(left, right) {
    const leftStrength = strength(left);
    const rightStrength = strength(right);
    const difference = leftStrength.findIndex((value, index) => value !== rightStrength[index]);
    return difference < 0 ? 0 : leftStrength[difference] - rightStrength[difference];
  }

  // Enumerate the same named subsets as the Python evaluator. Flush keys use suit and length.
  function buildLookup(pool) {
    const lookup = new Map();
    function add(bid, cards) {
      const canonical = normalize(bid);
      lookup.set(key(canonical), { bid: canonical, cards });
    }

    const rankGroups = ranks.map(rank => ({ rank, cards: pool.filter(card => card.rank === rank) }))
      .filter(group => group.cards.length);
    rankGroups.forEach(({ rank, cards }, index) => {
      for (let length = 1; length <= cards.length; length++) {
        const selected = cards.slice(0, length);
        add({ family: "Set", rank, length }, selected);
        for (const other of rankGroups.slice(index + 1)) {
          for (let secondLength = 1; secondLength <= other.cards.length; secondLength++) {
            add({
              family: "Double Set", rank, length, secondRank: other.rank, secondLength,
            }, [...selected, ...other.cards.slice(0, secondLength)]);
          }
        }
      }
    });

    function addRuns(cards, family, suit) {
      const byRank = new Map(cards.map(card => [card.rank, card]));
      if (byRank.has(14)) byRank.set(1, byRank.get(14));
      for (const rank of byRank.keys()) {
        const run = [];
        for (let next = rank; byRank.has(next) && next - rank < 13; next++) {
          run.push(byRank.get(next));
          add({ family, rank, length: run.length, suit }, [...run]);
        }
      }
    }

    addRuns(pool, "Straight");
    for (const suit of suits) {
      const cards = pool.filter(card => card.suit === suit);
      for (let length = 1; length <= cards.length; length++) {
        add({ family: "Flush", suit, length }, cards.slice(0, length));
      }
      addRuns(cards, "Straight Flush", suit);
    }
    return lookup;
  }

  function declarationCatalog() {
    return [...buildLookup(deck).values()].map(({ bid }) => bid);
  }

  function parameterOptions(name, bid) {
    const numbers = (min, max) => Array.from({ length: max - min + 1 }, (_, index) => min + index);
    if (name === "suit") return [...suits];
    if (name === "length") return numbers(1, lengths(bid.family));
    if (name === "secondLength") return numbers(1, 4);
    if (name === "secondRank") return ranks.filter(rank => rank !== bid.rank);
    if (name === "rank" && (bid.family === "Straight" || bid.family === "Straight Flush")) {
      return numbers(1, 15 - bid.length);
    }
    return name === "rank" ? [...ranks] : [];
  }

  function requiredGroups(bid) {
    const { family, length, suit, rank, secondLength, secondRank } = normalize(bid);
    const group = (needed, rank, suit) => ({
      needed, rank, suit,
      includes: card => (rank === undefined || card.rank === rank)
        && (suit === undefined || card.suit === suit),
    });
    if (family === "Set") return [group(length, rank)];
    if (family === "Double Set") return [group(length, rank), group(secondLength, secondRank)];
    if (family === "Flush") return [group(length, undefined, suit)];
    return Array.from({ length }, (_, index) => {
      const runRank = rank + index;
      return group(1, runRank === 1 ? 14 : runRank, suit);
    });
  }

  return { families, normalize, validBid, key, compare, buildLookup, declarationCatalog, parameterOptions, requiredGroups };
});
