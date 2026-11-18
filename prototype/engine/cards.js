"use strict";

((factory) => {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    const modules = (globalThis.BluffmasterEngine ??= {});
    modules.cards = factory();
  }
})(() => {
  const suits = Object.freeze(["Spades", "Hearts", "Clubs", "Diamonds"]);
  const ranks = Object.freeze(Array.from({ length: 13 }, (_, index) => index + 2));
  const deck = Object.freeze(ranks.flatMap(rank => suits.map(suit => Object.freeze({ rank, suit }))));
  const cardId = card => Number.isInteger(card?.rank) && typeof card.suit === "string"
    ? `${card.rank}:${card.suit}`
    : null;
  const cardsById = new Map(deck.map(card => [cardId(card), card]));

  function seededRandom(seed, stream) {
    let hash = 2166136261;
    for (const character of `${seed}:${stream}`) {
      hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
    }
    return () => {
      hash = (Math.imul(1664525, hash) + 1013904223) >>> 0;
      return hash / 4294967296;
    };
  }

  function shuffleItems(items, random) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    return shuffled;
  }

  function shuffle(seed, round) {
    return shuffleItems(deck, seededRandom(seed, round));
  }

  const standardCard = card => cardsById.get(cardId(card));
  return { suits, ranks, deck, shuffle, standardCard, seededRandom, shuffleItems };
});
