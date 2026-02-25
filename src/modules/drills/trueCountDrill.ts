import { computeTrueCount } from '@/modules/counting/trueCount.ts'

export interface TrueCountProblem {
  runningCount: number
  decksRemaining: number
  correctAnswer: number
}

export interface TrueCountResult {
  problem: TrueCountProblem
  userAnswer: number
  isCorrect: boolean
  delta: number
  responseMs: number
}

export interface TrueCountDrillState {
  problems: TrueCountProblem[]
  results: TrueCountResult[]
  currentIndex: number
}

/**
 * Generate a set of true count conversion problems.
 * Running counts range from -12 to +12 with varying deck counts.
 */
export function generateProblems(
  count: number,
  rng: () => number = Math.random,
): TrueCountProblem[] {
  const problems: TrueCountProblem[] = []
  const deckOptions = [1, 1.5, 2, 2.5, 3, 4, 5, 6]

  for (let i = 0; i < count; i++) {
    const runningCount = Math.floor(rng() * 25) - 12 // -12 to +12
    const decksRemaining = deckOptions[Math.floor(rng() * deckOptions.length)]!
    const correctAnswer = computeTrueCount(runningCount, decksRemaining)

    problems.push({ runningCount, decksRemaining, correctAnswer })
  }

  return problems
}

export function createTrueCountDrillState(problemCount = 20): TrueCountDrillState {
  return {
    problems: generateProblems(problemCount),
    results: [],
    currentIndex: 0,
  }
}

export function submitAnswer(
  state: TrueCountDrillState,
  userAnswer: number,
  responseMs: number,
): TrueCountDrillState {
  const problem = state.problems[state.currentIndex]
  if (!problem) return state

  const delta = userAnswer - problem.correctAnswer
  const result: TrueCountResult = {
    problem,
    userAnswer,
    isCorrect: delta === 0,
    delta,
    responseMs,
  }

  return {
    ...state,
    results: [...state.results, result],
    currentIndex: state.currentIndex + 1,
  }
}

export function drillSummary(state: TrueCountDrillState) {
  const correct = state.results.filter((r) => r.isCorrect).length
  const total = state.results.length
  const avgMs = total > 0 ? state.results.reduce((s, r) => s + r.responseMs, 0) / total : 0
  return {
    correct,
    total,
    accuracy: total > 0 ? (correct / total) * 100 : 0,
    avgResponseMs: avgMs,
  }
}
