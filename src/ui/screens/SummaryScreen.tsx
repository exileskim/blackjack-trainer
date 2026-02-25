import { useState } from 'react'
import type { CountCheck, RuleConfig } from '@/modules/domain/types.ts'
import type { TrainingMode } from '@/modules/domain/enums.ts'
import { analyzeWeakSpots } from '@/modules/stats/weakSpotAnalyzer.ts'

interface SummaryScreenProps {
  handsPlayed: number
  countChecks: CountCheck[]
  startedAt: string | null
  mode: TrainingMode
  ruleConfig: RuleConfig
  onNewSession: () => void
  onShowHistory: () => void
  onMissReplay?: () => void
}

export function SummaryScreen({
  handsPlayed,
  countChecks,
  startedAt,
  mode,
  ruleConfig,
  onNewSession,
  onShowHistory,
  onMissReplay,
}: SummaryScreenProps) {
  const countOnlyChecks = countChecks.filter((c) => (c.promptType ?? 'runningCount') !== 'bestAction')
  const replayableMisses = countOnlyChecks.filter((c) => !c.isCorrect)
  const totalPrompts = countChecks.length
  const correctPrompts = countChecks.filter((c) => c.isCorrect).length
  const accuracy = totalPrompts > 0 ? (correctPrompts / totalPrompts) * 100 : 0
  const avgResponseMs =
    totalPrompts > 0
      ? countChecks.reduce((sum, c) => sum + c.responseMs, 0) / totalPrompts
      : 0

  // Longest correct streak
  let longestStreak = 0
  let currentStreak = 0
  for (const check of countChecks) {
    if (check.isCorrect) {
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  // Duration computed once on mount (avoids impure Date.now in render)
  const [durationMinutes] = useState(() =>
    startedAt
      ? Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)
      : null,
  )

  const modeLabel = mode === 'countingDrill' ? 'Counting Drill' : 'Play + Count'

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-void" />
      <div className="absolute inset-0 bg-gradient-to-b from-felt-900/30 via-transparent to-felt-900/20" />

      <div className="relative z-10 flex-1 overflow-y-auto flex flex-col items-center gap-10 max-w-lg w-full mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400/60 mb-2">
            Session Complete
          </p>
          <h2 className="font-display text-3xl text-card-white mb-2">Summary</h2>
          <p className="font-body text-xs text-white/30">
            {modeLabel} · {ruleConfig.decks} deck{ruleConfig.decks > 1 ? 's' : ''}
            {durationMinutes !== null && durationMinutes > 0 && (
              <> · {durationMinutes}m</>
            )}
          </p>
        </div>

        {/* Stats grid */}
        <div className="w-full grid grid-cols-2 gap-4" role="list" aria-label="Session statistics">
          <StatCard label="Hands Played" value={handsPlayed.toString()} />
          <StatCard label="Prompts" value={totalPrompts.toString()} />
          <StatCard
            label="Accuracy"
            value={`${accuracy.toFixed(0)}%`}
            accent={accuracy >= 80 ? 'green' : accuracy >= 50 ? 'gold' : 'red'}
          />
          <StatCard
            label="Avg Response"
            value={`${(avgResponseMs / 1000).toFixed(1)}s`}
          />
          <StatCard label="Correct" value={`${correctPrompts}/${totalPrompts}`} />
          <StatCard label="Best Streak" value={longestStreak.toString()} accent="gold" />
        </div>

        {/* Error log */}
        {countChecks.some((c) => !c.isCorrect) && (
          <div className="w-full">
            <h3 className="font-body text-xs uppercase tracking-wider text-white/30 mb-3">
              Misses
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto" role="list" aria-label="Incorrect count checks">
              {countChecks
                .filter((c) => !c.isCorrect)
                .map((c, i) => (
                  <div
                    key={i}
                    role="listitem"
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    <span className="font-mono text-xs text-white/30">
                      Hand #{c.handNumber}
                    </span>
                    {(c.promptType ?? 'runningCount') !== 'bestAction' ? (
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-white/50">
                          Entered: {c.enteredCount}
                        </span>
                        <span className="font-mono text-xs text-gold-400">
                          Actual: {c.expectedCount}
                        </span>
                        <span className="font-mono text-xs text-red-400">
                          {c.delta > 0 ? '+' : ''}{c.delta}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-white/50">
                          Played: {formatAction(c.enteredAction)}
                        </span>
                        <span className="font-mono text-xs text-gold-400">
                          Best: {formatAction(c.expectedAction)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Weak-spot insights */}
        {countOnlyChecks.length >= 3 && (() => {
          const report = analyzeWeakSpots(countOnlyChecks)
          if (report.insights.length === 0) return null
          return (
            <div className="w-full">
              <h3 className="font-body text-xs uppercase tracking-wider text-white/30 mb-3">
                Insights
              </h3>
              <div className="space-y-2">
                {report.insights.map((insight, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2.5 ${
                      insight.severity === 'critical'
                        ? 'border-red-400/20 bg-red-400/5'
                        : insight.severity === 'warning'
                          ? 'border-gold-400/20 bg-gold-400/5'
                          : 'border-emerald-400/20 bg-emerald-400/5'
                    }`}
                  >
                    <p className={`font-body text-xs font-semibold mb-0.5 ${
                      insight.severity === 'critical'
                        ? 'text-red-400'
                        : insight.severity === 'warning'
                          ? 'text-gold-400'
                          : 'text-emerald-400'
                    }`}>
                      {insight.label}
                    </p>
                    <p className="font-body text-[11px] text-white/40">{insight.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onNewSession}
            className="w-full rounded-xl border border-gold-400/40 bg-gold-400/10 px-6 py-4 font-display text-xl text-gold-400 hover:bg-gold-400/20 transition-all"
          >
            New Session
          </button>
          {onMissReplay && replayableMisses.length > 0 && (
            <button
              onClick={onMissReplay}
              className="w-full rounded-xl border border-red-400/20 bg-red-400/[0.04] px-6 py-3 font-body text-sm text-red-400/70 hover:text-red-400 hover:bg-red-400/[0.08] transition-all"
            >
              Replay Count Misses ({replayableMisses.length})
            </button>
          )}
          <button
            onClick={onShowHistory}
            className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 font-body text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all"
          >
            View Session History
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'green' | 'gold' | 'red'
}) {
  const valueColor =
    accent === 'green'
      ? 'text-emerald-400'
      : accent === 'gold'
        ? 'text-gold-400'
        : accent === 'red'
          ? 'text-red-400'
          : 'text-card-white'

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4" role="listitem">
      <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">
        {label}
      </p>
      <p className={`font-mono text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}

function formatAction(action: string | undefined): string {
  if (!action) return '—'
  return action.charAt(0).toUpperCase() + action.slice(1)
}
