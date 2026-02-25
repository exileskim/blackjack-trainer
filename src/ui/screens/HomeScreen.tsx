import { useEffect, useState } from 'react'
import type { TrainingMode, PromptType } from '@/modules/domain/enums.ts'
import type { RuleConfig } from '@/modules/domain/types.ts'
import { DEFAULT_RULES } from '@/modules/domain/types.ts'
import { DECK_COUNTS, PROMPT_TYPES } from '@/modules/domain/enums.ts'
import { loadSettings, saveSettings, type SessionSnapshot } from '@/modules/persistence/repository.ts'
import {
  applyAccessibilitySettings,
  normalizeAccessibilitySettings,
  type AccessibilitySettings,
} from '@/modules/accessibility/settings.ts'
import { useSessionStore } from '@/modules/session/sessionStore.ts'
import {
  getOnboardingProgress,
  STEP_META,
  type OnboardingProgress,
} from '@/modules/onboarding/onboarding.ts'

interface HomeScreenProps {
  onStartSession: (mode: TrainingMode, rules: RuleConfig) => void
  recoveryPrompt?: SessionSnapshot | null
  onRecover?: () => void
  onDiscardRecovery?: () => void
  onShowHistory?: () => void
  onDeckCountdown?: () => void
  onTrueCountDrill?: () => void
}

export function HomeScreen({ onStartSession, recoveryPrompt, onRecover, onDiscardRecovery, onShowHistory, onDeckCountdown, onTrueCountDrill }: HomeScreenProps) {
  const savedSettings = loadSettings()
  const [mode, setMode] = useState<TrainingMode>(savedSettings?.mode ?? 'playAndCount')
  const [showSettings, setShowSettings] = useState(false)
  const [rules, setRules] = useState<RuleConfig>(savedSettings?.ruleConfig ?? DEFAULT_RULES)
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>(
    normalizeAccessibilitySettings(savedSettings?.accessibility),
  )
  const [onboarding] = useState<OnboardingProgress>(() =>
    getOnboardingProgress(),
  )
  const enabledPromptTypes = useSessionStore((s) => s.enabledPromptTypes)
  const togglePromptType = useSessionStore((s) => s.togglePromptType)

  useEffect(() => {
    applyAccessibilitySettings(accessibility)
  }, [accessibility])

  useEffect(() => {
    saveSettings({ mode, ruleConfig: rules, accessibility, enabledPromptTypes })
  }, [mode, rules, accessibility, enabledPromptTypes])

  const promptTypeLabel: Record<PromptType, string> = {
    runningCount: 'Running',
    trueCount: 'True',
    bestAction: 'Best Play',
  }

  return (
    <div className="h-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute inset-0 bg-void" />
      <div className="absolute inset-0 bg-gradient-to-b from-felt-900/40 via-transparent to-felt-900/20" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-12 max-w-md w-full px-6">
        {/* Title */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gold-400/40" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400/60">
              Training System
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gold-400/40" />
          </div>
          <h1 className="font-display text-5xl text-card-white mb-2">Blackjack</h1>
          <p className="font-display text-2xl italic text-gold-400/80">Count Trainer</p>
        </div>

        {/* Onboarding path — shown until all steps complete */}
        {!onboarding.isComplete && (
          <div className="w-full">
            <p className="font-body text-[10px] uppercase tracking-wider text-white/20 mb-3 text-center">
              Learning Path
            </p>

            {/* Step progress bar */}
            <div className="flex items-center gap-1 mb-4 px-2">
              {(['deckCountdown', 'countingDrill', 'trueCount', 'playAndCount'] as const).map(
                (step, i) => {
                  const done = onboarding.completedSteps.includes(step)
                  const isCurrent = step === onboarding.currentStep
                  return (
                    <div key={step} className="flex-1 flex items-center gap-1">
                      <div
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          done
                            ? 'bg-emerald-400/60'
                            : isCurrent
                              ? 'bg-gold-400/40'
                              : 'bg-white/10'
                        }`}
                      />
                      {i < 3 && <div className="w-0.5" />}
                    </div>
                  )
                },
              )}
            </div>

            {/* Current step card */}
            <button
              onClick={() => {
                const step = onboarding.currentStep
                if (step === 'deckCountdown') onDeckCountdown?.()
                else if (step === 'countingDrill') onStartSession('countingDrill', rules)
                else if (step === 'trueCount') onTrueCountDrill?.()
                else onStartSession('playAndCount', rules)
              }}
              className="w-full rounded-xl border border-gold-400/20 bg-gold-400/[0.04] p-4 text-left hover:bg-gold-400/[0.08] transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-400/60">
                  Step {STEP_META[onboarding.currentStep].order} of 4
                </span>
                <span className="font-mono text-[10px] text-gold-400/40 group-hover:text-gold-400/80 transition-colors">
                  Start →
                </span>
              </div>
              <h3 className="font-body text-sm font-semibold text-card-white">
                {STEP_META[onboarding.currentStep].label}
              </h3>
              <p className="font-body text-xs text-white/40 mt-0.5">
                {STEP_META[onboarding.currentStep].description}
              </p>
            </button>

            {/* Completed steps */}
            {onboarding.completedSteps.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {onboarding.completedSteps.map((step) => (
                  <span
                    key={step}
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400/50 bg-emerald-400/5 rounded-full px-2.5 py-1 border border-emerald-400/10"
                  >
                    <span>✓</span> {STEP_META[step].label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode selector */}
        <div className="w-full space-y-3">
          <button
            onClick={() => setMode('playAndCount')}
            className={`w-full text-left rounded-xl border p-4 transition-all ${
              mode === 'playAndCount'
                ? 'border-gold-400/40 bg-gold-400/10'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-body text-sm font-semibold text-card-white">Play + Count</h3>
                <p className="font-body text-xs text-white/40 mt-0.5">
                  You control every hand: Hit, Hold, Double, Split, Surrender
                </p>
              </div>
              {mode === 'playAndCount' && (
                <div className="w-2 h-2 rounded-full bg-gold-400" />
              )}
            </div>
          </button>

          <button
            onClick={() => setMode('countingDrill')}
            className={`w-full text-left rounded-xl border p-4 transition-all ${
              mode === 'countingDrill'
                ? 'border-gold-400/40 bg-gold-400/10'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-body text-sm font-semibold text-card-white">Counting Drill</h3>
                <p className="font-body text-xs text-white/40 mt-0.5">
                  Auto-deal pace training focused on running count speed
                </p>
              </div>
              {mode === 'countingDrill' && (
                <div className="w-2 h-2 rounded-full bg-gold-400" />
              )}
            </div>
          </button>
        </div>

        {/* Settings toggle */}
        <div className="w-full">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 font-body text-xs uppercase tracking-wider text-white/30 hover:text-white/50 transition-colors"
          >
            <span>{showSettings ? '▾' : '▸'}</span>
            Table Rules
          </button>

          {showSettings && (
            <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              {/* Decks */}
              <div className="flex items-center justify-between">
                <label className="font-body text-xs text-white/40">Decks</label>
                <div className="flex gap-1">
                  {DECK_COUNTS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setRules({ ...rules, decks: d })}
                      className={`font-mono text-xs px-2.5 py-1 rounded transition-all ${
                        rules.decks === d
                          ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                          : 'text-white/40 border border-white/10 hover:text-white/60'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dealer hits soft 17 */}
              <div className="flex items-center justify-between">
                <label className="font-body text-xs text-white/40">Dealer Soft 17</label>
                <div className="flex gap-1">
                  {(['Hit', 'Stand'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() =>
                        setRules({ ...rules, dealerHitsSoft17: opt === 'Hit' })
                      }
                      className={`font-mono text-xs px-2.5 py-1 rounded transition-all ${
                        (opt === 'Hit') === rules.dealerHitsSoft17
                          ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                          : 'text-white/40 border border-white/10 hover:text-white/60'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* DAS */}
              <div className="flex items-center justify-between">
                <label className="font-body text-xs text-white/40">Double After Split</label>
                <button
                  onClick={() =>
                    setRules({ ...rules, doubleAfterSplit: !rules.doubleAfterSplit })
                  }
                  className={`font-mono text-xs px-2.5 py-1 rounded transition-all ${
                    rules.doubleAfterSplit
                      ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                      : 'text-white/40 border border-white/10'
                  }`}
                >
                  {rules.doubleAfterSplit ? 'On' : 'Off'}
                </button>
              </div>

              {/* Surrender */}
              <div className="flex items-center justify-between">
                <label className="font-body text-xs text-white/40">Surrender</label>
                <button
                  onClick={() =>
                    setRules({ ...rules, surrenderAllowed: !rules.surrenderAllowed })
                  }
                  className={`font-mono text-xs px-2.5 py-1 rounded transition-all ${
                    rules.surrenderAllowed
                      ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                      : 'text-white/40 border border-white/10'
                  }`}
                >
                  {rules.surrenderAllowed ? 'On' : 'Off'}
                </button>
              </div>

              {/* Speed */}
              <div className="flex items-center justify-between">
                <label className="font-body text-xs text-white/40">Deal Speed</label>
                <div className="flex gap-1">
                  {(['slow', 'normal', 'fast', 'veryFast'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setRules({ ...rules, dealSpeed: s })}
                      className={`font-mono text-xs px-2 py-1 rounded transition-all ${
                        rules.dealSpeed === s
                          ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                          : 'text-white/40 border border-white/10 hover:text-white/60'
                      }`}
                    >
                      {s === 'veryFast' ? 'V.Fast' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Penetration */}
              <div className="flex items-center justify-between">
                <label className="font-body text-xs text-white/40">Penetration</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="50"
                    max="85"
                    value={rules.penetration * 100}
                    onChange={(e) =>
                      setRules({ ...rules, penetration: parseInt(e.target.value) / 100 })
                    }
                    className="w-24 accent-gold-400"
                  />
                  <span className="font-mono text-xs text-gold-400 w-8 text-right">
                    {(rules.penetration * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Prompt types */}
              <div className="space-y-2">
                <label className="font-body text-xs text-white/40">Prompt Checks</label>
                <div className="flex flex-wrap gap-1">
                  {PROMPT_TYPES.map((type) => {
                    const enabled = enabledPromptTypes.includes(type)
                    return (
                      <button
                        key={type}
                        onClick={() => togglePromptType(type)}
                        className={`font-mono text-xs px-2.5 py-1 rounded transition-all ${
                          enabled
                            ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                            : 'text-white/40 border border-white/10 hover:text-white/60'
                        }`}
                      >
                        {promptTypeLabel[type]}
                      </button>
                    )
                  })}
                </div>
                <p className="font-body text-[10px] text-white/25">
                  Best Play prompts appear in Play + Count only.
                </p>
              </div>

              <div className="h-px bg-white/5" />

              {/* Accessibility */}
              <div className="space-y-3">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30">
                  Accessibility
                </p>

                <div className="flex items-center justify-between">
                  <label className="font-body text-xs text-white/40">High Contrast</label>
                  <button
                    onClick={() =>
                      setAccessibility((prev) => ({
                        ...prev,
                        highContrast: !prev.highContrast,
                      }))
                    }
                    className={`font-mono text-xs px-2.5 py-1 rounded transition-all ${
                      accessibility.highContrast
                        ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                        : 'text-white/40 border border-white/10'
                    }`}
                  >
                    {accessibility.highContrast ? 'On' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="font-body text-xs text-white/40">Text Size</label>
                  <div className="flex gap-1">
                    {([
                      ['normal', 'Normal'],
                      ['large', 'Large'],
                      ['xLarge', 'XL'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() =>
                          setAccessibility((prev) => ({ ...prev, textScale: value }))
                        }
                        className={`font-mono text-xs px-2.5 py-1 rounded transition-all ${
                          accessibility.textScale === value
                            ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
                            : 'text-white/40 border border-white/10 hover:text-white/60'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recovery banner */}
        {recoveryPrompt && (
          <div className="w-full rounded-xl border border-gold-400/30 bg-gold-400/5 p-4">
            <p className="font-body text-sm text-card-white mb-1">Resume interrupted session?</p>
            <p className="font-mono text-xs text-white/40 mb-3">
              {recoveryPrompt.handsPlayed} hands played · {recoveryPrompt.countChecks.length} count checks
            </p>
            <div className="flex gap-2">
              <button
                onClick={onRecover}
                className="flex-1 rounded-lg border border-gold-400/30 bg-gold-400/15 px-3 py-2 font-mono text-xs font-semibold text-gold-400 uppercase tracking-wider hover:bg-gold-400/25 transition-colors"
              >
                Resume
              </button>
              <button
                onClick={onDiscardRecovery}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Start button */}
        <button
          onClick={() => {
            onStartSession(mode, rules)
          }}
          className="w-full rounded-xl border border-gold-400/40 bg-gold-400/10 px-6 py-4 font-display text-xl text-gold-400 hover:bg-gold-400/20 transition-all group"
        >
          Begin Training
          <span className="ml-3 font-mono text-xs text-gold-400/50 group-hover:text-gold-400/80 transition-colors">
            ↵
          </span>
        </button>

        {/* Practice drills */}
        {(onDeckCountdown || onTrueCountDrill) && (
          <div className="w-full">
            <p className="font-body text-[10px] uppercase tracking-wider text-white/20 mb-2 text-center">
              Practice Drills
            </p>
            <div className="flex gap-3">
              {onDeckCountdown && (
                <button
                  onClick={onDeckCountdown}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left hover:border-white/20 transition-all"
                >
                  <h4 className="font-body text-xs font-semibold text-card-white">Deck Countdown</h4>
                  <p className="font-body text-[10px] text-white/30 mt-0.5">Count a full deck against the clock</p>
                </button>
              )}
              {onTrueCountDrill && (
                <button
                  onClick={onTrueCountDrill}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left hover:border-white/20 transition-all"
                >
                  <h4 className="font-body text-xs font-semibold text-card-white">True Count</h4>
                  <p className="font-body text-[10px] text-white/30 mt-0.5">Practice RC ÷ decks conversion</p>
                </button>
              )}
            </div>
          </div>
        )}

        {/* History link */}
        {onShowHistory && (
          <button
            onClick={onShowHistory}
            className="font-body text-xs uppercase tracking-wider text-white/20 hover:text-gold-400/60 transition-colors"
          >
            Session History
          </button>
        )}

        {/* Keyboard hints */}
        <div className="flex items-center gap-6 text-white/15">
          <div className="flex items-center gap-1.5">
            <span className="kbd">Space</span>
            <span className="text-[10px]">Pause</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="kbd">N</span>
            <span className="text-[10px]">Next</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="kbd">↵</span>
            <span className="text-[10px]">Submit</span>
          </div>
        </div>
      </div>
    </div>
  )
}
