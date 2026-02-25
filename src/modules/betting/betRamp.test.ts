import { describe, it, expect } from 'vitest'
import {
  getRecommendedBet,
  computePayout,
  createBetRampState,
  recordBetResult,
  computeBetRampStats,
  SPREAD_CONSERVATIVE,
  SPREAD_MODERATE,
  SPREAD_AGGRESSIVE,
  type BetRampConfig,
} from './betRamp.ts'

const DEFAULT_CONFIG: BetRampConfig = {
  name: 'Test Spread',
  spread: SPREAD_CONSERVATIVE,
  startingBankroll: 5000,
  unitSize: 25,
}

describe('getRecommendedBet', () => {
  it('returns minimum bet for negative true counts', () => {
    expect(getRecommendedBet(-3, SPREAD_CONSERVATIVE)).toBe(1)
    expect(getRecommendedBet(-10, SPREAD_MODERATE)).toBe(1)
  })

  it('returns correct tier for TC 0', () => {
    expect(getRecommendedBet(0, SPREAD_CONSERVATIVE)).toBe(1)
    expect(getRecommendedBet(0, SPREAD_AGGRESSIVE)).toBe(1)
  })

  it('scales bet with positive true count', () => {
    expect(getRecommendedBet(1, SPREAD_CONSERVATIVE)).toBe(2)
    expect(getRecommendedBet(2, SPREAD_CONSERVATIVE)).toBe(3)
    expect(getRecommendedBet(3, SPREAD_CONSERVATIVE)).toBe(4)
    expect(getRecommendedBet(4, SPREAD_CONSERVATIVE)).toBe(5)
  })

  it('caps at max tier for very high counts', () => {
    expect(getRecommendedBet(10, SPREAD_CONSERVATIVE)).toBe(5)
    expect(getRecommendedBet(10, SPREAD_MODERATE)).toBe(10)
    expect(getRecommendedBet(10, SPREAD_AGGRESSIVE)).toBe(16)
  })

  it('moderate spread scales faster than conservative', () => {
    expect(getRecommendedBet(2, SPREAD_MODERATE)).toBe(6)
    expect(getRecommendedBet(2, SPREAD_CONSERVATIVE)).toBe(3)
  })

  it('aggressive spread has widest range', () => {
    expect(getRecommendedBet(3, SPREAD_AGGRESSIVE)).toBe(12)
    expect(getRecommendedBet(3, SPREAD_MODERATE)).toBe(8)
  })

  it('returns 1 for empty spread', () => {
    expect(getRecommendedBet(5, [])).toBe(1)
  })
})

describe('computePayout', () => {
  it('win pays 1:1', () => {
    expect(computePayout(5, 'win')).toBe(5)
    expect(computePayout(1, 'win')).toBe(1)
  })

  it('loss pays -1:1', () => {
    expect(computePayout(5, 'loss')).toBe(-5)
  })

  it('push pays 0', () => {
    expect(computePayout(10, 'push')).toBe(0)
  })

  it('blackjack pays 3:2', () => {
    expect(computePayout(4, 'blackjack')).toBe(6)
    expect(computePayout(2, 'blackjack')).toBe(3)
  })

  it('surrender pays -0.5', () => {
    expect(computePayout(4, 'surrender')).toBe(-2)
    expect(computePayout(1, 'surrender')).toBe(-0.5)
  })
})

describe('createBetRampState', () => {
  it('initializes with correct starting values', () => {
    const state = createBetRampState(DEFAULT_CONFIG)
    expect(state.config).toBe(DEFAULT_CONFIG)
    expect(state.currentBankroll).toBe(5000)
    expect(state.handsPlayed).toBe(0)
    expect(state.totalWagered).toBe(0)
    expect(state.netResult).toBe(0)
    expect(state.betHistory).toEqual([])
    expect(state.peakBankroll).toBe(5000)
    expect(state.troughBankroll).toBe(5000)
  })
})

describe('recordBetResult', () => {
  it('tracks a winning hand', () => {
    const state = createBetRampState(DEFAULT_CONFIG)
    const next = recordBetResult(state, 1, 2, 3, 'win')

    expect(next.handsPlayed).toBe(1)
    expect(next.currentBankroll).toBe(5000 + 3 * 25)
    expect(next.totalWagered).toBe(3 * 25)
    expect(next.netResult).toBe(3 * 25)
    expect(next.peakBankroll).toBe(5000 + 75)
    expect(next.betHistory).toHaveLength(1)
    expect(next.betHistory[0]!.payout).toBe(3)
  })

  it('tracks a losing hand and updates trough', () => {
    const state = createBetRampState(DEFAULT_CONFIG)
    const next = recordBetResult(state, 1, -1, 1, 'loss')

    expect(next.currentBankroll).toBe(5000 - 25)
    expect(next.netResult).toBe(-25)
    expect(next.troughBankroll).toBe(5000 - 25)
    expect(next.peakBankroll).toBe(5000)
  })

  it('tracks multiple hands correctly', () => {
    let state = createBetRampState(DEFAULT_CONFIG)
    state = recordBetResult(state, 1, 2, 3, 'win')      // +75
    state = recordBetResult(state, 2, 3, 4, 'blackjack') // +150
    state = recordBetResult(state, 3, -1, 1, 'loss')     // -25

    expect(state.handsPlayed).toBe(3)
    expect(state.currentBankroll).toBe(5000 + 75 + 150 - 25)
    expect(state.netResult).toBe(200)
    expect(state.peakBankroll).toBe(5000 + 75 + 150)
    expect(state.troughBankroll).toBe(5000)
    expect(state.betHistory).toHaveLength(3)
  })

  it('handles push without changing bankroll', () => {
    const state = createBetRampState(DEFAULT_CONFIG)
    const next = recordBetResult(state, 1, 0, 5, 'push')

    expect(next.currentBankroll).toBe(5000)
    expect(next.netResult).toBe(0)
    expect(next.totalWagered).toBe(5 * 25)
  })

  it('handles surrender with half-bet loss', () => {
    const state = createBetRampState(DEFAULT_CONFIG)
    const next = recordBetResult(state, 1, 0, 4, 'surrender')

    expect(next.currentBankroll).toBe(5000 - 2 * 25)
    expect(next.netResult).toBe(-50)
  })
})

describe('computeBetRampStats', () => {
  it('returns zeroes for empty state', () => {
    const state = createBetRampState(DEFAULT_CONFIG)
    const stats = computeBetRampStats(state)

    expect(stats.handsPlayed).toBe(0)
    expect(stats.avgBetSize).toBe(0)
    expect(stats.winRate).toBe(0)
    expect(stats.hourlyEv).toBe(0)
    expect(stats.standardDeviation).toBe(0)
    expect(stats.riskOfRuin).toBe(0)
  })

  it('computes correct stats after several hands', () => {
    let state = createBetRampState(DEFAULT_CONFIG)
    state = recordBetResult(state, 1, 2, 3, 'win')
    state = recordBetResult(state, 2, 0, 1, 'loss')
    state = recordBetResult(state, 3, 3, 4, 'win')
    state = recordBetResult(state, 4, -1, 1, 'loss')

    const stats = computeBetRampStats(state)

    expect(stats.handsPlayed).toBe(4)
    expect(stats.avgBetSize).toBe((3 + 1 + 4 + 1) / 4)
    expect(stats.winRate).toBe(50) // 2 wins out of 4
    expect(stats.currentBankroll).toBe(state.currentBankroll)
    expect(stats.peakBankroll).toBe(state.peakBankroll)
    expect(stats.troughBankroll).toBe(state.troughBankroll)
    expect(stats.standardDeviation).toBeGreaterThan(0)
  })

  it('computes non-zero risk of ruin with losing edge', () => {
    let state = createBetRampState(DEFAULT_CONFIG)
    // Simulate losing streak to establish negative EV
    for (let i = 0; i < 10; i++) {
      state = recordBetResult(state, i + 1, 0, 1, 'loss')
    }
    for (let i = 0; i < 4; i++) {
      state = recordBetResult(state, 11 + i, 0, 1, 'win')
    }

    const stats = computeBetRampStats(state)
    expect(stats.riskOfRuin).toBeGreaterThan(0)
    expect(stats.riskOfRuin).toBeLessThanOrEqual(1)
  })
})
