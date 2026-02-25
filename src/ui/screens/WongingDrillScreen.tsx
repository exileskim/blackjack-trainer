import { useState, useEffect, useCallback } from 'react'
import {
  createWongingDrill,
  submitWongingDecision,
  isWongingDrillComplete,
  computeWongingDrillSummary,
  getOptimalDecision,
  type WongingDrillState,
  type WongingDecision,
} from '@/modules/drills/wonging.ts'

interface WongingDrillScreenProps {
  onBack: () => void
}

const DECISION_LABELS: Record<WongingDecision, string> = {
  enter: 'Enter Table',
  stay: 'Stay & Play',
  exit: 'Exit Table',
  watch: 'Keep Watching',
}

const DECISION_SHORTCUTS: Record<WongingDecision, string> = {
  enter: 'E',
  stay: 'S',
  exit: 'X',
  watch: 'W',
}

export function WongingDrillScreen({ onBack }: WongingDrillScreenProps) {
  const [state, setState] = useState<WongingDrillState>(() => createWongingDrill())
  const [lastAnswer, setLastAnswer] = useState<{
    decision: WongingDecision
    optimal: WongingDecision
    isCorrect: boolean
  } | null>(null)
  const [problemStart, setProblemStart] = useState(() => Date.now())

  const scenario = state.scenarios[state.currentIndex]
  const isComplete = isWongingDrillComplete(state)
  const summary = isComplete ? computeWongingDrillSummary(state) : null

  // Available decisions based on whether player is currently at the table
  const availableDecisions: WongingDecision[] = scenario?.isCurrentlyPlaying
    ? ['stay', 'exit']
    : ['enter', 'watch']

  const handleDecision = useCallback((decision: WongingDecision) => {
    if (!scenario || lastAnswer) return
    const responseMs = Date.now() - problemStart
    const optimal = getOptimalDecision(scenario, state.config)
    setLastAnswer({
      decision,
      optimal,
      isCorrect: decision === optimal,
    })
    setState((prev) => submitWongingDecision(prev, decision, responseMs))
  }, [scenario, lastAnswer, problemStart, state.config])

  const handleContinue = useCallback(() => {
    setLastAnswer(null)
    setProblemStart(Date.now())
  }, [])

  const handleRestart = useCallback(() => {
    setState(createWongingDrill())
    setLastAnswer(null)
    setProblemStart(Date.now())
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lastAnswer) {
        if (e.key === 'n' || e.key === 'N' || e.key === 'Enter') {
          e.preventDefault()
          handleContinue()
        }
        return
      }
      if (isComplete) {
        if (e.key === 'n' || e.key === 'N') handleRestart()
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'e' && availableDecisions.includes('enter')) handleDecision('enter')
      else if (key === 's' && availableDecisions.includes('stay')) handleDecision('stay')
      else if (key === 'x' && availableDecisions.includes('exit')) handleDecision('exit')
      else if (key === 'w' && availableDecisions.includes('watch')) handleDecision('watch')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lastAnswer, isComplete, availableDecisions, handleDecision, handleContinue, handleRestart])

  // Shoe depth visual (percentage bar)
  const shoeDepthPct = scenario ? Math.round(scenario.shoeProgress * 100) : 0

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="screen-bg" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white/40 hover:text-gold-400 transition-colors min-h-[44px] min-w-[44px]"
          aria-label="Back"
        >
          <span aria-hidden="true">←</span> <span className="hidden sm:inline">Back</span>
        </button>
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400/60">
            Wonging Drill
          </p>
        </div>
        {!isComplete ? (
          <span className="font-mono text-xs text-white/30 min-w-[3rem] text-right">
            {state.currentIndex + (lastAnswer ? 0 : 1)}/{state.scenarios.length}
          </span>
        ) : (
          <div className="min-w-[3rem]" />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6">
        {isComplete && summary ? (
          /* ─── Summary ─── */
          <div className="max-w-sm w-full text-center anim-fade-up">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400/60 mb-2">
              Drill Complete
            </p>
            <h2 className="font-display text-3xl text-card-white mb-6">Results</h2>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
              <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">Accuracy</p>
                <p className={`font-mono text-2xl font-bold ${
                  summary.accuracy >= 80 ? 'text-emerald-400' : summary.accuracy >= 50 ? 'text-gold-400' : 'text-red-400'
                }`}>
                  {summary.accuracy.toFixed(0)}%
                </p>
              </div>
              <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">Correct</p>
                <p className="font-mono text-2xl font-bold text-card-white">
                  {summary.correct}/{summary.totalScenarios}
                </p>
              </div>
              <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">Missed Entries</p>
                <p className="font-mono text-2xl font-bold text-red-400/80">
                  {summary.missedEntries}
                </p>
              </div>
              <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">Late Exits</p>
                <p className="font-mono text-2xl font-bold text-red-400/80">
                  {summary.lateExits}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleRestart}
                className="w-full rounded-xl border border-gold-400/40 bg-gold-400/10 px-6 py-4 font-display text-xl text-gold-400 hover:bg-gold-400/20 transition-all min-h-[52px]"
              >
                Try Again <span className="kbd ml-2">N</span>
              </button>
              <button
                onClick={onBack}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 font-body text-sm text-white/40 hover:text-white/60 transition-all min-h-[44px]"
              >
                Back to Home
              </button>
            </div>
          </div>
        ) : lastAnswer ? (
          /* ─── Feedback ─── */
          <div className="max-w-sm w-full text-center anim-fade-up" role="status" aria-live="polite">
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                lastAnswer.isCorrect
                  ? 'bg-emerald-500/20 border border-emerald-500/40'
                  : 'bg-red-500/20 border border-red-500/40'
              }`}
            >
              <span className="text-3xl">{lastAnswer.isCorrect ? '✓' : '✗'}</span>
            </div>

            <h3 className={`font-display text-xl mb-4 ${lastAnswer.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
              {lastAnswer.isCorrect ? 'Correct' : 'Incorrect'}
            </h3>

            <div className="flex justify-center gap-6 sm:gap-8 mb-6">
              <div>
                <p className="font-body text-xs uppercase tracking-wider text-white/30 mb-1">Your call</p>
                <p className="font-mono text-lg sm:text-2xl font-bold text-card-white">
                  {DECISION_LABELS[lastAnswer.decision]}
                </p>
              </div>
              {!lastAnswer.isCorrect && (
                <div>
                  <p className="font-body text-xs uppercase tracking-wider text-white/30 mb-1">Should be</p>
                  <p className="font-mono text-lg sm:text-2xl font-bold text-gold-400">
                    {DECISION_LABELS[lastAnswer.optimal]}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleContinue}
              className="w-full rounded-xl bg-gold-400/15 border border-gold-400/30 px-4 py-3 font-mono text-sm font-semibold text-gold-400 uppercase tracking-wider hover:bg-gold-400/25 transition-colors min-h-[44px]"
            >
              Continue <span className="kbd ml-2">N</span>
            </button>
          </div>
        ) : scenario ? (
          /* ─── Scenario ─── */
          <div className="max-w-md w-full">
            <div className="text-center mb-6 sm:mb-8 anim-fade-up">
              <p className="font-body text-xs uppercase tracking-[0.2em] text-white/30 mb-4 sm:mb-6">
                {scenario.isCurrentlyPlaying ? 'You are at the table' : 'You are watching'}
              </p>

              {/* Shoe depth bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] text-white/20 uppercase tracking-wider">Shoe depth</span>
                  <span className="font-mono text-[10px] text-white/30">{shoeDepthPct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gold-400/50 rounded-full transition-all duration-500"
                    style={{ width: `${shoeDepthPct}%` }}
                  />
                </div>
              </div>

              {/* Count display */}
              <div className="flex justify-center gap-6 sm:gap-10 mb-6 sm:mb-8">
                <div>
                  <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-2">Running Count</p>
                  <p className="font-mono text-3xl sm:text-4xl font-bold text-card-white">
                    {scenario.runningCount >= 0 ? '+' : ''}{scenario.runningCount}
                  </p>
                </div>
                <div>
                  <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-2">True Count</p>
                  <p className="font-mono text-3xl sm:text-4xl font-bold text-gold-400">
                    {scenario.trueCount >= 0 ? '+' : ''}{scenario.trueCount}
                  </p>
                </div>
                <div>
                  <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-2">Decks Left</p>
                  <p className="font-mono text-3xl sm:text-4xl font-bold text-white/60">
                    {scenario.decksRemaining}
                  </p>
                </div>
              </div>

              {/* Player status indicator */}
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-2 ${
                scenario.isCurrentlyPlaying
                  ? 'bg-emerald-400/10 border border-emerald-400/20'
                  : 'bg-white/5 border border-white/10'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  scenario.isCurrentlyPlaying ? 'bg-emerald-400' : 'bg-white/30'
                }`} />
                <span className={`font-mono text-xs uppercase tracking-wider ${
                  scenario.isCurrentlyPlaying ? 'text-emerald-400/80' : 'text-white/40'
                }`}>
                  {scenario.isCurrentlyPlaying ? 'Seated' : 'Observing'}
                </span>
              </div>
            </div>

            {/* Decision buttons */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 anim-fade-up anim-delay-2">
              {availableDecisions.map((decision) => (
                <button
                  key={decision}
                  onClick={() => handleDecision(decision)}
                  className={`rounded-xl border px-4 py-4 sm:py-5 font-mono text-sm font-semibold uppercase tracking-wider transition-all min-h-[56px] ${
                    decision === 'enter'
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20'
                      : decision === 'exit'
                        ? 'border-red-400/30 bg-red-400/10 text-red-400 hover:bg-red-400/20'
                        : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {DECISION_LABELS[decision]}
                  <span className="kbd ml-2">{DECISION_SHORTCUTS[decision]}</span>
                </button>
              ))}
            </div>

            <p className="mt-3 text-center font-mono text-[10px] text-white/20 uppercase tracking-wider">
              {availableDecisions.map((d) => `${DECISION_SHORTCUTS[d]} = ${DECISION_LABELS[d]}`).join('  ·  ')}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
