import { describe, it, expect } from 'vitest'
import { getHiLoValue, updateRunningCount, updateRunningCountSingle } from './hiLo.ts'
import type { Card } from '@/modules/domain/types.ts'
import type { Rank } from '@/modules/domain/enums.ts'

function card(rank: Rank): Card {
  return { rank, suit: 'S', countValue: getHiLoValue(rank) }
}

describe('getHiLoValue', () => {
  it.each([
    ['2', 1],
    ['3', 1],
    ['4', 1],
    ['5', 1],
    ['6', 1],
  ] as [Rank, number][])('low card %s = +1', (rank, expected) => {
    expect(getHiLoValue(rank)).toBe(expected)
  })

  it.each([
    ['7', 0],
    ['8', 0],
    ['9', 0],
  ] as [Rank, number][])('neutral card %s = 0', (rank, expected) => {
    expect(getHiLoValue(rank)).toBe(expected)
  })

  it.each([
    ['10', -1],
    ['J', -1],
    ['Q', -1],
    ['K', -1],
    ['A', -1],
  ] as [Rank, number][])('high card %s = -1', (rank, expected) => {
    expect(getHiLoValue(rank)).toBe(expected)
  })
})

describe('updateRunningCount', () => {
  it('updates from multiple cards', () => {
    const cards = [card('2'), card('K'), card('5'), card('A')]
    // +1 -1 +1 -1 = 0
    expect(updateRunningCount(0, cards)).toBe(0)
  })

  it('accumulates from a starting count', () => {
    const cards = [card('3'), card('4')] // +1 +1
    expect(updateRunningCount(5, cards)).toBe(7)
  })

  it('handles all low cards', () => {
    const cards = [card('2'), card('3'), card('4'), card('5'), card('6')]
    expect(updateRunningCount(0, cards)).toBe(5)
  })

  it('handles all high cards', () => {
    const cards = [card('10'), card('J'), card('Q'), card('K'), card('A')]
    expect(updateRunningCount(0, cards)).toBe(-5)
  })

  it('handles empty card array', () => {
    expect(updateRunningCount(3, [])).toBe(3)
  })
})

describe('updateRunningCountSingle', () => {
  it('adds single card value', () => {
    expect(updateRunningCountSingle(2, card('5'))).toBe(3)
    expect(updateRunningCountSingle(2, card('K'))).toBe(1)
    expect(updateRunningCountSingle(2, card('8'))).toBe(2)
  })
})
