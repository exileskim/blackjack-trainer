import { describe, it, expect } from 'vitest'
import type { Card, RuleConfig } from '@/modules/domain/types.ts'
import type { Rank, Suit } from '@/modules/domain/enums.ts'
import { DEFAULT_RULES } from '@/modules/domain/types.ts'
import { getHiLoValue } from '@/modules/counting/hiLo.ts'
import { findApplicableDeviation, getDeviationAction, ALL_DEVIATIONS, DEVIATION_SOURCE } from './deviations.ts'

function card(rank: Rank, suit: Suit = 'S'): Card {
  return { rank, suit, countValue: getHiLoValue(rank) }
}

const RULES: RuleConfig = { ...DEFAULT_RULES, surrenderAllowed: true }

describe('deviations – I18 plays', () => {
  it('16 vs 10: stand at TC >= 0', () => {
    const dev = findApplicableDeviation([card('10'), card('6')], card('10'), 0, RULES)
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('stand')
    expect(dev!.name).toBe('16 vs 10: Stand')
  })

  it('16 vs 10: no deviation at TC -1', () => {
    const dev = findApplicableDeviation([card('10'), card('6')], card('10'), -1, RULES)
    expect(dev).toBeNull()
  })

  it('15 vs 10: stand at TC >= 4', () => {
    const dev = findApplicableDeviation([card('10'), card('5')], card('10'), 4, RULES)
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('stand')
  })

  it('15 vs 10: no deviation at TC 3', () => {
    const dev = findApplicableDeviation([card('10'), card('5')], card('10'), 3, RULES)
    // TC 3 < threshold 4, but Fab4 15 vs 10 surrender has threshold 0
    // so it should find the surrender deviation instead
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('surrender')
  })

  it('12 vs 3: stand at TC >= 2', () => {
    const dev = findApplicableDeviation([card('4'), card('8')], card('3'), 2, RULES)
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('stand')
  })

  it('12 vs 3: no deviation at TC 1', () => {
    const dev = findApplicableDeviation([card('4'), card('8')], card('3'), 1, RULES)
    expect(dev).toBeNull()
  })

  it('13 vs 2: hit at TC <= -1', () => {
    const dev = findApplicableDeviation([card('4'), card('9')], card('2'), -1, RULES)
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('hit')
  })

  it('13 vs 2: no deviation at TC 0', () => {
    const dev = findApplicableDeviation([card('4'), card('9')], card('2'), 0, RULES)
    expect(dev).toBeNull()
  })

  it('12 vs 4: hit at TC 0 (threshold is 0 negative direction)', () => {
    const dev = findApplicableDeviation([card('4'), card('8')], card('4'), 0, RULES)
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('hit')
  })

  it('10 vs 10: double at TC >= 4', () => {
    const dev = findApplicableDeviation([card('4'), card('6')], card('10'), 4, RULES)
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('double')
  })

  it('10,10 pair vs 5: split at TC >= 5', () => {
    const dev = findApplicableDeviation([card('10'), card('10')], card('5'), 5, RULES)
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('split')
  })

  it('10,10 pair vs 5: no deviation at TC 4', () => {
    const dev = findApplicableDeviation([card('10'), card('10')], card('5'), 4, RULES)
    expect(dev).toBeNull()
  })
})

describe('deviations – Fab 4 surrenders', () => {
  it('14 vs 10: surrender at TC >= 3', () => {
    const dev = findApplicableDeviation([card('4'), card('10')], card('10'), 3, RULES)
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('surrender')
    expect(dev!.group).toBe('Fab4')
  })

  it('15 vs 9: surrender at TC >= 2', () => {
    const dev = findApplicableDeviation([card('5'), card('10')], card('9'), 2, RULES)
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('surrender')
  })

  it('15 vs A: surrender at TC >= 1', () => {
    const dev = findApplicableDeviation([card('5'), card('10')], card('A'), 1, RULES)
    expect(dev).not.toBeNull()
    expect(dev!.deviationAction).toBe('surrender')
  })

  it('14 vs 10: no surrender when surrender not allowed', () => {
    const noSurr = { ...RULES, surrenderAllowed: false }
    const dev = findApplicableDeviation([card('4'), card('10')], card('10'), 5, noSurr)
    // Should find the I18 10 vs 10 double deviation instead
    expect(dev?.deviationAction).not.toBe('surrender')
  })

  it('surrender not available on 3+ card hands', () => {
    const dev = findApplicableDeviation([card('2'), card('3'), card('10')], card('10'), 5, RULES)
    // 15 vs 10 but 3 cards — can't surrender
    // Should find the I18 stand deviation instead
    expect(dev?.deviationAction).not.toBe('surrender')
  })
})

describe('deviations – edge cases', () => {
  it('soft hands do not match hard deviations', () => {
    // A,5 = soft 16, should not match hard 16 vs 10 deviation
    const dev = findApplicableDeviation([card('A'), card('5')], card('10'), 5, RULES)
    expect(dev).toBeNull()
  })

  it('no deviation for unmatched hand', () => {
    // Hard 18 vs 7 — no deviation exists
    const dev = findApplicableDeviation([card('10'), card('8')], card('7'), 5, RULES)
    expect(dev).toBeNull()
  })

  it('getDeviationAction returns action+deviation tuple', () => {
    const result = getDeviationAction([card('10'), card('6')], card('10'), 1, RULES)
    expect(result).not.toBeNull()
    expect(result!.action).toBe('stand')
    expect(result!.deviation.group).toBe('I18')
  })

  it('getDeviationAction returns null when no deviation applies', () => {
    const result = getDeviationAction([card('10'), card('8')], card('7'), 0, RULES)
    expect(result).toBeNull()
  })
})

describe('deviations – data integrity', () => {
  it('pins deviation data to the BJA H17 chart source', () => {
    expect(DEVIATION_SOURCE.id).toBe('bja-h17-2019')
    expect(DEVIATION_SOURCE.sourceUrl).toContain('blackjackapprenticeship.com')
  })

  it('has 17 I18 plays (excluding insurance)', () => {
    expect(ALL_DEVIATIONS.filter((d) => d.group === 'I18').length).toBe(17)
  })

  it('has 4 Fab4 plays', () => {
    expect(ALL_DEVIATIONS.filter((d) => d.group === 'Fab4').length).toBe(4)
  })

  it('all deviations have valid actions', () => {
    const validActions = ['hit', 'stand', 'double', 'split', 'surrender']
    for (const dev of ALL_DEVIATIONS) {
      expect(validActions).toContain(dev.basicAction)
      expect(validActions).toContain(dev.deviationAction)
      expect(dev.basicAction).not.toBe(dev.deviationAction)
    }
  })
})
