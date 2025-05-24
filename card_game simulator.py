# card_game_simulator.py

import random
import csv
from collections import Counter, defaultdict
from typing import List, Tuple, Literal

RANK_ORDER = {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
              '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14}

RANK_DISPLAY = {'10': 'T', **{r: r for r in RANK_ORDER if r != '10'}}

SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades']

class Card:
    def __init__(self, rank: str, suit: str):
        assert rank in RANK_ORDER, f"Invalid rank: {rank}"
        assert suit in SUITS, f"Invalid suit: {suit}"
        self.rank = rank
        self.suit = suit
        self.value = RANK_ORDER[rank]

    def __repr__(self):
        rank_display = RANK_DISPLAY[self.rank]
        return f"{rank_display}{self.suit[0]}"

class Combination:
    def __init__(self, cards: List[Card]):
        self.cards = cards
        self.rank_counts = Counter(card.rank for card in cards)
        self.suit_counts = Counter(card.suit for card in cards)
        self.sorted_values = sorted([card.value for card in cards], reverse=True)

    def get_matching_families(self):
        families = []

        for rank, count in self.rank_counts.items():
            for i in range(1, count + 1):
                families.append(("Set", i, rank))

        valid_ranks = [(r, c) for r, c in self.rank_counts.items() if c >= 1]
        for i in range(len(valid_ranks)):
            for j in range(i + 1, len(valid_ranks)):
                r1, c1 = valid_ranks[i]
                r2, c2 = valid_ranks[j]
                for x in range(1, c1 + 1):
                    for y in range(1, c2 + 1):
                        families.append(("Double Set", (x, y), (r1, r2)))

        value_set = set(self.sorted_values)
        if 14 in value_set:
            value_set.add(1)
        sorted_unique = sorted(value_set)
        for start in range(len(sorted_unique)):
            for length in range(1, len(sorted_unique) - start + 1):
                window = sorted_unique[start:start + length]
                if all(window[j] - window[j - 1] == 1 for j in range(1, len(window))):
                    if 14 in window and 1 in window:
                        continue
                    families.append(("Straight", length, window[0]))

        for suit in SUITS:
            suited_cards = [card for card in self.cards if card.suit == suit]
            if suited_cards:
                suited_values = sorted([card.value for card in suited_cards], reverse=True)
                for length in range(1, len(suited_values) + 1):
                    highest_card = max(suited_values[:length])
                    families.append(("Flush", length, highest_card, suit))

        suited_cards = {}
        for card in self.cards:
            suited_cards.setdefault(card.suit, []).append(card.value)
        for suit, values in suited_cards.items():
            vset = set(values)
            if 14 in vset:
                vset.add(1)
            values = sorted(vset)
            for start in range(len(values)):
                for length in range(1, len(values) - start + 1):
                    window = values[start:start + length]
                    if all(window[j] - window[j - 1] == 1 for j in range(1, len(window))):
                        if 14 in window and 1 in window:
                            continue
                        families.append(("Straight Flush", length, window[0], suit))

        return families

def initialize_deck() -> List[Card]:
    return [Card(rank, suit) for rank in RANK_ORDER for suit in SUITS]

def shuffle_deck(deck: List[Card]) -> None:
    random.shuffle(deck)

def deal_cards(deck: List[Card], number_of_cards: int) -> List[Card]:
    return [deck.pop() for _ in range(number_of_cards)]

def simulate_rounds(num_rounds: int) -> dict:
    results = defaultdict(int)
    for _ in range(num_rounds):
        for hand_size in range(1, 53):
            deck = initialize_deck()
            shuffle_deck(deck)
            if hand_size > len(deck):
                continue
            hand = deal_cards(deck, hand_size)
            combo = Combination(hand)
            families = combo.get_matching_families()
            for fam in families:
                results[(hand_size, tuple(fam))] += 1
    return results

def export_to_csv(data: dict, filename: str):
    with open(filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['Hand Size', 'Family', 'Details', 'Count'])
        for (hand_size, family), count in data.items():
            writer.writerow([hand_size, family[0], family[1:], count])

if __name__ == "__main__":
    stats = simulate_rounds(1000)
    export_to_csv(stats, "simulation_results.csv")
    print("Simulation results exported to 'simulation_results.csv'")
