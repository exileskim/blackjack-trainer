import { describe, it, expect } from 'vitest'
import {
  createMissReplay,
  submitMissReplayAnswer,
  missReplaySummary,
} from './missReplay.ts'
import type { CountCheck } from '@/modules/domain/types.ts'

function makeCheck(expected: number, entered: number, hand: number): CountCheck {
  return {
    sessionId: 'test',
    handNumber: hand,
    expectedCount: expected,
    enteredCount: entered,
    responseMs: 1500,
    isCorrect: expected === entered,
    delta: entered - expected,
    createdAt: '2024-01-01T00:00:00Z',
  }
}

describe('createMissReplay', () => {
  it('returns null when no misses exist', () => {
    const checks = [makeCheck(2, 2, 1), makeCheck(3, 3, 2)]
    expect(createMissReplay(checks)).toBeNull()
  })

  it('creates problems from misses only', () => {
    const checks = [
      makeCheck(2, 2, 1), // correct
      makeCheck(3, 5, 2), // miss
      makeCheck(4, 4, 3), // correct
      makeCheck(-1, 1, 4), // miss
    ]
    const state = createMissReplay(checks)!
    expect(state.problems).toHaveLength(2)
    expect(state.problems[0]!.expectedCount).toBe(3)
    expect(state.problems[0]!.userPreviousAnswer).toBe(5)
    expect(state.problems[1]!.expectedCount).toBe(-1)
  })

  it('ignores best-action misses', () => {
    const checks: CountCheck[] = [
      makeCheck(3, 5, 1),
      {
        sessionId: 'test',
        handNumber: 2,
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
    const state = createMissReplay(checks)!
    expect(state.problems).toHaveLength(1)
    expect(state.problems[0]!.handNumber).toBe(1)
  })
})

describe('submitMissReplayAnswer', () => {
  it('records correct answers', () => {
    const checks = [makeCheck(3, 5, 2)]
    let state = createMissReplay(checks)!

    state = submitMissReplayAnswer(state, 3, 800)
    expect(state.answers).toHaveLength(1)
    expect(state.answers[0]!.isCorrect).toBe(true)
    expect(state.currentIndex).toBe(1)
  })

  it('records incorrect answers', () => {
    const checks = [makeCheck(3, 5, 2)]
    let state = createMissReplay(checks)!

    state = submitMissReplayAnswer(state, 4, 1200)
    expect(state.answers[0]!.isCorrect).toBe(false)
  })
})

describe('missReplaySummary', () => {
  it('returns zero summary for empty answers', () => {
    const checks = [makeCheck(3, 5, 2)]
    const state = createMissReplay(checks)!
    const summary = missReplaySummary(state)
    expect(summary.total).toBe(0)
    expect(summary.accuracy).toBe(0)
  })

  it('computes correct summary', () => {
    const checks = [
      makeCheck(3, 5, 1),
      makeCheck(-1, 1, 2),
      makeCheck(7, 4, 3),
    ]
    let state = createMissReplay(checks)!
    state = submitMissReplayAnswer(state, 3, 800) // correct
    state = submitMissReplayAnswer(state, -1, 1000) // correct
    state = submitMissReplayAnswer(state, 5, 600) // wrong

    const summary = missReplaySummary(state)
    expect(summary.total).toBe(3)
    expect(summary.correct).toBe(2)
    expect(summary.accuracy).toBeCloseTo(66.67, 0)
    expect(summary.improved).toBe(2)
    expect(summary.avgResponseMs).toBe(800)
  })
})
