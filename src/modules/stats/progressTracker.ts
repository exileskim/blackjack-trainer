import type { SessionRecord } from '@/modules/persistence/repository.ts'

export interface SessionTrendPoint {
  date: string
  accuracy: number
  avgResponseMs: number
  hands: number
  totalPrompts: number
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
  return nums.reduce((sum, n) => sum + n, 0) / nums.length
}

function toDateString(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * Compute practice streaks from a sorted list of unique date strings.
 * Returns { current, longest } where current is the streak ending
 * at today or yesterday, and longest is the all-time max.
 */
function computeStreaks(
  sortedDates: string[],
  now: Date,
): { current: number; longest: number } {
  if (sortedDates.length === 0) return { current: 0, longest: 0 }

  // Build list of unique dates in ascending order
  const unique = [...new Set(sortedDates)].sort()

  // Convert date strings to epoch days for easy gap detection
  const toDays = (dateStr: string): number => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
  }

  const dayNums = unique.map(toDays)
  const todayDays = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000,
  )

  // Walk backwards through dayNums to find all streaks
  let longest = 1
  let streak = 1

  for (let i = dayNums.length - 1; i > 0; i--) {
    if (dayNums[i] - dayNums[i - 1] === 1) {
      streak++
    } else {
      if (streak > longest) longest = streak
      streak = 1
    }
  }
  if (streak > longest) longest = streak

  // Current streak: must end at today or yesterday
  const lastDay = dayNums[dayNums.length - 1]
  if (todayDays - lastDay > 1) {
    return { current: 0, longest }
  }

  let current = 1
  for (let i = dayNums.length - 1; i > 0; i--) {
    if (dayNums[i] - dayNums[i - 1] === 1) {
      current++
    } else {
      break
    }
  }

  return { current, longest: Math.max(longest, current) }
}

/**
 * Compute a full progress snapshot from session history.
 *
 * @param sessions - Array of completed session records
 * @param now - Current time (defaults to Date.now); used for streak calculation
 */
export function computeProgress(
  sessions: SessionRecord[],
  now: Date = new Date(),
): ProgressSnapshot {
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
        bestAccuracy: { ...EMPTY_RECORD },
        fastestSpeed: { ...EMPTY_RECORD },
        longestCorrectStreak: { ...EMPTY_RECORD },
        mostHands: { ...EMPTY_RECORD },
      },
      totalSessions: 0,
    }
  }

  // Sort chronologically by startedAt
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  )

  // --- Trend points ---
  const trendPoints: SessionTrendPoint[] = sorted.map((s) => ({
    date: toDateString(s.startedAt),
    accuracy: s.summary.accuracy,
    avgResponseMs: s.summary.avgResponseMs,
    hands: s.handsPlayed,
    totalPrompts: s.summary.totalPrompts,
  }))

  // --- Accuracy ---
  const overallAccuracy = avg(sorted.map((s) => s.summary.accuracy))
  const recentSessions = sorted.slice(-RECENT_WINDOW)
  const recentAccuracy = avg(recentSessions.map((s) => s.summary.accuracy))

  // --- Speed ---
  const speedEligible = sorted.filter((s) => s.summary.totalPrompts > 0)
  const recentSpeedEligible = speedEligible.slice(-RECENT_WINDOW)
  const overallSpeed = avg(speedEligible.map((s) => s.summary.avgResponseMs))
  const recentSpeed = avg(recentSpeedEligible.map((s) => s.summary.avgResponseMs))

  // --- Deltas ---
  const accuracyDelta = recentAccuracy - overallAccuracy
  const speedDelta =
    speedEligible.length > 0 ? overallSpeed - recentSpeed : 0 // positive = improving (faster)

  // --- Streaks ---
  const sessionDates = sorted.map((s) => toDateString(s.startedAt))
  const { current: currentStreak, longest: longestStreak } = computeStreaks(
    sessionDates,
    now,
  )

  // --- Personal records ---
  let bestAccuracy: PersonalRecord = { ...EMPTY_RECORD }
  let fastestSpeed: PersonalRecord = { ...EMPTY_RECORD }
  let longestCorrectStreak: PersonalRecord = { ...EMPTY_RECORD }
  let mostHands: PersonalRecord = { ...EMPTY_RECORD }

  for (const s of sorted) {
    const date = toDateString(s.startedAt)

    if (s.summary.accuracy > bestAccuracy.value) {
      bestAccuracy = { value: s.summary.accuracy, sessionId: s.sessionId, date }
    }

    // Speed: lower is better, only consider sessions with prompts
    if (s.summary.totalPrompts > 0) {
      if (
        fastestSpeed.value === 0 ||
        s.summary.avgResponseMs < fastestSpeed.value
      ) {
        fastestSpeed = { value: s.summary.avgResponseMs, sessionId: s.sessionId, date }
      }
    }

    if (s.summary.longestStreak > longestCorrectStreak.value) {
      longestCorrectStreak = {
        value: s.summary.longestStreak,
        sessionId: s.sessionId,
        date,
      }
    }

    if (s.handsPlayed > mostHands.value) {
      mostHands = { value: s.handsPlayed, sessionId: s.sessionId, date }
    }
  }

  return {
    sessions: trendPoints,
    recentAccuracy,
    overallAccuracy,
    recentSpeed,
    overallSpeed,
    accuracyDelta,
    speedDelta,
    currentStreak,
    longestStreak,
    records: {
      bestAccuracy,
      fastestSpeed,
      longestCorrectStreak,
      mostHands,
    },
    totalSessions: sorted.length,
  }
}
