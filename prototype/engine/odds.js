"use strict";

((factory) => {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./cards.js"), require("./combinations.js"));
  } else {
    const modules = (globalThis.BluffmasterEngine ??= {});
    modules.odds = factory(modules.cards, modules.combinations);
  }
})((cards, combinations) => {
  const { deck, standardCard } = cards;
  const { validBid, requiredGroups } = combinations;

  // All counts through binomial(52, 26) fit in JavaScript's safe integer range.
  const coefficients = [[1]];
  for (let n = 1; n <= deck.length; n++) {
    coefficients.push(Array.from({ length: n + 1 }, (_, k) =>
      (coefficients[n - 1][k - 1] ?? 0) + (coefficients[n - 1][k] ?? 0)));
  }
  const choose = (n, k) => coefficients[n][k] ?? 0;

  function oddsForDeal(known, draws) {
    const knownCards = known.map(standardCard);
    const seen = new Set(knownCards);
    if (seen.size !== known.length || seen.has(undefined)) {
      throw new RangeError("Known cards must be distinct cards from a standard deck.");
    }
    const remaining = deck.filter(card => !seen.has(card));
    if (!Number.isInteger(draws) || draws < 0 || draws > remaining.length) {
      throw new RangeError("Unseen dealt card count is outside the remaining deck.");
    }
    const possibleDeals = choose(remaining.length, draws);

    return bid => {
      if (!validBid(bid)) throw new TypeError("Invalid declaration.");
      const missing = requiredGroups(bid)
        .map(({ needed, includes }) => ({
          minimum: needed - knownCards.filter(includes).length,
          available: remaining.filter(includes).length,
        }))
        .filter(({ minimum }) => minimum > 0);
      if (!missing.length) return 1;
      if (missing.reduce((sum, { minimum }) => sum + minimum, 0) > draws) return 0;

      // The groups are disjoint. Count ways to meet their minimums, then fill
      // any remaining draw slots from the unconstrained cards.
      let ways = Array(draws + 1).fill(0);
      ways[0] = 1;
      let unconstrained = remaining.length;
      for (const { minimum, available } of missing) {
        unconstrained -= available;
        const next = Array(draws + 1).fill(0);
        ways.forEach((count, used) => {
          if (!count) return;
          for (let take = minimum; take <= Math.min(available, draws - used); take++) {
            next[used + take] += count * choose(available, take);
          }
        });
        ways = next;
      }
      const favorableDeals = ways.reduce((sum, count, used) =>
        sum + count * choose(unconstrained, draws - used), 0);
      return favorableDeals / possibleDeals;
    };
  }

  return { oddsForDeal };
});
