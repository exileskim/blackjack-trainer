import { describe, it, expect } from 'vitest'
import { computeTrueCount, estimateDecksRemaining } from './trueCount.ts'

describe('computeTrueCount', () => {
  it('divides running count by decks remaining', () => {
    expect(computeTrueCount(10, 5)).toBe(2)
  })

  it('truncates toward zero for positive', () => {
    expect(computeTrueCount(7, 3)).toBe(2) // 7/3 = 2.33 -> 2
  })

  it('truncates toward zero for negative', () => {
    expect(computeTrueCount(-7, 3)).toBe(-2) // -7/3 = -2.33 -> -2
  })

  it('handles zero running count', () => {
    expect(computeTrueCount(0, 4)).toBe(0)
  })

  it('returns running count when decks remaining is 0', () => {
    expect(computeTrueCount(5, 0)).toBe(5)
  })

  it('returns running count when decks remaining is negative', () => {
    expect(computeTrueCount(5, -1)).toBe(5)
  })
})

describe('estimateDecksRemaining', () => {
  it('converts cards to decks', () => {
    expect(estimateDecksRemaining(312)).toBe(6) // 6 decks
    expect(estimateDecksRemaining(52)).toBe(1)
    expect(estimateDecksRemaining(26)).toBe(0.5)
  })
})
