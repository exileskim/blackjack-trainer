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
  onWongingDrill?: () => void
  onProgress?: () => void
}

export function HomeScreen({
  onStartSession,
  recoveryPrompt,
  onRecover,
  onDiscardRecovery,
  onShowHistory,
  onDeckCountdown,
  onTrueCountDrill,
  onWongingDrill,
  onProgress,
}: HomeScreenProps) {
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
    <div className="h-full flex flex-col items-center relative overflow-y-auto overflow-x-hidden">
      {/* Background */}
      <div className="screen-bg" />

      <div className="relative z-10 flex flex-col items-center gap-10 max-w-md w-full px-6 py-12">
        {/* ─── Title ─── */}
        <div className="text-center anim-fade-up anim-delay-1">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold-400/30" />
            <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-gold-400/50">
              Training System
            </span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold-400/30" />
          </div>
          <h1 className="font-display text-5xl text-card-white mb-3 tracking-tight">
            Blackjack
          </h1>
          <p className="font-display text-2xl italic text-shimmer">
            Count Trainer
          </p>
        </div>

        {/* ─── Onboarding ─── */}
        {!onboarding.isComplete && (
          <div className="w-full anim-fade-up anim-delay-2">
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
                        className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
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
              className="w-full rounded-xl border border-gold-400/20 bg-gold-400/[0.04] p-4 text-left hover:bg-gold-400/[0.08] hover:border-gold-400/30 transition-all group"
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

        {/* ─── Mode selector ─── */}
        <div className="w-full space-y-3 anim-fade-up anim-delay-3">
          <ModeCard
            title="Play + Count"
            description="You control every hand: Hit, Stand, Double, Split, Surrender"
            isActive={mode === 'playAndCount'}
            onClick={() => setMode('playAndCount')}
          />
          <ModeCard
            title="Counting Drill"
            description="Auto-deal pace training focused on running count speed"
            isActive={mode === 'countingDrill'}
            onClick={() => setMode('countingDrill')}
          />
        </div>

        {/* ─── Settings toggle ─── */}
        <div className="w-full anim-fade-up anim-delay-4">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 font-body text-xs uppercase tracking-wider text-white/30 hover:text-white/50 transition-colors"
          >
            <span
              className="inline-block transition-transform duration-200"
              style={{ transform: showSettings ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▸
            </span>
            Table Rules
          </button>

          {showSettings && (
            <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
              {/* Decks */}
              <SettingRow label="Decks">
                <div className="flex gap-1">
                  {DECK_COUNTS.map((d) => (
                    <SettingPill
                      key={d}
                      label={String(d)}
                      isActive={rules.decks === d}
                      onClick={() => setRules({ ...rules, decks: d })}
                    />
                  ))}
                </div>
              </SettingRow>

              {/* Dealer hits soft 17 */}
              <SettingRow label="Dealer Soft 17">
                <div className="flex gap-1">
                  {(['Hit', 'Stand'] as const).map((opt) => (
                    <SettingPill
                      key={opt}
                      label={opt}
                      isActive={(opt === 'Hit') === rules.dealerHitsSoft17}
                      onClick={() => setRules({ ...rules, dealerHitsSoft17: opt === 'Hit' })}
                    />
                  ))}
                </div>
              </SettingRow>

              {/* DAS */}
              <SettingRow label="Double After Split">
                <SettingPill
                  label={rules.doubleAfterSplit ? 'On' : 'Off'}
                  isActive={rules.doubleAfterSplit}
                  onClick={() => setRules({ ...rules, doubleAfterSplit: !rules.doubleAfterSplit })}
                />
              </SettingRow>

              {/* Surrender */}
              <SettingRow label="Surrender">
                <SettingPill
                  label={rules.surrenderAllowed ? 'On' : 'Off'}
                  isActive={rules.surrenderAllowed}
                  onClick={() => setRules({ ...rules, surrenderAllowed: !rules.surrenderAllowed })}
                />
              </SettingRow>

              {/* Speed */}
              <SettingRow label="Deal Speed">
                <div className="flex gap-1">
                  {(['slow', 'normal', 'fast', 'veryFast'] as const).map((s) => (
                    <SettingPill
                      key={s}
                      label={s === 'veryFast' ? 'V.Fast' : s.charAt(0).toUpperCase() + s.slice(1)}
                      isActive={rules.dealSpeed === s}
                      onClick={() => setRules({ ...rules, dealSpeed: s })}
                    />
                  ))}
                </div>
              </SettingRow>

              {/* Penetration */}
              <SettingRow label="Penetration">
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
              </SettingRow>

              {/* Prompt types */}
              <div className="space-y-2">
                <label className="font-body text-xs text-white/40">Prompt Checks</label>
                <div className="flex flex-wrap gap-1">
                  {PROMPT_TYPES.map((type) => (
                    <SettingPill
                      key={type}
                      label={promptTypeLabel[type]}
                      isActive={enabledPromptTypes.includes(type)}
                      onClick={() => togglePromptType(type)}
                    />
                  ))}
                </div>
                <p className="font-body text-[10px] text-white/20">
                  Best Play prompts appear in Play + Count only.
                </p>
              </div>

              <div className="divider-gold" />

              {/* Accessibility */}
              <div className="space-y-3">
                <p className="font-body text-[10px] uppercase tracking-wider text-white/30">
                  Accessibility
                </p>

                <SettingRow label="High Contrast">
                  <SettingPill
                    label={accessibility.highContrast ? 'On' : 'Off'}
                    isActive={accessibility.highContrast}
                    onClick={() =>
                      setAccessibility((prev) => ({ ...prev, highContrast: !prev.highContrast }))
                    }
                  />
                </SettingRow>

                <SettingRow label="Text Size">
                  <div className="flex gap-1">
                    {([
                      ['normal', 'Normal'],
                      ['large', 'Large'],
                      ['xLarge', 'XL'],
                    ] as const).map(([value, label]) => (
                      <SettingPill
                        key={value}
                        label={label}
                        isActive={accessibility.textScale === value}
                        onClick={() =>
                          setAccessibility((prev) => ({ ...prev, textScale: value }))
                        }
                      />
                    ))}
                  </div>
                </SettingRow>
              </div>
            </div>
          )}
        </div>

        {/* ─── Recovery banner ─── */}
        {recoveryPrompt && (
          <div className="w-full rounded-xl border border-gold-400/30 bg-gold-400/5 p-4 anim-fade-up">
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

        {/* ─── Start button ─── */}
        <button
          onClick={() => onStartSession(mode, rules)}
          className="w-full rounded-xl border border-gold-400/40 bg-gold-400/10 px-6 py-4 font-display text-xl text-gold-400 hover:bg-gold-400/20 hover:border-gold-400/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] transition-all group anim-fade-up anim-delay-5"
        >
          Begin Training
          <span className="ml-3 font-mono text-xs text-gold-400/40 group-hover:text-gold-400/70 transition-colors">
            ↵
          </span>
        </button>

        {/* ─── Practice Drills ─── */}
        <div className="w-full anim-fade-up anim-delay-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-white/5" />
            <p className="font-body text-[10px] uppercase tracking-wider text-white/20">
              Practice Drills
            </p>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {onDeckCountdown && (
              <DrillCard
                title="Deck Countdown"
                description="Count a full deck against the clock"
                onClick={onDeckCountdown}
              />
            )}
            {onTrueCountDrill && (
              <DrillCard
                title="True Count"
                description="Practice RC ÷ decks conversion"
                onClick={onTrueCountDrill}
              />
            )}
            {onWongingDrill && (
              <DrillCard
                title="Wonging"
                description="Back-counting entry & exit decisions"
                onClick={onWongingDrill}
                accent
              />
            )}
            <DrillCard
              title="Miss Replay"
              description="Review errors from past sessions"
              onClick={onShowHistory}
              subtle
            />
          </div>
        </div>

        {/* ─── Progress & History links ─── */}
        <div className="flex items-center gap-4 anim-fade-up anim-delay-7">
          {onProgress && (
            <button
              onClick={onProgress}
              className="font-body text-xs uppercase tracking-wider text-gold-400/40 hover:text-gold-400/70 transition-colors"
            >
              Progress
            </button>
          )}
          {onProgress && onShowHistory && (
            <span className="text-white/10 text-xs">·</span>
          )}
          {onShowHistory && (
            <button
              onClick={onShowHistory}
              className="font-body text-xs uppercase tracking-wider text-white/20 hover:text-gold-400/60 transition-colors"
            >
              History
            </button>
          )}
        </div>

        {/* ─── Keyboard hints ─── */}
        <div className="flex items-center gap-6 text-white/15 pb-4 anim-fade-up anim-delay-8">
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

/* ─── Sub-components ─── */

function ModeCard({
  title,
  description,
  isActive,
  onClick,
}: {
  title: string
  description: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
        isActive
          ? 'border-gold-400/40 bg-gold-400/10 shadow-[0_0_20px_rgba(212,175,55,0.08)]'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-body text-sm font-semibold text-card-white">{title}</h3>
          <p className="font-body text-xs text-white/40 mt-0.5">{description}</p>
        </div>
        <div
          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
            isActive
              ? 'bg-gold-400 shadow-[0_0_8px_rgba(212,175,55,0.6)]'
              : 'bg-white/10'
          }`}
        />
      </div>
    </button>
  )
}

function DrillCard({
  title,
  description,
  onClick,
  accent,
  subtle,
}: {
  title: string
  description: string
  onClick?: () => void
  accent?: boolean
  subtle?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-all group ${
        accent
          ? 'border-gold-400/15 bg-gold-400/[0.03] hover:border-gold-400/25 hover:bg-gold-400/[0.06]'
          : subtle
            ? 'border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.03]'
            : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
      }`}
    >
      <h4 className={`font-body text-xs font-semibold mb-0.5 ${
        accent ? 'text-gold-400/80 group-hover:text-gold-400' : 'text-card-white'
      }`}>
        {title}
      </h4>
      <p className="font-body text-[10px] text-white/30 leading-relaxed">
        {description}
      </p>
    </button>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <label className="font-body text-xs text-white/40">{label}</label>
      {children}
    </div>
  )
}

function SettingPill({
  label,
  isActive,
  onClick,
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-xs px-2.5 py-1 rounded transition-all duration-200 ${
        isActive
          ? 'bg-gold-400/15 text-gold-400 border border-gold-400/30'
          : 'text-white/40 border border-white/10 hover:text-white/60 hover:border-white/20'
      }`}
    >
      {label}
    </button>
  )
}
