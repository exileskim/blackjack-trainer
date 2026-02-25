import { describe, it, expect } from 'vitest'
import { analyzeWeakSpots, recentMissRate } from './weakSpotAnalyzer.ts'
import type { CountCheck } from '@/modules/domain/types.ts'

function makeCheck(opts: {
  expectedCount: number
  enteredCount: number
  handNumber?: number
  responseMs?: number
}): CountCheck {
  const delta = opts.enteredCount - opts.expectedCount
  return {
    sessionId: 'test',
    handNumber: opts.handNumber ?? 1,
    expectedCount: opts.expectedCount,
    enteredCount: opts.enteredCount,
    responseMs: opts.responseMs ?? 1500,
    isCorrect: delta === 0,
    delta,
    createdAt: '2024-01-01T00:00:00Z',
  }
}

describe('analyzeWeakSpots', () => {
  it('returns empty insights for no checks', () => {
    const report = analyzeWeakSpots([])
    expect(report.insights).toHaveLength(0)
    expect(report.recentAccuracy).toBe(0)
  })

  it('detects high accuracy', () => {
    const checks = Array.from({ length: 10 }, (_, i) =>
      makeCheck({ expectedCount: i, enteredCount: i, handNumber: i + 1 }),
    )
    const report = analyzeWeakSpots(checks)
    expect(report.insights.find((i) => i.type === 'accuracy')?.severity).toBe('info')
    expect(report.recentAccuracy).toBe(100)
  })

  it('detects low accuracy', () => {
    const checks = Array.from({ length: 10 }, (_, i) =>
      makeCheck({ expectedCount: i, enteredCount: i + 3, handNumber: i + 1 }),
    )
    const report = analyzeWeakSpots(checks)
    expect(report.insights.find((i) => i.type === 'accuracy')?.severity).toBe('critical')
  })

  it('detects overshoot bias', () => {
    const checks = [
      makeCheck({ expectedCount: 2, enteredCount: 5, handNumber: 1 }),
      makeCheck({ expectedCount: -1, enteredCount: 2, handNumber: 2 }),
      makeCheck({ expectedCount: 3, enteredCount: 6, handNumber: 3 }),
      makeCheck({ expectedCount: 0, enteredCount: 0, handNumber: 4 }),
      makeCheck({ expectedCount: 1, enteredCount: 4, handNumber: 5 }),
    ]
    const report = analyzeWeakSpots(checks)
    expect(report.overallBias).toBeGreaterThan(1.5)
    expect(report.insights.find((i) => i.type === 'overshoot')).toBeDefined()
  })

  it('detects undershoot bias', () => {
    const checks = [
      makeCheck({ expectedCount: 5, enteredCount: 2, handNumber: 1 }),
      makeCheck({ expectedCount: 3, enteredCount: 0, handNumber: 2 }),
      makeCheck({ expectedCount: 4, enteredCount: 1, handNumber: 3 }),
      makeCheck({ expectedCount: 0, enteredCount: 0, handNumber: 4 }),
      makeCheck({ expectedCount: 2, enteredCount: -1, handNumber: 5 }),
    ]
    const report = analyzeWeakSpots(checks)
    expect(report.overallBias).toBeLessThan(-1.5)
    expect(report.insights.find((i) => i.type === 'undershoot')).toBeDefined()
  })

  it('detects fatigue dropoff', () => {
    // First half: 100% correct
    const firstHalf = Array.from({ length: 6 }, (_, i) =>
      makeCheck({ expectedCount: i, enteredCount: i, handNumber: i + 1 }),
    )
    // Second half: mostly wrong
    const secondHalf = Array.from({ length: 6 }, (_, i) =>
      makeCheck({ expectedCount: i, enteredCount: i + 3, handNumber: i + 7 }),
    )
    const report = analyzeWeakSpots([...firstHalf, ...secondHalf])
    expect(report.fatigueDropoff).toBe(true)
    expect(report.insights.find((i) => i.type === 'fatigue')).toBeDefined()
  })

  it('detects high-count struggles', () => {
    // Easy at low counts, bad at high counts
    const lowCount = Array.from({ length: 8 }, (_, i) =>
      makeCheck({ expectedCount: i % 3, enteredCount: i % 3, handNumber: i + 1 }),
    )
    const highCount = [
      makeCheck({ expectedCount: 5, enteredCount: 3, handNumber: 9 }),
      makeCheck({ expectedCount: -6, enteredCount: -3, handNumber: 10 }),
      makeCheck({ expectedCount: 7, enteredCount: 4, handNumber: 11 }),
      makeCheck({ expectedCount: -5, enteredCount: -2, handNumber: 12 }),
    ]
    const report = analyzeWeakSpots([...lowCount, ...highCount])
    expect(report.insights.find((i) => i.type === 'highCount')).toBeDefined()
  })

  it('ignores best-action prompts in count analysis', () => {
    const checks: CountCheck[] = [
      makeCheck({ expectedCount: 1, enteredCount: 1, handNumber: 1 }),
      makeCheck({ expectedCount: 2, enteredCount: 5, handNumber: 2 }),
      {
        sessionId: 'test',
        handNumber: 3,
        promptType: 'bestAction',
        expectedCount: 0,
        enteredCount: 0,
        expectedAction: 'stand',
        enteredAction: 'hit',
        responseMs: 1000,
        isCorrect: false,
        delta: 0,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]
    const report = analyzeWeakSpots(checks)
    expect(report.recentAccuracy).toBe(50)
  })
})

describe('recentMissRate', () => {
  it('returns 0 for empty checks', () => {
    expect(recentMissRate([])).toBe(0)
  })

  it('returns correct rate for last 5', () => {
    const checks = [
      makeCheck({ expectedCount: 1, enteredCount: 1 }),
      makeCheck({ expectedCount: 2, enteredCount: 2 }),
      makeCheck({ expectedCount: 3, enteredCount: 0 }), // miss
      makeCheck({ expectedCount: 4, enteredCount: 4 }),
      makeCheck({ expectedCount: 5, enteredCount: 0 }), // miss
    ]
    expect(recentMissRate(checks, 5)).toBe(0.4)
  })

  it('only considers the window', () => {
    const old = Array.from({ length: 10 }, (_, i) =>
      makeCheck({ expectedCount: i, enteredCount: i + 5 }), // all wrong
    )
    const recent = Array.from({ length: 5 }, (_, i) =>
      makeCheck({ expectedCount: i, enteredCount: i }), // all correct
    )
    expect(recentMissRate([...old, ...recent], 5)).toBe(0)
  })

  it('ignores best-action prompts', () => {
    const checks: CountCheck[] = [
      makeCheck({ expectedCount: 1, enteredCount: 1 }),
      makeCheck({ expectedCount: 2, enteredCount: 6 }),
      {
        sessionId: 'test',
        handNumber: 3,
        promptType: 'bestAction',
        expectedCount: 0,
        enteredCount: 0,
        expectedAction: 'stand',
        enteredAction: 'hit',
        responseMs: 900,
        isCorrect: false,
        delta: 0,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]
    expect(recentMissRate(checks, 3)).toBe(0.5)
  })
})
