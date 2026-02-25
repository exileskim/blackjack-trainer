import { describe, it, expect, beforeEach } from 'vitest'
import {
  MILESTONES,
  checkMilestones,
  loadMilestones,
  saveMilestones,
  type PersistedMilestones,
} from './milestones.ts'
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
  const correctPrompts =
    opts.correctPrompts ?? Math.round((accuracy / 100) * totalPrompts)
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

describe('MILESTONES', () => {
  it('has 13 milestones total', () => {
    expect(MILESTONES).toHaveLength(13)
  })

  it('has 4 bronze milestones', () => {
    expect(MILESTONES.filter((m) => m.tier === 'bronze')).toHaveLength(4)
  })

  it('has 4 silver milestones', () => {
    expect(MILESTONES.filter((m) => m.tier === 'silver')).toHaveLength(4)
  })

  it('has 5 gold milestones', () => {
    expect(MILESTONES.filter((m) => m.tier === 'gold')).toHaveLength(5)
  })

  it('has unique ids', () => {
    const ids = MILESTONES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('checkMilestones', () => {
  it('returns no unlocks for empty sessions', () => {
    const result = checkMilestones([], 0, [])
    expect(result.newlyUnlocked).toHaveLength(0)
  })

  it('returns progress map for all milestones even with empty sessions', () => {
    const result = checkMilestones([], 0, [])
    expect(result.progress.size).toBe(13)
  })

  describe('first_session', () => {
    it('unlocks after 1 session', () => {
      const sessions = [makeSession({})]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('first_session')
    })

    it('does not re-unlock if already unlocked', () => {
      const sessions = [makeSession({})]
      const result = checkMilestones(sessions, 0, ['first_session'])
      expect(result.newlyUnlocked).not.toContain('first_session')
    })

    it('reports progress as complete for first_session', () => {
      const sessions = [makeSession({})]
      const result = checkMilestones(sessions, 0, [])
      const progress = result.progress.get('first_session')!
      expect(progress.isComplete).toBe(true)
      expect(progress.current).toBe(1)
      expect(progress.target).toBe(1)
    })

    it('reports progress as incomplete with 0 sessions', () => {
      const result = checkMilestones([], 0, [])
      const progress = result.progress.get('first_session')!
      expect(progress.isComplete).toBe(false)
      expect(progress.current).toBe(0)
      expect(progress.target).toBe(1)
    })
  })

  describe('accuracy milestones', () => {
    it('unlocks accuracy_80 when a session has 80% accuracy', () => {
      const sessions = [makeSession({ accuracy: 80 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('accuracy_80')
    })

    it('does not unlock accuracy_80 at 79%', () => {
      const sessions = [makeSession({ accuracy: 79 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).not.toContain('accuracy_80')
    })

    it('unlocks accuracy_90 when a session has 90% accuracy', () => {
      const sessions = [makeSession({ accuracy: 90 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('accuracy_90')
    })

    it('does not unlock accuracy_90 at 89%', () => {
      const sessions = [makeSession({ accuracy: 89 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).not.toContain('accuracy_90')
    })

    it('unlocks accuracy_95 when a session has 95% accuracy', () => {
      const sessions = [makeSession({ accuracy: 95 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('accuracy_95')
    })

    it('does not unlock accuracy_95 at 94%', () => {
      const sessions = [makeSession({ accuracy: 94 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).not.toContain('accuracy_95')
    })

    it('uses best single session accuracy', () => {
      const sessions = [
        makeSession({ sessionId: 's1', accuracy: 50 }),
        makeSession({ sessionId: 's2', accuracy: 95 }),
        makeSession({ sessionId: 's3', accuracy: 60 }),
      ]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('accuracy_95')
    })

    it('reports accuracy progress correctly for locked milestone', () => {
      const sessions = [makeSession({ accuracy: 70 })]
      const result = checkMilestones(sessions, 0, [])
      const progress = result.progress.get('accuracy_80')!
      expect(progress.isComplete).toBe(false)
      expect(progress.current).toBe(70)
      expect(progress.target).toBe(80)
    })
  })

  describe('streak milestones', () => {
    it('unlocks streak_10 with longestStreak >= 10', () => {
      const sessions = [makeSession({ longestStreak: 10 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('streak_10')
    })

    it('does not unlock streak_10 with longestStreak 9', () => {
      const sessions = [makeSession({ longestStreak: 9 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).not.toContain('streak_10')
    })

    it('unlocks streak_25 with longestStreak >= 25', () => {
      const sessions = [makeSession({ longestStreak: 25 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('streak_25')
    })

    it('unlocks streak_50 with longestStreak >= 50', () => {
      const sessions = [makeSession({ longestStreak: 50 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('streak_50')
    })

    it('uses best single session longestStreak', () => {
      const sessions = [
        makeSession({ sessionId: 's1', longestStreak: 5 }),
        makeSession({ sessionId: 's2', longestStreak: 50 }),
        makeSession({ sessionId: 's3', longestStreak: 3 }),
      ]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('streak_50')
    })

    it('reports streak progress correctly for locked milestone', () => {
      const sessions = [makeSession({ longestStreak: 7 })]
      const result = checkMilestones(sessions, 0, [])
      const progress = result.progress.get('streak_10')!
      expect(progress.isComplete).toBe(false)
      expect(progress.current).toBe(7)
      expect(progress.target).toBe(10)
    })
  })

  describe('speed milestones', () => {
    it('unlocks speed_5s with avgResponseMs < 5000', () => {
      const sessions = [makeSession({ avgResponseMs: 4999 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('speed_5s')
    })

    it('does not unlock speed_5s at exactly 5000ms', () => {
      const sessions = [makeSession({ avgResponseMs: 5000 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).not.toContain('speed_5s')
    })

    it('unlocks speed_3s with avgResponseMs < 3000', () => {
      const sessions = [makeSession({ avgResponseMs: 2999 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('speed_3s')
    })

    it('unlocks speed_2s with avgResponseMs < 2000', () => {
      const sessions = [makeSession({ avgResponseMs: 1999 })]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('speed_2s')
    })

    it('uses best (lowest) avgResponseMs across sessions with prompts', () => {
      const sessions = [
        makeSession({ sessionId: 's1', avgResponseMs: 6000, totalPrompts: 10 }),
        makeSession({ sessionId: 's2', avgResponseMs: 1500, totalPrompts: 10 }),
        makeSession({ sessionId: 's3', avgResponseMs: 4000, totalPrompts: 10 }),
      ]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('speed_2s')
    })

    it('ignores sessions with 0 totalPrompts for speed milestones', () => {
      const sessions = [
        makeSession({ sessionId: 's1', avgResponseMs: 500, totalPrompts: 0 }),
        makeSession({ sessionId: 's2', avgResponseMs: 6000, totalPrompts: 10 }),
      ]
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).not.toContain('speed_5s')
    })

    it('reports speed progress correctly for locked milestone', () => {
      const sessions = [makeSession({ avgResponseMs: 4000, totalPrompts: 10 })]
      const result = checkMilestones(sessions, 0, [])
      const progress = result.progress.get('speed_3s')!
      expect(progress.isComplete).toBe(false)
      expect(progress.current).toBe(4000)
      expect(progress.target).toBe(3000)
    })
  })

  describe('practice streak milestones', () => {
    it('unlocks practice_7d with practiceStreak >= 7', () => {
      const result = checkMilestones([], 7, [])
      expect(result.newlyUnlocked).toContain('practice_7d')
    })

    it('does not unlock practice_7d with practiceStreak 6', () => {
      const result = checkMilestones([], 6, [])
      expect(result.newlyUnlocked).not.toContain('practice_7d')
    })

    it('unlocks practice_30d with practiceStreak >= 30', () => {
      const result = checkMilestones([], 30, [])
      expect(result.newlyUnlocked).toContain('practice_30d')
    })

    it('does not unlock practice_30d with practiceStreak 29', () => {
      const result = checkMilestones([], 29, [])
      expect(result.newlyUnlocked).not.toContain('practice_30d')
    })

    it('reports practice streak progress correctly', () => {
      const result = checkMilestones([], 5, [])
      const progress = result.progress.get('practice_7d')!
      expect(progress.isComplete).toBe(false)
      expect(progress.current).toBe(5)
      expect(progress.target).toBe(7)
    })
  })

  describe('sessions_50 milestone', () => {
    it('unlocks at 50 sessions', () => {
      const sessions = Array.from({ length: 50 }, (_, i) =>
        makeSession({ sessionId: `s${i}` }),
      )
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).toContain('sessions_50')
    })

    it('does not unlock at 49 sessions', () => {
      const sessions = Array.from({ length: 49 }, (_, i) =>
        makeSession({ sessionId: `s${i}` }),
      )
      const result = checkMilestones(sessions, 0, [])
      expect(result.newlyUnlocked).not.toContain('sessions_50')
    })

    it('reports progress correctly', () => {
      const sessions = Array.from({ length: 25 }, (_, i) =>
        makeSession({ sessionId: `s${i}` }),
      )
      const result = checkMilestones(sessions, 0, [])
      const progress = result.progress.get('sessions_50')!
      expect(progress.isComplete).toBe(false)
      expect(progress.current).toBe(25)
      expect(progress.target).toBe(50)
    })
  })

  describe('filtering already unlocked', () => {
    it('does not return already unlocked milestones in newlyUnlocked', () => {
      const sessions = [
        makeSession({ accuracy: 95, longestStreak: 50, avgResponseMs: 1500 }),
      ]
      const alreadyUnlocked = [
        'first_session',
        'accuracy_80',
        'accuracy_90',
        'accuracy_95',
      ]
      const result = checkMilestones(sessions, 0, alreadyUnlocked)
      expect(result.newlyUnlocked).not.toContain('first_session')
      expect(result.newlyUnlocked).not.toContain('accuracy_80')
      expect(result.newlyUnlocked).not.toContain('accuracy_90')
      expect(result.newlyUnlocked).not.toContain('accuracy_95')
      // But others that qualify should still be there
      expect(result.newlyUnlocked).toContain('streak_50')
      expect(result.newlyUnlocked).toContain('speed_2s')
    })

    it('still includes progress for already unlocked milestones', () => {
      const sessions = [makeSession({ accuracy: 95 })]
      const result = checkMilestones(sessions, 0, ['accuracy_95'])
      const progress = result.progress.get('accuracy_95')!
      expect(progress.isComplete).toBe(true)
    })
  })
})

describe('loadMilestones / saveMilestones', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty unlocked array when nothing stored', () => {
    const result = loadMilestones()
    expect(result.unlocked).toEqual([])
  })

  it('persists and loads milestones', () => {
    const data: PersistedMilestones = {
      unlocked: [{ id: 'first_session', unlockedAt: '2024-01-01T10:00:00Z' }],
    }
    saveMilestones(data)
    const loaded = loadMilestones()
    expect(loaded.unlocked).toHaveLength(1)
    expect(loaded.unlocked[0].id).toBe('first_session')
    expect(loaded.unlocked[0].unlockedAt).toBe('2024-01-01T10:00:00Z')
  })

  it('returns empty unlocked on corrupted data', () => {
    localStorage.setItem('bjt_milestones', 'not json')
    const result = loadMilestones()
    expect(result.unlocked).toEqual([])
  })
})
