import { useState, useRef, useEffect } from 'react'
import type { PromptType, PlayerAction } from '@/modules/domain/enums.ts'
import type { CountCheck } from '@/modules/domain/types.ts'

interface CountPromptModalProps {
  isOpen: boolean
  handNumber: number
  promptType?: PromptType | null
  onSubmitCount: (count: number) => void
  onSubmitAction: (action: PlayerAction) => void
  onContinue: () => void
  lastResult?: CountCheck | null
}

const PROMPT_TITLES: Record<PromptType, string> = {
  runningCount: 'What is the running count?',
  trueCount: 'What is the true count?',
  bestAction: 'What is the correct play?',
}

const PROMPT_LABELS: Record<PromptType, string> = {
  runningCount: 'Running count',
  trueCount: 'True count',
  bestAction: 'Best action',
}

const ACTION_OPTIONS: PlayerAction[] = ['hit', 'stand', 'double', 'split', 'surrender']

const ACTION_LABELS: Record<PlayerAction, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
}

function resolvedPromptType(promptType: PromptType | null | undefined): PromptType {
  return promptType ?? 'runningCount'
}

export function CountPromptModal({
  isOpen,
  handNumber,
  promptType,
  onSubmitCount,
  onSubmitAction,
  onContinue,
  lastResult,
}: CountPromptModalProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const showResult = !!lastResult
  const activePromptType = resolvedPromptType(promptType)
  const isBestActionPrompt = activePromptType === 'bestAction'

  useEffect(() => {
    if (isOpen && !showResult && !isBestActionPrompt) {
      // Focus after animation for smoother entrance.
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, showResult, isBestActionPrompt])

  useEffect(() => {
    if (!isOpen || showResult || !isBestActionPrompt) return
    const onKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, PlayerAction> = {
        h: 'hit',
        s: 'stand',
        d: 'double',
        p: 'split',
        r: 'surrender',
      }
      const action = keyMap[e.key.toLowerCase()]
      if (!action) return
      e.preventDefault()
      onSubmitAction(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, showResult, isBestActionPrompt, onSubmitAction])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseInt(input, 10)
    if (isNaN(val)) return
    onSubmitCount(val)
    setInput('')
  }

  if (!isOpen) return null

  const resultType = resolvedPromptType(lastResult?.promptType)
  const isActionResult = resultType === 'bestAction'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ animation: 'modal-backdrop-in 0.25s ease-out both' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={showResult ? 'Prompt result' : PROMPT_LABELS[activePromptType]}
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
                  {PROMPT_TITLES[activePromptType]}
                </h2>
              </div>

              {!isBestActionPrompt ? (
                <form onSubmit={handleSubmit}>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    aria-label={PROMPT_LABELS[activePromptType]}
                    value={input}
                    onChange={(e) => {
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
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {ACTION_OPTIONS.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => onSubmitAction(action)}
                      className="w-full rounded-xl border border-gold-400/30 bg-black/30 px-4 py-3 font-mono text-sm font-semibold text-gold-400 uppercase tracking-wider hover:bg-gold-400/15 transition-colors"
                    >
                      {ACTION_LABELS[action]}
                    </button>
                  ))}
                  <p className="mt-1 text-center font-mono text-[10px] text-white/35 uppercase tracking-wider">
                    H / S / D / P / R shortcuts
                  </p>
                </div>
              )}
            </>
          ) : lastResult ? (
            <>
              {/* Result feedback */}
              <div className="text-center" role="status" aria-live="polite">
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

                {!isActionResult ? (
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
                        {resultType === 'trueCount' ? 'Actual TC' : 'Actual count'}
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
                ) : (
                  <div className="flex justify-center gap-8 mb-6">
                    <div>
                      <p className="font-body text-xs uppercase tracking-wider text-white/30 mb-1">
                        Your play
                      </p>
                      <p className="font-mono text-2xl font-bold text-card-white">
                        {lastResult.enteredAction ? ACTION_LABELS[lastResult.enteredAction] : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="font-body text-xs uppercase tracking-wider text-white/30 mb-1">
                        Best play
                      </p>
                      <p className="font-mono text-2xl font-bold text-gold-400">
                        {lastResult.expectedAction ? ACTION_LABELS[lastResult.expectedAction] : '—'}
                      </p>
                    </div>
                  </div>
                )}

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
