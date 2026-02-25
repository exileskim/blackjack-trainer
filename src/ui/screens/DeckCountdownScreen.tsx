import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createDeckCountdown,
  advanceCard,
  evaluateCountdown,
  type DeckCountdownState,
  type DeckCountdownResult,
} from '@/modules/drills/deckCountdown.ts'
import { CardView } from '@/ui/components/CardView.tsx'

interface DeckCountdownScreenProps {
  onBack: () => void
  onComplete?: () => void
}

type Phase = 'ready' | 'dealing' | 'answer' | 'result'

export function DeckCountdownScreen({ onBack, onComplete }: DeckCountdownScreenProps) {
  const [state, setState] = useState<DeckCountdownState>(() => createDeckCountdown())
  const [phase, setPhase] = useState<Phase>('ready')
  const [input, setInput] = useState('')
  const [result, setResult] = useState<DeckCountdownResult | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const completionReportedRef = useRef(false)

  const currentCard = state.cards[state.currentIndex]

  // Timer
  useEffect(() => {
    if (phase === 'dealing') {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - state.startTime)
      }, 100)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
  }, [phase, state.startTime])

  // Auto-advance cards
  useEffect(() => {
    if (phase === 'dealing' && !state.isComplete) {
      dealTimerRef.current = setTimeout(() => {
        setState((prev) => {
          const next = advanceCard(prev)
          if (next.isComplete) {
            setPhase('answer')
          }
          return next
        })
      }, 400) // 400ms per card ≈ 20s for full deck
      return () => {
        if (dealTimerRef.current) clearTimeout(dealTimerRef.current)
      }
    }
  }, [phase, state.currentIndex, state.isComplete])

  // Focus input when answering
  useEffect(() => {
    if (phase === 'answer') {
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [phase])

  useEffect(() => {
    if (phase === 'result' && result && !completionReportedRef.current) {
      completionReportedRef.current = true
      onComplete?.()
    }
  }, [phase, result, onComplete])

  const handleStart = useCallback(() => {
    completionReportedRef.current = false
    const newState = createDeckCountdown()
    setState(newState)
    setPhase('dealing')
    setElapsed(0)
    setResult(null)
    setInput('')
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseInt(input, 10)
    if (isNaN(val)) return
    const res = evaluateCountdown(state, val)
    setResult(res)
    setPhase('result')
  }

  // Keyboard: Space to start, N to restart
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phase === 'ready' && e.key === ' ') {
        e.preventDefault()
        handleStart()
      }
      if (phase === 'result' && (e.key === 'n' || e.key === 'N')) {
        handleStart()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [phase, handleStart])

  const seconds = (elapsed / 1000).toFixed(1)

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-void" />
      <div className="absolute inset-0 bg-gradient-to-b from-felt-900/40 via-transparent to-felt-900/20" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-white/40 hover:text-gold-400 transition-colors"
          aria-label="Back"
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400/60">
            Deck Countdown
          </p>
        </div>
        <div className="font-mono text-xs text-white/30 w-16 text-right">
          {phase === 'dealing' && `${state.currentIndex + 1}/52`}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        {phase === 'ready' && (
          <div className="text-center">
            <h2 className="font-display text-2xl text-card-white mb-4">
              Count the Deck
            </h2>
            <p className="font-body text-sm text-white/40 mb-8 max-w-xs mx-auto">
              52 cards will be dealt one at a time. Track the Hi-Lo running count,
              then report your final count.
            </p>
            <button
              onClick={handleStart}
              className="rounded-xl border border-gold-400/40 bg-gold-400/10 px-8 py-4 font-display text-xl text-gold-400 hover:bg-gold-400/20 transition-all"
            >
              Start <span className="kbd ml-2">Space</span>
            </button>
          </div>
        )}

        {phase === 'dealing' && currentCard && (
          <div className="text-center">
            {/* Timer */}
            <p className="font-mono text-sm text-white/30 mb-6">{seconds}s</p>

            {/* Current card - large */}
            <div className="flex justify-center mb-6">
              <div className="transform scale-[2] origin-center">
                <CardView
                  card={currentCard}
                  faceDown={false}
                  index={0}
                  key={`${currentCard.rank}${currentCard.suit}-${state.currentIndex}`}
                />
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-48 mx-auto h-1 rounded-full bg-white/10 overflow-hidden mt-8">
              <div
                className="h-full bg-gold-400/60 transition-all duration-300"
                style={{ width: `${((state.currentIndex + 1) / 52) * 100}%` }}
              />
            </div>
          </div>
        )}

        {phase === 'answer' && (
          <div className="max-w-sm w-full">
            <div className="text-center mb-6">
              <p className="font-mono text-sm text-white/30 mb-2">{seconds}s</p>
              <h2 className="font-display text-2xl text-card-white mb-2">
                What is the running count?
              </h2>
              <p className="font-body text-xs text-white/30">
                For a balanced deck, the final count should be 0.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                aria-label="Final running count"
                value={input}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || v === '-' || /^-?\d+$/.test(v)) setInput(v)
                }}
                className="w-full rounded-xl border border-gold-400/30 bg-black/40 px-4 py-4 text-center font-mono text-3xl font-bold text-card-white placeholder-white/20 focus:border-gold-400 focus:outline-none transition-colors"
                style={{ animation: 'glow-pulse 2s ease-in-out infinite' }}
                placeholder="0"
                autoComplete="off"
              />
              <button
                type="submit"
                className="mt-4 w-full rounded-xl bg-gold-400/15 border border-gold-400/30 px-4 py-3 font-mono text-sm font-semibold text-gold-400 uppercase tracking-wider hover:bg-gold-400/25 transition-colors"
              >
                Submit <span className="kbd ml-2">↵</span>
              </button>
            </form>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="max-w-sm w-full text-center" role="status" aria-live="polite">
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                result.isCorrect
                  ? 'bg-emerald-500/20 border border-emerald-500/40'
                  : 'bg-red-500/20 border border-red-500/40'
              }`}
            >
              <span className="text-3xl">{result.isCorrect ? '✓' : '✗'}</span>
            </div>

            <h3 className={`font-display text-xl mb-2 ${result.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.isCorrect ? 'Perfect!' : 'Not quite'}
            </h3>

            <p className="font-mono text-sm text-white/40 mb-6">
              {(result.elapsedMs / 1000).toFixed(1)}s
            </p>

            <div className="flex justify-center gap-8 mb-8">
              <div>
                <p className="font-body text-xs uppercase tracking-wider text-white/30 mb-1">Your count</p>
                <p className="font-mono text-2xl font-bold text-card-white">{result.userCount}</p>
              </div>
              <div>
                <p className="font-body text-xs uppercase tracking-wider text-white/30 mb-1">Correct</p>
                <p className="font-mono text-2xl font-bold text-gold-400">{result.correctCount}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleStart}
                className="w-full rounded-xl border border-gold-400/40 bg-gold-400/10 px-6 py-4 font-display text-xl text-gold-400 hover:bg-gold-400/20 transition-all"
              >
                Try Again <span className="kbd ml-2">N</span>
              </button>
              <button
                onClick={onBack}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 font-body text-sm text-white/40 hover:text-white/60 transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
