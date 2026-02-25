// ---------------------------------------------------------------------------
// Wonging (back-counting) Trainer
// ---------------------------------------------------------------------------
// Presents shoe scenarios where the player must decide whether to enter,
// stay at, watch, or exit a table based on the true count.

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface WongingConfig {
  /** True count at or above which the player should enter (default 2) */
  readonly entryThreshold: number
  /** True count at or below which the player should exit (default 0) */
  readonly exitThreshold: number
  /** Number of scenarios in the drill */
  readonly scenarioCount: number
}

export const DEFAULT_WONGING_CONFIG: WongingConfig = {
  entryThreshold: 2,
  exitThreshold: 0,
  scenarioCount: 20,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WongingScenario {
  /** How deep into the shoe (0–1, e.g. 0.4 = 40% dealt) */
  readonly shoeProgress: number
  readonly runningCount: number
  readonly trueCount: number
  readonly decksRemaining: number
  /** Whether the player is currently seated and playing */
  readonly isCurrentlyPlaying: boolean
}

export type WongingDecision = 'enter' | 'stay' | 'exit' | 'watch'

export interface WongingAnswer {
  readonly scenarioIndex: number
  readonly decision: WongingDecision
  readonly optimalDecision: WongingDecision
  readonly isCorrect: boolean
  readonly responseMs: number
}

export interface WongingDrillState {
  readonly config: WongingConfig
  readonly scenarios: WongingScenario[]
  readonly currentIndex: number
  readonly answers: WongingAnswer[]
  readonly startTime: number
}

export interface WongingDrillSummary {
  readonly totalScenarios: number
  readonly correct: number
  readonly accuracy: number
  readonly avgResponseMs: number
  /** Times the player should have entered but didn't */
  readonly missedEntries: number
  /** Times the player should have exited but stayed */
  readonly lateExits: number
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Determine the optimal wonging decision for a scenario.
 */
export function getOptimalDecision(
  scenario: WongingScenario,
  config: WongingConfig,
): WongingDecision {
  const { trueCount, isCurrentlyPlaying } = scenario

  if (isCurrentlyPlaying) {
    // Already at the table — stay or exit
    return trueCount <= config.exitThreshold ? 'exit' : 'stay'
  } else {
    // Watching — enter or keep watching
    return trueCount >= config.entryThreshold ? 'enter' : 'watch'
  }
}

/**
 * Generate a randomized set of wonging scenarios.
 * Simulates shoe progression with varying counts.
 */
export function generateScenarios(
  config: WongingConfig,
  rng: () => number = Math.random,
): WongingScenario[] {
  const scenarios: WongingScenario[] = []
  let isPlaying = false

  for (let i = 0; i < config.scenarioCount; i++) {
    // Shoe progress ranges from 0.1 to 0.85
    const shoeProgress = 0.1 + rng() * 0.75
    const totalDecks = 6
    const decksRemaining = Math.max(0.5, totalDecks * (1 - shoeProgress))

    // Generate a running count with realistic variance
    // Bias toward the range -8 to +12 for a 6-deck shoe
    const runningCount = Math.round((rng() * 20 - 8) * 10) / 10
    const rc = Math.round(runningCount)
    const trueCount = decksRemaining > 0
      ? Math.trunc(rc / decksRemaining)
      : rc

    scenarios.push({
      shoeProgress: Math.round(shoeProgress * 100) / 100,
      runningCount: rc,
      trueCount,
      decksRemaining: Math.round(decksRemaining * 10) / 10,
      isCurrentlyPlaying: isPlaying,
    })

    // Simulate realistic flow: sometimes we enter/exit between scenarios
    const optimal = getOptimalDecision(scenarios[i]!, config)
    if (optimal === 'enter') isPlaying = true
    else if (optimal === 'exit') isPlaying = false
  }

  return scenarios
}

// ---------------------------------------------------------------------------
// Drill lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a new wonging drill with generated scenarios.
 */
export function createWongingDrill(
  config?: Partial<WongingConfig>,
  rng?: () => number,
): WongingDrillState {
  const fullConfig: WongingConfig = {
    ...DEFAULT_WONGING_CONFIG,
    ...config,
  }

  return {
    config: fullConfig,
    scenarios: generateScenarios(fullConfig, rng),
    currentIndex: 0,
    answers: [],
    startTime: Date.now(),
  }
}

/**
 * Submit a decision for the current scenario.
 */
export function submitWongingDecision(
  state: WongingDrillState,
  decision: WongingDecision,
  responseMs: number,
): WongingDrillState {
  const scenario = state.scenarios[state.currentIndex]
  if (!scenario) return state

  const optimalDecision = getOptimalDecision(scenario, state.config)
  const isCorrect = decision === optimalDecision

  const answer: WongingAnswer = {
    scenarioIndex: state.currentIndex,
    decision,
    optimalDecision,
    isCorrect,
    responseMs,
  }

  return {
    ...state,
    currentIndex: state.currentIndex + 1,
    answers: [...state.answers, answer],
  }
}

/**
 * Check if the drill is complete.
 */
export function isWongingDrillComplete(state: WongingDrillState): boolean {
  return state.currentIndex >= state.scenarios.length
}

/**
 * Compute summary statistics for a completed (or in-progress) drill.
 */
export function computeWongingDrillSummary(
  state: WongingDrillState,
): WongingDrillSummary {
  const { answers, scenarios } = state
  const total = answers.length

  if (total === 0) {
    return {
      totalScenarios: scenarios.length,
      correct: 0,
      accuracy: 0,
      avgResponseMs: 0,
      missedEntries: 0,
      lateExits: 0,
    }
  }

  const correct = answers.filter((a) => a.isCorrect).length
  const accuracy = (correct / total) * 100
  const avgResponseMs = answers.reduce((s, a) => s + a.responseMs, 0) / total

  // Missed entries: optimal was 'enter' but player chose 'watch'
  let missedEntries = 0
  let lateExits = 0

  for (const answer of answers) {
    if (answer.optimalDecision === 'enter' && answer.decision !== 'enter') {
      missedEntries++
    }
    if (answer.optimalDecision === 'exit' && answer.decision !== 'exit') {
      lateExits++
    }
  }

  return {
    totalScenarios: scenarios.length,
    correct,
    accuracy,
    avgResponseMs,
    missedEntries,
    lateExits,
  }
}
