import { useState } from 'react'
import { loadSessionHistory, type SessionRecord } from '@/modules/persistence/repository.ts'

interface HistoryScreenProps {
  onBack: () => void
}

export function HistoryScreen({ onBack }: HistoryScreenProps) {
  const sessions = loadSessionHistory().sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-void" />
      <div className="absolute inset-0 bg-gradient-to-b from-felt-900/40 via-transparent to-felt-900/20" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white/40 hover:text-gold-400 transition-colors"
          aria-label="Back to home"
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400/60">
            Session Ledger
          </p>
        </div>
        <div className="w-16" /> {/* Balance spacer */}
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 py-6">
        {sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-w-2xl mx-auto space-y-2">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_4rem_4rem_4rem_4rem] gap-3 px-4 pb-2 border-b border-white/5">
              <span className="font-body text-[10px] uppercase tracking-wider text-white/20">
                Session
              </span>
              <span className="font-body text-[10px] uppercase tracking-wider text-white/20 text-right">
                Hands
              </span>
              <span className="font-body text-[10px] uppercase tracking-wider text-white/20 text-right">
                Acc.
              </span>
              <span className="font-body text-[10px] uppercase tracking-wider text-white/20 text-right">
                Avg
              </span>
              <span className="font-body text-[10px] uppercase tracking-wider text-white/20 text-right">
                Streak
              </span>
            </div>

            {sessions.map((session, i) => (
              <SessionRow
                key={session.sessionId}
                session={session}
                index={i}
                isExpanded={expandedId === session.sessionId}
                onToggle={() =>
                  setExpandedId(
                    expandedId === session.sessionId ? null : session.sessionId,
                  )
                }
              />
            ))}

            {/* Summary footer */}
            <HistoryFooter sessions={sessions} />
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <div className="w-20 h-20 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center">
        <span className="font-mono text-3xl text-white/10">∅</span>
      </div>
      <div className="text-center">
        <p className="font-display text-xl text-white/20 mb-2">No sessions yet</p>
        <p className="font-body text-xs text-white/10">
          Complete a training session to see your history here.
        </p>
      </div>
    </div>
  )
}

function SessionRow({
  session,
  index,
  isExpanded,
  onToggle,
}: {
  session: SessionRecord
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const date = new Date(session.endedAt)
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  const duration = Math.round(
    (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000,
  )

  const misses = session.countChecks.filter((c) => !c.isCorrect)
  const hasMisses = misses.length > 0

  const accuracyColor =
    session.summary.accuracy >= 80
      ? 'text-emerald-400'
      : session.summary.accuracy >= 50
        ? 'text-gold-400'
        : 'text-red-400'

  return (
    <div
      className="rounded-xl border border-white/5 bg-white/[0.01] overflow-hidden transition-all"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Main row */}
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[1fr_4rem_4rem_4rem_4rem] gap-3 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
        aria-expanded={isExpanded}
        aria-label={`Session from ${dateStr} at ${timeStr}`}
      >
        {/* Date & mode */}
        <div className="flex items-center gap-3 min-w-0">
          {hasMisses && (
            <span
              className="text-white/20 text-xs shrink-0 transition-transform"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}
              aria-hidden="true"
            >
              ▸
            </span>
          )}
          <div className="min-w-0">
            <p className="font-mono text-xs text-card-white truncate">
              {dateStr}{' '}
              <span className="text-white/30">{timeStr}</span>
            </p>
            <p className="font-body text-[10px] text-white/20">
              {session.mode === 'countingDrill' ? 'Count Drill' : 'Play + Count'}
              {duration > 0 && (
                <span className="text-white/15"> · {duration}m</span>
              )}
            </p>
          </div>
        </div>

        {/* Hands */}
        <span className="font-mono text-xs text-white/50 text-right tabular-nums">
          {session.handsPlayed}
        </span>

        {/* Accuracy */}
        <span className={`font-mono text-xs text-right tabular-nums font-semibold ${accuracyColor}`}>
          {session.summary.totalPrompts > 0
            ? `${session.summary.accuracy.toFixed(0)}%`
            : '—'}
        </span>

        {/* Avg response */}
        <span className="font-mono text-xs text-white/50 text-right tabular-nums">
          {session.summary.totalPrompts > 0
            ? `${(session.summary.avgResponseMs / 1000).toFixed(1)}s`
            : '—'}
        </span>

        {/* Streak */}
        <span className="font-mono text-xs text-gold-400/70 text-right tabular-nums">
          {session.summary.longestStreak > 0
            ? session.summary.longestStreak
            : '—'}
        </span>
      </button>

      {/* Expanded detail: miss log */}
      {isExpanded && hasMisses && (
        <div className="border-t border-white/5 bg-black/20 px-4 py-3">
          <p className="font-body text-[10px] uppercase tracking-wider text-white/20 mb-2">
            Misses ({misses.length})
          </p>
          <div className="space-y-1">
            {misses.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between font-mono text-[11px]"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span className="text-white/25">Hand #{c.handNumber}</span>
                <div className="flex items-center gap-4">
                  <span className="text-white/40">
                    You: {c.enteredCount}
                  </span>
                  <span className="text-gold-400/70">
                    Actual: {c.expectedCount}
                  </span>
                  <span className="text-red-400/80 w-8 text-right">
                    {c.delta > 0 ? '+' : ''}{c.delta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryFooter({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length < 2) return null

  const totalHands = sessions.reduce((s, r) => s + r.handsPlayed, 0)
  const totalChecks = sessions.reduce((s, r) => s + r.summary.totalPrompts, 0)
  const totalCorrect = sessions.reduce((s, r) => s + r.summary.correctPrompts, 0)
  const overallAccuracy = totalChecks > 0 ? (totalCorrect / totalChecks) * 100 : 0

  return (
    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between px-4">
      <span className="font-body text-[10px] uppercase tracking-wider text-white/15">
        {sessions.length} sessions · {totalHands} hands
      </span>
      <span className="font-mono text-xs text-white/30">
        Overall:{' '}
        <span
          className={
            overallAccuracy >= 80
              ? 'text-emerald-400'
              : overallAccuracy >= 50
                ? 'text-gold-400'
                : 'text-red-400'
          }
        >
          {overallAccuracy.toFixed(0)}%
        </span>
      </span>
    </div>
  )
}
