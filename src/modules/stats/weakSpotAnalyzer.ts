import type { CountCheck } from '@/modules/domain/types.ts'

export interface WeakSpotInsight {
  type: 'overshoot' | 'undershoot' | 'fatigue' | 'highCount' | 'accuracy'
  label: string
  detail: string
  severity: 'info' | 'warning' | 'critical'
}

export interface WeakSpotReport {
  insights: WeakSpotInsight[]
  recentAccuracy: number
  overallBias: number // positive = overshooting, negative = undershooting
  fatigueDropoff: boolean
}

/**
 * Analyze count check history to find error patterns.
 * Works on an array of checks from one or more sessions.
 */
export function analyzeWeakSpots(checks: CountCheck[]): WeakSpotReport {
  const numericChecks = checks.filter((c) => (c.promptType ?? 'runningCount') !== 'bestAction')
  if (numericChecks.length === 0) {
    return { insights: [], recentAccuracy: 0, overallBias: 0, fatigueDropoff: false }
  }

  checks = numericChecks
  const incorrect = checks.filter((c) => !c.isCorrect)
  const insights: WeakSpotInsight[] = []

  const accuracy = (checks.filter((c) => c.isCorrect).length / checks.length) * 100

  // Recent accuracy (last 10 checks)
  const recent = checks.slice(-10)
  const recentAccuracy =
    recent.length > 0
      ? (recent.filter((c) => c.isCorrect).length / recent.length) * 100
      : 0

  if (checks.length >= 5) {
    if (accuracy >= 90) {
      insights.push({
        type: 'accuracy',
        label: 'Strong accuracy',
        detail: `${accuracy.toFixed(0)}% overall — you're counting consistently.`,
        severity: 'info',
      })
    } else if (accuracy < 50) {
      insights.push({
        type: 'accuracy',
        label: 'Accuracy needs work',
        detail: `${accuracy.toFixed(0)}% overall — focus on tracking each card carefully.`,
        severity: 'critical',
      })
    }
  }

  // Bias analysis: do they consistently overshoot or undershoot?
  const overallBias =
    incorrect.length > 0
      ? incorrect.reduce((sum, c) => sum + c.delta, 0) / incorrect.length
      : 0

  if (incorrect.length >= 3) {
    if (overallBias > 1.5) {
      insights.push({
        type: 'overshoot',
        label: 'Counting too high',
        detail: `You overshoot by ${overallBias.toFixed(1)} on average when wrong. You may be double-counting low cards or missing high cards.`,
        severity: 'warning',
      })
    } else if (overallBias < -1.5) {
      insights.push({
        type: 'undershoot',
        label: 'Counting too low',
        detail: `You undershoot by ${Math.abs(overallBias).toFixed(1)} on average when wrong. You may be missing low cards or double-counting high cards.`,
        severity: 'warning',
      })
    }
  }

  // Fatigue analysis: compare first-half vs second-half accuracy
  if (checks.length >= 10) {
    const mid = Math.floor(checks.length / 2)
    const firstHalf = checks.slice(0, mid)
    const secondHalf = checks.slice(mid)
    const firstAcc = firstHalf.filter((c) => c.isCorrect).length / firstHalf.length
    const secondAcc = secondHalf.filter((c) => c.isCorrect).length / secondHalf.length

    const fatigueDropoff = firstAcc - secondAcc > 0.2

    if (fatigueDropoff) {
      insights.push({
        type: 'fatigue',
        label: 'Late-session dropoff',
        detail: `Accuracy drops from ${(firstAcc * 100).toFixed(0)}% to ${(secondAcc * 100).toFixed(0)}% in the second half. Consider shorter sessions or breaks.`,
        severity: 'warning',
      })
    }

    // High count difficulty
    const highCountChecks = checks.filter((c) => Math.abs(c.expectedCount) >= 4)
    if (highCountChecks.length >= 3) {
      const highCountAcc =
        highCountChecks.filter((c) => c.isCorrect).length / highCountChecks.length
      if (highCountAcc < accuracy / 100 - 0.15) {
        insights.push({
          type: 'highCount',
          label: 'Struggle at extreme counts',
          detail: `${(highCountAcc * 100).toFixed(0)}% accuracy when count is ±4 or beyond, vs ${accuracy.toFixed(0)}% overall. Practice holding larger numbers.`,
          severity: 'warning',
        })
      }
    }

    return { insights, recentAccuracy, overallBias, fatigueDropoff }
  }

  return { insights, recentAccuracy, overallBias, fatigueDropoff: false }
}

/**
 * Get the recent miss rate for use by the adaptive scheduler.
 * Returns the proportion of incorrect answers in the last N checks.
 */
export function recentMissRate(checks: CountCheck[], window = 5): number {
  const filtered = checks.filter((c) => (c.promptType ?? 'runningCount') !== 'bestAction')
  if (filtered.length === 0) return 0
  const recent = filtered.slice(-window)
  return recent.filter((c) => !c.isCorrect).length / recent.length
}
