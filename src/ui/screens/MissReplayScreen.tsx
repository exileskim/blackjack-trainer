import { useState, useRef, useEffect } from 'react'
import type { CountCheck } from '@/modules/domain/types.ts'
import {
  createMissReplay,
  submitMissReplayAnswer,
  missReplaySummary,
  type MissReplayState,
} from '@/modules/drills/missReplay.ts'

interface MissReplayScreenProps {
  countChecks: CountCheck[]
  onBack: () => void
}

export function MissReplayScreen({ countChecks, onBack }: MissReplayScreenProps) {
  const [state, setState] = useState<MissReplayState | null>(() =>
    createMissReplay(countChecks),
  )
  const [input, setInput] = useState('')
  const [lastResult, setLastResult] = useState<{
    isCorrect: boolean
    userAnswer: number
    correctAnswer: number
    previousAnswer: number
  } | null>(null)
  const [problemStart, setProblemStart] = useState(() => Date.now())
  const [startTime, setStartTime] = useState(() => Date.now())
  const [elapsedMinutes, setElapsedMinutes] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const problem = state?.problems[state.currentIndex] ?? null
  const isComplete = state ? state.currentIndex >= state.problems.length : false
  const summary = isComplete && state ? missReplaySummary(state) : null

  const handleContinue = () => {
    setLastResult(null)
    setProblemStart(Date.now())
  }

  useEffect(() => {
    if (state && !isComplete && !lastResult) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [state?.currentIndex, isComplete, lastResult, state])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lastResult && (e.key === 'n' || e.key === 'N' || e.key === 'Enter')) {
        handleContinue()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseInt(input, 10)
    if (isNaN(val) || !problem) return

    const now = Date.now()
    const responseMs = now - problemStart
    setLastResult({
      isCorrect: val === problem.expectedCount,
      userAnswer: val,
      correctAnswer: problem.expectedCount,
      previousAnswer: problem.userPreviousAnswer,
    })
    setState((prev) => {
      if (!prev) return prev
      const next = submitMissReplayAnswer(prev, val, responseMs)
      if (next.currentIndex >= next.problems.length) {
        setElapsedMinutes(Math.round((now - startTime) / 60000))
      }
      return next
    })
    setInput('')
  }

  // No misses to replay
  if (!state) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        <div className="screen-bg" />
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
          <div className="text-center max-w-sm anim-fade-up">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-4 sm:mb-6">
              <span className="text-2xl sm:text-3xl">✓</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl text-card-white mb-2 sm:mb-3">No Misses to Replay</h2>
            <p className="font-body text-sm text-white/40 mb-6 sm:mb-8">
              Every count check was correct. Nothing to review.
            </p>
            <button
              onClick={onBack}
              className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 font-body text-sm text-white/40 hover:text-white/60 transition-all min-h-[44px]"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="screen-bg" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 sm:gap-2 font-mono text-xs uppercase tracking-wider text-white/40 hover:text-gold-400 transition-colors min-h-[44px]"
          aria-label="Back"
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400/60">
            Miss Replay
          </p>
        </div>
        {!isComplete && (
          <span className="font-mono text-xs text-white/30 w-12 sm:w-auto text-right">
            {state.currentIndex + (lastResult ? 0 : 1)}/{state.problems.length}
          </span>
        )}
        {isComplete && <div className="w-12 sm:w-16" />}
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6">
        {isComplete && summary ? (
          /* Summary */
          <div className="max-w-sm w-full text-center anim-fade-up">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400/60 mb-2">
              Replay Complete
            </p>
            <h2 className="font-display text-2xl sm:text-3xl text-card-white mb-4 sm:mb-6">Correction Results</h2>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">
                  Corrected
                </p>
                <p className={`font-mono text-xl sm:text-2xl font-bold ${
                  summary.accuracy >= 80 ? 'text-emerald-400' : summary.accuracy >= 50 ? 'text-gold-400' : 'text-red-400'
                }`}>
                  {summary.accuracy.toFixed(0)}%
                </p>
              </div>
              <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">
                  Improved
                </p>
                <p className="font-mono text-xl sm:text-2xl font-bold text-emerald-400">
                  {summary.improved}/{summary.total}
                </p>
              </div>
              <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">
                  Avg Response
                </p>
                <p className="font-mono text-xl sm:text-2xl font-bold text-card-white">
                  {(summary.avgResponseMs / 1000).toFixed(1)}s
                </p>
              </div>
              <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">
                  Duration
                </p>
                <p className="font-mono text-xl sm:text-2xl font-bold text-card-white">
                  {elapsedMinutes}m
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const now = Date.now()
                  const fresh = createMissReplay(countChecks)
                  if (fresh) {
                    setState(fresh)
                    setLastResult(null)
                    setInput('')
                    setStartTime(now)
                    setProblemStart(now)
                    setElapsedMinutes(0)
                  }
                }}
                className="w-full rounded-xl border border-gold-400/40 bg-gold-400/10 px-6 py-3.5 sm:py-4 font-display text-lg sm:text-xl text-gold-400 hover:bg-gold-400/20 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] transition-all min-h-[52px]"
              >
                Replay Again
              </button>
              <button
                onClick={onBack}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 font-body text-sm text-white/40 hover:text-white/60 transition-all min-h-[44px]"
              >
                Back
              </button>
            </div>
          </div>
        ) : lastResult ? (
          /* Result feedback */
          <div className="max-w-sm w-full text-center anim-fade-up" role="status" aria-live="polite">
            <div
              className={`inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full mb-3 sm:mb-4 ${
                lastResult.isCorrect
                  ? 'bg-emerald-500/20 border border-emerald-500/40'
                  : 'bg-red-500/20 border border-red-500/40'
              }`}
            >
              <span className="text-2xl sm:text-3xl">
                {lastResult.isCorrect ? '✓' : '✗'}
              </span>
            </div>

            <h3 className={`font-display text-lg sm:text-xl mb-2 ${lastResult.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
              {lastResult.isCorrect ? 'Corrected' : 'Still Off'}
            </h3>

            {lastResult.isCorrect && (
              <p className="font-body text-xs text-white/30 mb-3 sm:mb-4">
                Previously <span className="line-through text-red-400/60">{lastResult.previousAnswer}</span> → now correct
              </p>
            )}

            <div className="flex justify-center gap-6 sm:gap-8 mb-5 sm:mb-6">
              <div>
                <p className="font-body text-[10px] sm:text-xs uppercase tracking-wider text-white/30 mb-1">Your answer</p>
                <p className="font-mono text-xl sm:text-2xl font-bold text-card-white">{lastResult.userAnswer}</p>
              </div>
              <div>
                <p className="font-body text-[10px] sm:text-xs uppercase tracking-wider text-white/30 mb-1">Correct</p>
                <p className="font-mono text-xl sm:text-2xl font-bold text-gold-400">{lastResult.correctAnswer}</p>
              </div>
            </div>

            <button
              onClick={handleContinue}
              className="w-full rounded-xl bg-gold-400/15 border border-gold-400/30 px-4 py-3 font-mono text-sm font-semibold text-gold-400 uppercase tracking-wider hover:bg-gold-400/25 transition-colors min-h-[44px]"
            >
              Continue <span className="kbd ml-2 hidden sm:inline-flex">N</span>
            </button>
          </div>
        ) : problem ? (
          /* Problem */
          <div className="max-w-sm w-full anim-fade-up">
            <div className="text-center mb-6 sm:mb-8">
              <p className="font-body text-xs uppercase tracking-[0.2em] text-white/30 mb-2">
                Correct your previous miss
              </p>
              <p className="font-mono text-sm text-white/20 mb-4 sm:mb-6">
                Hand #{problem.handNumber}
              </p>

              <div className="mb-6 sm:mb-8">
                <div className="inline-flex flex-col items-center gap-1.5 sm:gap-2 rounded-xl border border-red-400/10 bg-red-400/[0.03] px-6 sm:px-8 py-3 sm:py-4">
                  <p className="font-body text-[10px] uppercase tracking-wider text-white/20">
                    Your previous answer
                  </p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-red-400/40 line-through decoration-2">
                    {problem.userPreviousAnswer}
                  </p>
                  <p className="font-mono text-[10px] text-white/20">
                    off by {problem.delta > 0 ? '+' : ''}{problem.delta}
                  </p>
                </div>
              </div>

              <p className="font-body text-xs text-white/40 mb-2">
                What was the correct running count?
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                aria-label="Correct running count"
                value={input}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || v === '-' || /^-?\d+$/.test(v)) {
                    setInput(v)
                  }
                }}
                className="w-full rounded-xl border border-gold-400/30 bg-black/40 px-4 py-3.5 sm:py-4 text-center font-mono text-2xl sm:text-3xl font-bold text-card-white placeholder-white/20 focus:border-gold-400 focus:outline-none transition-colors"
                placeholder="0"
                autoComplete="off"
              />
              <button
                type="submit"
                className="mt-3 sm:mt-4 w-full rounded-xl bg-gold-400/15 border border-gold-400/30 px-4 py-3 font-mono text-sm font-semibold text-gold-400 uppercase tracking-wider hover:bg-gold-400/25 transition-colors min-h-[44px]"
              >
                Submit <span className="kbd ml-2 hidden sm:inline-flex">↵</span>
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  )
}
