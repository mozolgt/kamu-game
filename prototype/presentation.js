"use strict";

globalThis.BluffmasterPresentation = (() => {
  const { normalize } = BluffmasterEngine.combinations;
  const ranks = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const symbols = { Spades: "♠", Hearts: "♥", Clubs: "♣", Diamonds: "♦" };
  const bidErrors = {
    ROUND_CLOSED: "Finish reviewing this round.",
    INVALID_DECLARATION: "Choose a valid combination.",
    FAMILY_LOCKED: "Choose a declaration from the round’s locked family.",
    DECLARATION_TOO_WEAK: "Choose a declaration stronger than the current one.",
  };

  function label(bid) {
    const { family, length, rank, suit, secondLength, secondRank } = normalize(bid);
    if (family === "Set") return `Set ${length} · ${ranks[rank]}`;
    if (family === "Double Set") return `Double Set · ${length} × ${ranks[rank]} & ${secondLength} × ${ranks[secondRank]}`;
    if (family === "Flush") return `${length}-Flush of ${suit}`;
    const suffix = family === "Straight Flush" ? ` · ${suit}` : "";
    return `${length}-${family} from ${ranks[rank]}${rank === 1 ? " (low)" : ""}${suffix}`;
  }

  function eventText(event) {
    switch (event.type) {
      case "deal":
        return `Dealt ${event.count} cards. Player ${event.starter + 1} starts.`;
      case "declaration":
        return `Player ${event.player + 1} declared ${label(event.bid)}.`;
      case "challenge": {
        const penalty = event.eliminated ? "is eliminated" : `goes to ${event.nextHandSize} cards`;
        return `Player ${event.challenger + 1} challenged. ${event.present ? "Present" : "Absent"} in the pool. Player ${event.loser + 1} ${penalty}.`;
      }
      case "winner":
        return `Player ${event.player + 1} wins the match.`;
      case "nextStarter":
        return `Player ${event.player + 1} starts next round.`;
      default:
        return "";
    }
  }

  return { ranks, symbols, label, bidErrors, eventText };
})();
