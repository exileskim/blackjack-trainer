import type { Card } from '@/modules/domain/types.ts'
import { RANKS, SUITS, type Rank, type Suit } from '@/modules/domain/enums.ts'
import { getHiLoValue } from '@/modules/counting/hiLo.ts'
import { shuffle } from './shuffle.ts'

function createCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, countValue: getHiLoValue(rank) }
}

function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(rank, suit))
    }
  }
  return deck
}

export interface Shoe {
  drawCard(): Card
  cardsRemaining(): number
  totalCards(): number
  needsReshuffle(): boolean
  reshuffle(): void
  serialize(): ShoeState
}

export interface ShoeState {
  cards: Card[]
  deckCount: number
  penetration: number
}

export function createShoe(
  deckCount: number,
  penetration: number,
  rng: () => number = Math.random,
  initialCards?: Card[],
): Shoe {
  let cards: Card[] = initialCards ? [...initialCards] : []
  const total = deckCount * 52

  function buildAndShuffle() {
    cards = []
    for (let i = 0; i < deckCount; i++) {
      cards.push(...createDeck())
    }
    shuffle(cards, rng)
  }

  if (!initialCards) {
    buildAndShuffle()
  }

  const cutCardPosition = Math.floor(total * penetration)

  return {
    drawCard(): Card {
      if (cards.length === 0) {
        buildAndShuffle()
      }
      return cards.pop()!
    },

    cardsRemaining(): number {
      return cards.length
    },

    totalCards(): number {
      return total
    },

    needsReshuffle(): boolean {
      return total - cards.length >= cutCardPosition
    },

    reshuffle() {
      buildAndShuffle()
    },

    serialize(): ShoeState {
      return {
        cards: [...cards],
        deckCount,
        penetration,
      }
    },
  }
}

export function createShoeFromState(
  state: ShoeState,
  rng: () => number = Math.random,
): Shoe {
  return createShoe(state.deckCount, state.penetration, rng, state.cards)
}
