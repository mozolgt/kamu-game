"use strict";

((factory) => {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./combinations.js"), require("./odds.js"));
  } else {
    const modules = globalThis.BluffmasterEngine;
    modules.easyBot = factory(modules.combinations, modules.odds);
  }
})((combinations, odds) => {
  const { compare, declarationCatalog } = combinations;
  const bluffRate = .15;
  const bluffFloor = .12;
  const bluffCeiling = .85;
  const challengeThreshold = .55;
  const catalog = declarationCatalog().sort(compare);
  let strength = 0;
  const ranked = catalog.map((bid, index) => {
    if (index && compare(bid, catalog[index - 1]) !== 0) strength = index / (catalog.length - 1);
    return { bid: Object.freeze(bid), strength };
  });

  function sample(candidates, weightName, total, random) {
    let draw = random() * total;
    for (const candidate of candidates) {
      draw -= candidate[weightName];
      if (draw < 0) return candidate;
    }
    return candidates.findLast(candidate => candidate[weightName] > 0);
  }

  function decide({ hand, otherCardsDealt, latestBid = null, family = latestBid?.family }, random = Math.random) {
    const probability = odds.oddsForDeal(hand, otherCardsDealt);
    const candidates = [];
    let legalCount = 0;
    let raiseTotal = 0;
    let bluffTotal = 0;
    for (const { bid, strength } of ranked) {
      if (family && bid.family !== family) continue;
      if (latestBid && compare(bid, latestBid) <= 0) continue;
      legalCount++;
      const support = probability(bid);
      if (!support) continue;
      const strengthFactor = .4 + 2 * strength;
      const raiseWeight = support ** 3 * strengthFactor;
      const bluffWeight = support >= bluffFloor && support <= bluffCeiling
        ? support * (1 - support) * strengthFactor : 0;
      candidates.push({ bid, support, strength, raiseWeight, bluffWeight });
      raiseTotal += raiseWeight;
      bluffTotal += bluffWeight;
    }

    const currentSupport = latestBid ? probability(latestBid) : null;
    const callChance = !latestBid ? 0
      : !candidates.length || currentSupport === 0 ? 1
      : .85 * Math.max(0, 1 - currentSupport / challengeThreshold);
    const bluffChance = bluffTotal ? bluffRate : 0;

    for (const candidate of candidates) {
      const ordinaryShare = (1 - bluffChance) * candidate.raiseWeight / raiseTotal;
      const bluffShare = bluffTotal ? bluffChance * candidate.bluffWeight / bluffTotal : 0;
      candidate.selectionChance = (1 - callChance) * (ordinaryShare + bluffShare);
    }

    let action;
    let mode;
    if (callChance === 1 || (callChance > 0 && random() < callChance)) {
      action = { type: "challenge" };
      mode = "challenge";
    } else {
      const bluffing = bluffChance > 0 && random() < bluffChance;
      const picked = sample(candidates, bluffing ? "bluffWeight" : "raiseWeight",
        bluffing ? bluffTotal : raiseTotal, random);
      action = { type: "declare", bid: picked.bid };
      mode = bluffing ? "bluff" : "raise";
    }

    return { action, mode, currentSupport, callChance, bluffChance, legalCount, candidates };
  }

  return { decide, bluffFloor, bluffCeiling, challengeThreshold };
});
