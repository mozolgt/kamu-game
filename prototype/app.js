"use strict";

(() => {
  const { cards, combinations, match: engine, odds, easyBot } = BluffmasterEngine;
  const { ranks, symbols, label, bidErrors, eventText } = BluffmasterPresentation;
  const byId = id => document.getElementById(id);
  const setup = byId("setup");
  const setupForm = byId("setup-form");
  const review = byId("review-controls");
  const inspector = byId("inspector-content");
  const reveal = byId("reveal");
  const search = byId("match-search");
  const oddsSearch = byId("odds-search");
  const oddsSeat = byId("odds-seat");
  const botDecision = byId("bot-decision");
  const botAutoplay = byId("bot-autoplay");
  const botStep = byId("bot-step");
  const oddsPageSize = 10;
  const viewButtons = [...document.querySelectorAll("[data-view]")];
  const scenarios = {
    standard: { label: "Standard opening", hint: "Everyone starts with one card." },
    flush: {
      label: "Six hearts",
      hint: "Four players hold 10 cards each. Exactly six hearts are in the pool.",
    },
    elimination: {
      label: "At the hand limit",
      hint: "Four players. Player 1 starts with 13 cards and is eliminated if they lose.",
    },
  };

  function debugOpening(scenario, seed) {
    if (scenario === "elimination") {
      return { sizes: [engine.handLimit(4), 1, 1, 1], deckOrder: cards.deck };
    }
    if (scenario === "flush") {
      const shuffled = cards.shuffle(seed, 1);
      return {
        sizes: [10, 10, 10, 10],
        deckOrder: [
          ...shuffled.filter(card => card.suit === "Hearts").slice(0, 6),
          ...shuffled.filter(card => card.suit !== "Hearts").slice(0, 34),
        ],
      };
    }
    return {};
  }

  function randomSeed() {
    return crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  }

  let scenario = "standard";
  let state = engine.start(4, randomSeed());
  let view = "pool";
  let selectedMatch = null;
  let oddsPage = 0;
  let oddsCatalog;
  let botSeats = new Set();
  let botRandom;
  let botTimer;
  let redealTimer;
  let autoRedeal = false;
  let botHistory = [];

  function isBotTurn() {
    return state.phase === "turn" && botSeats.has(state.active);
  }

  function queueBot() {
    clearTimeout(botTimer);
    if (!setup.open && botAutoplay.checked && isBotTurn()) {
      botTimer = setTimeout(runBotTurn, 2500);
    }
  }

  function queueRedeal() {
    clearTimeout(redealTimer);
    if (autoRedeal && state.phase === "review" && !setup.open) {
      redealTimer = setTimeout(nextRound, 5000);
    }
  }

  function focusTurnAction() {
    (isBotTurn() ? botStep : byId("declare")).focus({ preventScroll: true });
  }

  function runBotTurn(manual = false) {
    if (setup.open || !isBotTurn()) return;
    const seat = state.active;
    const hand = state.hands[seat];
    const otherCardsDealt = state.pool.length - hand.length;
    const latestBid = state.latest?.bid ?? null;
    const trace = easyBot.decide({ hand, otherCardsDealt, latestBid, family: state.family }, botRandom);
    const { action } = trace;
    if (action.type === "challenge") engine.challenge(state);
    else engine.declare(state, action.bid);
    botHistory.push({ seat, round: state.round, hand, otherCardsDealt, latestBid, ...trace });
    render();
    if (manual) {
      if (state.phase === "turn") focusTurnAction();
      else review.focus();
    }
  }

  const picker = createDeclarationPicker({
    lockedFamily: () => state.family,
    validate: bid => bidErrors[engine.bidError(state, bid)],
    submit(bid) {
      engine.declare(state, bid);
      picker.reset();
      render();
      focusTurnAction();
    },
    challenge: callBluff,
  });

  function cardFaces(cards, highlights = new Set(), owners) {
    return cards.map(card => {
      const { rank, suit } = card;
      const red = suit === "Hearts" || suit === "Diamonds";
      const name = `${rank ? ranks[rank] : "Any rank"} · ${suit ?? "Any suit"}`;
      const matched = highlights.has(card);
      const direction = owners?.get(card) ? " from-bottom" : "";
      return `<span class="card${red ? " red" : ""}${matched ? " proof" : ""}${direction}" role="img" aria-label="${name}${matched ? " · Matches declaration" : ""}">
        <span aria-hidden="true">${ranks[rank] ?? "✦"}</span>
        <span class="suit" aria-hidden="true">${symbols[suit] ?? "✦"}</span>
      </span>`;
    }).join("");
  }

  function renderHistory() {
    const declarations = state.log.filter(event => event.type === "declaration").reverse();
    byId("declaration-history").innerHTML = declarations.length ? `<ol class="declaration-list" tabindex="0" aria-label="Declarations, newest first">
      ${declarations.map(({ round, player, bid }) => {
        const example = combinations.requiredGroups(bid).flatMap(({ rank, suit, needed }) =>
          Array.from({ length: needed }, () => ({ rank, suit })));
        return `<li><div><small>Round ${round} · Player ${player + 1}</small><strong>${label(bid)}</strong></div>
          <div class="card-grid example-cards" aria-label="Example cards">${cardFaces(example)}</div></li>`;
      }).join("")}
    </ol>` : '<p class="empty">Declarations appear here during play.</p>';
  }

  function revealedPool() {
    const { bid, match } = state.result;
    const owners = new Map();
    state.hands.forEach((hand, seat) => {
      for (const card of hand) owners.set(card, seat >= Math.floor(state.hands.length / 2));
    });
    const highlights = new Set(match?.cards);
    const groups = combinations.requiredGroups(bid);
    const groupOf = card => groups.findIndex(group => group.includes(card));
    const compareCards = (a, b) => b.rank - a.rank || cards.suits.indexOf(a.suit) - cards.suits.indexOf(b.suit);
    const relevant = state.pool.filter(card => groupOf(card) !== -1)
      .sort((a, b) => groupOf(a) - groupOf(b) || Number(highlights.has(b)) - Number(highlights.has(a)) || compareCards(a, b));
    const other = state.pool.filter(card => groupOf(card) === -1).sort(compareCards);
    return `<div class="table-reveal">
      <h2>${state.phase === "over" ? `Player ${state.result.starter + 1} wins` : match ? "Declaration was true" : "Bluff caught"}</h2>
      <p>${label(bid)} · ${state.pool.length} cards revealed</p>
      ${relevant.length ? `<div class="reveal-group"><h3>${match ? "Highlighted cards prove the match" : "Cards relevant to the declaration"}</h3>
        <div class="card-grid revealed-cards">${cardFaces(relevant, highlights, owners)}</div></div>` : ""}
      ${other.length ? `<div class="reveal-group"><h3>${relevant.length ? "Other dealt cards" : "Dealt cards"}</h3>
        <div class="card-grid revealed-cards">${cardFaces(other, highlights, owners)}</div></div>` : ""}
    </div>`;
  }

  function renderTable() {
    byId("round-number").textContent = state.round;
    byId("pool-size").textContent = state.pool.length;
    byId("hand-limit").textContent = state.cap;
    byId("round-family").textContent = state.family ?? "Undecided";
    const seats = state.sizes.map((size, index) => {
      const eliminated = size === 0 || (state.result?.eliminated && state.result.loser === index);
      const active = state.phase === "turn" && state.active === index;
      const winner = state.phase === "over" && state.result.starter === index;
      const status = eliminated ? "Eliminated" : `${size} ${size === 1 ? "card" : "cards"}${active ? " · Turn" : ""}`;
      return `<div class="seat${active || winner ? " active" : ""}${eliminated ? " eliminated" : ""}">
        <strong>Player ${index + 1}</strong>${botSeats.has(index) ? '<small class="seat-bot">Easy bot</small>' : ""}<small>${winner ? "Winner" : status}</small>
      </div>`;
    });
    const topCount = Math.floor(seats.length / 2);
    byId("seats-top").innerHTML = seats.slice(0, topCount).join("");
    byId("seats-bottom").innerHTML = seats.slice(topCount).join("");
    const center = byId("table-center");
    const stamp = '<span class="suit-mark" aria-hidden="true">♠</span>';
    if (state.result) {
      center.innerHTML = revealedPool();
    } else if (state.latest) {
      center.innerHTML = `${stamp}<p>Player ${state.latest.player + 1} declared</p><h2>${label(state.latest.bid)}</h2>`;
    } else {
      center.innerHTML = `${stamp}<h2>Open the round</h2><p>Player ${state.active + 1} makes the first declaration.</p>`;
    }
  }

  function renderActions() {
    const isTurn = state.phase === "turn";
    const botTurn = isBotTurn();
    byId("turn-controls").hidden = !isTurn;
    byId("human-actions").hidden = botTurn;
    byId("bot-actions").hidden = !botTurn;
    review.hidden = isTurn;
    picker.setChallengeAvailable(engine.canChallenge(state));
    if (isTurn) {
      byId("turn-title").textContent = `Player ${state.active + 1}'s turn${botTurn ? " · Easy bot" : ""}`;
      byId("active-hand-label").textContent = botTurn ? "Bot hand" : "Your hand";
      byId("active-hand").innerHTML = !botTurn || reveal.checked
        ? cardFaces(state.hands[state.active])
        : '<p>Hidden hand</p>';
      return;
    }

    const { match, loser, nextSizes, eliminated, starter, bid, challenger } = state.result;
    const outcome = eliminated
      ? `Player ${loser + 1} is eliminated.`
      : `Player ${loser + 1} will receive ${nextSizes[loser]} cards next round.`;
    review.innerHTML = `<div class="result">
      <h2 class="result-title">${match ? "Declaration was true" : "Bluff caught"}</h2>
      <p>Player ${challenger + 1} challenged. ${label(bid)} was ${match ? "present in" : "absent from"} the ${state.pool.length} dealt cards.</p>
      <p>${outcome}</p>
      ${state.phase === "over"
        ? '<button class="button primary" type="button" data-action="new">New match</button>'
        : `<p class="result-caption">Player ${starter + 1} starts the next round.</p>
          <div class="review-actions">
            <button class="button primary" type="button" data-action="advance">Next round</button>
            <label><input id="auto-redeal" type="checkbox"${autoRedeal ? " checked" : ""}> Auto-deal after 5 seconds</label>
          </div>`}
    </div>`;
  }

  function renderHands() {
    inspector.innerHTML = state.hands.map((cards, index) => {
      if (!cards.length) return "";
      const visible = reveal.checked || state.phase !== "turn" || (index === state.active && !isBotTurn());
      return `<div class="hand-row">
        <header><strong>Player ${index + 1}</strong><small>${cards.length} ${cards.length === 1 ? "card" : "cards"}</small></header>
        ${visible ? `<div class="card-grid">${cardFaces(cards)}</div>` : '<p class="empty">Hidden hand</p>'}
      </div>`;
    }).join("");
  }

  function renderMatches() {
    const query = search.value.trim().toLowerCase();
    const matches = [...state.lookup.entries()]
      .map(([key, { bid, cards }]) => ({ key, bid, cards, label: label(bid) }))
      .filter(item => item.label.toLowerCase().includes(query))
      .sort((a, b) => combinations.compare(b.bid, a.bid) || a.label.localeCompare(b.label));
    const heading = document.createElement("p");
    heading.className = "match-count";
    heading.textContent = `${matches.length} matching ${matches.length === 1 ? "declaration" : "declarations"}`;
    const list = document.createElement("div");
    list.className = "match-list";
    const fragment = document.createDocumentFragment();
    for (const { key, label, cards } of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "match-option";
      button.dataset.match = key;
      const selected = selectedMatch === key;
      button.setAttribute("aria-pressed", selected);
      button.textContent = label;
      fragment.append(button);
      if (selected) {
        const evidence = document.createElement("div");
        evidence.className = "match-cards card-grid";
        evidence.innerHTML = cardFaces(cards);
        fragment.append(evidence);
      }
    }
    list.append(fragment);
    inspector.replaceChildren(heading, list);
  }

  const searchAliases = {
    one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7",
    eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13",
    jack: "j", queen: "q", king: "k", ace: "a",
  };

  function searchTerms(text) {
    return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
      .map(term => Object.hasOwn(searchAliases, term) ? searchAliases[term] : term);
  }

  const oddsFormat = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 4 });

  function formatOdds(p) {
    if (p > 0 && p < .000001) return `<${oddsFormat.format(.000001)}`;
    if (p < 1 && p > .999999) return `>${oddsFormat.format(.999999)}`;
    return oddsFormat.format(p);
  }

  function renderOdds() {
    oddsCatalog ??= combinations.declarationCatalog()
      .sort((a, b) => combinations.families.indexOf(a.family) - combinations.families.indexOf(b.family) || combinations.compare(a, b))
      .map(bid => ({ bid, label: label(bid), words: searchTerms(label(bid)) }));

    const selectedSeat = oddsSeat.value || "active";
    const canInspectSeats = reveal.checked || state.phase !== "turn";
    const seats = [new Option(`Active player (Player ${state.active + 1})`, "active")];
    if (canInspectSeats) {
      state.hands.forEach((cards, index) => {
        if (cards.length) seats.push(new Option(`Player ${index + 1}`, index));
      });
    }
    oddsSeat.replaceChildren(...seats);
    oddsSeat.value = seats.some(option => option.value === selectedSeat) ? selectedSeat : "active";
    oddsSeat.disabled = !canInspectSeats;
    const seat = oddsSeat.value === "active" ? state.active : Number(oddsSeat.value);
    const known = state.hands[seat];
    const unseenDealt = state.pool.length - known.length;
    byId("odds-context").textContent =
      `${known.length} in hand · ${unseenDealt} other cards dealt. Only this hand’s cards are used.`;

    const terms = searchTerms(oddsSearch.value);
    const matches = oddsCatalog.filter(({ words }) => terms.every(term => words.some(word =>
      /^\d/.test(term) || term.length === 1 ? word === term : word.startsWith(term))));
    const pages = Math.ceil(matches.length / oddsPageSize);
    oddsPage = Math.min(oddsPage, Math.max(pages - 1, 0));
    byId("odds-pagination").hidden = pages <= 1;
    byId("odds-prev").disabled = oddsPage === 0;
    byId("odds-next").disabled = oddsPage >= pages - 1;
    byId("odds-page").textContent = `${oddsPage + 1} / ${pages}`;

    if (!matches.length) {
      inspector.innerHTML = '<p class="empty">No matching combination.</p>';
      return;
    }
    const probability = odds.oddsForDeal(known, unseenDealt);
    const table = document.createElement("table");
    table.className = "odds-table";
    table.innerHTML = '<thead><tr><th scope="col">Combination</th><th scope="col">Chance</th></tr></thead><tbody></tbody>';
    const body = table.tBodies[0];
    for (const { bid, label } of matches.slice(oddsPage * oddsPageSize, (oddsPage + 1) * oddsPageSize)) {
      const row = body.insertRow();
      row.insertCell().textContent = label;
      row.insertCell().textContent = formatOdds(probability(bid));
    }
    inspector.replaceChildren(table);
  }

  function renderBotDecision() {
    const decisionIndex = botDecision.value || "latest";
    const options = botHistory.map(({ round, seat }, index) =>
      new Option(`#${index + 1} · Round ${round} · Player ${seat + 1}`, index)).reverse();
    botDecision.replaceChildren(new Option("Latest move", "latest"), ...options);
    botDecision.value = options.some(option => option.value === decisionIndex) ? decisionIndex : "latest";
    const trace = botDecision.value === "latest" ? botHistory.at(-1) : botHistory[Number(botDecision.value)];
    if (!trace) {
      const message = botSeats.size ? "Step a bot or let it play to inspect its first decision."
        : "Add Easy bots in New match to inspect their decisions.";
      inspector.innerHTML = `<p class="empty">${message}</p>`;
      return;
    }
    const { seat, round, hand, otherCardsDealt, latestBid, currentSupport, mode, action,
      callChance, bluffChance, legalCount, candidates } = trace;
    const move = action.type === "declare" ? label(action.bid) : "Call bluff";
    const reason = mode === "bluff" ? "Sampled a plausible bluff."
      : mode === "raise" ? "Sampled a raise weighted toward likely, stronger claims."
      : !candidates.length ? "No stronger declaration had a positive chance."
      : currentSupport === 0 ? "The current declaration was impossible from this hand."
      : "Called after weighing the chance that the current declaration was false.";
    inspector.innerHTML = `<div class="bot-decision-summary">
      <h3>Player ${seat + 1} · Round ${round}</h3>
      <p><strong>${move}</strong> · ${reason}</p>
      <div class="card-grid">${cardFaces(hand)}</div>
      <p>${hand.length} known · ${otherCardsDealt} other cards dealt</p>
      <p>${latestBid ? `Current bid: ${label(latestBid)} · ${formatOdds(currentSupport)} present.` : "Opening declaration."}</p>
      <p>Call chance ${formatOdds(callChance)} · Bluff chance if raising ${formatOdds(bluffChance)}.</p>
      <p>${candidates.length} possible raises · ${legalCount - candidates.length} zero-odds raises excluded.</p>
    </div>`;
    if (!candidates.length) return;

    const weights = document.createElement("table");
    weights.className = "odds-table bot-weights";
    weights.innerHTML = '<thead><tr><th scope="col">Raise</th><th scope="col">Present</th><th scope="col">Raise weight</th><th scope="col">Bluff weight</th><th scope="col">Pick</th></tr></thead><tbody></tbody>';
    const body = weights.tBodies[0];
    const ranked = [...candidates].sort((a, b) => Number(b.bid === action.bid) - Number(a.bid === action.bid)
      || b.selectionChance - a.selectionChance || b.raiseWeight - a.raiseWeight);
    for (const choice of ranked) {
      const row = body.insertRow();
      const selected = choice.bid === action.bid;
      row.classList.toggle("chosen", selected);
      for (const value of [label(choice.bid) + (selected ? " (chosen)" : ""), formatOdds(choice.support),
        choice.raiseWeight.toPrecision(3), choice.bluffWeight.toPrecision(3), formatOdds(choice.selectionChance)]) {
        row.insertCell().textContent = value;
      }
    }
    const scroll = document.createElement("div");
    scroll.className = "bot-weights-scroll";
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", "Bot decision weights");
    scroll.append(weights);
    inspector.append(scroll);
  }

  function renderInspector() {
    const visible = reveal.checked || state.phase !== "turn";
    const oddsVisible = view === "odds" && (visible || !isBotTurn());
    byId("match-search-wrap").hidden = view !== "matches" || !visible;
    byId("odds-controls").hidden = !oddsVisible;
    if (!oddsVisible) byId("odds-pagination").hidden = true;
    byId("bot-inspector-controls").hidden = view !== "bots" || !visible;
    byId("scenario-label").textContent = scenarios[scenario].label;
    byId("seed-label").textContent = state.seed;
    viewButtons.forEach(button => button.setAttribute("aria-pressed", button.dataset.view === view));
    if (view === "pool") {
      renderHands();
    } else if (view === "odds") {
      if (oddsVisible) renderOdds();
      else inspector.innerHTML = '<p class="empty">Enable all dealt cards to inspect odds during a bot turn.</p>';
    } else if (view === "bots") {
      if (visible) renderBotDecision();
      else inspector.innerHTML = '<p class="empty">Enable all dealt cards to inspect bot decisions during a turn.</p>';
    } else if (view === "log") {
      inspector.innerHTML = `<ol class="log-list">${[...state.log].reverse().map(event =>
        `<li><small>Round ${event.round}</small>${eventText(event)}</li>`
      ).join("")}</ol>`;
    } else if (visible) {
      renderMatches();
    } else {
      inspector.innerHTML = '<p class="empty">Enable all dealt cards to inspect matches during a turn.</p>';
    }
  }

  function render() {
    renderTable();
    renderActions();
    renderHistory();
    renderInspector();
    queueBot();
    queueRedeal();
  }

  function updateSetup(event) {
    const scenario = setupForm.elements.scenario.value;
    const { players, bots } = setupForm.elements;
    players.disabled = scenario !== "standard";
    if (players.disabled) players.value = 4;
    byId("scenario-hint").textContent = scenarios[scenario].hint;
    const count = players.valueAsNumber;
    const validCount = count >= 2 && count <= 10 && Number.isInteger(count);
    if (validCount) {
      bots.max = count;
      if (event && event.target !== bots && bots.valueAsNumber > count) bots.value = count;
    }
    const botCount = bots.valueAsNumber;
    const split = Number.isInteger(botCount) && botCount >= 0 && botCount <= count
      ? ` · ${count - botCount} human / ${botCount} bot` : "";
    byId("setup-cap").textContent = validCount ? `Hand limit ${engine.handLimit(count)}${split}` : "Choose between 2 and 10 players.";
  }

  function openSetup() {
    clearTimeout(botTimer);
    clearTimeout(redealTimer);
    setupForm.elements.scenario.value = scenario;
    setupForm.elements.players.value = state.sizes.length;
    setupForm.elements.bots.value = botSeats.size;
    setupForm.elements.seed.value = "";
    updateSetup();
    setup.showModal();
  }

  byId("open-setup").addEventListener("click", openSetup);
  byId("close-setup").addEventListener("click", () => setup.close());
  setup.addEventListener("close", () => {
    queueBot();
    queueRedeal();
  });
  setupForm.addEventListener("input", updateSetup);
  setupForm.addEventListener("submit", event => {
    event.preventDefault();
    const { players, bots, seed, scenario: scenarioField } = setupForm.elements;
    scenario = scenarioField.value;
    const dealSeed = seed.value.trim() || randomSeed();
    const count = players.valueAsNumber;
    const botCount = bots.valueAsNumber;
    state = engine.start(count, dealSeed, debugOpening(scenario, dealSeed));
    const seatOrder = cards.shuffleItems([...state.sizes.keys()], cards.seededRandom(dealSeed, "bot-seats"));
    botSeats = new Set(seatOrder.slice(0, botCount));
    botRandom = cards.seededRandom(dealSeed, "bot-actions");
    botHistory = [];
    botDecision.value = "latest";
    botAutoplay.checked = botCount > 0 && botCount < count;
    selectedMatch = null;
    view = botCount ? "bots" : "pool";
    search.value = "";
    oddsSearch.value = "";
    oddsSeat.value = "active";
    oddsPage = 0;
    inspector.scrollTop = 0;
    picker.reset();
    render();
    setup.close();
  });

  function callBluff() {
    engine.challenge(state);
    picker.reset();
    render();
    review.focus();
  }

  function nextRound() {
    if (setup.open || state.phase !== "review") return;
    engine.advance(state);
    selectedMatch = null;
    inspector.scrollTop = 0;
    render();
    focusTurnAction();
  }

  review.addEventListener("click", ({ target }) => {
    if (target.dataset.action === "new") openSetup();
    if (target.dataset.action === "advance") nextRound();
  });
  review.addEventListener("change", ({ target }) => {
    if (target.id !== "auto-redeal") return;
    autoRedeal = target.checked;
    queueRedeal();
  });

  viewButtons.forEach(button => button.addEventListener("click", () => {
    view = button.dataset.view;
    inspector.scrollTop = 0;
    renderInspector();
  }));

  search.addEventListener("input", () => {
    inspector.scrollTop = 0;
    renderMatches();
  });
  oddsSearch.addEventListener("input", () => {
    oddsPage = 0;
    inspector.scrollTop = 0;
    renderOdds();
  });
  oddsSeat.addEventListener("change", renderOdds);
  byId("odds-prev").addEventListener("click", () => {
    oddsPage--;
    inspector.scrollTop = 0;
    renderOdds();
  });
  byId("odds-next").addEventListener("click", () => {
    oddsPage++;
    inspector.scrollTop = 0;
    renderOdds();
  });
  reveal.addEventListener("change", () => {
    renderActions();
    renderInspector();
  });
  botDecision.addEventListener("change", () => {
    inspector.scrollTop = 0;
    renderBotDecision();
  });
  botAutoplay.addEventListener("change", queueBot);
  botStep.addEventListener("click", () => runBotTurn(true));
  inspector.addEventListener("click", ({ target }) => {
    if (!target.dataset.match) return;
    const buttons = [...inspector.querySelectorAll("[data-match]")];
    const index = buttons.indexOf(target);
    selectedMatch = selectedMatch === target.dataset.match ? null : target.dataset.match;
    renderMatches();
    inspector.querySelectorAll("[data-match]")[index].focus({ preventScroll: true });
  });

  if (window.matchMedia("(max-width: 730px)").matches) byId("inspector").open = false;
  render();
})();
