import type { HandOutcome } from '@/modules/domain/enums.ts'

// ---------------------------------------------------------------------------
// Bet spread configuration
// ---------------------------------------------------------------------------

export interface BetSpreadEntry {
  /** Minimum true count for this tier (inclusive) */
  readonly tcMin: number
  /** Maximum true count for this tier (inclusive, use Infinity for unbounded) */
  readonly tcMax: number
  /** Bet size in units */
  readonly units: number
}

export interface BetRampConfig {
  readonly name: string
  readonly spread: BetSpreadEntry[]
  readonly startingBankroll: number
  /** Dollar (or chip) value of one unit */
  readonly unitSize: number
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface BetHistoryEntry {
  readonly handNumber: number
  readonly trueCount: number
  readonly betUnits: number
  readonly outcome: HandOutcome
  /** Net units won/lost on this hand (e.g. +1, -1, +1.5 for BJ, -0.5 for surrender) */
  readonly payout: number
}

export interface BetRampState {
  readonly config: BetRampConfig
  readonly currentBankroll: number
  readonly handsPlayed: number
  readonly totalWagered: number
  readonly netResult: number
  readonly betHistory: BetHistoryEntry[]
  readonly peakBankroll: number
  readonly troughBankroll: number
}

export interface BetRampStats {
  readonly handsPlayed: number
  readonly totalWagered: number
  readonly netResult: number
  readonly avgBetSize: number
  readonly winRate: number
  readonly currentBankroll: number
  readonly peakBankroll: number
  readonly troughBankroll: number
  /** Estimated hourly EV in units, assuming 80 hands/hour */
  readonly hourlyEv: number
  /** Standard deviation of per-hand results */
  readonly standardDeviation: number
  /** Analytical risk of ruin estimate */
  readonly riskOfRuin: number
}

// ---------------------------------------------------------------------------
// Preset spreads
// ---------------------------------------------------------------------------

export const SPREAD_CONSERVATIVE: BetSpreadEntry[] = [
  { tcMin: -Infinity, tcMax: 0, units: 1 },
  { tcMin: 1, tcMax: 1, units: 2 },
  { tcMin: 2, tcMax: 2, units: 3 },
  { tcMin: 3, tcMax: 3, units: 4 },
  { tcMin: 4, tcMax: Infinity, units: 5 },
]

export const SPREAD_MODERATE: BetSpreadEntry[] = [
  { tcMin: -Infinity, tcMax: 0, units: 1 },
  { tcMin: 1, tcMax: 1, units: 3 },
  { tcMin: 2, tcMax: 2, units: 6 },
  { tcMin: 3, tcMax: 3, units: 8 },
  { tcMin: 4, tcMax: Infinity, units: 10 },
]

export const SPREAD_AGGRESSIVE: BetSpreadEntry[] = [
  { tcMin: -Infinity, tcMax: 0, units: 1 },
  { tcMin: 1, tcMax: 1, units: 4 },
  { tcMin: 2, tcMax: 2, units: 8 },
  { tcMin: 3, tcMax: 3, units: 12 },
  { tcMin: 4, tcMax: Infinity, units: 16 },
]

export const PRESET_SPREADS = {
  conservative: SPREAD_CONSERVATIVE,
  moderate: SPREAD_MODERATE,
  aggressive: SPREAD_AGGRESSIVE,
} as const

export type SpreadPreset = keyof typeof PRESET_SPREADS

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Look up the recommended bet for a given true count using the spread config.
 * Falls back to 1 unit if no matching tier is found.
 */
export function getRecommendedBet(trueCount: number, spread: BetSpreadEntry[]): number {
  for (const entry of spread) {
    if (trueCount >= entry.tcMin && trueCount <= entry.tcMax) {
      return entry.units
    }
  }
  return 1
}

/**
 * Compute the payout in units for a given outcome and bet size.
 * Standard payouts: win +1, loss -1, push 0, blackjack +1.5, surrender -0.5.
 */
export function computePayout(betUnits: number, outcome: HandOutcome): number {
  switch (outcome) {
    case 'win':
      return betUnits
    case 'loss':
      return -betUnits
    case 'push':
      return 0
    case 'blackjack':
      return betUnits * 1.5
    case 'surrender':
      return -betUnits * 0.5
  }
}

/**
 * Create a fresh bet ramp state from config.
 */
export function createBetRampState(config: BetRampConfig): BetRampState {
  return {
    config,
    currentBankroll: config.startingBankroll,
    handsPlayed: 0,
    totalWagered: 0,
    netResult: 0,
    betHistory: [],
    peakBankroll: config.startingBankroll,
    troughBankroll: config.startingBankroll,
  }
}

/**
 * Record a completed hand result and update the bet ramp state.
 */
export function recordBetResult(
  state: BetRampState,
  handNumber: number,
  trueCount: number,
  betUnits: number,
  outcome: HandOutcome,
): BetRampState {
  const payout = computePayout(betUnits, outcome)
  const wageredDollars = betUnits * state.config.unitSize
  const payoutDollars = payout * state.config.unitSize
  const newBankroll = state.currentBankroll + payoutDollars

  const entry: BetHistoryEntry = {
    handNumber,
    trueCount,
    betUnits,
    outcome,
    payout,
  }

  return {
    ...state,
    currentBankroll: newBankroll,
    handsPlayed: state.handsPlayed + 1,
    totalWagered: state.totalWagered + wageredDollars,
    netResult: state.netResult + payoutDollars,
    betHistory: [...state.betHistory, entry],
    peakBankroll: Math.max(state.peakBankroll, newBankroll),
    troughBankroll: Math.min(state.troughBankroll, newBankroll),
  }
}

/**
 * Compute summary statistics from the current bet ramp state.
 */
export function computeBetRampStats(state: BetRampState): BetRampStats {
  const { betHistory, config } = state
  const n = betHistory.length

  const avgBetSize = n > 0
    ? betHistory.reduce((sum, e) => sum + e.betUnits, 0) / n
    : 0

  const wins = betHistory.filter(
    (e) => e.outcome === 'win' || e.outcome === 'blackjack',
  ).length
  const winRate = n > 0 ? (wins / n) * 100 : 0

  // Per-hand EV in units
  const evPerHand = n > 0
    ? betHistory.reduce((sum, e) => sum + e.payout, 0) / n
    : 0
  const hourlyEv = evPerHand * 80

  // Standard deviation of per-hand payouts
  let sd = 0
  if (n >= 2) {
    const mean = betHistory.reduce((s, e) => s + e.payout, 0) / n
    const sumSq = betHistory.reduce((s, e) => s + (e.payout - mean) ** 2, 0)
    sd = Math.sqrt(sumSq / (n - 1))
  }

  // Analytical risk of ruin: e^(-2 * edge * bankroll / variance)
  const bankrollUnits = state.currentBankroll / config.unitSize
  const variance = sd * sd
  let ror = 0
  if (variance > 0 && bankrollUnits > 0) {
    const exponent = (2 * evPerHand * bankrollUnits) / variance
    ror = Math.min(1, Math.max(0, Math.exp(-exponent)))
  }

  return {
    handsPlayed: n,
    totalWagered: state.totalWagered,
    netResult: state.netResult,
    avgBetSize,
    winRate,
    currentBankroll: state.currentBankroll,
    peakBankroll: state.peakBankroll,
    troughBankroll: state.troughBankroll,
    hourlyEv,
    standardDeviation: sd,
    riskOfRuin: ror,
  }
}
