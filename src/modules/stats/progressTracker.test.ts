import { describe, it, expect } from 'vitest'
import { computeProgress } from './progressTracker.ts'
import type { SessionRecord } from '@/modules/persistence/repository.ts'
import type { RuleConfig } from '@/modules/domain/types.ts'

const defaultRules: RuleConfig = {
  decks: 6,
  dealerHitsSoft17: true,
  doubleAfterSplit: true,
  surrenderAllowed: false,
  penetration: 0.75,
  dealSpeed: 'normal',
}

function makeSession(opts: {
  sessionId?: string
  startedAt?: string
  endedAt?: string
  handsPlayed?: number
  accuracy?: number
  avgResponseMs?: number
  totalPrompts?: number
  correctPrompts?: number
  longestStreak?: number
}): SessionRecord {
  const accuracy = opts.accuracy ?? 80
  const totalPrompts = opts.totalPrompts ?? 10
  const correctPrompts = opts.correctPrompts ?? Math.round((accuracy / 100) * totalPrompts)
  return {
    sessionId: opts.sessionId ?? 'session-1',
    mode: 'countingDrill',
    ruleConfig: defaultRules,
    startedAt: opts.startedAt ?? '2024-01-01T10:00:00Z',
    endedAt: opts.endedAt ?? '2024-01-01T10:30:00Z',
    handsPlayed: opts.handsPlayed ?? 20,
    countChecks: [],
    summary: {
      totalPrompts,
      correctPrompts,
      accuracy,
      avgResponseMs: opts.avgResponseMs ?? 2000,
      longestStreak: opts.longestStreak ?? 5,
    },
  }
}

describe('computeProgress', () => {
  it('returns zeroed snapshot for empty history', () => {
    const result = computeProgress([])
    expect(result.sessions).toHaveLength(0)
    expect(result.recentAccuracy).toBe(0)
    expect(result.overallAccuracy).toBe(0)
    expect(result.recentSpeed).toBe(0)
    expect(result.overallSpeed).toBe(0)
    expect(result.accuracyDelta).toBe(0)
    expect(result.speedDelta).toBe(0)
    expect(result.currentStreak).toBe(0)
    expect(result.longestStreak).toBe(0)
    expect(result.records.bestAccuracy.value).toBe(0)
    expect(result.records.fastestSpeed.value).toBe(0)
    expect(result.records.longestCorrectStreak.value).toBe(0)
    expect(result.records.mostHands.value).toBe(0)
    expect(result.totalSessions).toBe(0)
  })

  it('computes overall accuracy from all sessions', () => {
    const sessions = [
      makeSession({ sessionId: 's1', accuracy: 60 }),
      makeSession({ sessionId: 's2', accuracy: 80 }),
      makeSession({ sessionId: 's3', accuracy: 100 }),
    ]
    const result = computeProgress(sessions)
    expect(result.overallAccuracy).toBe(80) // (60+80+100)/3
    expect(result.totalSessions).toBe(3)
  })

  it('computes recent accuracy from last 5 sessions only', () => {
    const sessions = [
      makeSession({ sessionId: 's1', accuracy: 20, startedAt: '2024-01-01T10:00:00Z' }),
      makeSession({ sessionId: 's2', accuracy: 20, startedAt: '2024-01-02T10:00:00Z' }),
      makeSession({ sessionId: 's3', accuracy: 20, startedAt: '2024-01-03T10:00:00Z' }),
      // Recent 5:
      makeSession({ sessionId: 's4', accuracy: 80, startedAt: '2024-01-04T10:00:00Z' }),
      makeSession({ sessionId: 's5', accuracy: 80, startedAt: '2024-01-05T10:00:00Z' }),
      makeSession({ sessionId: 's6', accuracy: 80, startedAt: '2024-01-06T10:00:00Z' }),
      makeSession({ sessionId: 's7', accuracy: 80, startedAt: '2024-01-07T10:00:00Z' }),
      makeSession({ sessionId: 's8', accuracy: 80, startedAt: '2024-01-08T10:00:00Z' }),
    ]
    const result = computeProgress(sessions)
    expect(result.recentAccuracy).toBe(80) // last 5 all 80
  })

  it('uses all sessions for recent when fewer than 5', () => {
    const sessions = [
      makeSession({ sessionId: 's1', accuracy: 60 }),
      makeSession({ sessionId: 's2', accuracy: 80 }),
    ]
    const result = computeProgress(sessions)
    expect(result.recentAccuracy).toBe(70) // (60+80)/2
  })

  it('computes positive accuracy delta when improving', () => {
    // Overall = 50, recent = 80 => delta = +30
    const sessions = [
      makeSession({ sessionId: 's1', accuracy: 20, startedAt: '2024-01-01T10:00:00Z' }),
      makeSession({ sessionId: 's2', accuracy: 20, startedAt: '2024-01-02T10:00:00Z' }),
      makeSession({ sessionId: 's3', accuracy: 20, startedAt: '2024-01-03T10:00:00Z' }),
      makeSession({ sessionId: 's4', accuracy: 20, startedAt: '2024-01-04T10:00:00Z' }),
      makeSession({ sessionId: 's5', accuracy: 20, startedAt: '2024-01-05T10:00:00Z' }),
      makeSession({ sessionId: 's6', accuracy: 80, startedAt: '2024-01-06T10:00:00Z' }),
      makeSession({ sessionId: 's7', accuracy: 80, startedAt: '2024-01-07T10:00:00Z' }),
      makeSession({ sessionId: 's8', accuracy: 80, startedAt: '2024-01-08T10:00:00Z' }),
      makeSession({ sessionId: 's9', accuracy: 80, startedAt: '2024-01-09T10:00:00Z' }),
      makeSession({ sessionId: 's10', accuracy: 80, startedAt: '2024-01-10T10:00:00Z' }),
    ]
    const result = computeProgress(sessions)
    expect(result.recentAccuracy).toBe(80)
    expect(result.overallAccuracy).toBe(50)
    expect(result.accuracyDelta).toBe(30) // recent - overall
  })

  it('computes positive speed delta when getting faster', () => {
    // Overall avg = 3000, recent = 1000 => speedDelta = overall - recent = 2000 (positive = improving)
    const sessions = [
      makeSession({ sessionId: 's1', avgResponseMs: 5000, startedAt: '2024-01-01T10:00:00Z' }),
      makeSession({ sessionId: 's2', avgResponseMs: 5000, startedAt: '2024-01-02T10:00:00Z' }),
      makeSession({ sessionId: 's3', avgResponseMs: 5000, startedAt: '2024-01-03T10:00:00Z' }),
      makeSession({ sessionId: 's4', avgResponseMs: 5000, startedAt: '2024-01-04T10:00:00Z' }),
      makeSession({ sessionId: 's5', avgResponseMs: 5000, startedAt: '2024-01-05T10:00:00Z' }),
      makeSession({ sessionId: 's6', avgResponseMs: 1000, startedAt: '2024-01-06T10:00:00Z' }),
      makeSession({ sessionId: 's7', avgResponseMs: 1000, startedAt: '2024-01-07T10:00:00Z' }),
      makeSession({ sessionId: 's8', avgResponseMs: 1000, startedAt: '2024-01-08T10:00:00Z' }),
      makeSession({ sessionId: 's9', avgResponseMs: 1000, startedAt: '2024-01-09T10:00:00Z' }),
      makeSession({ sessionId: 's10', avgResponseMs: 1000, startedAt: '2024-01-10T10:00:00Z' }),
    ]
    const result = computeProgress(sessions)
    expect(result.recentSpeed).toBe(1000)
    expect(result.overallSpeed).toBe(3000)
    expect(result.speedDelta).toBe(2000) // overall - recent (positive = improving)
  })

  it('computes negative speed delta when getting slower', () => {
    const sessions = [
      makeSession({ sessionId: 's1', avgResponseMs: 1000, startedAt: '2024-01-01T10:00:00Z' }),
      makeSession({ sessionId: 's2', avgResponseMs: 1000, startedAt: '2024-01-02T10:00:00Z' }),
      makeSession({ sessionId: 's3', avgResponseMs: 1000, startedAt: '2024-01-03T10:00:00Z' }),
      makeSession({ sessionId: 's4', avgResponseMs: 1000, startedAt: '2024-01-04T10:00:00Z' }),
      makeSession({ sessionId: 's5', avgResponseMs: 1000, startedAt: '2024-01-05T10:00:00Z' }),
      makeSession({ sessionId: 's6', avgResponseMs: 5000, startedAt: '2024-01-06T10:00:00Z' }),
      makeSession({ sessionId: 's7', avgResponseMs: 5000, startedAt: '2024-01-07T10:00:00Z' }),
      makeSession({ sessionId: 's8', avgResponseMs: 5000, startedAt: '2024-01-08T10:00:00Z' }),
      makeSession({ sessionId: 's9', avgResponseMs: 5000, startedAt: '2024-01-09T10:00:00Z' }),
      makeSession({ sessionId: 's10', avgResponseMs: 5000, startedAt: '2024-01-10T10:00:00Z' }),
    ]
    const result = computeProgress(sessions)
    expect(result.speedDelta).toBe(-2000) // overall - recent = 3000 - 5000
  })

  describe('practice streaks', () => {
    it('counts consecutive calendar days ending today', () => {
      const now = new Date('2024-01-05T15:00:00Z')
      const sessions = [
        makeSession({ sessionId: 's1', startedAt: '2024-01-03T10:00:00Z' }),
        makeSession({ sessionId: 's2', startedAt: '2024-01-04T10:00:00Z' }),
        makeSession({ sessionId: 's3', startedAt: '2024-01-05T10:00:00Z' }),
      ]
      const result = computeProgress(sessions, now)
      expect(result.currentStreak).toBe(3)
    })

    it('counts consecutive calendar days ending yesterday', () => {
      const now = new Date('2024-01-06T15:00:00Z')
      const sessions = [
        makeSession({ sessionId: 's1', startedAt: '2024-01-03T10:00:00Z' }),
        makeSession({ sessionId: 's2', startedAt: '2024-01-04T10:00:00Z' }),
        makeSession({ sessionId: 's3', startedAt: '2024-01-05T10:00:00Z' }),
      ]
      const result = computeProgress(sessions, now)
      expect(result.currentStreak).toBe(3)
    })

    it('breaks streak on gap day', () => {
      const now = new Date('2024-01-05T15:00:00Z')
      const sessions = [
        makeSession({ sessionId: 's1', startedAt: '2024-01-01T10:00:00Z' }),
        // gap on Jan 2
        makeSession({ sessionId: 's2', startedAt: '2024-01-03T10:00:00Z' }),
        makeSession({ sessionId: 's3', startedAt: '2024-01-04T10:00:00Z' }),
        makeSession({ sessionId: 's4', startedAt: '2024-01-05T10:00:00Z' }),
      ]
      const result = computeProgress(sessions, now)
      expect(result.currentStreak).toBe(3) // Jan 3, 4, 5
    })

    it('returns 0 streak when last session was more than 1 day ago', () => {
      const now = new Date('2024-01-10T15:00:00Z')
      const sessions = [
        makeSession({ sessionId: 's1', startedAt: '2024-01-05T10:00:00Z' }),
      ]
      const result = computeProgress(sessions, now)
      expect(result.currentStreak).toBe(0)
    })

    it('counts multiple sessions on same day as 1 streak day', () => {
      const now = new Date('2024-01-03T15:00:00Z')
      const sessions = [
        makeSession({ sessionId: 's1', startedAt: '2024-01-02T09:00:00Z' }),
        makeSession({ sessionId: 's2', startedAt: '2024-01-02T14:00:00Z' }),
        makeSession({ sessionId: 's3', startedAt: '2024-01-03T10:00:00Z' }),
      ]
      const result = computeProgress(sessions, now)
      expect(result.currentStreak).toBe(2) // Jan 2, Jan 3
    })

    it('tracks longest streak across all history', () => {
      const now = new Date('2024-01-10T15:00:00Z')
      const sessions = [
        // 5-day streak early on
        makeSession({ sessionId: 's1', startedAt: '2024-01-01T10:00:00Z' }),
        makeSession({ sessionId: 's2', startedAt: '2024-01-02T10:00:00Z' }),
        makeSession({ sessionId: 's3', startedAt: '2024-01-03T10:00:00Z' }),
        makeSession({ sessionId: 's4', startedAt: '2024-01-04T10:00:00Z' }),
        makeSession({ sessionId: 's5', startedAt: '2024-01-05T10:00:00Z' }),
        // gap on Jan 6
        // 2-day streak
        makeSession({ sessionId: 's6', startedAt: '2024-01-09T10:00:00Z' }),
        makeSession({ sessionId: 's7', startedAt: '2024-01-10T10:00:00Z' }),
      ]
      const result = computeProgress(sessions, now)
      expect(result.currentStreak).toBe(2)
      expect(result.longestStreak).toBe(5)
    })
  })

  describe('personal records', () => {
    it('tracks best accuracy record', () => {
      const sessions = [
        makeSession({ sessionId: 's1', accuracy: 70, startedAt: '2024-01-01T10:00:00Z' }),
        makeSession({ sessionId: 's2', accuracy: 95, startedAt: '2024-01-02T10:00:00Z' }),
        makeSession({ sessionId: 's3', accuracy: 80, startedAt: '2024-01-03T10:00:00Z' }),
      ]
      const result = computeProgress(sessions)
      expect(result.records.bestAccuracy.value).toBe(95)
      expect(result.records.bestAccuracy.sessionId).toBe('s2')
    })

    it('tracks fastest speed record (lower is better)', () => {
      const sessions = [
        makeSession({ sessionId: 's1', avgResponseMs: 3000, startedAt: '2024-01-01T10:00:00Z' }),
        makeSession({ sessionId: 's2', avgResponseMs: 1200, startedAt: '2024-01-02T10:00:00Z' }),
        makeSession({ sessionId: 's3', avgResponseMs: 2000, startedAt: '2024-01-03T10:00:00Z' }),
      ]
      const result = computeProgress(sessions)
      expect(result.records.fastestSpeed.value).toBe(1200)
      expect(result.records.fastestSpeed.sessionId).toBe('s2')
    })

    it('excludes sessions with 0 prompts from speed record', () => {
      const sessions = [
        makeSession({ sessionId: 's1', avgResponseMs: 500, totalPrompts: 0, startedAt: '2024-01-01T10:00:00Z' }),
        makeSession({ sessionId: 's2', avgResponseMs: 2000, totalPrompts: 5, startedAt: '2024-01-02T10:00:00Z' }),
      ]
      const result = computeProgress(sessions)
      expect(result.records.fastestSpeed.value).toBe(2000)
      expect(result.records.fastestSpeed.sessionId).toBe('s2')
    })

    it('tracks longest correct streak record', () => {
      const sessions = [
        makeSession({ sessionId: 's1', longestStreak: 5, startedAt: '2024-01-01T10:00:00Z' }),
        makeSession({ sessionId: 's2', longestStreak: 12, startedAt: '2024-01-02T10:00:00Z' }),
        makeSession({ sessionId: 's3', longestStreak: 8, startedAt: '2024-01-03T10:00:00Z' }),
      ]
      const result = computeProgress(sessions)
      expect(result.records.longestCorrectStreak.value).toBe(12)
      expect(result.records.longestCorrectStreak.sessionId).toBe('s2')
    })

    it('tracks most hands record', () => {
      const sessions = [
        makeSession({ sessionId: 's1', handsPlayed: 30, startedAt: '2024-01-01T10:00:00Z' }),
        makeSession({ sessionId: 's2', handsPlayed: 50, startedAt: '2024-01-02T10:00:00Z' }),
        makeSession({ sessionId: 's3', handsPlayed: 25, startedAt: '2024-01-03T10:00:00Z' }),
      ]
      const result = computeProgress(sessions)
      expect(result.records.mostHands.value).toBe(50)
      expect(result.records.mostHands.sessionId).toBe('s2')
    })

    it('includes date in personal records', () => {
      const sessions = [
        makeSession({ sessionId: 's1', accuracy: 95, startedAt: '2024-03-15T14:00:00Z' }),
      ]
      const result = computeProgress(sessions)
      expect(result.records.bestAccuracy.date).toBe('2024-03-15')
    })
  })

  describe('session trend data', () => {
    it('sorts sessions chronologically', () => {
      const sessions = [
        makeSession({ sessionId: 's3', accuracy: 90, startedAt: '2024-01-03T10:00:00Z' }),
        makeSession({ sessionId: 's1', accuracy: 70, startedAt: '2024-01-01T10:00:00Z' }),
        makeSession({ sessionId: 's2', accuracy: 80, startedAt: '2024-01-02T10:00:00Z' }),
      ]
      const result = computeProgress(sessions)
      expect(result.sessions).toHaveLength(3)
      expect(result.sessions[0].accuracy).toBe(70)
      expect(result.sessions[1].accuracy).toBe(80)
      expect(result.sessions[2].accuracy).toBe(90)
    })

    it('maps trend points correctly', () => {
      const sessions = [
        makeSession({
          sessionId: 's1',
          accuracy: 85,
          avgResponseMs: 1500,
          handsPlayed: 25,
          startedAt: '2024-02-10T09:00:00Z',
        }),
      ]
      const result = computeProgress(sessions)
      expect(result.sessions[0]).toEqual({
        date: '2024-02-10',
        accuracy: 85,
        avgResponseMs: 1500,
        hands: 25,
      })
    })
  })
})
