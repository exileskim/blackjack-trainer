import { useState } from 'react'
import type { TrainingMode } from '@/modules/domain/enums.ts'
import type { RuleConfig } from '@/modules/domain/types.ts'
import { DEFAULT_RULES } from '@/modules/domain/types.ts'
import { DECK_COUNTS } from '@/modules/domain/enums.ts'
import { loadSettings, saveSettings, type SessionSnapshot } from '@/modules/persistence/repository.ts'

interface HomeScreenProps {
  onStartSession: (mode: TrainingMode, rules: RuleConfig) => void
  recoveryPrompt?: SessionSnapshot | null
  onRecover?: () => void
  onDiscardRecovery?: () => void
}

export function HomeScreen({ onStartSession, recoveryPrompt, onRecover, onDiscardRecovery }: HomeScreenProps) {
  const savedSettings = loadSettings()
  const [mode, setMode] = useState<TrainingMode>(savedSettings?.mode ?? 'countingDrill')
  const [showSettings, setShowSettings] = useState(false)
  const [rules, setRules] = useState<RuleConfig>(savedSettings?.ruleConfig ?? DEFAULT_RULES)

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

        {/* Mode selector */}
        <div className="w-full space-y-3">
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
                  Observe hands and track the running count
                </p>
              </div>
              {mode === 'countingDrill' && (
                <div className="w-2 h-2 rounded-full bg-gold-400" />
              )}
            </div>
          </button>

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
                  Make strategy decisions while maintaining the count
                </p>
              </div>
              {mode === 'playAndCount' && (
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
            saveSettings({ mode, ruleConfig: rules })
            onStartSession(mode, rules)
          }}
          className="w-full rounded-xl border border-gold-400/40 bg-gold-400/10 px-6 py-4 font-display text-xl text-gold-400 hover:bg-gold-400/20 transition-all group"
        >
          Begin Training
          <span className="ml-3 font-mono text-xs text-gold-400/50 group-hover:text-gold-400/80 transition-colors">
            ↵
          </span>
        </button>

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
