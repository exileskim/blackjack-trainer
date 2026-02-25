import type { Card } from '@/modules/domain/types.ts'
import { RANKS, SUITS, type Rank, type Suit } from '@/modules/domain/enums.ts'
import { getHiLoValue } from '@/modules/counting/hiLo.ts'
import { shuffle } from '@/modules/blackjack/shuffle.ts'

function createCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, countValue: getHiLoValue(rank) }
}

export interface DeckCountdownState {
  cards: Card[]
  currentIndex: number
  startTime: number
  isComplete: boolean
}

export interface DeckCountdownResult {
  totalCards: number
  elapsedMs: number
  userCount: number
  correctCount: number
  isCorrect: boolean
}

/**
 * Create a shuffled single deck for countdown drill.
 * The correct final running count for a single balanced deck is always 0.
 */
export function createDeckCountdown(rng: () => number = Math.random): DeckCountdownState {
  const cards: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push(createCard(rank, suit))
    }
  }
  shuffle(cards, rng)

  return {
    cards,
    currentIndex: 0,
    startTime: Date.now(),
    isComplete: false,
  }
}

/** Advance to the next card. Returns updated state. */
export function advanceCard(state: DeckCountdownState): DeckCountdownState {
  if (state.isComplete || state.currentIndex >= state.cards.length - 1) {
    return { ...state, isComplete: true }
  }
  const nextIndex = state.currentIndex + 1
  return {
    ...state,
    currentIndex: nextIndex,
    isComplete: nextIndex >= state.cards.length - 1,
  }
}

/** Evaluate the user's final count. */
export function evaluateCountdown(
  state: DeckCountdownState,
  userCount: number,
): DeckCountdownResult {
  // A single balanced deck always sums to 0
  const correctCount = 0
  return {
    totalCards: state.cards.length,
    elapsedMs: Date.now() - state.startTime,
    userCount,
    correctCount,
    isCorrect: userCount === correctCount,
  }
}
