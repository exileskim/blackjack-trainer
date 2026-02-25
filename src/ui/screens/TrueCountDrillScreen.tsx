import { useState, useRef, useEffect } from 'react'
import {
  createTrueCountDrillState,
  submitAnswer,
  drillSummary,
  type TrueCountDrillState,
} from '@/modules/drills/trueCountDrill.ts'

interface TrueCountDrillScreenProps {
  onBack: () => void
  onComplete?: () => void
}

export function TrueCountDrillScreen({ onBack, onComplete }: TrueCountDrillScreenProps) {
  const [state, setState] = useState<TrueCountDrillState>(() =>
    createTrueCountDrillState(20),
  )
  const [input, setInput] = useState('')
  const [lastResult, setLastResult] = useState<{
    isCorrect: boolean
    userAnswer: number
    correctAnswer: number
    delta: number
  } | null>(null)
  const [startTime, setStartTime] = useState(() => Date.now())
  const [problemStart, setProblemStart] = useState(() => Date.now())
  const [elapsedMinutes, setElapsedMinutes] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const completionReportedRef = useRef(false)

  const problem = state.problems[state.currentIndex]
  const isComplete = state.currentIndex >= state.problems.length
  const summary = isComplete ? drillSummary(state) : null

  useEffect(() => {
    if (!isComplete && !lastResult) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [state.currentIndex, isComplete, lastResult])

  useEffect(() => {
    if (isComplete && !completionReportedRef.current) {
      completionReportedRef.current = true
      onComplete?.()
    }
  }, [isComplete, onComplete])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseInt(input, 10)
    if (isNaN(val) || !problem) return

    const now = Date.now()
    const responseMs = now - problemStart
    const delta = val - problem.correctAnswer
    setLastResult({
      isCorrect: delta === 0,
      userAnswer: val,
      correctAnswer: problem.correctAnswer,
      delta,
    })
    setState((prev) => {
      const next = submitAnswer(prev, val, responseMs)
      if (next.currentIndex >= next.problems.length) {
        setElapsedMinutes(Math.round((now - startTime) / 60000))
      }
      return next
    })
    setInput('')
  }

  const handleContinue = () => {
    setLastResult(null)
    setProblemStart(Date.now())
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lastResult && (e.key === 'n' || e.key === 'N' || e.key === 'Enter')) {
        handleContinue()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

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
            True Count Drill
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
              Drill Complete
            </p>
            <h2 className="font-display text-2xl sm:text-3xl text-card-white mb-4 sm:mb-6">Results</h2>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">
                  Accuracy
                </p>
                <p className={`font-mono text-xl sm:text-2xl font-bold ${
                  summary.accuracy >= 80 ? 'text-emerald-400' : summary.accuracy >= 50 ? 'text-gold-400' : 'text-red-400'
                }`}>
                  {summary.accuracy.toFixed(0)}%
                </p>
              </div>
              <div className="stat-card rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1">
                  Correct
                </p>
                <p className="font-mono text-xl sm:text-2xl font-bold text-card-white">
                  {summary.correct}/{summary.total}
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
                  completionReportedRef.current = false
                  setState(createTrueCountDrillState(20))
                  setLastResult(null)
                  setInput('')
                  setStartTime(now)
                  setProblemStart(now)
                  setElapsedMinutes(0)
                }}
                className="w-full rounded-xl border border-gold-400/40 bg-gold-400/10 px-6 py-3.5 sm:py-4 font-display text-lg sm:text-xl text-gold-400 hover:bg-gold-400/20 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] transition-all min-h-[52px]"
              >
                Try Again
              </button>
              <button
                onClick={onBack}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 font-body text-sm text-white/40 hover:text-white/60 transition-all min-h-[44px]"
              >
                Back to Home
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

            <h3 className={`font-display text-lg sm:text-xl mb-3 sm:mb-4 ${lastResult.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
              {lastResult.isCorrect ? 'Correct' : 'Incorrect'}
            </h3>

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
              <p className="font-body text-xs uppercase tracking-[0.2em] text-white/30 mb-4 sm:mb-6">
                Convert to true count
              </p>

              <div className="flex justify-center gap-5 sm:gap-8 mb-6 sm:mb-8">
                <div>
                  <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1.5 sm:mb-2">
                    Running Count
                  </p>
                  <p className="font-mono text-3xl sm:text-4xl font-bold text-card-white">
                    {problem.runningCount >= 0 ? '+' : ''}{problem.runningCount}
                  </p>
                </div>
                <div className="flex items-end pb-1.5 sm:pb-2">
                  <span className="font-mono text-xl sm:text-2xl text-white/20">÷</span>
                </div>
                <div>
                  <p className="font-body text-[10px] uppercase tracking-wider text-white/30 mb-1.5 sm:mb-2">
                    Decks Left
                  </p>
                  <p className="font-mono text-3xl sm:text-4xl font-bold text-gold-400">
                    {problem.decksRemaining}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                aria-label="True count answer"
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
