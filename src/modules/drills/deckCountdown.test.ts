import { describe, it, expect } from 'vitest'
import {
  createDeckCountdown,
  advanceCard,
  evaluateCountdown,
} from './deckCountdown.ts'
import { createSeededRng } from '@/modules/blackjack/shuffle.ts'

describe('deckCountdown', () => {
  it('creates a 52-card deck', () => {
    const state = createDeckCountdown(() => 0.5)
    expect(state.cards).toHaveLength(52)
    expect(state.currentIndex).toBe(0)
    expect(state.isComplete).toBe(false)
  })

  it('advances through cards', () => {
    let state = createDeckCountdown(() => 0.5)
    state = advanceCard(state)
    expect(state.currentIndex).toBe(1)

    // Advance to the end
    for (let i = 2; i < 52; i++) {
      state = advanceCard(state)
    }
    expect(state.isComplete).toBe(true)
  })

  it('correct answer is always 0 for a single deck', () => {
    const rng = createSeededRng(42)
    const state = createDeckCountdown(rng)
    const result = evaluateCountdown(state, 0)
    expect(result.isCorrect).toBe(true)
    expect(result.correctCount).toBe(0)
  })

  it('reports incorrect when user count is wrong', () => {
    const state = createDeckCountdown(() => 0.5)
    const result = evaluateCountdown(state, 3)
    expect(result.isCorrect).toBe(false)
    expect(result.userCount).toBe(3)
  })

  it('all 52 cards are present (complete deck)', () => {
    const state = createDeckCountdown(() => 0.5)
    const counts = new Map<string, number>()
    for (const c of state.cards) {
      const key = `${c.rank}${c.suit}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    // 52 unique rank+suit combinations
    expect(counts.size).toBe(52)
    for (const v of counts.values()) {
      expect(v).toBe(1)
    }
  })
})
