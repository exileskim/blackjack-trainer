import { describe, it, expect } from 'vitest'
import type { CountCheck } from '@/modules/domain/types.ts'
import type { ActionFeedback } from '@/modules/session/sessionStore.ts'
import {
  categorizeErrors,
  generateDrillProblems,
  createWeakSpotDrill,
  submitWeakSpotAnswer,
  computeWeakSpotDrillSummary,
  type CategorizedError,
  type WeakSpotDrillConfig,
} from './weakSpotDrill.ts'

function makeCountCheck(overrides: Partial<CountCheck> = {}): CountCheck {
  return {
    sessionId: 'test',
    handNumber: 1,
    expectedCount: 5,
    enteredCount: 5,
    responseMs: 2000,
    isCorrect: true,
    delta: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeFeedback(overrides: Partial<ActionFeedback> = {}): ActionFeedback {
  return {
    chosenAction: 'hit',
    recommendedAction: 'hit',
    isCorrect: true,
    deviationName: null,
    ...overrides,
  }
}

describe('categorizeErrors', () => {
  it('returns empty for all-correct checks', () => {
    const checks = [makeCountCheck(), makeCountCheck({ handNumber: 2 })]
    const result = categorizeErrors(checks, [])
    expect(result).toEqual([])
  })

  it('detects overshoot errors', () => {
    const checks = [
      makeCountCheck({ isCorrect: false, delta: 2, enteredCount: 7, handNumber: 1 }),
      makeCountCheck({ isCorrect: false, delta: 3, enteredCount: 8, handNumber: 2 }),
    ]
    const result = categorizeErrors(checks, [])
    const overshoot = result.find((r) => r.category === 'countOvershoot')
    expect(overshoot).toBeDefined()
    expect(overshoot!.count).toBe(2)
  })

  it('detects undershoot errors', () => {
    const checks = [
      makeCountCheck({ isCorrect: false, delta: -2, enteredCount: 3, handNumber: 1 }),
      makeCountCheck({ isCorrect: false, delta: -1, enteredCount: 4, handNumber: 2 }),
    ]
    const result = categorizeErrors(checks, [])
    const undershoot = result.find((r) => r.category === 'countUndershoot')
    expect(undershoot).toBeDefined()
    expect(undershoot!.count).toBe(2)
  })

  it('detects true count errors', () => {
    const checks = [
      makeCountCheck({
        promptType: 'trueCount',
        isCorrect: false,
        delta: 1,
        enteredCount: 3,
        expectedCount: 2,
        handNumber: 1,
      }),
    ]
    const result = categorizeErrors(checks, [])
    const tc = result.find((r) => r.category === 'trueCountError')
    expect(tc).toBeDefined()
    expect(tc!.count).toBe(1)
  })

  it('detects slow responses', () => {
    const checks = [
      makeCountCheck({ isCorrect: true, responseMs: 6000, handNumber: 1 }),
      makeCountCheck({ isCorrect: true, responseMs: 7000, handNumber: 2 }),
    ]
    const result = categorizeErrors(checks, [])
    const slow = result.find((r) => r.category === 'slowResponse')
    expect(slow).toBeDefined()
    expect(slow!.count).toBe(2)
  })

  it('detects deviation misses from action feedback', () => {
    const feedback = [
      makeFeedback({
        isCorrect: false,
        chosenAction: 'hit',
        recommendedAction: 'stand',
        deviationName: 'I18: 16vT',
      }),
    ]
    const result = categorizeErrors([], feedback)
    const devMiss = result.find((r) => r.category === 'deviationMiss')
    expect(devMiss).toBeDefined()
    expect(devMiss!.count).toBe(1)
  })

  it('detects basic strategy action leaks', () => {
    const feedback = [
      makeFeedback({
        isCorrect: false,
        chosenAction: 'hit',
        recommendedAction: 'double',
        deviationName: null,
      }),
    ]
    const result = categorizeErrors([], feedback)
    const leak = result.find((r) => r.category === 'actionLeak')
    expect(leak).toBeDefined()
    expect(leak!.count).toBe(1)
  })

  it('assigns severity based on error count', () => {
    const checks: CountCheck[] = []
    for (let i = 0; i < 6; i++) {
      checks.push(
        makeCountCheck({ isCorrect: false, delta: 2, enteredCount: 7, handNumber: i + 1 }),
      )
    }
    const result = categorizeErrors(checks, [])
    const overshoot = result.find((r) => r.category === 'countOvershoot')
    expect(overshoot!.severity).toBe('severe')
  })

  it('keeps at most 5 examples per category', () => {
    const checks: CountCheck[] = []
    for (let i = 0; i < 10; i++) {
      checks.push(
        makeCountCheck({ isCorrect: false, delta: 2, enteredCount: 7, handNumber: i + 1 }),
      )
    }
    const result = categorizeErrors(checks, [])
    const overshoot = result.find((r) => r.category === 'countOvershoot')
    expect(overshoot!.examples).toHaveLength(5)
  })

  it('skips bestAction prompt checks in count categories', () => {
    const checks = [
      makeCountCheck({
        promptType: 'bestAction',
        isCorrect: false,
        delta: 0,
        handNumber: 1,
      }),
    ]
    const result = categorizeErrors(checks, [])
    expect(result).toEqual([])
  })
})

describe('generateDrillProblems', () => {
  it('returns empty for no errors', () => {
    const problems = generateDrillProblems([], { categories: ['countOvershoot'], problemCount: 5 })
    expect(problems).toEqual([])
  })

  it('generates problems matching targeted categories', () => {
    const errors: CategorizedError[] = [
      {
        category: 'countOvershoot',
        count: 3,
        examples: [
          { handNumber: 1, expected: '5', actual: '7', delta: 2, responseMs: 2000 },
          { handNumber: 2, expected: '3', actual: '6', delta: 3, responseMs: 1500 },
        ],
        severity: 'moderate',
      },
    ]

    const config: WeakSpotDrillConfig = { categories: ['countOvershoot'], problemCount: 4 }
    const problems = generateDrillProblems(errors, config)

    expect(problems).toHaveLength(4)
    expect(problems.every((p) => p.category === 'countOvershoot')).toBe(true)
  })

  it('distributes problems by severity weight', () => {
    const errors: CategorizedError[] = [
      {
        category: 'countOvershoot',
        count: 5,
        examples: [{ handNumber: 1, expected: '5', actual: '7', delta: 2, responseMs: 2000 }],
        severity: 'severe',
      },
      {
        category: 'slowResponse',
        count: 2,
        examples: [{ handNumber: 3, expected: '5', actual: '5', responseMs: 6000 }],
        severity: 'mild',
      },
    ]

    const config: WeakSpotDrillConfig = {
      categories: ['countOvershoot', 'slowResponse'],
      problemCount: 8,
    }
    const problems = generateDrillProblems(errors, config)

    expect(problems.length).toBeLessThanOrEqual(8)
    // Severe category should get more problems than mild
    const overshootCount = problems.filter((p) => p.category === 'countOvershoot').length
    const slowCount = problems.filter((p) => p.category === 'slowResponse').length
    expect(overshootCount).toBeGreaterThanOrEqual(slowCount)
  })
})

describe('createWeakSpotDrill', () => {
  it('returns null when no errors exist', () => {
    const result = createWeakSpotDrill([makeCountCheck()], [makeFeedback()])
    expect(result).toBeNull()
  })

  it('creates a drill from error data', () => {
    const checks = [
      makeCountCheck({ isCorrect: false, delta: 2, enteredCount: 7, handNumber: 1 }),
      makeCountCheck({ isCorrect: false, delta: 3, enteredCount: 8, handNumber: 2 }),
      makeCountCheck({ isCorrect: false, delta: 1, enteredCount: 6, handNumber: 3 }),
    ]
    const drill = createWeakSpotDrill(checks, [])
    expect(drill).not.toBeNull()
    expect(drill!.problems.length).toBeGreaterThan(0)
    expect(drill!.currentIndex).toBe(0)
    expect(drill!.answers).toEqual([])
  })

  it('respects custom config', () => {
    const checks = [
      makeCountCheck({ isCorrect: false, delta: 2, enteredCount: 7, handNumber: 1 }),
      makeCountCheck({ isCorrect: false, delta: 3, enteredCount: 8, handNumber: 2 }),
      makeCountCheck({ isCorrect: false, delta: -1, enteredCount: 4, handNumber: 3 }),
    ]
    const drill = createWeakSpotDrill(checks, [], {
      categories: ['countOvershoot'],
      problemCount: 3,
    })
    expect(drill).not.toBeNull()
    expect(drill!.problems.every((p) => p.category === 'countOvershoot')).toBe(true)
  })
})

describe('submitWeakSpotAnswer', () => {
  it('records correct answer', () => {
    const checks = [
      makeCountCheck({ isCorrect: false, delta: 2, enteredCount: 7, handNumber: 1 }),
      makeCountCheck({ isCorrect: false, delta: 3, enteredCount: 8, handNumber: 2 }),
      makeCountCheck({ isCorrect: false, delta: 1, enteredCount: 6, handNumber: 3 }),
    ]
    let drill = createWeakSpotDrill(checks, [])!
    const expectedAnswer = drill.problems[0]!.expectedAnswer

    drill = submitWeakSpotAnswer(drill, expectedAnswer, 1500)
    expect(drill.currentIndex).toBe(1)
    expect(drill.answers).toHaveLength(1)
    expect(drill.answers[0]!.isCorrect).toBe(true)
  })

  it('records incorrect answer', () => {
    const checks = [
      makeCountCheck({ isCorrect: false, delta: 2, enteredCount: 7, handNumber: 1 }),
      makeCountCheck({ isCorrect: false, delta: 3, enteredCount: 8, handNumber: 2 }),
      makeCountCheck({ isCorrect: false, delta: 1, enteredCount: 6, handNumber: 3 }),
    ]
    let drill = createWeakSpotDrill(checks, [])!

    drill = submitWeakSpotAnswer(drill, 'wrong_answer', 2000)
    expect(drill.answers[0]!.isCorrect).toBe(false)
  })
})

describe('computeWeakSpotDrillSummary', () => {
  it('returns zeroes for no answers', () => {
    const checks = [
      makeCountCheck({ isCorrect: false, delta: 2, enteredCount: 7, handNumber: 1 }),
      makeCountCheck({ isCorrect: false, delta: 3, enteredCount: 8, handNumber: 2 }),
      makeCountCheck({ isCorrect: false, delta: 1, enteredCount: 6, handNumber: 3 }),
    ]
    const drill = createWeakSpotDrill(checks, [])!
    const summary = computeWeakSpotDrillSummary(drill)

    expect(summary.correct).toBe(0)
    expect(summary.accuracy).toBe(0)
    expect(summary.avgResponseMs).toBe(0)
  })

  it('computes correct summary after answering', () => {
    const checks = [
      makeCountCheck({ isCorrect: false, delta: 2, enteredCount: 7, handNumber: 1 }),
      makeCountCheck({ isCorrect: false, delta: 3, enteredCount: 8, handNumber: 2 }),
      makeCountCheck({ isCorrect: false, delta: 1, enteredCount: 6, handNumber: 3 }),
    ]
    let drill = createWeakSpotDrill(checks, [], { problemCount: 3 })!

    // Answer all problems correctly
    for (let i = 0; i < drill.problems.length; i++) {
      drill = submitWeakSpotAnswer(drill, drill.problems[i]!.expectedAnswer, 1000)
    }

    const summary = computeWeakSpotDrillSummary(drill)
    expect(summary.correct).toBe(drill.problems.length)
    expect(summary.accuracy).toBe(100)
    expect(summary.avgResponseMs).toBe(1000)
  })
})
