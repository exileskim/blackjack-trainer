import { useState, useRef, useEffect } from 'react'

interface CountPromptModalProps {
  isOpen: boolean
  handNumber: number
  onSubmit: (count: number) => void
  onContinue: () => void
  lastResult?: {
    enteredCount: number
    expectedCount: number
    isCorrect: boolean
    delta: number
  } | null
}

export function CountPromptModal({
  isOpen,
  handNumber,
  onSubmit,
  onContinue,
  lastResult,
}: CountPromptModalProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const showResult = !!lastResult

  useEffect(() => {
    if (isOpen && !showResult) {
      // Focus after animation for smoother entrance.
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, showResult])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseInt(input, 10)
    if (isNaN(val)) return
    onSubmit(val)
    setInput('')
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ animation: 'modal-backdrop-in 0.25s ease-out both' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm mx-4"
        style={{ animation: 'modal-content-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both' }}
      >
        <div className="rounded-2xl border border-gold-400/30 bg-felt-900/95 backdrop-blur-md p-8 shadow-2xl shadow-black/60">
          {/* Decorative top accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px h-px w-24 bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />

          {!showResult ? (
            <>
              {/* Prompt */}
              <div className="text-center mb-6">
                <p className="font-body text-xs uppercase tracking-[0.2em] text-white/30 mb-2">
                  Hand #{handNumber}
                </p>
                <h2 className="font-display text-2xl text-card-white">
                  What is the running count?
                </h2>
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit}>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={input}
                  onChange={(e) => {
                    // Allow negative numbers and digits
                    const v = e.target.value
                    if (v === '' || v === '-' || /^-?\d+$/.test(v)) {
                      setInput(v)
                    }
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
            </>
          ) : lastResult ? (
            <>
              {/* Result feedback */}
              <div className="text-center">
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                    lastResult.isCorrect
                      ? 'bg-emerald-500/20 border border-emerald-500/40'
                      : 'bg-red-500/20 border border-red-500/40'
                  }`}
                >
                  <span className="text-3xl">
                    {lastResult.isCorrect ? '✓' : '✗'}
                  </span>
                </div>

                <h3
                  className={`font-display text-xl mb-4 ${
                    lastResult.isCorrect ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {lastResult.isCorrect ? 'Correct' : 'Incorrect'}
                </h3>

                <div className="flex justify-center gap-8 mb-6">
                  <div>
                    <p className="font-body text-xs uppercase tracking-wider text-white/30 mb-1">
                      Your answer
                    </p>
                    <p className="font-mono text-2xl font-bold text-card-white">
                      {lastResult.enteredCount}
                    </p>
                  </div>
                  <div>
                    <p className="font-body text-xs uppercase tracking-wider text-white/30 mb-1">
                      Actual count
                    </p>
                    <p className="font-mono text-2xl font-bold text-gold-400">
                      {lastResult.expectedCount}
                    </p>
                  </div>
                  {!lastResult.isCorrect && (
                    <div>
                      <p className="font-body text-xs uppercase tracking-wider text-white/30 mb-1">
                        Off by
                      </p>
                      <p className="font-mono text-2xl font-bold text-red-400">
                        {lastResult.delta > 0 ? '+' : ''}
                        {lastResult.delta}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onContinue}
                  className="w-full rounded-xl bg-gold-400/15 border border-gold-400/30 px-4 py-3 font-mono text-sm font-semibold text-gold-400 uppercase tracking-wider hover:bg-gold-400/25 transition-colors"
                >
                  Continue <span className="kbd ml-2">N</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
