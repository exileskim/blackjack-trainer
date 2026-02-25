# Progress Dashboard + Milestones Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Progress screen showing accuracy/speed trends over sessions, practice streak tracking, personal records, and auto-unlocking milestone achievements.

**Architecture:** Two pure domain modules (`progressTracker`, `milestones`) compute everything from existing `SessionRecord[]` data. One new `Sparkline` SVG component for trend visualization. One new `ProgressScreen` as an overlay route. Milestones persisted as a lightweight `bjt_milestones` localStorage key. Milestone check runs inside `endSession()` after saving the session record.

**Tech Stack:** React + TypeScript, Tailwind v4 (casino noir aesthetic), pure SVG sparklines, Zustand store integration, Vitest for tests.

---

### Task 1: progressTracker module — tests

**Files:**
- Create: `src/modules/stats/progressTracker.test.ts`

**Step 1: Write the tests**

```typescript
import { describe, it, expect } from 'vitest'
import { computeProgress, type ProgressSnapshot } from './progressTracker.ts'
import type { SessionRecord } from '@/modules/persistence/repository.ts'

function makeSession(overrides: Partial<SessionRecord> & { startedAt: string }): SessionRecord {
  return {
    sessionId: crypto.randomUUID(),
    mode: 'countingDrill',
    ruleConfig: {
      decks: 6,
      dealerHitsSoft17: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      penetration: 0.75,
      dealSpeed: 'normal',
    },
    endedAt: overrides.startedAt,
    handsPlayed: 20,
    countChecks: [],
    summary: {
      totalPrompts: 10,
      correctPrompts: 8,
      accuracy: 80,
      avgResponseMs: 3000,
      longestStreak: 5,
    },
    ...overrides,
  }
}

describe('computeProgress', () => {
  it('returns zeroed snapshot for empty history', () => {
    const snap = computeProgress([])
    expect(snap.totalSessions).toBe(0)
    expect(snap.recentAccuracy).toBe(0)
    expect(snap.overallAccuracy).toBe(0)
    expect(snap.currentStreak).toBe(0)
    expect(snap.sessions).toEqual([])
  })

  it('computes overall accuracy from all sessions', () => {
    const sessions = [
      makeSession({ startedAt: '2026-02-20T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 8, accuracy: 80, avgResponseMs: 3000, longestStreak: 5 } }),
      makeSession({ startedAt: '2026-02-21T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 10, accuracy: 100, avgResponseMs: 2000, longestStreak: 10 } }),
    ]
    const snap = computeProgress(sessions)
    expect(snap.overallAccuracy).toBe(90)
    expect(snap.totalSessions).toBe(2)
  })

  it('computes recent accuracy from last 5 sessions', () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({
        startedAt: `2026-02-${String(i + 10).padStart(2, '0')}T10:00:00Z`,
        summary: {
          totalPrompts: 10,
          correctPrompts: i < 5 ? 5 : 9,
          accuracy: i < 5 ? 50 : 90,
          avgResponseMs: 3000,
          longestStreak: 3,
        },
      }),
    )
    const snap = computeProgress(sessions)
    expect(snap.recentAccuracy).toBe(90)
  })

  it('computes accuracy delta (positive = improving)', () => {
    const sessions = [
      makeSession({ startedAt: '2026-02-10T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 5, accuracy: 50, avgResponseMs: 5000, longestStreak: 2 } }),
      makeSession({ startedAt: '2026-02-11T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 5, accuracy: 50, avgResponseMs: 5000, longestStreak: 2 } }),
      makeSession({ startedAt: '2026-02-12T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 5, accuracy: 50, avgResponseMs: 5000, longestStreak: 2 } }),
      makeSession({ startedAt: '2026-02-13T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 5, accuracy: 50, avgResponseMs: 5000, longestStreak: 2 } }),
      makeSession({ startedAt: '2026-02-14T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 5, accuracy: 50, avgResponseMs: 5000, longestStreak: 2 } }),
      makeSession({ startedAt: '2026-02-20T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 9, accuracy: 90, avgResponseMs: 2000, longestStreak: 8 } }),
      makeSession({ startedAt: '2026-02-21T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 9, accuracy: 90, avgResponseMs: 2000, longestStreak: 8 } }),
      makeSession({ startedAt: '2026-02-22T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 9, accuracy: 90, avgResponseMs: 2000, longestStreak: 8 } }),
      makeSession({ startedAt: '2026-02-23T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 9, accuracy: 90, avgResponseMs: 2000, longestStreak: 8 } }),
      makeSession({ startedAt: '2026-02-24T10:00:00Z', summary: { totalPrompts: 10, correctPrompts: 9, accuracy: 90, avgResponseMs: 2000, longestStreak: 8 } }),
    ]
    const snap = computeProgress(sessions)
    expect(snap.accuracyDelta).toBeGreaterThan(0)
    expect(snap.speedDelta).toBeGreaterThan(0)
  })

  it('computes practice streak from consecutive calendar days', () => {
    const today = new Date('2026-02-25T12:00:00Z')
    const sessions = [
      makeSession({ startedAt: '2026-02-23T10:00:00Z' }),
      makeSession({ startedAt: '2026-02-24T10:00:00Z' }),
      makeSession({ startedAt: '2026-02-25T10:00:00Z' }),
    ]
    const snap = computeProgress(sessions, today)
    expect(snap.currentStreak).toBe(3)
  })

  it('breaks streak on gap day', () => {
    const today = new Date('2026-02-25T12:00:00Z')
    const sessions = [
      makeSession({ startedAt: '2026-02-22T10:00:00Z' }),
      // gap on 23rd
      makeSession({ startedAt: '2026-02-24T10:00:00Z' }),
      makeSession({ startedAt: '2026-02-25T10:00:00Z' }),
    ]
    const snap = computeProgress(sessions, today)
    expect(snap.currentStreak).toBe(2)
  })

  it('tracks personal records', () => {
    const sessions = [
      makeSession({ sessionId: 'a', startedAt: '2026-02-20T10:00:00Z', handsPlayed: 50, summary: { totalPrompts: 10, correctPrompts: 9, accuracy: 90, avgResponseMs: 3000, longestStreak: 8 } }),
      makeSession({ sessionId: 'b', startedAt: '2026-02-21T10:00:00Z', handsPlayed: 30, summary: { totalPrompts: 10, correctPrompts: 10, accuracy: 100, avgResponseMs: 1500, longestStreak: 10 } }),
    ]
    const snap = computeProgress(sessions)
    expect(snap.records.bestAccuracy.value).toBe(100)
    expect(snap.records.bestAccuracy.sessionId).toBe('b')
    expect(snap.records.fastestSpeed.value).toBe(1500)
    expect(snap.records.mostHands.value).toBe(50)
    expect(snap.records.longestCorrectStreak.value).toBe(10)
  })

  it('builds session trend data sorted chronologically', () => {
    const sessions = [
      makeSession({ startedAt: '2026-02-21T10:00:00Z' }),
      makeSession({ startedAt: '2026-02-20T10:00:00Z' }),
    ]
    const snap = computeProgress(sessions)
    expect(snap.sessions).toHaveLength(2)
    expect(snap.sessions[0].date).toBe('2026-02-20T10:00:00Z')
    expect(snap.sessions[1].date).toBe('2026-02-21T10:00:00Z')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/modules/stats/progressTracker.test.ts`
Expected: FAIL — module not found

**Step 3: Commit**

```bash
git add src/modules/stats/progressTracker.test.ts
git commit -m "test: add progressTracker tests (red)"
```

---

### Task 2: progressTracker module — implementation

**Files:**
- Create: `src/modules/stats/progressTracker.ts`

**Step 1: Implement the module**

```typescript
import type { SessionRecord } from '@/modules/persistence/repository.ts'

export interface SessionTrendPoint {
  date: string
  accuracy: number
  avgResponseMs: number
  hands: number
}

export interface PersonalRecord {
  value: number
  sessionId: string
  date: string
}

export interface ProgressSnapshot {
  sessions: SessionTrendPoint[]

  recentAccuracy: number
  overallAccuracy: number
  recentSpeed: number
  overallSpeed: number

  accuracyDelta: number
  speedDelta: number

  currentStreak: number
  longestStreak: number

  records: {
    bestAccuracy: PersonalRecord
    fastestSpeed: PersonalRecord
    longestCorrectStreak: PersonalRecord
    mostHands: PersonalRecord
  }

  totalSessions: number
}

const RECENT_WINDOW = 5

const EMPTY_RECORD: PersonalRecord = { value: 0, sessionId: '', date: '' }

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function toDateKey(dateStr: string): string {
  return dateStr.slice(0, 10) // YYYY-MM-DD
}

function computePracticeStreak(sessions: SessionRecord[], now: Date): { current: number; longest: number } {
  if (sessions.length === 0) return { current: 0, longest: 0 }

  const daySet = new Set<string>()
  for (const s of sessions) {
    daySet.add(toDateKey(s.startedAt))
  }

  const sortedDays = [...daySet].sort().reverse()

  // Current streak: count consecutive days ending at today or yesterday
  const todayKey = toDateKey(now.toISOString())
  const yesterdayKey = toDateKey(new Date(now.getTime() - 86400000).toISOString())

  let current = 0
  if (daySet.has(todayKey) || daySet.has(yesterdayKey)) {
    const startKey = daySet.has(todayKey) ? todayKey : yesterdayKey
    let checkDate = new Date(startKey + 'T00:00:00Z')
    while (daySet.has(toDateKey(checkDate.toISOString()))) {
      current++
      checkDate = new Date(checkDate.getTime() - 86400000)
    }
  }

  // Longest streak ever
  let longest = 0
  let streak = 1
  for (let i = 0; i < sortedDays.length - 1; i++) {
    const curr = new Date(sortedDays[i] + 'T00:00:00Z')
    const next = new Date(sortedDays[i + 1] + 'T00:00:00Z')
    const diffDays = (curr.getTime() - next.getTime()) / 86400000
    if (diffDays === 1) {
      streak++
    } else {
      longest = Math.max(longest, streak)
      streak = 1
    }
  }
  longest = Math.max(longest, streak)

  return { current, longest }
}

export function computeProgress(sessions: SessionRecord[], now?: Date): ProgressSnapshot {
  const reference = now ?? new Date()

  if (sessions.length === 0) {
    return {
      sessions: [],
      recentAccuracy: 0,
      overallAccuracy: 0,
      recentSpeed: 0,
      overallSpeed: 0,
      accuracyDelta: 0,
      speedDelta: 0,
      currentStreak: 0,
      longestStreak: 0,
      records: {
        bestAccuracy: EMPTY_RECORD,
        fastestSpeed: EMPTY_RECORD,
        longestCorrectStreak: EMPTY_RECORD,
        mostHands: EMPTY_RECORD,
      },
      totalSessions: 0,
    }
  }

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  )

  const trendData: SessionTrendPoint[] = sorted.map((s) => ({
    date: s.startedAt,
    accuracy: s.summary.accuracy,
    avgResponseMs: s.summary.avgResponseMs,
    hands: s.handsPlayed,
  }))

  const allAccuracies = sorted.map((s) => s.summary.accuracy)
  const allSpeeds = sorted.map((s) => s.summary.avgResponseMs)
  const recentSlice = sorted.slice(-RECENT_WINDOW)

  const overallAccuracy = avg(allAccuracies)
  const overallSpeed = avg(allSpeeds)
  const recentAccuracy = avg(recentSlice.map((s) => s.summary.accuracy))
  const recentSpeed = avg(recentSlice.map((s) => s.summary.avgResponseMs))

  // Personal records
  let bestAccuracy = EMPTY_RECORD
  let fastestSpeed: PersonalRecord = { value: Infinity, sessionId: '', date: '' }
  let longestCorrectStreak = EMPTY_RECORD
  let mostHands = EMPTY_RECORD

  for (const s of sorted) {
    if (s.summary.accuracy > bestAccuracy.value || bestAccuracy.sessionId === '') {
      bestAccuracy = { value: s.summary.accuracy, sessionId: s.sessionId, date: s.startedAt }
    }
    if (s.summary.avgResponseMs < fastestSpeed.value && s.summary.totalPrompts > 0) {
      fastestSpeed = { value: s.summary.avgResponseMs, sessionId: s.sessionId, date: s.startedAt }
    }
    if (s.summary.longestStreak > longestCorrectStreak.value) {
      longestCorrectStreak = { value: s.summary.longestStreak, sessionId: s.sessionId, date: s.startedAt }
    }
    if (s.handsPlayed > mostHands.value) {
      mostHands = { value: s.handsPlayed, sessionId: s.sessionId, date: s.startedAt }
    }
  }

  if (fastestSpeed.sessionId === '') fastestSpeed = EMPTY_RECORD

  const { current, longest } = computePracticeStreak(sorted, reference)

  return {
    sessions: trendData,
    recentAccuracy,
    overallAccuracy,
    recentSpeed,
    overallSpeed,
    accuracyDelta: recentAccuracy - overallAccuracy,
    speedDelta: overallSpeed - recentSpeed, // positive = getting faster = improving
    currentStreak: current,
    longestStreak: longest,
    records: { bestAccuracy, fastestSpeed, longestCorrectStreak, mostHands },
    totalSessions: sessions.length,
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `pnpm vitest run src/modules/stats/progressTracker.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/modules/stats/progressTracker.ts
git commit -m "feat(BJ-026): add progressTracker module"
```

---

### Task 3: milestones module — tests

**Files:**
- Create: `src/modules/stats/milestones.test.ts`

**Step 1: Write the tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { checkMilestones, MILESTONES, type MilestoneProgress } from './milestones.ts'
import type { SessionRecord } from '@/modules/persistence/repository.ts'

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId: crypto.randomUUID(),
    mode: 'countingDrill',
    ruleConfig: {
      decks: 6,
      dealerHitsSoft17: true,
      doubleAfterSplit: true,
      surrenderAllowed: false,
      penetration: 0.75,
      dealSpeed: 'normal',
    },
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    handsPlayed: 20,
    countChecks: [],
    summary: {
      totalPrompts: 10,
      correctPrompts: 8,
      accuracy: 80,
      avgResponseMs: 3000,
      longestStreak: 5,
    },
    ...overrides,
  }
}

describe('checkMilestones', () => {
  it('returns empty for no sessions', () => {
    const result = checkMilestones([], 0, [])
    expect(result.newlyUnlocked).toEqual([])
  })

  it('unlocks first_session after one session', () => {
    const sessions = [makeSession()]
    const result = checkMilestones(sessions, 0, [])
    expect(result.newlyUnlocked).toContain('first_session')
  })

  it('does not re-unlock already unlocked milestones', () => {
    const sessions = [makeSession()]
    const result = checkMilestones(sessions, 0, ['first_session'])
    expect(result.newlyUnlocked).not.toContain('first_session')
  })

  it('unlocks accuracy_80 when a session hits 80%', () => {
    const sessions = [makeSession({ summary: { totalPrompts: 10, correctPrompts: 8, accuracy: 80, avgResponseMs: 3000, longestStreak: 5 } })]
    const result = checkMilestones(sessions, 0, [])
    expect(result.newlyUnlocked).toContain('accuracy_80')
  })

  it('unlocks accuracy_90 when a session hits 90%', () => {
    const sessions = [makeSession({ summary: { totalPrompts: 10, correctPrompts: 9, accuracy: 90, avgResponseMs: 3000, longestStreak: 5 } })]
    const result = checkMilestones(sessions, 0, [])
    expect(result.newlyUnlocked).toContain('accuracy_90')
  })

  it('unlocks accuracy_95 when a session hits 95%', () => {
    const sessions = [makeSession({ summary: { totalPrompts: 20, correctPrompts: 19, accuracy: 95, avgResponseMs: 3000, longestStreak: 15 } })]
    const result = checkMilestones(sessions, 0, [])
    expect(result.newlyUnlocked).toContain('accuracy_95')
  })

  it('unlocks streak milestones based on longest streak across sessions', () => {
    const sessions = [makeSession({ summary: { totalPrompts: 30, correctPrompts: 28, accuracy: 93, avgResponseMs: 3000, longestStreak: 26 } })]
    const result = checkMilestones(sessions, 0, [])
    expect(result.newlyUnlocked).toContain('streak_10')
    expect(result.newlyUnlocked).toContain('streak_25')
    expect(result.newlyUnlocked).not.toContain('streak_50')
  })

  it('unlocks speed milestones based on avg response', () => {
    const sessions = [makeSession({ summary: { totalPrompts: 10, correctPrompts: 8, accuracy: 80, avgResponseMs: 1800, longestStreak: 5 } })]
    const result = checkMilestones(sessions, 0, [])
    expect(result.newlyUnlocked).toContain('speed_5s')
    expect(result.newlyUnlocked).toContain('speed_3s')
    expect(result.newlyUnlocked).toContain('speed_2s')
  })

  it('unlocks practice streak milestones', () => {
    const sessions = [makeSession()]
    const result = checkMilestones(sessions, 7, [])
    expect(result.newlyUnlocked).toContain('practice_7d')
    expect(result.newlyUnlocked).not.toContain('practice_30d')
  })

  it('unlocks sessions_50 milestone', () => {
    const sessions = Array.from({ length: 50 }, () => makeSession())
    const result = checkMilestones(sessions, 0, [])
    expect(result.newlyUnlocked).toContain('sessions_50')
  })

  it('reports progress for locked milestones', () => {
    const sessions = [makeSession({ summary: { totalPrompts: 10, correctPrompts: 8, accuracy: 80, avgResponseMs: 3000, longestStreak: 8 } })]
    const result = checkMilestones(sessions, 2, [])
    const streakProgress = result.progress.get('streak_10')
    expect(streakProgress).toBeDefined()
    expect(streakProgress!.current).toBe(8)
    expect(streakProgress!.target).toBe(10)
    expect(streakProgress!.isComplete).toBe(false)
  })

  it('MILESTONES has correct tier assignments', () => {
    const bronze = MILESTONES.filter((m) => m.tier === 'bronze')
    const silver = MILESTONES.filter((m) => m.tier === 'silver')
    const gold = MILESTONES.filter((m) => m.tier === 'gold')
    expect(bronze.length).toBe(4)
    expect(silver.length).toBe(4)
    expect(gold.length).toBe(5)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/modules/stats/milestones.test.ts`
Expected: FAIL — module not found

**Step 3: Commit**

```bash
git add src/modules/stats/milestones.test.ts
git commit -m "test: add milestones tests (red)"
```

---

### Task 4: milestones module — implementation

**Files:**
- Create: `src/modules/stats/milestones.ts`

**Step 1: Implement the module**

```typescript
import type { SessionRecord } from '@/modules/persistence/repository.ts'

export type MilestoneTier = 'bronze' | 'silver' | 'gold'

export interface MilestoneProgress {
  isComplete: boolean
  current: number
  target: number
}

export interface MilestoneDef {
  id: string
  tier: MilestoneTier
  label: string
  description: string
  check: (sessions: SessionRecord[], practiceStreak: number) => MilestoneProgress
}

export interface PersistedMilestones {
  unlocked: { id: string; unlockedAt: string }[]
}

const MILESTONES_KEY = 'bjt_milestones'

// ─── Milestone definitions ──────────────────────────────────────────────────

function bestAccuracy(sessions: SessionRecord[]): number {
  return sessions.reduce((max, s) => Math.max(max, s.summary.accuracy), 0)
}

function bestStreak(sessions: SessionRecord[]): number {
  return sessions.reduce((max, s) => Math.max(max, s.summary.longestStreak), 0)
}

function bestSpeed(sessions: SessionRecord[]): number {
  const withPrompts = sessions.filter((s) => s.summary.totalPrompts > 0)
  if (withPrompts.length === 0) return Infinity
  return Math.min(...withPrompts.map((s) => s.summary.avgResponseMs))
}

export const MILESTONES: MilestoneDef[] = [
  // Bronze
  {
    id: 'first_session', tier: 'bronze', label: 'First Steps', description: 'Complete your first session',
    check: (sessions) => ({ isComplete: sessions.length >= 1, current: sessions.length, target: 1 }),
  },
  {
    id: 'accuracy_80', tier: 'bronze', label: 'Counting Basics', description: 'Achieve 80% accuracy in a session',
    check: (sessions) => ({ isComplete: bestAccuracy(sessions) >= 80, current: Math.round(bestAccuracy(sessions)), target: 80 }),
  },
  {
    id: 'streak_10', tier: 'bronze', label: 'On a Roll', description: 'Get 10 correct in a row',
    check: (sessions) => ({ isComplete: bestStreak(sessions) >= 10, current: bestStreak(sessions), target: 10 }),
  },
  {
    id: 'speed_5s', tier: 'bronze', label: 'Quick Thinker', description: 'Average response under 5 seconds',
    check: (sessions) => ({ isComplete: bestSpeed(sessions) <= 5000, current: Math.round(bestSpeed(sessions)), target: 5000 }),
  },
  // Silver
  {
    id: 'accuracy_90', tier: 'silver', label: 'Sharp Counter', description: 'Achieve 90% accuracy in a session',
    check: (sessions) => ({ isComplete: bestAccuracy(sessions) >= 90, current: Math.round(bestAccuracy(sessions)), target: 90 }),
  },
  {
    id: 'streak_25', tier: 'silver', label: 'Flow State', description: 'Get 25 correct in a row',
    check: (sessions) => ({ isComplete: bestStreak(sessions) >= 25, current: bestStreak(sessions), target: 25 }),
  },
  {
    id: 'speed_3s', tier: 'silver', label: 'Fast Hands', description: 'Average response under 3 seconds',
    check: (sessions) => ({ isComplete: bestSpeed(sessions) <= 3000, current: Math.round(bestSpeed(sessions)), target: 3000 }),
  },
  {
    id: 'practice_7d', tier: 'silver', label: 'Dedicated', description: '7-day practice streak',
    check: (_, streak) => ({ isComplete: streak >= 7, current: streak, target: 7 }),
  },
  // Gold
  {
    id: 'accuracy_95', tier: 'gold', label: 'Card Sharp', description: 'Achieve 95% accuracy in a session',
    check: (sessions) => ({ isComplete: bestAccuracy(sessions) >= 95, current: Math.round(bestAccuracy(sessions)), target: 95 }),
  },
  {
    id: 'streak_50', tier: 'gold', label: 'Machine', description: 'Get 50 correct in a row',
    check: (sessions) => ({ isComplete: bestStreak(sessions) >= 50, current: bestStreak(sessions), target: 50 }),
  },
  {
    id: 'speed_2s', tier: 'gold', label: 'Lightning', description: 'Average response under 2 seconds',
    check: (sessions) => ({ isComplete: bestSpeed(sessions) <= 2000, current: Math.round(bestSpeed(sessions)), target: 2000 }),
  },
  {
    id: 'practice_30d', tier: 'gold', label: 'Iron Will', description: '30-day practice streak',
    check: (_, streak) => ({ isComplete: streak >= 30, current: streak, target: 30 }),
  },
  {
    id: 'sessions_50', tier: 'gold', label: 'Veteran', description: 'Complete 50 sessions',
    check: (sessions) => ({ isComplete: sessions.length >= 50, current: sessions.length, target: 50 }),
  },
]

export function checkMilestones(
  sessions: SessionRecord[],
  practiceStreak: number,
  alreadyUnlocked: string[],
): { newlyUnlocked: string[]; progress: Map<string, MilestoneProgress> } {
  const unlocked = new Set(alreadyUnlocked)
  const newlyUnlocked: string[] = []
  const progress = new Map<string, MilestoneProgress>()

  for (const milestone of MILESTONES) {
    const result = milestone.check(sessions, practiceStreak)
    progress.set(milestone.id, result)

    if (result.isComplete && !unlocked.has(milestone.id)) {
      newlyUnlocked.push(milestone.id)
    }
  }

  return { newlyUnlocked, progress }
}

export function loadMilestones(): PersistedMilestones {
  try {
    const raw = localStorage.getItem(MILESTONES_KEY)
    if (!raw) return { unlocked: [] }
    return JSON.parse(raw) as PersistedMilestones
  } catch {
    return { unlocked: [] }
  }
}

export function saveMilestones(milestones: PersistedMilestones): void {
  localStorage.setItem(MILESTONES_KEY, JSON.stringify(milestones))
}
```

**Step 2: Run tests to verify they pass**

Run: `pnpm vitest run src/modules/stats/milestones.test.ts`
Expected: ALL PASS

**Step 3: Run full test suite**

Run: `pnpm vitest run`
Expected: ALL PASS (300+ tests)

**Step 4: Commit**

```bash
git add src/modules/stats/milestones.ts
git commit -m "feat(BJ-025): add milestones module with 13 auto-unlocking achievements"
```

---

### Task 5: Milestone persistence helpers in repository

**Files:**
- Modify: `src/modules/persistence/repository.ts` (add milestones key to STORAGE_KEYS)

**Step 1: Add milestones storage key**

In `src/modules/persistence/repository.ts`, add to STORAGE_KEYS (line ~10):

```typescript
const STORAGE_KEYS = {
  activeSession: 'bjt_active_session',
  sessionHistory: 'bjt_session_history',
  settings: 'bjt_settings',
  milestones: 'bjt_milestones',     // ← add this
} as const
```

Note: The actual load/save functions live in `milestones.ts` since the key is self-contained. This key addition is for documentation/consistency only.

**Step 2: Run lint and tests**

Run: `pnpm lint && pnpm vitest run`
Expected: clean

**Step 3: Commit**

```bash
git add src/modules/persistence/repository.ts
git commit -m "chore: add milestones storage key to STORAGE_KEYS"
```

---

### Task 6: Integrate milestone check into endSession

**Files:**
- Modify: `src/modules/session/sessionStore.ts:684-722` — call milestone check after saving session record

**Step 1: Add imports at top of sessionStore.ts**

Add after existing imports:

```typescript
import { checkMilestones, loadMilestones, saveMilestones } from '@/modules/stats/milestones.ts'
import { computeProgress } from '@/modules/stats/progressTracker.ts'
import { loadSessionHistory } from '@/modules/persistence/repository.ts'
```

**Step 2: Add `newMilestones` to session state**

Add to the state interface (wherever other state fields are defined):

```typescript
newMilestones: string[]     // milestone IDs unlocked in the most recent endSession call
```

Initialize as `[]` in the initial state.

**Step 3: Update endSession (line 684-722)**

After `saveSessionRecord(record)` at line 717, before `clearActiveSession()` at line 720, insert:

```typescript
      // Check for newly unlocked milestones
      const allSessions = loadSessionHistory()
      const progress = computeProgress(allSessions)
      const persisted = loadMilestones()
      const alreadyUnlocked = persisted.unlocked.map((m) => m.id)
      const { newlyUnlocked } = checkMilestones(allSessions, progress.currentStreak, alreadyUnlocked)

      if (newlyUnlocked.length > 0) {
        const now = new Date().toISOString()
        persisted.unlocked.push(...newlyUnlocked.map((id) => ({ id, unlockedAt: now })))
        saveMilestones(persisted)
      }
```

And update the `set()` call at line 721 to include `newMilestones: newlyUnlocked` (or `[]` if no session was saved).

**Step 4: Run tests**

Run: `pnpm vitest run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/modules/session/sessionStore.ts
git commit -m "feat: check milestones on session end"
```

---

### Task 7: Sparkline component

**Files:**
- Create: `src/ui/components/Sparkline.tsx`

**Step 1: Build the SVG sparkline**

```typescript
interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  showDots?: boolean
  className?: string
}

export function Sparkline({
  data,
  width = 200,
  height = 48,
  color = 'var(--color-gold-400)',
  showDots = false,
  className = '',
}: SparklineProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padding = 4

  const points = data.map((val, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - (val - min) / range) * (height - padding * 2),
  }))

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  // Gradient fill area
  const areaPath = [
    `M ${points[0].x},${height}`,
    `L ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`,
    `L ${points[points.length - 1].x},${height}`,
    'Z',
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      style={{ width: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkline-fill)" />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots && points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 3 : 2}
          fill={i === points.length - 1 ? color : 'transparent'}
          stroke={color}
          strokeWidth="1"
        />
      ))}
    </svg>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/components/Sparkline.tsx
git commit -m "feat: add Sparkline SVG component"
```

---

### Task 8: ProgressScreen UI

**Files:**
- Create: `src/ui/screens/ProgressScreen.tsx`

**Step 1: Build the screen**

Use the frontend-design skill (`@frontend-design:frontend-design`) with these arguments: "Build the ProgressScreen for the blackjack count trainer. Casino noir aesthetic, DM Serif Display / DM Sans / JetBrains Mono, Tailwind v4, gold accents on dark felt. Mobile-first with sm: breakpoints, 44px+ touch targets. Use existing screen-bg, stat-card, anim-fade-up, anim-delay-N CSS classes from index.css. Import Sparkline from @/ui/components/Sparkline.tsx, computeProgress from @/modules/stats/progressTracker.ts, MILESTONES/loadMilestones/checkMilestones from @/modules/stats/milestones.ts, loadSessionHistory from @/modules/persistence/repository.ts."

The screen layout (top to bottom):
1. Header with back button + "Progress" title
2. Hero sparkline — accuracy trend, with last 10 / last 30 / all filter pills
3. 4 stat cards (2x2): accuracy delta, speed delta, practice streak, total sessions
4. Personal records row (best accuracy, fastest speed, longest streak, most hands)
5. Milestones section — 3 tiers (bronze/silver/gold), unlocked=gold+date, locked=grey+progress bar
6. "View Full History" button at bottom

**Step 2: Commit**

```bash
git add src/ui/screens/ProgressScreen.tsx
git commit -m "feat(BJ-026): add ProgressScreen with sparkline, stats, milestones"
```

---

### Task 9: Route ProgressScreen in App.tsx

**Files:**
- Modify: `src/app/App.tsx:25` — add `'progress'` to OverlayView type
- Modify: `src/app/App.tsx:101-129` — add progress overlay routing
- Modify: `src/ui/screens/HomeScreen.tsx` — add onProgress prop + Progress button

**Step 1: Update App.tsx**

At line 25, add `'progress'` to OverlayView:
```typescript
type OverlayView = 'history' | 'deckCountdown' | 'trueCountDrill' | 'missReplay' | 'wongingDrill' | 'progress' | null
```

Add import at top:
```typescript
import { ProgressScreen } from '@/ui/screens/ProgressScreen.tsx'
```

Add routing block near other overlay conditionals (after the history block around line 102):
```typescript
if (overlay === 'progress') {
  return <ProgressScreen onBack={goHome} onShowHistory={() => setOverlay('history')} />
}
```

Pass prop to HomeScreen:
```typescript
onProgress={() => setOverlay('progress')}
```

**Step 2: Update HomeScreen**

Add `onProgress?: () => void` to `HomeScreenProps` interface.

Replace the "Session History" button (lines ~412-419) with a "Progress" button that calls `onProgress`:
```typescript
{onProgress && (
  <button
    onClick={onProgress}
    className="w-full rounded-xl border border-gold-400/20 bg-gold-400/[0.04] px-6 py-3 font-body text-sm text-gold-400/60 hover:text-gold-400 hover:bg-gold-400/[0.08] transition-all min-h-[44px] anim-fade-up anim-delay-7"
  >
    Progress & Milestones
  </button>
)}
```

**Step 3: Run build + lint + tests**

Run: `pnpm lint && pnpm vitest run && pnpm build`
Expected: ALL PASS, build succeeds

**Step 4: Commit**

```bash
git add src/app/App.tsx src/ui/screens/HomeScreen.tsx
git commit -m "feat: route ProgressScreen from HomeScreen"
```

---

### Task 10: Final validation + push

**Step 1: Full quality gate**

Run: `pnpm lint && pnpm vitest run && pnpm build`
Expected: 0 errors, 300+ tests pass, build succeeds

**Step 2: Push**

```bash
git push origin main
```
