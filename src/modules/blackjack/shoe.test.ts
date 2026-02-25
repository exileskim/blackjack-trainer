import { describe, it, expect } from 'vitest'
import { createShoe } from './shoe.ts'
import { createSeededRng } from './shuffle.ts'

describe('createShoe', () => {
  it('creates correct card count for 1 deck', () => {
    const shoe = createShoe(1, 0.75)
    expect(shoe.totalCards()).toBe(52)
    expect(shoe.cardsRemaining()).toBe(52)
  })

  it('creates correct card count for 6 decks', () => {
    const shoe = createShoe(6, 0.75)
    expect(shoe.totalCards()).toBe(312)
    expect(shoe.cardsRemaining()).toBe(312)
  })

  it('creates correct card count for 8 decks', () => {
    const shoe = createShoe(8, 0.75)
    expect(shoe.totalCards()).toBe(416)
  })

  it('draws cards and decrements remaining', () => {
    const shoe = createShoe(1, 0.75)
    shoe.drawCard()
    expect(shoe.cardsRemaining()).toBe(51)
    shoe.drawCard()
    expect(shoe.cardsRemaining()).toBe(50)
  })

  it('drawn cards are valid', () => {
    const shoe = createShoe(1, 0.75, createSeededRng(42))
    const card = shoe.drawCard()
    expect(card).toHaveProperty('rank')
    expect(card).toHaveProperty('suit')
    expect(card).toHaveProperty('countValue')
    expect([-1, 0, 1]).toContain(card.countValue)
  })

  it('has correct cardinality for all ranks/suits in 1 deck', () => {
    const rng = createSeededRng(123)
    const shoe = createShoe(1, 1.0, rng) // penetration 100% to draw all
    const cards = []
    for (let i = 0; i < 52; i++) {
      cards.push(shoe.drawCard())
    }
    // Should have 4 of each rank
    const rankCounts = new Map<string, number>()
    for (const c of cards) {
      rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1)
    }
    for (const [, count] of rankCounts) {
      expect(count).toBe(4)
    }
    // Should have 13 of each suit
    const suitCounts = new Map<string, number>()
    for (const c of cards) {
      suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1)
    }
    for (const [, count] of suitCounts) {
      expect(count).toBe(13)
    }
  })

  it('triggers reshuffle at penetration threshold', () => {
    const shoe = createShoe(1, 0.5) // 50% penetration = 26 cards
    expect(shoe.needsReshuffle()).toBe(false)
    for (let i = 0; i < 26; i++) {
      shoe.drawCard()
    }
    expect(shoe.needsReshuffle()).toBe(true)
  })

  it('reshuffle refills the shoe', () => {
    const shoe = createShoe(1, 0.75)
    for (let i = 0; i < 30; i++) shoe.drawCard()
    shoe.reshuffle()
    expect(shoe.cardsRemaining()).toBe(52)
  })

  it('auto-reshuffles when empty', () => {
    const shoe = createShoe(1, 1.0)
    for (let i = 0; i < 52; i++) shoe.drawCard()
    expect(shoe.cardsRemaining()).toBe(0)
    const card = shoe.drawCard() // should auto-reshuffle
    expect(card).toBeDefined()
    expect(shoe.cardsRemaining()).toBe(51)
  })

  it('produces deterministic results with seeded RNG', () => {
    const shoe1 = createShoe(1, 0.75, createSeededRng(42))
    const shoe2 = createShoe(1, 0.75, createSeededRng(42))
    for (let i = 0; i < 10; i++) {
      const c1 = shoe1.drawCard()
      const c2 = shoe2.drawCard()
      expect(c1.rank).toBe(c2.rank)
      expect(c1.suit).toBe(c2.suit)
    }
  })
})
