import { describe, it, expect } from 'vitest'
import {
  getOptimalDecision,
  generateScenarios,
  createWongingDrill,
  submitWongingDecision,
  isWongingDrillComplete,
  computeWongingDrillSummary,
  DEFAULT_WONGING_CONFIG,
  type WongingScenario,
  type WongingConfig,
} from './wonging.ts'

// Deterministic RNG for reproducible tests
function createSeededRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return s / 0x7fffffff
  }
}

const config: WongingConfig = { entryThreshold: 2, exitThreshold: 0, scenarioCount: 10 }

describe('getOptimalDecision', () => {
  it('should enter when not playing and TC >= entry threshold', () => {
    const scenario: WongingScenario = {
      shoeProgress: 0.4,
      runningCount: 8,
      trueCount: 3,
      decksRemaining: 3,
      isCurrentlyPlaying: false,
    }
    expect(getOptimalDecision(scenario, config)).toBe('enter')
  })

  it('should watch when not playing and TC < entry threshold', () => {
    const scenario: WongingScenario = {
      shoeProgress: 0.3,
      runningCount: 2,
      trueCount: 1,
      decksRemaining: 4,
      isCurrentlyPlaying: false,
    }
    expect(getOptimalDecision(scenario, config)).toBe('watch')
  })

  it('should stay when playing and TC > exit threshold', () => {
    const scenario: WongingScenario = {
      shoeProgress: 0.5,
      runningCount: 6,
      trueCount: 2,
      decksRemaining: 3,
      isCurrentlyPlaying: true,
    }
    expect(getOptimalDecision(scenario, config)).toBe('stay')
  })

  it('should exit when playing and TC <= exit threshold', () => {
    const scenario: WongingScenario = {
      shoeProgress: 0.6,
      runningCount: 0,
      trueCount: 0,
      decksRemaining: 2.4,
      isCurrentlyPlaying: true,
    }
    expect(getOptimalDecision(scenario, config)).toBe('exit')
  })

  it('should exit when playing and TC is negative', () => {
    const scenario: WongingScenario = {
      shoeProgress: 0.7,
      runningCount: -4,
      trueCount: -2,
      decksRemaining: 2,
      isCurrentlyPlaying: true,
    }
    expect(getOptimalDecision(scenario, config)).toBe('exit')
  })

  it('should enter at exactly the entry threshold', () => {
    const scenario: WongingScenario = {
      shoeProgress: 0.5,
      runningCount: 6,
      trueCount: 2,
      decksRemaining: 3,
      isCurrentlyPlaying: false,
    }
    expect(getOptimalDecision(scenario, config)).toBe('enter')
  })

  it('should exit at exactly the exit threshold', () => {
    const scenario: WongingScenario = {
      shoeProgress: 0.5,
      runningCount: 0,
      trueCount: 0,
      decksRemaining: 3,
      isCurrentlyPlaying: true,
    }
    expect(getOptimalDecision(scenario, config)).toBe('exit')
  })
})

describe('generateScenarios', () => {
  it('generates the correct number of scenarios', () => {
    const rng = createSeededRng(42)
    const scenarios = generateScenarios(config, rng)
    expect(scenarios).toHaveLength(10)
  })

  it('all scenarios have valid fields', () => {
    const rng = createSeededRng(123)
    const scenarios = generateScenarios(config, rng)

    for (const s of scenarios) {
      expect(s.shoeProgress).toBeGreaterThanOrEqual(0.1)
      expect(s.shoeProgress).toBeLessThanOrEqual(0.85)
      expect(s.decksRemaining).toBeGreaterThanOrEqual(0.5)
      expect(typeof s.runningCount).toBe('number')
      expect(typeof s.trueCount).toBe('number')
      expect(typeof s.isCurrentlyPlaying).toBe('boolean')
    }
  })

  it('produces different results with different seeds', () => {
    const s1 = generateScenarios(config, createSeededRng(1))
    const s2 = generateScenarios(config, createSeededRng(999))

    const counts1 = s1.map((s) => s.trueCount)
    const counts2 = s2.map((s) => s.trueCount)
    // Very unlikely to be identical
    expect(counts1).not.toEqual(counts2)
  })
})

describe('createWongingDrill', () => {
  it('creates a drill with default config', () => {
    const rng = createSeededRng(42)
    const drill = createWongingDrill(undefined, rng)

    expect(drill.config).toEqual(DEFAULT_WONGING_CONFIG)
    expect(drill.scenarios).toHaveLength(DEFAULT_WONGING_CONFIG.scenarioCount)
    expect(drill.currentIndex).toBe(0)
    expect(drill.answers).toEqual([])
  })

  it('creates a drill with custom config', () => {
    const rng = createSeededRng(42)
    const drill = createWongingDrill({ entryThreshold: 3, scenarioCount: 5 }, rng)

    expect(drill.config.entryThreshold).toBe(3)
    expect(drill.config.exitThreshold).toBe(0) // default
    expect(drill.scenarios).toHaveLength(5)
  })
})

describe('submitWongingDecision', () => {
  it('records a correct decision', () => {
    const rng = createSeededRng(42)
    let drill = createWongingDrill({ scenarioCount: 5 }, rng)
    const scenario = drill.scenarios[0]!
    const optimal = getOptimalDecision(scenario, drill.config)

    drill = submitWongingDecision(drill, optimal, 500)

    expect(drill.currentIndex).toBe(1)
    expect(drill.answers).toHaveLength(1)
    expect(drill.answers[0]!.isCorrect).toBe(true)
    expect(drill.answers[0]!.responseMs).toBe(500)
  })

  it('records an incorrect decision', () => {
    const rng = createSeededRng(42)
    let drill = createWongingDrill({ scenarioCount: 5 }, rng)
    const scenario = drill.scenarios[0]!
    const optimal = getOptimalDecision(scenario, drill.config)

    // Choose the opposite
    const wrong = optimal === 'enter' || optimal === 'stay' ? 'watch' : 'enter'
    drill = submitWongingDecision(drill, wrong, 300)

    expect(drill.answers[0]!.isCorrect).toBe(false)
    expect(drill.answers[0]!.decision).toBe(wrong)
    expect(drill.answers[0]!.optimalDecision).toBe(optimal)
  })

  it('does nothing when past the last scenario', () => {
    const rng = createSeededRng(42)
    let drill = createWongingDrill({ scenarioCount: 2 }, rng)

    // Submit both
    for (let i = 0; i < 2; i++) {
      const s = drill.scenarios[drill.currentIndex]!
      drill = submitWongingDecision(drill, getOptimalDecision(s, drill.config), 100)
    }

    // Try one more
    const before = { ...drill }
    drill = submitWongingDecision(drill, 'enter', 100)
    expect(drill.answers).toHaveLength(before.answers.length)
  })
})

describe('isWongingDrillComplete', () => {
  it('returns false when scenarios remain', () => {
    const rng = createSeededRng(42)
    const drill = createWongingDrill({ scenarioCount: 3 }, rng)
    expect(isWongingDrillComplete(drill)).toBe(false)
  })

  it('returns true when all scenarios answered', () => {
    const rng = createSeededRng(42)
    let drill = createWongingDrill({ scenarioCount: 2 }, rng)

    for (let i = 0; i < 2; i++) {
      const s = drill.scenarios[drill.currentIndex]!
      drill = submitWongingDecision(drill, getOptimalDecision(s, drill.config), 100)
    }

    expect(isWongingDrillComplete(drill)).toBe(true)
  })
})

describe('computeWongingDrillSummary', () => {
  it('returns zeroes for empty drill', () => {
    const rng = createSeededRng(42)
    const drill = createWongingDrill({ scenarioCount: 5 }, rng)
    const summary = computeWongingDrillSummary(drill)

    expect(summary.correct).toBe(0)
    expect(summary.accuracy).toBe(0)
    expect(summary.avgResponseMs).toBe(0)
    expect(summary.missedEntries).toBe(0)
    expect(summary.lateExits).toBe(0)
  })

  it('reports 100% accuracy when all correct', () => {
    const rng = createSeededRng(42)
    let drill = createWongingDrill({ scenarioCount: 5 }, rng)

    for (let i = 0; i < 5; i++) {
      const s = drill.scenarios[drill.currentIndex]!
      drill = submitWongingDecision(drill, getOptimalDecision(s, drill.config), 200)
    }

    const summary = computeWongingDrillSummary(drill)
    expect(summary.correct).toBe(5)
    expect(summary.accuracy).toBe(100)
    expect(summary.avgResponseMs).toBe(200)
    expect(summary.missedEntries).toBe(0)
    expect(summary.lateExits).toBe(0)
  })

  it('tracks missed entries and late exits', () => {
    // Create a controlled scenario set
    const rng = createSeededRng(42)
    let drill = createWongingDrill({ scenarioCount: 10 }, rng)

    for (let i = 0; i < 10; i++) {
      const s = drill.scenarios[drill.currentIndex]!
      const optimal = getOptimalDecision(s, drill.config)

      // Always choose watch/stay — misses entries and exits
      const passive = s.isCurrentlyPlaying ? 'stay' : 'watch'
      drill = submitWongingDecision(drill, passive, 150)

      // If optimal was enter/exit, we should see it counted
      if (optimal === 'enter' || optimal === 'exit') {
        // will be tallied in summary
      }
    }

    const summary = computeWongingDrillSummary(drill)
    // missedEntries + lateExits should match incorrect answers
    // (unless some passive choices were actually correct)
    expect(summary.totalScenarios).toBe(10)
    expect(summary.missedEntries + summary.lateExits).toBeLessThanOrEqual(
      summary.totalScenarios - summary.correct,
    )
  })
})
