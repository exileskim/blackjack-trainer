import { describe, it, expect } from 'vitest'
import {
  createAnalysisWorker,
  generateRequestId,
  computeAnalysis,
  type AnalysisParams,
  type AnalysisRequest,
} from './deepAnalysis.ts'

const BASE_PARAMS: AnalysisParams = {
  handsPlayed: 100,
  totalWagered: 500,
  netResult: -10,
  betHistory: [],
  decks: 6,
  dealerHitsSoft17: true,
  penetration: 0.75,
}

describe('generateRequestId', () => {
  it('returns unique IDs', () => {
    const id1 = generateRequestId()
    const id2 = generateRequestId()
    expect(id1).not.toBe(id2)
  })

  it('starts with "analysis-"', () => {
    expect(generateRequestId()).toMatch(/^analysis-/)
  })
})

describe('computeAnalysis – fast mode', () => {
  it('computes EV analysis', () => {
    const request: AnalysisRequest = {
      id: 'test-1',
      type: 'ev',
      mode: 'fast',
      params: BASE_PARAMS,
    }
    const result = computeAnalysis(request)

    expect(result.expectedValue).toBeDefined()
    expect(result.houseEdge).toBeDefined()
    expect(result.playerAdvantage).toBeDefined()
    // EV should be empirical: -10/100 = -0.1
    expect(result.expectedValue).toBeCloseTo(-0.1, 5)
  })

  it('computes variance analysis', () => {
    const params: AnalysisParams = {
      ...BASE_PARAMS,
      betHistory: [
        { units: 1, outcome: 'win', payout: 1 },
        { units: 1, outcome: 'loss', payout: -1 },
        { units: 1, outcome: 'win', payout: 1 },
        { units: 1, outcome: 'loss', payout: -1 },
      ],
    }
    const request: AnalysisRequest = {
      id: 'test-2',
      type: 'variance',
      mode: 'fast',
      params,
    }
    const result = computeAnalysis(request)

    expect(result.standardDeviation).toBeGreaterThan(0)
    expect(result.variancePerHand).toBeGreaterThan(0)
    expect(result.nZero).toBeGreaterThan(0)
  })

  it('computes risk of ruin', () => {
    const request: AnalysisRequest = {
      id: 'test-3',
      type: 'ror',
      mode: 'fast',
      params: {
        ...BASE_PARAMS,
        betHistory: [
          { units: 1, outcome: 'loss', payout: -1 },
          { units: 1, outcome: 'loss', payout: -1 },
          { units: 1, outcome: 'win', payout: 1 },
        ],
      },
    }
    const result = computeAnalysis(request)

    expect(result.riskOfRuin).toBeDefined()
    expect(result.riskOfRuin).toBeGreaterThanOrEqual(0)
    expect(result.riskOfRuin).toBeLessThanOrEqual(1)
    expect(result.kellyFraction).toBeDefined()
  })

  it('computes strategy quality', () => {
    const request: AnalysisRequest = {
      id: 'test-4',
      type: 'strategy',
      mode: 'fast',
      params: {
        ...BASE_PARAMS,
        strategyAccuracy: 0.95,
        deviationAccuracy: 0.8,
        countAccuracy: 0.9,
      },
    }
    const result = computeAnalysis(request)

    expect(result.costOfErrors).toBeDefined()
    expect(result.costOfErrors).toBeGreaterThan(0)
    expect(result.deviationValue).toBeDefined()
    expect(result.deviationValue).toBeGreaterThan(0)
  })

  it('computes full analysis with all fields', () => {
    const request: AnalysisRequest = {
      id: 'test-5',
      type: 'full',
      mode: 'fast',
      params: {
        ...BASE_PARAMS,
        strategyAccuracy: 0.9,
        betHistory: [
          { units: 1, outcome: 'win', payout: 1 },
          { units: 1, outcome: 'loss', payout: -1 },
        ],
      },
    }
    const result = computeAnalysis(request)

    // All categories should be populated
    expect(result.expectedValue).toBeDefined()
    expect(result.houseEdge).toBeDefined()
    expect(result.standardDeviation).toBeDefined()
    expect(result.riskOfRuin).toBeDefined()
    expect(result.costOfErrors).toBeDefined()
  })

  it('handles zero hands gracefully', () => {
    const request: AnalysisRequest = {
      id: 'test-6',
      type: 'ev',
      mode: 'fast',
      params: { ...BASE_PARAMS, handsPlayed: 0 },
    }
    const result = computeAnalysis(request)
    expect(result.expectedValue).toBe(0)
  })
})

describe('computeAnalysis – deep mode', () => {
  it('includes simulation data for RoR', () => {
    const request: AnalysisRequest = {
      id: 'test-deep-1',
      type: 'ror',
      mode: 'deep',
      params: {
        ...BASE_PARAMS,
        betHistory: [
          { units: 1, outcome: 'win', payout: 1 },
          { units: 1, outcome: 'loss', payout: -1 },
          { units: 1, outcome: 'win', payout: 1 },
        ],
      },
    }
    const result = computeAnalysis(request)

    expect(result.simulations).toBe(10_000)
    expect(result.confidenceInterval).toBeDefined()
    expect(result.confidenceInterval).toHaveLength(2)
    expect(result.ruinProbByHands).toBeDefined()
    expect(result.ruinProbByHands!.length).toBeGreaterThan(0)
  })

  it('adjusts edge for counting advantage and errors', () => {
    const request: AnalysisRequest = {
      id: 'test-deep-2',
      type: 'full',
      mode: 'deep',
      params: {
        ...BASE_PARAMS,
        strategyAccuracy: 1.0,
        deviationAccuracy: 1.0,
        countAccuracy: 1.0,
        betHistory: [
          { units: 1, outcome: 'win', payout: 1 },
          { units: 1, outcome: 'loss', payout: -1 },
        ],
      },
    }
    const result = computeAnalysis(request)

    // With perfect play + counting, player advantage should be positive relative to base
    expect(result.deviationValue).toBeGreaterThan(0)
    expect(result.costOfErrors).toBe(0)
  })

  it('handles S17 rule adjustment', () => {
    const h17: AnalysisRequest = {
      id: 'h17',
      type: 'ev',
      mode: 'fast',
      params: { ...BASE_PARAMS, dealerHitsSoft17: true },
    }
    const s17: AnalysisRequest = {
      id: 's17',
      type: 'ev',
      mode: 'fast',
      params: { ...BASE_PARAMS, dealerHitsSoft17: false },
    }
    const h17Result = computeAnalysis(h17)
    const s17Result = computeAnalysis(s17)

    // S17 should have lower absolute house edge (better for player)
    // Edge is negative, so S17 (-0.3%) is closer to 0 than H17 (-0.5%)
    expect(Math.abs(s17Result.houseEdge!)).toBeLessThan(Math.abs(h17Result.houseEdge!))
  })
})

describe('createAnalysisWorker', () => {
  it('creates a worker handle', () => {
    const handle = createAnalysisWorker()
    expect(handle).toBeDefined()
    expect(typeof handle.analyze).toBe('function')
    expect(typeof handle.cancel).toBe('function')
    expect(typeof handle.terminate).toBe('function')
    handle.terminate()
  })

  it('falls back to sync when Worker is unavailable', async () => {
    // In vitest/jsdom, Worker may not be defined, so this exercises the fallback
    const handle = createAnalysisWorker()
    const result = await handle.analyze({
      type: 'ev',
      mode: 'fast',
      params: BASE_PARAMS,
    })

    expect(result.id).toMatch(/^analysis-/)
    expect(result.type).toBe('ev')
    expect(result.data.expectedValue).toBeDefined()
    expect(result.computeTimeMs).toBeGreaterThanOrEqual(0)
    handle.terminate()
  })
})
