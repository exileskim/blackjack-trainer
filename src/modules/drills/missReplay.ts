import type { CountCheck } from '@/modules/domain/types.ts'

export interface MissReplayProblem {
  handNumber: number
  expectedCount: number
  userPreviousAnswer: number
  delta: number
}

export interface MissReplayState {
  problems: MissReplayProblem[]
  currentIndex: number
  answers: { problem: MissReplayProblem; userAnswer: number; isCorrect: boolean; responseMs: number }[]
}

export interface MissReplaySummary {
  total: number
  correct: number
  accuracy: number
  improved: number
  avgResponseMs: number
}

/**
 * Create a miss replay drill from a set of count checks.
 * Only includes incorrect checks. Returns null if there are no misses.
 */
export function createMissReplay(checks: CountCheck[]): MissReplayState | null {
  const misses = checks.filter((c) => !c.isCorrect && (c.promptType ?? 'runningCount') !== 'bestAction')
  if (misses.length === 0) return null

  const problems: MissReplayProblem[] = misses.map((c) => ({
    handNumber: c.handNumber,
    expectedCount: c.expectedCount,
    userPreviousAnswer: c.enteredCount,
    delta: c.delta,
  }))

  return {
    problems,
    currentIndex: 0,
    answers: [],
  }
}

export function submitMissReplayAnswer(
  state: MissReplayState,
  userAnswer: number,
  responseMs: number,
): MissReplayState {
  const problem = state.problems[state.currentIndex]
  if (!problem) return state

  return {
    ...state,
    currentIndex: state.currentIndex + 1,
    answers: [
      ...state.answers,
      {
        problem,
        userAnswer,
        isCorrect: userAnswer === problem.expectedCount,
        responseMs,
      },
    ],
  }
}

export function missReplaySummary(state: MissReplayState): MissReplaySummary {
  const total = state.answers.length
  if (total === 0) return { total: 0, correct: 0, accuracy: 0, improved: 0, avgResponseMs: 0 }

  const correct = state.answers.filter((a) => a.isCorrect).length
  // "Improved" means they got it right this time (after previously getting it wrong)
  const improved = correct
  const avgResponseMs = state.answers.reduce((s, a) => s + a.responseMs, 0) / total

  return {
    total,
    correct,
    accuracy: (correct / total) * 100,
    improved,
    avgResponseMs,
  }
}
