import { describe, it, expect } from 'vitest'
import {
  generateProblems,
  createTrueCountDrillState,
  submitAnswer,
  drillSummary,
} from './trueCountDrill.ts'

describe('trueCountDrill', () => {
  it('generates the requested number of problems', () => {
    const problems = generateProblems(15, () => 0.5)
    expect(problems).toHaveLength(15)
  })

  it('each problem has a correct answer matching computeTrueCount', () => {
    const problems = generateProblems(10, () => 0.5)
    for (const p of problems) {
      expect(p.correctAnswer).toBe(Math.trunc(p.runningCount / p.decksRemaining))
    }
  })

  it('creates a drill state with default 20 problems', () => {
    const state = createTrueCountDrillState()
    expect(state.problems).toHaveLength(20)
    expect(state.results).toHaveLength(0)
    expect(state.currentIndex).toBe(0)
  })

  it('submitAnswer records results and advances index', () => {
    const state = createTrueCountDrillState(5)
    const problem = state.problems[0]!
    const next = submitAnswer(state, problem.correctAnswer, 1200)

    expect(next.results).toHaveLength(1)
    expect(next.results[0]!.isCorrect).toBe(true)
    expect(next.currentIndex).toBe(1)
  })

  it('submitAnswer handles incorrect answers', () => {
    const state = createTrueCountDrillState(5)
    const next = submitAnswer(state, 999, 800)

    expect(next.results[0]!.isCorrect).toBe(false)
    expect(next.results[0]!.delta).toBe(999 - state.problems[0]!.correctAnswer)
  })

  it('drillSummary computes stats', () => {
    let state = createTrueCountDrillState(3)
    // Answer first two correctly, third wrong
    state = submitAnswer(state, state.problems[0]!.correctAnswer, 1000)
    state = submitAnswer(state, state.problems[1]!.correctAnswer, 2000)
    state = submitAnswer(state, state.problems[2]!.correctAnswer + 5, 1500)

    const summary = drillSummary(state)
    expect(summary.correct).toBe(2)
    expect(summary.total).toBe(3)
    expect(summary.accuracy).toBeCloseTo(66.67, 1)
    expect(summary.avgResponseMs).toBe(1500)
  })
})
