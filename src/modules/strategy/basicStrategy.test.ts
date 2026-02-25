import { describe, it, expect } from 'vitest'
import type { Card, RuleConfig } from '@/modules/domain/types.ts'
import type { Rank, Suit } from '@/modules/domain/enums.ts'
import { DEFAULT_RULES } from '@/modules/domain/types.ts'
import { getHiLoValue } from '@/modules/counting/hiLo.ts'
import { getBasicStrategyAction, isCorrectPlay, BASIC_STRATEGY_SOURCE } from './basicStrategy.ts'

function card(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit, countValue: getHiLoValue(rank) }
}

const H17_DAS: RuleConfig = { ...DEFAULT_RULES, surrenderAllowed: true }
const S17_DAS: RuleConfig = { ...DEFAULT_RULES, dealerHitsSoft17: false, surrenderAllowed: true }
const H17_NO_DAS: RuleConfig = { ...DEFAULT_RULES, doubleAfterSplit: false, surrenderAllowed: true }

describe('basicStrategy – hard totals', () => {
  it('hits hard 8 vs dealer 6', () => {
    expect(getBasicStrategyAction([card('5'), card('3')], card('6'), H17_DAS)).toBe('hit')
  })

  it('doubles hard 9 vs dealer 3', () => {
    expect(getBasicStrategyAction([card('4'), card('5')], card('3'), H17_DAS)).toBe('double')
  })

  it('hits hard 9 vs dealer 2 (no double)', () => {
    expect(getBasicStrategyAction([card('4'), card('5')], card('2'), H17_DAS)).toBe('hit')
  })

  it('doubles hard 10 vs dealer 9', () => {
    expect(getBasicStrategyAction([card('4'), card('6')], card('9'), H17_DAS)).toBe('double')
  })

  it('hits hard 10 vs dealer A', () => {
    expect(getBasicStrategyAction([card('4'), card('6')], card('A'), H17_DAS)).toBe('hit')
  })

  it('doubles hard 11 vs dealer A (H17)', () => {
    expect(getBasicStrategyAction([card('5'), card('6')], card('A'), H17_DAS)).toBe('double')
  })

  it('doubles hard 11 vs dealer A (S17)', () => {
    expect(getBasicStrategyAction([card('5'), card('6')], card('A'), S17_DAS)).toBe('double')
  })

  it('stands hard 12 vs dealer 4', () => {
    expect(getBasicStrategyAction([card('4'), card('8')], card('4'), H17_DAS)).toBe('stand')
  })

  it('hits hard 12 vs dealer 2', () => {
    expect(getBasicStrategyAction([card('4'), card('8')], card('2'), H17_DAS)).toBe('hit')
  })

  it('stands hard 13 vs dealer 2', () => {
    expect(getBasicStrategyAction([card('4'), card('9')], card('2'), H17_DAS)).toBe('stand')
  })

  it('hits hard 13 vs dealer 7', () => {
    expect(getBasicStrategyAction([card('4'), card('9')], card('7'), H17_DAS)).toBe('hit')
  })

  it('surrenders hard 16 vs dealer 10 (H17)', () => {
    expect(getBasicStrategyAction([card('10'), card('6')], card('10'), H17_DAS)).toBe('surrender')
  })

  it('hits hard 16 vs dealer 10 when surrender not allowed', () => {
    const noSurr = { ...H17_DAS, surrenderAllowed: false }
    expect(getBasicStrategyAction([card('10'), card('6')], card('10'), noSurr)).toBe('hit')
  })

  it('hits hard 15 vs dealer 10 (H17 baseline)', () => {
    expect(getBasicStrategyAction([card('10'), card('5')], card('10'), H17_DAS)).toBe('hit')
  })

  it('surrenders hard 17 vs dealer A (H17)', () => {
    expect(getBasicStrategyAction([card('10'), card('7')], card('A'), H17_DAS)).toBe('surrender')
  })

  it('hits hard 16 vs dealer 9 (H17 baseline)', () => {
    expect(getBasicStrategyAction([card('10'), card('6')], card('9'), H17_DAS)).toBe('hit')
  })

  it('stands hard 17 vs dealer A (S17)', () => {
    expect(getBasicStrategyAction([card('10'), card('7')], card('A'), S17_DAS)).toBe('stand')
  })

  it('hits hard 9 vs 3 with 3+ cards (no double)', () => {
    expect(getBasicStrategyAction([card('2'), card('3'), card('4')], card('3'), H17_DAS)).toBe('hit')
  })
})

describe('basicStrategy – source metadata', () => {
  it('pins strategy data to the BJA H17 chart source', () => {
    expect(BASIC_STRATEGY_SOURCE.id).toBe('bja-h17-2019')
    expect(BASIC_STRATEGY_SOURCE.sourceUrl).toContain('blackjackapprenticeship.com')
    expect(BASIC_STRATEGY_SOURCE.pdfMd5).toBe('de7471c5d1e232bf85e790b8a83ff9e9')
  })
})

describe('basicStrategy – soft totals', () => {
  it('hits soft 13 vs dealer 5 when can double', () => {
    // A,2 vs 5 → D → double
    expect(getBasicStrategyAction([card('A'), card('2')], card('5'), H17_DAS)).toBe('double')
  })

  it('hits soft 13 vs dealer 2', () => {
    expect(getBasicStrategyAction([card('A'), card('2')], card('2'), H17_DAS)).toBe('hit')
  })

  it('doubles soft 17 vs dealer 4', () => {
    expect(getBasicStrategyAction([card('A'), card('6')], card('4'), H17_DAS)).toBe('double')
  })

  it('hits soft 17 vs dealer 2', () => {
    expect(getBasicStrategyAction([card('A'), card('6')], card('2'), H17_DAS)).toBe('hit')
  })

  it('doubles soft 18 vs dealer 3 (Ds → double)', () => {
    expect(getBasicStrategyAction([card('A'), card('7')], card('3'), H17_DAS)).toBe('double')
  })

  it('stands soft 18 vs dealer 3 with 3+ cards (Ds → stand, no double)', () => {
    expect(getBasicStrategyAction([card('A'), card('3'), card('4')], card('3'), H17_DAS)).toBe('stand')
  })

  it('stands soft 18 vs dealer 7', () => {
    expect(getBasicStrategyAction([card('A'), card('7')], card('7'), H17_DAS)).toBe('stand')
  })

  it('hits soft 18 vs dealer 9', () => {
    expect(getBasicStrategyAction([card('A'), card('7')], card('9'), H17_DAS)).toBe('hit')
  })

  it('stands soft 19 vs dealer 6 (S17: stand instead of Ds)', () => {
    expect(getBasicStrategyAction([card('A'), card('8')], card('6'), S17_DAS)).toBe('stand')
  })

  it('doubles soft 19 vs dealer 6 (H17: Ds → double)', () => {
    expect(getBasicStrategyAction([card('A'), card('8')], card('6'), H17_DAS)).toBe('double')
  })

  it('stands soft 20 always', () => {
    expect(getBasicStrategyAction([card('A'), card('9')], card('6'), H17_DAS)).toBe('stand')
  })
})

describe('basicStrategy – pairs', () => {
  it('splits Aces vs anything', () => {
    expect(getBasicStrategyAction([card('A'), card('A')], card('6'), H17_DAS)).toBe('split')
    expect(getBasicStrategyAction([card('A'), card('A')], card('A'), H17_DAS)).toBe('split')
  })

  it('splits 8s vs dealer 2', () => {
    expect(getBasicStrategyAction([card('8'), card('8')], card('2'), H17_DAS)).toBe('split')
  })

  it('splits 8s vs dealer A (H17 chart)', () => {
    expect(getBasicStrategyAction([card('8'), card('8')], card('A'), H17_DAS)).toBe('split')
  })

  it('splits 8s vs dealer A when surrender not allowed', () => {
    const noSurr = { ...H17_DAS, surrenderAllowed: false }
    expect(getBasicStrategyAction([card('8'), card('8')], card('A'), noSurr)).toBe('split')
  })

  it('never splits 10s', () => {
    expect(getBasicStrategyAction([card('10'), card('10')], card('5'), H17_DAS)).toBe('stand')
    expect(getBasicStrategyAction([card('K'), card('Q')], card('6'), H17_DAS)).toBe('stand')
  })

  it('treats 5,5 as hard 10 (double vs 9)', () => {
    expect(getBasicStrategyAction([card('5'), card('5')], card('9'), H17_DAS)).toBe('double')
  })

  it('splits 2,2 vs 4 with DAS (Ph → split)', () => {
    expect(getBasicStrategyAction([card('2'), card('2')], card('4'), H17_DAS)).toBe('split')
  })

  it('splits 2,2 vs 2 with DAS (Ph → split)', () => {
    expect(getBasicStrategyAction([card('2'), card('2')], card('2'), H17_DAS)).toBe('split')
  })

  it('hits 2,2 vs 2 without DAS', () => {
    expect(getBasicStrategyAction([card('2'), card('2')], card('2'), H17_NO_DAS)).toBe('hit')
  })

  it('hits 4,4 vs 5 without DAS', () => {
    expect(getBasicStrategyAction([card('4'), card('4')], card('5'), H17_NO_DAS)).toBe('hit')
  })

  it('splits 9,9 vs 9', () => {
    expect(getBasicStrategyAction([card('9'), card('9')], card('9'), H17_DAS)).toBe('split')
  })

  it('stands 9,9 vs 7', () => {
    expect(getBasicStrategyAction([card('9'), card('9')], card('7'), H17_DAS)).toBe('stand')
  })
})

describe('basicStrategy – split hand constraints', () => {
  it('cannot double on split hand when DAS disabled', () => {
    // 5,6 on a split hand with no DAS → should hit instead of double vs dealer 5
    expect(getBasicStrategyAction([card('5'), card('6')], card('5'), H17_NO_DAS, true)).toBe('hit')
  })

  it('can double on split hand when DAS enabled', () => {
    expect(getBasicStrategyAction([card('5'), card('6')], card('5'), H17_DAS, true)).toBe('double')
  })

  it('cannot surrender on split hand', () => {
    expect(getBasicStrategyAction([card('10'), card('6')], card('10'), H17_DAS, true)).toBe('hit')
  })
})

describe('isCorrectPlay', () => {
  it('returns true for correct play', () => {
    expect(isCorrectPlay('stand', [card('10'), card('7')], card('6'), H17_DAS)).toBe(true)
  })

  it('returns false for incorrect play', () => {
    expect(isCorrectPlay('hit', [card('10'), card('7')], card('6'), H17_DAS)).toBe(false)
  })
})
