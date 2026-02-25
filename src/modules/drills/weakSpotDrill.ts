import type { CountCheck } from '@/modules/domain/types.ts'
import type { ActionFeedback } from '@/modules/session/sessionStore.ts'

// ---------------------------------------------------------------------------
// Error categories
// ---------------------------------------------------------------------------

export type ErrorCategory =
  | 'countOvershoot'  // consistently counting too high
  | 'countUndershoot' // consistently counting too low
  | 'trueCountError'  // true count conversion mistakes
  | 'deviationMiss'   // missed I18/Fab4 deviations
  | 'actionLeak'      // basic strategy errors
  | 'slowResponse'    // correct but too slow (>5s)

export interface ErrorExample {
  readonly handNumber: number
  readonly expected: string
  readonly actual: string
  readonly delta?: number
  readonly responseMs: number
}

export interface CategorizedError {
  readonly category: ErrorCategory
  readonly count: number
  readonly examples: ErrorExample[] // up to 5 most recent
  readonly severity: 'mild' | 'moderate' | 'severe'
}

export interface WeakSpotDrillConfig {
  readonly categories: ErrorCategory[]
  readonly problemCount: number
}

export interface WeakSpotProblem {
  readonly category: ErrorCategory
  readonly prompt: string
  readonly expectedAnswer: string
  readonly context: string
  readonly sourceHandNumber?: number
}

export interface WeakSpotAnswer {
  readonly problemIndex: number
  readonly answer: string
  readonly isCorrect: boolean
  readonly responseMs: number
}

export interface WeakSpotDrillState {
  readonly config: WeakSpotDrillConfig
  readonly problems: WeakSpotProblem[]
  readonly currentIndex: number
  readonly answers: WeakSpotAnswer[]
  readonly startTime: number
}

export interface WeakSpotDrillSummary {
  readonly totalProblems: number
  readonly correct: number
  readonly accuracy: number
  readonly avgResponseMs: number
  readonly improvementByCategory: Record<string, { before: number; after: number }>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLOW_RESPONSE_THRESHOLD_MS = 5000
const MAX_EXAMPLES = 5

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityFromCount(count: number): 'mild' | 'moderate' | 'severe' {
  if (count >= 5) return 'severe'
  if (count >= 3) return 'moderate'
  return 'mild'
}

function takeLast<T>(arr: T[], n: number): T[] {
  return arr.slice(-n)
}

// ---------------------------------------------------------------------------
// categorizeErrors
// ---------------------------------------------------------------------------

export function categorizeErrors(
  countChecks: readonly CountCheck[],
  actionFeedback: readonly ActionFeedback[],
): CategorizedError[] {
  const overshootExamples: ErrorExample[] = []
  const undershootExamples: ErrorExample[] = []
  const trueCountExamples: ErrorExample[] = []
  const slowExamples: ErrorExample[] = []

  for (const check of countChecks) {
    const promptType = check.promptType ?? 'runningCount'

    // Slow response (correct but slow)
    if (check.isCorrect && check.responseMs > SLOW_RESPONSE_THRESHOLD_MS) {
      slowExamples.push({
        handNumber: check.handNumber,
        expected: String(check.expectedCount),
        actual: String(check.enteredCount),
        responseMs: check.responseMs,
      })
      continue
    }

    if (check.isCorrect) continue

    // bestAction prompts are handled via actionFeedback, skip here
    if (promptType === 'bestAction') continue

    if (promptType === 'trueCount') {
      trueCountExamples.push({
        handNumber: check.handNumber,
        expected: String(check.expectedCount),
        actual: String(check.enteredCount),
        delta: check.delta,
        responseMs: check.responseMs,
      })
    } else {
      // runningCount errors: classify by delta sign
      if (check.delta > 0) {
        overshootExamples.push({
          handNumber: check.handNumber,
          expected: String(check.expectedCount),
          actual: String(check.enteredCount),
          delta: check.delta,
          responseMs: check.responseMs,
        })
      } else if (check.delta < 0) {
        undershootExamples.push({
          handNumber: check.handNumber,
          expected: String(check.expectedCount),
          actual: String(check.enteredCount),
          delta: check.delta,
          responseMs: check.responseMs,
        })
      }
    }
  }

  // Action feedback: deviation misses vs general action leaks
  const deviationMissExamples: ErrorExample[] = []
  const actionLeakExamples: ErrorExample[] = []

  for (let i = 0; i < actionFeedback.length; i++) {
    const fb = actionFeedback[i]!
    if (fb.isCorrect) continue

    const example: ErrorExample = {
      handNumber: i + 1, // use 1-based index as proxy hand number
      expected: fb.recommendedAction,
      actual: fb.chosenAction,
      responseMs: 0,
    }

    if (fb.deviationName !== null) {
      deviationMissExamples.push(example)
    } else {
      actionLeakExamples.push(example)
    }
  }

  const categories: CategorizedError[] = []

  const addCategory = (
    category: ErrorCategory,
    examples: ErrorExample[],
  ) => {
    if (examples.length === 0) return
    categories.push({
      category,
      count: examples.length,
      examples: takeLast(examples, MAX_EXAMPLES),
      severity: severityFromCount(examples.length),
    })
  }

  addCategory('countOvershoot', overshootExamples)
  addCategory('countUndershoot', undershootExamples)
  addCategory('trueCountError', trueCountExamples)
  addCategory('deviationMiss', deviationMissExamples)
  addCategory('actionLeak', actionLeakExamples)
  addCategory('slowResponse', slowExamples)

  return categories
}

// ---------------------------------------------------------------------------
// generateDrillProblems
// ---------------------------------------------------------------------------

function generatePromptForCategory(
  category: ErrorCategory,
  example: ErrorExample,
): Pick<WeakSpotProblem, 'prompt' | 'expectedAnswer' | 'context'> {
  switch (category) {
    case 'countOvershoot':
      return {
        prompt: `What is the running count? (You previously answered ${example.actual} instead of ${example.expected})`,
        expectedAnswer: example.expected,
        context: `Hand #${example.handNumber}: You overshot by +${example.delta}`,
      }
    case 'countUndershoot':
      return {
        prompt: `What is the running count? (You previously answered ${example.actual} instead of ${example.expected})`,
        expectedAnswer: example.expected,
        context: `Hand #${example.handNumber}: You undershot by ${example.delta}`,
      }
    case 'trueCountError':
      return {
        prompt: `What is the true count? (You previously answered ${example.actual} instead of ${example.expected})`,
        expectedAnswer: example.expected,
        context: `Hand #${example.handNumber}: True count conversion error, delta ${example.delta}`,
      }
    case 'deviationMiss':
      return {
        prompt: `What is the correct play? (You chose ${example.actual} instead of ${example.expected})`,
        expectedAnswer: example.expected,
        context: `Hand #${example.handNumber}: Missed deviation — correct play was ${example.expected}`,
      }
    case 'actionLeak':
      return {
        prompt: `What is the correct basic strategy play? (You chose ${example.actual} instead of ${example.expected})`,
        expectedAnswer: example.expected,
        context: `Hand #${example.handNumber}: Basic strategy error — correct play was ${example.expected}`,
      }
    case 'slowResponse':
      return {
        prompt: `What is the count? (You answered correctly but took ${(example.responseMs / 1000).toFixed(1)}s)`,
        expectedAnswer: example.expected,
        context: `Hand #${example.handNumber}: Correct answer but response time was ${(example.responseMs / 1000).toFixed(1)}s (target: <5s)`,
      }
  }
}

export function generateDrillProblems(
  errors: readonly CategorizedError[],
  config: WeakSpotDrillConfig,
): WeakSpotProblem[] {
  // Filter to only the targeted categories
  const targeted = errors.filter((e) => config.categories.includes(e.category))
  if (targeted.length === 0) return []

  // Weight by severity: severe=3, moderate=2, mild=1
  const severityWeight = { severe: 3, moderate: 2, mild: 1 } as const
  const totalWeight = targeted.reduce((sum, e) => sum + severityWeight[e.severity], 0)

  // Distribute problems proportionally to severity weight
  const problems: WeakSpotProblem[] = []
  let remaining = config.problemCount

  for (let i = 0; i < targeted.length; i++) {
    const error = targeted[i]!
    const weight = severityWeight[error.severity]
    const isLast = i === targeted.length - 1

    // Give proportional share, last category gets the remainder
    const share = isLast
      ? remaining
      : Math.max(1, Math.round((weight / totalWeight) * config.problemCount))

    const count = Math.min(share, remaining)
    if (count <= 0) continue

    // Generate problems by cycling through examples
    for (let j = 0; j < count; j++) {
      const example = error.examples[j % error.examples.length]!
      const { prompt, expectedAnswer, context } = generatePromptForCategory(
        error.category,
        example,
      )
      problems.push({
        category: error.category,
        prompt,
        expectedAnswer,
        context,
        sourceHandNumber: example.handNumber,
      })
    }

    remaining -= count
    if (remaining <= 0) break
  }

  return problems
}

// ---------------------------------------------------------------------------
// createWeakSpotDrill
// ---------------------------------------------------------------------------

export function createWeakSpotDrill(
  countChecks: readonly CountCheck[],
  actionFeedback: readonly ActionFeedback[],
  config?: Partial<WeakSpotDrillConfig>,
): WeakSpotDrillState | null {
  const errors = categorizeErrors(countChecks, actionFeedback)
  if (errors.length === 0) return null

  const fullConfig: WeakSpotDrillConfig = {
    categories: config?.categories ?? errors.map((e) => e.category),
    problemCount: config?.problemCount ?? 10,
  }

  const problems = generateDrillProblems(errors, fullConfig)
  if (problems.length === 0) return null

  return {
    config: fullConfig,
    problems,
    currentIndex: 0,
    answers: [],
    startTime: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// submitWeakSpotAnswer
// ---------------------------------------------------------------------------

export function submitWeakSpotAnswer(
  state: WeakSpotDrillState,
  answer: string,
  responseMs: number,
): WeakSpotDrillState {
  const problem = state.problems[state.currentIndex]
  if (!problem) return state

  const isCorrect = answer === problem.expectedAnswer

  const newAnswer: WeakSpotAnswer = {
    problemIndex: state.currentIndex,
    answer,
    isCorrect,
    responseMs,
  }

  return {
    ...state,
    currentIndex: state.currentIndex + 1,
    answers: [...state.answers, newAnswer],
  }
}

// ---------------------------------------------------------------------------
// computeWeakSpotDrillSummary
// ---------------------------------------------------------------------------

export function computeWeakSpotDrillSummary(
  state: WeakSpotDrillState,
): WeakSpotDrillSummary {
  const total = state.answers.length
  if (total === 0) {
    return {
      totalProblems: state.problems.length,
      correct: 0,
      accuracy: 0,
      avgResponseMs: 0,
      improvementByCategory: {},
    }
  }

  const correct = state.answers.filter((a) => a.isCorrect).length
  const accuracy = (correct / total) * 100
  const avgResponseMs = state.answers.reduce((s, a) => s + a.responseMs, 0) / total

  // Compute improvement by category
  const improvementByCategory: Record<string, { before: number; after: number }> = {}

  // Group answers by the category of their corresponding problem
  const categoryAnswers = new Map<ErrorCategory, WeakSpotAnswer[]>()
  for (const answer of state.answers) {
    const problem = state.problems[answer.problemIndex]
    if (!problem) continue
    const list = categoryAnswers.get(problem.category) ?? []
    list.push(answer)
    categoryAnswers.set(problem.category, list)
  }

  // "Before" accuracy is 0% for all categories (they were all errors originally)
  // "After" accuracy is how well they did in the drill
  for (const [category, answers] of categoryAnswers) {
    const catCorrect = answers.filter((a) => a.isCorrect).length
    const catAccuracy = (catCorrect / answers.length) * 100
    improvementByCategory[category] = {
      before: 0,
      after: catAccuracy,
    }
  }

  return {
    totalProblems: state.problems.length,
    correct,
    accuracy,
    avgResponseMs,
    improvementByCategory,
  }
}
