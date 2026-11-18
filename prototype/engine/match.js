"use strict";

((factory) => {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./cards.js"), require("./combinations.js"));
  } else {
    const modules = (globalThis.BluffmasterEngine ??= {});
    modules.match = factory(modules.cards, modules.combinations);
  }
})((cards, combinations) => {
  const { deck, shuffle, standardCard } = cards;
  const { normalize, validBid, key, compare, buildLookup } = combinations;

  function deal(state, deckOrder) {
    const cards = [...deckOrder];
    state.hands = state.sizes.map(size => cards.splice(0, size));
    state.pool = state.hands.flat();
    state.lookup = buildLookup(state.pool);
    state.latest = null;
    state.family = null;
    state.result = null;
    state.phase = "turn";
    state.log.push({
      round: state.round,
      type: "deal", count: state.pool.length, starter: state.active,
    });
  }

  function handLimit(count) {
    if (!Number.isInteger(count) || count < 2 || count > 10) {
      throw new RangeError("Player count must be an integer between 2 and 10.");
    }
    return Math.floor(deck.length / count);
  }

  function start(count, seed, opening = {}) {
    const cap = handLimit(count);
    const sizes = opening.sizes ?? Array(count).fill(1);
    const deckOrder = opening.deckOrder ?? shuffle(seed, 1);
    if (sizes.length !== count || sizes.some(size => !Number.isInteger(size) || size < 1 || size > cap)) {
      throw new RangeError("Opening hand sizes must be within the hand limit for each seat.");
    }
    const dealSize = sizes.reduce((total, size) => total + size, 0);
    const cards = deckOrder.slice(0, dealSize).map(standardCard);
    if (cards.length !== dealSize || cards.includes(undefined) || new Set(cards).size !== dealSize) {
      throw new RangeError("An opening requires enough distinct standard cards to deal every hand.");
    }
    const state = { seed, cap, sizes: [...sizes], active: 0, round: 1, log: [] };
    deal(state, cards);
    return state;
  }

  function nextSeat(sizes, after) {
    let seat = (after + 1) % sizes.length;
    while (!sizes[seat]) seat = (seat + 1) % sizes.length;
    return seat;
  }

  function bidError(state, bid) {
    if (state.phase !== "turn") return "ROUND_CLOSED";
    if (!validBid(bid)) return "INVALID_DECLARATION";
    if (state.family && bid.family !== state.family) return "FAMILY_LOCKED";
    if (state.latest && compare(bid, state.latest.bid) <= 0) {
      return "DECLARATION_TOO_WEAK";
    }
    return null;
  }

  function declare(state, bid) {
    const error = bidError(state, bid);
    if (error) throw new Error(error);
    state.family ??= bid.family;
    state.latest = { player: state.active, bid: normalize(bid) };
    state.log.push({ round: state.round, type: "declaration", ...state.latest });
    state.active = nextSeat(state.sizes, state.active);
  }

  function canChallenge(state) {
    return state.phase === "turn" && state.latest !== null;
  }

  function challenge(state) {
    if (!canChallenge(state)) throw new Error("NO_DECLARATION_TO_CHALLENGE");
    const { player: declarer, bid } = state.latest;
    const challenger = state.active;
    const match = state.lookup.get(key(bid));
    const loser = match ? challenger : declarer;
    const eliminated = state.sizes[loser] === state.cap;
    const nextSizes = [...state.sizes];
    nextSizes[loser] = eliminated ? 0 : nextSizes[loser] + 1;
    const survivors = nextSizes.filter(Boolean).length;
    const starter = eliminated ? nextSeat(nextSizes, loser) : loser;
    state.result = { bid, declarer, challenger, match, loser, eliminated, nextSizes, starter };
    state.phase = survivors === 1 ? "over" : "review";
    state.log.push({
      round: state.round, type: "challenge", challenger, present: Boolean(match),
      loser, eliminated, nextHandSize: nextSizes[loser],
    });
    state.log.push({
      round: state.round, type: state.phase === "over" ? "winner" : "nextStarter", player: starter,
    });
  }

  function advance(state) {
    if (state.phase !== "review") throw new Error("NO_NEXT_ROUND");
    state.sizes = state.result.nextSizes;
    state.active = state.result.starter;
    state.round++;
    deal(state, shuffle(state.seed, state.round));
  }

  return { handLimit, start, bidError, declare, canChallenge, challenge, advance };
});
