import { useState, useMemo } from 'react'
import { loadSessionHistory } from '@/modules/persistence/repository.ts'
import { computeProgress } from '@/modules/stats/progressTracker.ts'
import {
  MILESTONES,
  checkMilestones,
  loadMilestones,
  type MilestoneTier,
  type MilestoneProgress,
} from '@/modules/stats/milestones.ts'
import { Sparkline } from '@/ui/components/Sparkline.tsx'

interface ProgressScreenProps {
  onBack: () => void
  onShowHistory: () => void
}

type FilterRange = 'last7' | 'last30' | 'all'

const TIER_ORDER: MilestoneTier[] = ['bronze', 'silver', 'gold']

const TIER_STYLES: Record<MilestoneTier, { label: string; border: string; bg: string; text: string; glow: string }> = {
  bronze: {
    label: 'Bronze',
    border: 'border-amber-700/30',
    bg: 'bg-amber-700/[0.06]',
    text: 'text-amber-600',
    glow: 'shadow-[0_0_12px_rgba(180,83,9,0.15)]',
  },
  silver: {
    label: 'Silver',
    border: 'border-slate-300/20',
    bg: 'bg-slate-300/[0.04]',
    text: 'text-slate-300',
    glow: 'shadow-[0_0_12px_rgba(203,213,225,0.12)]',
  },
  gold: {
    label: 'Gold',
    border: 'border-gold-400/30',
    bg: 'bg-gold-400/[0.06]',
    text: 'text-gold-400',
    glow: 'shadow-[0_0_16px_rgba(212,175,55,0.2)]',
  },
}

export function ProgressScreen({ onBack, onShowHistory }: ProgressScreenProps) {
  const [filter, setFilter] = useState<FilterRange>('last30')

  const { snap, milestoneProgress, unlockedSet } = useMemo(() => {
    const sessions = loadSessionHistory()
    const s = computeProgress(sessions)
    const persisted = loadMilestones()
    const alreadyUnlocked = persisted.unlocked.map((m) => m.id)
    const { progress } = checkMilestones(sessions, s.currentStreak, alreadyUnlocked)
    return {
      snap: s,
      milestoneProgress: progress,
      unlockedSet: new Set(alreadyUnlocked),
      unlockedDates: new Map(persisted.unlocked.map((m) => [m.id, m.unlockedAt])),
    }
  }, [])

  const filteredSessions = useMemo(() => {
    if (filter === 'all') return snap.sessions

    const windowDays = filter === 'last7' ? 7 : 30
    const toDayNumber = (date: string) => {
      const [year, month, day] = date.split('-').map(Number)
      return Math.floor(Date.UTC(year!, month! - 1, day!) / 86_400_000)
    }
    const today = new Date()
    const todayDay = Math.floor(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 86_400_000,
    )
    return snap.sessions.filter((s) => {
      const ageDays = todayDay - toDayNumber(s.date)
      return ageDays >= 0 && ageDays < windowDays
    })
  }, [snap.sessions, filter])

  const filteredAccuracy = useMemo(
    () => filteredSessions.map((s) => s.accuracy),
    [filteredSessions],
  )

  const filteredSpeed = useMemo(
    () => filteredSessions
      .filter((s) => s.totalPrompts > 0)
      .map((s) => s.avgResponseMs / 1000),
    [filteredSessions],
  )

  const hasData = snap.totalSessions > 0

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="screen-bg" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 sm:gap-2 font-mono text-xs uppercase tracking-wider text-white/40 hover:text-gold-400 transition-colors min-h-[44px]"
          aria-label="Back to home"
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400/60">
            Progress
          </p>
        </div>
        <div className="w-12 sm:w-16" />
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-lg w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">

          {!hasData ? (
            <EmptyState />
          ) : (
            <>
              {/* ─── Hero Sparkline: Accuracy ─── */}
              <div className="anim-fade-up anim-delay-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-body text-[10px] sm:text-xs uppercase tracking-wider text-white/30">
                    Accuracy Trend
                  </h3>
                  <div className="flex gap-1">
                    {(['last7', 'last30', 'all'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`font-mono text-[9px] sm:text-[10px] uppercase tracking-wider px-2 py-1 rounded transition-colors min-h-[28px] ${
                          filter === f
                            ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                            : 'text-white/25 hover:text-white/40'
                        }`}
                      >
                        {f === 'last7' ? '7D' : f === 'last30' ? '30D' : 'All'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                  {filteredAccuracy.length >= 2 ? (
                    <Sparkline
                      data={filteredAccuracy}
                      height={64}
                      color="var(--color-gold-400)"
                      showDots={filteredAccuracy.length <= 20}
                    />
                  ) : (
                    <div className="h-16 flex items-center justify-center">
                      <p className="font-mono text-[10px] text-white/20">Need 2+ sessions for trend</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-mono text-[10px] text-white/20">
                      {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
                    </span>
                    {filteredAccuracy.length > 0 && (
                      <span className="font-mono text-[10px] text-gold-400/60">
                        Latest: {filteredAccuracy[filteredAccuracy.length - 1].toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── Speed Sparkline ─── */}
              <div className="anim-fade-up anim-delay-2">
                <h3 className="font-body text-[10px] sm:text-xs uppercase tracking-wider text-white/30 mb-3">
                  Speed Trend
                </h3>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                  {filteredSpeed.length >= 2 ? (
                    <Sparkline
                      data={filteredSpeed.map((v) => -v)}
                      height={48}
                      color="var(--color-emerald-400, #34d399)"
                      showDots={filteredSpeed.length <= 20}
                    />
                  ) : (
                    <div className="h-12 flex items-center justify-center">
                      <p className="font-mono text-[10px] text-white/20">Need 2+ sessions for trend</p>
                    </div>
                  )}
                  {filteredSpeed.length > 0 && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-mono text-[10px] text-white/20">avg response time</span>
                      <span className="font-mono text-[10px] text-emerald-400/60">
                        Latest: {filteredSpeed[filteredSpeed.length - 1].toFixed(1)}s
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Stat Cards (2x2) ─── */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 anim-fade-up anim-delay-3">
                <DeltaCard
                  label="Accuracy"
                  value={`${snap.recentAccuracy.toFixed(0)}%`}
                  delta={snap.accuracyDelta}
                  deltaLabel={`${snap.accuracyDelta >= 0 ? '+' : ''}${snap.accuracyDelta.toFixed(1)}%`}
                  positiveIsGood
                />
                <DeltaCard
                  label="Speed"
                  value={`${(snap.recentSpeed / 1000).toFixed(1)}s`}
                  delta={snap.speedDelta}
                  deltaLabel={`${(Math.abs(snap.speedDelta) / 1000).toFixed(1)}s`}
                  positiveIsGood
                />
                <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                  <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">
                    Practice Streak
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="font-mono text-xl sm:text-2xl font-bold text-gold-400">
                      {snap.currentStreak}
                    </p>
                    <p className="font-mono text-[10px] text-white/20">
                      day{snap.currentStreak !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {snap.longestStreak > snap.currentStreak && (
                    <p className="font-mono text-[9px] text-white/15 mt-1">
                      Best: {snap.longestStreak}d
                    </p>
                  )}
                </div>
                <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                  <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">
                    Sessions
                  </p>
                  <p className="font-mono text-xl sm:text-2xl font-bold text-card-white">
                    {snap.totalSessions}
                  </p>
                </div>
              </div>

              {/* ─── Personal Records ─── */}
              <div className="anim-fade-up anim-delay-4">
                <h3 className="font-body text-[10px] sm:text-xs uppercase tracking-wider text-white/30 mb-3">
                  Personal Records
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <RecordCard
                    label="Best Accuracy"
                    value={snap.records.bestAccuracy.value > 0 ? `${snap.records.bestAccuracy.value.toFixed(0)}%` : '—'}
                    date={snap.records.bestAccuracy.date}
                  />
                  <RecordCard
                    label="Fastest Avg"
                    value={snap.records.fastestSpeed.value > 0 ? `${(snap.records.fastestSpeed.value / 1000).toFixed(1)}s` : '—'}
                    date={snap.records.fastestSpeed.date}
                  />
                  <RecordCard
                    label="Best Streak"
                    value={snap.records.longestCorrectStreak.value > 0 ? snap.records.longestCorrectStreak.value.toString() : '—'}
                    date={snap.records.longestCorrectStreak.date}
                  />
                  <RecordCard
                    label="Most Hands"
                    value={snap.records.mostHands.value > 0 ? snap.records.mostHands.value.toString() : '—'}
                    date={snap.records.mostHands.date}
                  />
                </div>
              </div>

              {/* ─── Milestones ─── */}
              <div className="anim-fade-up anim-delay-5">
                <h3 className="font-body text-[10px] sm:text-xs uppercase tracking-wider text-white/30 mb-3">
                  Milestones
                </h3>
                <div className="flex flex-col gap-4 sm:gap-5">
                  {TIER_ORDER.map((tier) => {
                    const tierMilestones = MILESTONES.filter((m) => m.tier === tier)
                    const style = TIER_STYLES[tier]
                    const unlockedCount = tierMilestones.filter((m) => unlockedSet.has(m.id)).length

                    return (
                      <div key={tier}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`font-mono text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${style.text}`}>
                            {style.label}
                          </span>
                          <span className="font-mono text-[9px] text-white/15">
                            {unlockedCount}/{tierMilestones.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {tierMilestones.map((m) => {
                            const isUnlocked = unlockedSet.has(m.id)
                            const progress = milestoneProgress.get(m.id)
                            return (
                              <MilestoneCard
                                key={m.id}
                                label={m.label}
                                description={m.description}
                                tier={tier}
                                isUnlocked={isUnlocked}
                                progress={progress}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* ─── Footer Actions ─── */}
          <div className="flex flex-col gap-3 anim-fade-up anim-delay-6">
            <button
              onClick={onShowHistory}
              className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 font-body text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all min-h-[44px]"
            >
              View Full History
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 anim-fade-up">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center mb-4 sm:mb-6">
        <span className="font-mono text-2xl sm:text-3xl text-white/10">—</span>
      </div>
      <p className="font-display text-lg sm:text-xl text-white/20 mb-2">No sessions yet</p>
      <p className="font-body text-xs text-white/10 text-center max-w-xs">
        Complete a training session to start tracking your progress.
      </p>
    </div>
  )
}

function DeltaCard({
  label,
  value,
  delta,
  deltaLabel,
  positiveIsGood,
}: {
  label: string
  value: string
  delta: number
  deltaLabel: string
  positiveIsGood: boolean
}) {
  const isGood = positiveIsGood ? delta > 0 : delta < 0
  const isBad = positiveIsGood ? delta < 0 : delta > 0
  const deltaColor = isGood ? 'text-emerald-400' : isBad ? 'text-red-400' : 'text-white/20'
  const arrow = isGood ? '↑' : isBad ? '↓' : ''

  return (
    <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
      <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">
        {label}
      </p>
      <p className="font-mono text-xl sm:text-2xl font-bold text-card-white">
        {value}
      </p>
      <p className={`font-mono text-[10px] mt-1 ${deltaColor}`}>
        {arrow} {deltaLabel}
        <span className="text-white/15 ml-1">vs avg</span>
      </p>
    </div>
  )
}

function RecordCard({ label, value, date }: { label: string; value: string; date: string }) {
  const formattedDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''

  return (
    <div className="rounded-lg border border-gold-400/10 bg-gold-400/[0.02] p-2.5 sm:p-3">
      <p className="font-body text-[9px] sm:text-[10px] uppercase tracking-wider text-white/25 mb-1">
        {label}
      </p>
      <p className="font-mono text-base sm:text-lg font-bold text-gold-400">
        {value}
      </p>
      {formattedDate && (
        <p className="font-mono text-[9px] text-white/15 mt-0.5">{formattedDate}</p>
      )}
    </div>
  )
}

function formatProgress(progress: MilestoneProgress): string {
  const isSpeed = progress.direction === 'atMost' && progress.target >= 1000
  if (!Number.isFinite(progress.current)) {
    return isSpeed
      ? `—/${(progress.target / 1000).toFixed(1)}s`
      : `—/${Math.round(progress.target)}`
  }
  if (isSpeed) {
    return `${(progress.current / 1000).toFixed(1)}s/${(progress.target / 1000).toFixed(1)}s`
  }
  return `${Math.round(progress.current)}/${Math.round(progress.target)}`
}

function MilestoneCard({
  label,
  description,
  tier,
  isUnlocked,
  progress,
}: {
  label: string
  description: string
  tier: MilestoneTier
  isUnlocked: boolean
  progress: MilestoneProgress | undefined
}) {
  const style = TIER_STYLES[tier]
  const pct = progress && progress.target > 0
    ? progress.direction === 'atMost'
      ? Number.isFinite(progress.current) && progress.current > 0
        ? Math.min(100, (progress.target / progress.current) * 100)
        : 0
      : Math.min(100, (progress.current / progress.target) * 100)
    : 0

  if (isUnlocked) {
    return (
      <div className={`rounded-lg border ${style.border} ${style.bg} p-2.5 sm:p-3 ${style.glow} transition-shadow`}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`font-mono text-xs sm:text-sm font-bold ${style.text}`}>
            {label}
          </span>
        </div>
        <p className="font-body text-[10px] text-white/30">{description}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.01] p-2.5 sm:p-3 opacity-60">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs sm:text-sm font-medium text-white/30">
          {label}
        </span>
        {progress && (
          <span className="font-mono text-[9px] text-white/15">
            {formatProgress(progress)}
          </span>
        )}
      </div>
      <p className="font-body text-[10px] text-white/15 mb-2">{description}</p>
      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            tier === 'bronze' ? 'bg-amber-700/40' : tier === 'silver' ? 'bg-slate-300/30' : 'bg-gold-400/30'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
