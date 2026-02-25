import { describe, it, expect } from 'vitest'
import type { Card, RuleConfig } from '@/modules/domain/types.ts'
import type { Rank, Suit } from '@/modules/domain/enums.ts'
import { DEFAULT_RULES } from '@/modules/domain/types.ts'
import { getHiLoValue } from '@/modules/counting/hiLo.ts'
import { findApplicableDeviation, getDeviationAction, ALL_DEVIATIONS, DEVIATION_SOURCE } from './deviations.ts'

function card(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit, countValue: getHiLoValue(rank) }
}

const H17_RULES: RuleConfig = { ...DEFAULT_RULES, surrenderAllowed: true }
const H17_NO_SURRENDER: RuleConfig = { ...DEFAULT_RULES, surrenderAllowed: false }
const S17_RULES: RuleConfig = { ...DEFAULT_RULES, dealerHitsSoft17: false, surrenderAllowed: true }

describe('deviations – source and rules gating', () => {
  it('pins deviation data to the BJA H17 chart source', () => {
    expect(DEVIATION_SOURCE.id).toBe('bja-h17-2019')
    expect(DEVIATION_SOURCE.sourceUrl).toContain('blackjackapprenticeship.com')
  })

  it('does not apply H17 chart indices when rules are S17', () => {
    const dev = findApplicableDeviation([card('4'), card('6')], card('A'), 5, S17_RULES)
    expect(dev).toBeNull()
  })
})

describe('deviations – hard totals and surrender overlays', () => {
  it('10 vs A doubles at TC >= 3', () => {
    const dev = findApplicableDeviation([card('4'), card('6')], card('A'), 3, H17_RULES)
    expect(dev?.deviationAction).toBe('double')
  })

  it('10 vs A has no deviation at TC 2', () => {
    const dev = findApplicableDeviation([card('4'), card('6')], card('A'), 2, H17_RULES)
    expect(dev).toBeNull()
  })

  it('16 vs 9 surrenders at TC <= -1', () => {
    const dev = findApplicableDeviation([card('10'), card('6')], card('9'), -1, H17_RULES)
    expect(dev?.deviationAction).toBe('surrender')
  })

  it('16 vs 9 stands at TC >= 4', () => {
    const dev = findApplicableDeviation([card('10'), card('6')], card('9'), 4, H17_RULES)
    expect(dev?.deviationAction).toBe('stand')
  })

  it('16 vs 9 has no deviation near neutral counts', () => {
    const dev = findApplicableDeviation([card('10'), card('6')], card('9'), 0, H17_RULES)
    expect(dev).toBeNull()
  })

  it('15 vs 10 surrenders at TC <= 0', () => {
    const dev = findApplicableDeviation([card('10'), card('5')], card('10'), 0, H17_RULES)
    expect(dev?.deviationAction).toBe('surrender')
  })

  it('15 vs 10 stands at TC >= 4', () => {
    const dev = findApplicableDeviation([card('10'), card('5')], card('10'), 4, H17_RULES)
    expect(dev?.deviationAction).toBe('stand')
  })

  it('15 vs 10 has no deviation at TC 1', () => {
    const dev = findApplicableDeviation([card('10'), card('5')], card('10'), 1, H17_RULES)
    expect(dev).toBeNull()
  })

  it('15 vs A surrenders at TC >= -1 when surrender is available', () => {
    const devLow = findApplicableDeviation([card('10'), card('5')], card('A'), -1, H17_RULES)
    const devHigh = findApplicableDeviation([card('10'), card('5')], card('A'), 5, H17_RULES)
    expect(devLow?.deviationAction).toBe('surrender')
    expect(devHigh?.deviationAction).toBe('surrender')
  })

  it('15 vs A stands at TC >= 5 when surrender is not available', () => {
    const dev = findApplicableDeviation([card('10'), card('5')], card('A'), 5, H17_NO_SURRENDER)
    expect(dev?.deviationAction).toBe('stand')
  })

  it('16 vs 10 uses basic-table surrender when surrender is available (no stand deviation applied)', () => {
    const dev = findApplicableDeviation([card('10'), card('6')], card('10'), 5, H17_RULES)
    expect(dev).toBeNull()
  })

  it('16 vs 10 stands at TC >= 0 when surrender is not available', () => {
    const dev = findApplicableDeviation([card('10'), card('6')], card('10'), 0, H17_NO_SURRENDER)
    expect(dev?.deviationAction).toBe('stand')
  })

  it('12 vs 4 hits at TC <= 0', () => {
    const dev = findApplicableDeviation([card('4'), card('8')], card('4'), 0, H17_RULES)
    expect(dev?.deviationAction).toBe('hit')
  })

  it('12 vs 4 has no deviation at TC +1', () => {
    const dev = findApplicableDeviation([card('4'), card('8')], card('4'), 1, H17_RULES)
    expect(dev).toBeNull()
  })

  it('8 vs 6 doubles at TC >= 2', () => {
    const dev = findApplicableDeviation([card('5'), card('3')], card('6'), 2, H17_RULES)
    expect(dev?.deviationAction).toBe('double')
  })
})

describe('deviations – soft totals and pairs', () => {
  it('A,8 vs 4 doubles at TC >= 3', () => {
    const dev = findApplicableDeviation([card('A'), card('8')], card('4'), 3, H17_RULES)
    expect(dev?.deviationAction).toBe('double')
  })

  it('A,8 vs 6 stands at TC <= 0', () => {
    const dev = findApplicableDeviation([card('A'), card('8')], card('6'), 0, H17_RULES)
    expect(dev?.deviationAction).toBe('stand')
  })

  it('A,8 vs 6 has no deviation at TC +1', () => {
    const dev = findApplicableDeviation([card('A'), card('8')], card('6'), 1, H17_RULES)
    expect(dev).toBeNull()
  })

  it('A,6 vs 2 doubles at TC >= 1', () => {
    const dev = findApplicableDeviation([card('A'), card('6')], card('2'), 1, H17_RULES)
    expect(dev?.deviationAction).toBe('double')
  })

  it('10,10 vs 4 splits at TC >= 6', () => {
    const dev = findApplicableDeviation([card('10'), card('10')], card('4'), 6, H17_RULES)
    expect(dev?.deviationAction).toBe('split')
  })

  it('10,10 vs 6 splits at TC >= 4', () => {
    const dev = findApplicableDeviation([card('10'), card('10')], card('6'), 4, H17_RULES)
    expect(dev?.deviationAction).toBe('split')
  })

  it('10,10 vs 6 has no deviation at TC 3', () => {
    const dev = findApplicableDeviation([card('10'), card('10')], card('6'), 3, H17_RULES)
    expect(dev).toBeNull()
  })
})

describe('deviations – integration and integrity', () => {
  it('getDeviationAction returns action+deviation tuple', () => {
    const result = getDeviationAction([card('10'), card('6')], card('9'), 4, H17_RULES)
    expect(result).not.toBeNull()
    expect(result!.action).toBe('stand')
  })

  it('getDeviationAction returns null when no deviation applies', () => {
    const result = getDeviationAction([card('10'), card('8')], card('7'), 0, H17_RULES)
    expect(result).toBeNull()
  })

  it('has all four Fab 4 surrender entries', () => {
    expect(ALL_DEVIATIONS.filter((d) => d.group === 'Fab4').length).toBe(4)
  })

  it('all deviations have valid actions and threshold directions', () => {
    const validActions = ['hit', 'stand', 'double', 'split', 'surrender']
    const validComparisons = ['gte', 'lte']
    for (const dev of ALL_DEVIATIONS) {
      expect(validActions).toContain(dev.basicAction)
      expect(validActions).toContain(dev.deviationAction)
      expect(validComparisons).toContain(dev.comparison)
      expect(dev.basicAction).not.toBe(dev.deviationAction)
    }
  })
})

