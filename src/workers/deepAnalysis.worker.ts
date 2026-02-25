// Deep Analysis Web Worker
// Receives AnalysisRequest messages, performs calculations, posts back AnalysisResult messages.

import type { AnalysisRequest, AnalysisResult, AnalysisData, AnalysisError } from './deepAnalysis.ts'

/**
 * Compute the base house edge from rule configuration.
 *
 * Starting point: -0.50% for 6-deck H17.
 * Adjustments:
 *   - Deck count: +0.02% per fewer deck from 6, -0.02% per extra deck
 *   - S17: +0.20% (favourable to player vs H17)
 *   - No DAS is not tracked in AnalysisParams, so we skip that adjustment here.
 */
function computeBaseHouseEdge(decks: number, dealerHitsSoft17: boolean): number {
  let edge = -0.50

  // Deck adjustment relative to 6
  const deckDelta = 6 - decks
  edge += deckDelta * 0.02

  // S17 is better for the player than H17
  if (!dealerHitsSoft17) {
    edge += 0.20
  }

  return edge
}

/**
 * Seeded pseudo-random number generator (xoshiro128**).
 * Deterministic for reproducibility in tests when seeded, but we use
 * Date.now() as the default seed for production randomness.
 */
function createRng(seed: number): () => number {
  let s0 = seed >>> 0
  let s1 = (seed * 1664525 + 1013904223) >>> 0
  let s2 = (s1 * 1664525 + 1013904223) >>> 0
  let s3 = (s2 * 1664525 + 1013904223) >>> 0

  return (): number => {
    const t = s1 << 9
    let r = s0 * 5
    r = ((r << 7) | (r >>> 25)) * 9

    s2 ^= s0
    s3 ^= s1
    s1 ^= s2
    s0 ^= s3
    s2 ^= t
    s3 = (s3 << 11) | (s3 >>> 21)

    return (r >>> 0) / 4294967296
  }
}

/**
 * Core analysis computation. Exported so the main-thread fallback can use
 * this same function directly.
 */
export function computeAnalysis(request: AnalysisRequest): AnalysisData {
  const { mode, type, params } = request

  const baseEdgePct = computeBaseHouseEdge(params.decks, params.dealerHitsSoft17)
  const baseEdge = baseEdgePct / 100

  if (mode === 'fast') {
    return computeFast(type, params, baseEdge)
  }
  return computeDeep(type, params, baseEdge)
}

function computeFast(
  type: AnalysisRequest['type'],
  params: AnalysisRequest['params'],
  baseEdge: number,
): AnalysisData {
  const result: Partial<AnalysisData> = {}

  const handsPlayed = params.handsPlayed
  const safeHands = handsPlayed > 0 ? handsPlayed : 1

  // ----- EV analysis -----
  if (type === 'ev' || type === 'full') {
    const empiricalEv = handsPlayed > 0 ? params.netResult / safeHands : 0
    result.expectedValue = empiricalEv
    result.houseEdge = baseEdge * 100
    result.playerAdvantage = -baseEdge * 100
  }

  // ----- Variance analysis -----
  if (type === 'variance' || type === 'full') {
    const { sd, variance } = computeSampleVariance(params.betHistory)
    result.standardDeviation = sd
    result.variancePerHand = variance

    // N0 = variance / edge^2  (hands needed for skill to overcome variance)
    const effectiveEdge = Math.abs(baseEdge) || 0.005
    result.nZero = variance > 0 ? Math.ceil(variance / (effectiveEdge * effectiveEdge)) : 0
  }

  // ----- Risk of Ruin -----
  if (type === 'ror' || type === 'full') {
    const { sd } = computeSampleVariance(params.betHistory)
    const effectiveSd = sd > 0 ? sd : 1.1 // default SD for flat betting
    const effectiveEdge = baseEdge // negative means house advantage
    const bankrollUnits = params.totalWagered > 0
      ? params.netResult + params.totalWagered
      : 100 // default bankroll assumption

    // Classic RoR formula: e^(-2 * edge * bankroll / variance)
    // When edge is negative (house advantage), RoR approaches 1
    const variance = effectiveSd * effectiveSd
    const exponent = (2 * effectiveEdge * bankrollUnits) / variance
    result.riskOfRuin = Math.min(1, Math.max(0, Math.exp(-exponent)))

    // Kelly fraction: edge / variance
    result.kellyFraction = effectiveEdge / variance
    result.optimalUnitSize = bankrollUnits > 0
      ? Math.max(0, (effectiveEdge / variance) * bankrollUnits)
      : 0
  }

  // ----- Strategy quality -----
  if (type === 'strategy' || type === 'full') {
    const strategyAccuracy = params.strategyAccuracy ?? 1
    const deviationAccuracy = params.deviationAccuracy ?? 0
    const countAccuracy = params.countAccuracy ?? 0

    // Cost of strategy errors: each mistake costs roughly 2% of a unit
    result.costOfErrors = (1 - strategyAccuracy) * 0.02

    // Value from counting deviations: skilled counting adds ~0.5-1.5% edge
    // Scale by both count accuracy and deviation accuracy
    result.deviationValue = countAccuracy * deviationAccuracy * 0.01
  }

  return result as AnalysisData
}

function computeDeep(
  type: AnalysisRequest['type'],
  params: AnalysisRequest['params'],
  baseEdge: number,
): AnalysisData {
  const result: Partial<AnalysisData> = {}

  const handsPlayed = params.handsPlayed
  const safeHands = handsPlayed > 0 ? handsPlayed : 1
  const strategyAccuracy = params.strategyAccuracy ?? 1
  const deviationAccuracy = params.deviationAccuracy ?? 0
  const countAccuracy = params.countAccuracy ?? 0

  // More accurate EV incorporating counting advantage and error cost
  const countingAdvantage = countAccuracy * deviationAccuracy * 0.01
  const errorCost = (1 - strategyAccuracy) * 0.02
  const adjustedEdge = baseEdge + countingAdvantage - errorCost

  // ----- EV analysis (deep) -----
  if (type === 'ev' || type === 'full') {
    const empiricalEv = handsPlayed > 0 ? params.netResult / safeHands : 0
    result.expectedValue = empiricalEv
    result.houseEdge = adjustedEdge * 100
    result.playerAdvantage = -adjustedEdge * 100
  }

  // ----- Strategy quality (deep) -----
  if (type === 'strategy' || type === 'full') {
    result.costOfErrors = errorCost
    result.deviationValue = countingAdvantage
  }

  // ----- Variance analysis (deep) -----
  const { sd, variance } = computeSampleVariance(params.betHistory)
  const effectiveSd = sd > 0 ? sd : 1.1
  const effectiveVariance = effectiveSd * effectiveSd

  if (type === 'variance' || type === 'full') {
    result.standardDeviation = effectiveSd
    result.variancePerHand = effectiveVariance

    const effectiveEdge = Math.abs(adjustedEdge) || 0.005
    result.nZero = Math.ceil(effectiveVariance / (effectiveEdge * effectiveEdge))
  }

  // ----- Monte Carlo simulation -----
  const SIM_ITERATIONS = 10_000
  const SIM_HANDS = Math.max(safeHands, 1000)

  if (type === 'ror' || type === 'full') {
    const bankrollUnits = params.totalWagered > 0
      ? params.netResult + params.totalWagered
      : 100

    const rng = createRng(Date.now())
    const finalResults: number[] = []
    let ruinCount = 0

    // Track ruin at milestone hand counts
    const milestones = [100, 500, 1000, 5000]
    const ruinAtMilestone: Record<number, number> = {}
    for (const m of milestones) {
      ruinAtMilestone[m] = 0
    }

    for (let sim = 0; sim < SIM_ITERATIONS; sim++) {
      let bankroll = bankrollUnits
      let ruined = false

      for (let h = 1; h <= SIM_HANDS; h++) {
        // Simulate a single hand result using normal approximation
        // result = edge + sd * Z, where Z is standard normal
        const u1 = rng()
        const u2 = rng()
        // Box-Muller transform for standard normal
        const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2)
        const handResult = adjustedEdge + effectiveSd * z

        bankroll += handResult

        if (bankroll <= 0 && !ruined) {
          ruined = true
          ruinCount++
          // Record ruin at all subsequent milestones
          for (const m of milestones) {
            if (h <= m) {
              ruinAtMilestone[m]++
            }
          }
        }

        // Check milestones even if not yet ruined
        // (ruin at milestone already handled above)
      }

      finalResults.push(bankroll)
    }

    result.riskOfRuin = ruinCount / SIM_ITERATIONS

    // Kelly and optimal unit size
    result.kellyFraction = adjustedEdge / effectiveVariance
    result.optimalUnitSize = bankrollUnits > 0
      ? Math.max(0, (adjustedEdge / effectiveVariance) * bankrollUnits)
      : 0

    // Confidence interval for final bankroll (95% CI)
    finalResults.sort((a, b) => a - b)
    const ciLow = finalResults[Math.floor(SIM_ITERATIONS * 0.025)]!
    const ciHigh = finalResults[Math.floor(SIM_ITERATIONS * 0.975)]!

    // Convert CI from bankroll to per-hand EV
    result.confidenceInterval = [
      (ciLow - bankrollUnits) / SIM_HANDS,
      (ciHigh - bankrollUnits) / SIM_HANDS,
    ]

    result.simulations = SIM_ITERATIONS

    result.ruinProbByHands = milestones.map(m => ({
      hands: m,
      probability: ruinAtMilestone[m]! / SIM_ITERATIONS,
    }))
  }

  return result as AnalysisData
}

/**
 * Compute sample variance and standard deviation from bet history payouts.
 * Returns { sd: 0, variance: 0 } for empty or single-element histories.
 */
function computeSampleVariance(
  betHistory: { units: number; outcome: string; payout: number }[],
): { sd: number; variance: number } {
  if (betHistory.length < 2) {
    return { sd: 0, variance: 0 }
  }

  const payouts = betHistory.map(b => b.payout)
  const n = payouts.length
  const mean = payouts.reduce((sum, p) => sum + p, 0) / n
  const sumSqDiff = payouts.reduce((sum, p) => sum + (p - mean) ** 2, 0)
  const variance = sumSqDiff / (n - 1) // sample variance (Bessel's correction)
  const sd = Math.sqrt(variance)

  return { sd, variance }
}

// ----- Worker message handler -----
declare const self: DedicatedWorkerGlobalScope

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  const request = event.data
  const start = performance.now()

  try {
    const data = computeAnalysis(request)
    const computeTimeMs = performance.now() - start

    const result: AnalysisResult = {
      id: request.id,
      type: request.type,
      mode: request.mode,
      data,
      computeTimeMs,
    }

    self.postMessage(result)
  } catch (err) {
    const error: AnalysisError = {
      id: request.id,
      error: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(error)
  }
}
