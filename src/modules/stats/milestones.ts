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

const STORAGE_KEY = 'bjt_milestones'

// --- Helpers for milestone check functions ---

function bestAccuracy(sessions: SessionRecord[]): number {
  if (sessions.length === 0) return 0
  return Math.max(...sessions.map((s) => s.summary.accuracy))
}

function bestStreak(sessions: SessionRecord[]): number {
  if (sessions.length === 0) return 0
  return Math.max(...sessions.map((s) => s.summary.longestStreak))
}

function bestSpeed(sessions: SessionRecord[]): number {
  const withPrompts = sessions.filter((s) => s.summary.totalPrompts > 0)
  if (withPrompts.length === 0) return Infinity
  return Math.min(...withPrompts.map((s) => s.summary.avgResponseMs))
}

function accuracyMilestone(
  target: number,
): (sessions: SessionRecord[], practiceStreak: number) => MilestoneProgress {
  return (sessions) => {
    const current = bestAccuracy(sessions)
    return { isComplete: current >= target, current, target }
  }
}

function streakMilestone(
  target: number,
): (sessions: SessionRecord[], practiceStreak: number) => MilestoneProgress {
  return (sessions) => {
    const current = bestStreak(sessions)
    return { isComplete: current >= target, current, target }
  }
}

function speedMilestone(
  targetMs: number,
): (sessions: SessionRecord[], practiceStreak: number) => MilestoneProgress {
  return (sessions) => {
    const current = bestSpeed(sessions)
    return { isComplete: current < targetMs, current, target: targetMs }
  }
}

function practiceStreakMilestone(
  target: number,
): (sessions: SessionRecord[], practiceStreak: number) => MilestoneProgress {
  return (_sessions, practiceStreak) => {
    return { isComplete: practiceStreak >= target, current: practiceStreak, target }
  }
}

// --- Milestone definitions ---

export const MILESTONES: MilestoneDef[] = [
  // Bronze (4)
  {
    id: 'first_session',
    tier: 'bronze',
    label: 'First Steps',
    description: 'Complete your first session',
    check: (sessions) => {
      const current = sessions.length
      return { isComplete: current >= 1, current: Math.min(current, 1), target: 1 }
    },
  },
  {
    id: 'accuracy_80',
    tier: 'bronze',
    label: 'Counting Basics',
    description: 'Achieve 80% accuracy in a session',
    check: accuracyMilestone(80),
  },
  {
    id: 'streak_10',
    tier: 'bronze',
    label: 'On a Roll',
    description: 'Get 10 correct in a row',
    check: streakMilestone(10),
  },
  {
    id: 'speed_5s',
    tier: 'bronze',
    label: 'Quick Thinker',
    description: 'Average response under 5 seconds',
    check: speedMilestone(5000),
  },

  // Silver (4)
  {
    id: 'accuracy_90',
    tier: 'silver',
    label: 'Sharp Counter',
    description: 'Achieve 90% accuracy in a session',
    check: accuracyMilestone(90),
  },
  {
    id: 'streak_25',
    tier: 'silver',
    label: 'Flow State',
    description: 'Get 25 correct in a row',
    check: streakMilestone(25),
  },
  {
    id: 'speed_3s',
    tier: 'silver',
    label: 'Fast Hands',
    description: 'Average response under 3 seconds',
    check: speedMilestone(3000),
  },
  {
    id: 'practice_7d',
    tier: 'silver',
    label: 'Dedicated',
    description: '7-day practice streak',
    check: practiceStreakMilestone(7),
  },

  // Gold (5)
  {
    id: 'accuracy_95',
    tier: 'gold',
    label: 'Card Sharp',
    description: 'Achieve 95% accuracy in a session',
    check: accuracyMilestone(95),
  },
  {
    id: 'streak_50',
    tier: 'gold',
    label: 'Machine',
    description: 'Get 50 correct in a row',
    check: streakMilestone(50),
  },
  {
    id: 'speed_2s',
    tier: 'gold',
    label: 'Lightning',
    description: 'Average response under 2 seconds',
    check: speedMilestone(2000),
  },
  {
    id: 'practice_30d',
    tier: 'gold',
    label: 'Iron Will',
    description: '30-day practice streak',
    check: practiceStreakMilestone(30),
  },
  {
    id: 'sessions_50',
    tier: 'gold',
    label: 'Veteran',
    description: 'Complete 50 sessions',
    check: (sessions) => {
      const current = sessions.length
      return { isComplete: current >= 50, current, target: 50 }
    },
  },
]

/**
 * Check all milestones against session history and practice streak.
 * Returns newly unlocked milestone ids and progress for all milestones.
 */
export function checkMilestones(
  sessions: SessionRecord[],
  practiceStreak: number,
  alreadyUnlocked: string[],
): { newlyUnlocked: string[]; progress: Map<string, MilestoneProgress> } {
  const unlockedSet = new Set(alreadyUnlocked)
  const newlyUnlocked: string[] = []
  const progress = new Map<string, MilestoneProgress>()

  for (const milestone of MILESTONES) {
    const result = milestone.check(sessions, practiceStreak)
    progress.set(milestone.id, result)

    if (result.isComplete && !unlockedSet.has(milestone.id)) {
      newlyUnlocked.push(milestone.id)
    }
  }

  return { newlyUnlocked, progress }
}

/**
 * Load persisted milestones from localStorage.
 * Returns empty unlocked array on error or missing data.
 */
export function loadMilestones(): PersistedMilestones {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { unlocked: [] }
    return JSON.parse(raw) as PersistedMilestones
  } catch {
    return { unlocked: [] }
  }
}

/**
 * Save milestones to localStorage.
 */
export function saveMilestones(milestones: PersistedMilestones): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(milestones))
  } catch {
    // Storage full or unavailable — fail silently
  }
}
