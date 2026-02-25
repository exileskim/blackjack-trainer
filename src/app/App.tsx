import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '@/modules/session/sessionStore.ts'
import { HomeScreen } from '@/ui/screens/HomeScreen.tsx'
import { TableScreen } from '@/ui/screens/TableScreen.tsx'
import { SummaryScreen } from '@/ui/screens/SummaryScreen.tsx'
import { HistoryScreen } from '@/ui/screens/HistoryScreen.tsx'
import { DeckCountdownScreen } from '@/ui/screens/DeckCountdownScreen.tsx'
import { TrueCountDrillScreen } from '@/ui/screens/TrueCountDrillScreen.tsx'
import { MissReplayScreen } from '@/ui/screens/MissReplayScreen.tsx'
import { WongingDrillScreen } from '@/ui/screens/WongingDrillScreen.tsx'
import {
  loadActiveSession,
  clearActiveSession,
  loadSettings,
  type SessionSnapshot,
} from '@/modules/persistence/repository.ts'
import {
  applyAccessibilitySettings,
  normalizeAccessibilitySettings,
} from '@/modules/accessibility/settings.ts'
import { completeOnboardingStep } from '@/modules/onboarding/onboarding.ts'
import type { TrainingMode } from '@/modules/domain/enums.ts'
import type { CountCheck, RuleConfig } from '@/modules/domain/types.ts'

type OverlayView = 'history' | 'deckCountdown' | 'trueCountDrill' | 'missReplay' | 'wongingDrill' | null

export function App() {
  const phase = useSessionStore((s) => s.phase)
  const handsPlayed = useSessionStore((s) => s.handsPlayed)
  const countChecks = useSessionStore((s) => s.countChecks)
  const startedAt = useSessionStore((s) => s.startedAt)
  const ruleConfig = useSessionStore((s) => s.ruleConfig)
  const mode = useSessionStore((s) => s.mode)
  const startSession = useSessionStore((s) => s.startSession)
  const resetToIdle = useSessionStore((s) => s.resetToIdle)
  const restoreSession = useSessionStore((s) => s.restoreSession)

  const [recoveryPrompt, setRecoveryPrompt] = useState<SessionSnapshot | null>(() => {
    const saved = loadActiveSession()
    return saved && saved.handsPlayed > 0 ? saved : null
  })

  const [overlay, setOverlay] = useState<OverlayView>(null)
  const [missReplayChecks, setMissReplayChecks] = useState<CountCheck[]>([])
  const previousPhaseRef = useRef(phase)

  useEffect(() => {
    const savedSettings = loadSettings()
    applyAccessibilitySettings(
      normalizeAccessibilitySettings(savedSettings?.accessibility),
    )
  }, [])

  const handleRecover = useCallback(() => {
    if (recoveryPrompt) {
      restoreSession(recoveryPrompt)
      setRecoveryPrompt(null)
    }
  }, [recoveryPrompt, restoreSession])

  const handleDiscardRecovery = useCallback(() => {
    clearActiveSession()
    setRecoveryPrompt(null)
  }, [])

  const handleStartSession = useCallback(
    (selectedMode: TrainingMode, rules: RuleConfig) => {
      startSession(selectedMode, rules)
    },
    [startSession],
  )

  const handleEndSession = useCallback(() => {
    // Phase transitions to 'completed' are handled by the store
  }, [])

  const handleNewSession = useCallback(() => {
    resetToIdle()
  }, [resetToIdle])

  const goHome = useCallback(() => {
    setOverlay(null)
    setMissReplayChecks([])
  }, [])

  const handleStartMissReplay = useCallback((checks: CountCheck[]) => {
    setMissReplayChecks(checks)
    setOverlay('missReplay')
  }, [])

  useEffect(() => {
    const previousPhase = previousPhaseRef.current
    const transitionedToCompleted = phase === 'completed' && previousPhase !== 'completed'
    if (transitionedToCompleted && handsPlayed > 0) {
      if (mode === 'countingDrill') completeOnboardingStep('countingDrill')
      if (mode === 'playAndCount') completeOnboardingStep('playAndCount')
    }
    previousPhaseRef.current = phase
  }, [phase, handsPlayed, mode])

  if (overlay === 'history') {
    return <HistoryScreen onBack={goHome} />
  }

  if (overlay === 'deckCountdown') {
    return (
      <DeckCountdownScreen
        onBack={goHome}
        onComplete={() => completeOnboardingStep('deckCountdown')}
      />
    )
  }

  if (overlay === 'trueCountDrill') {
    return (
      <TrueCountDrillScreen
        onBack={goHome}
        onComplete={() => completeOnboardingStep('trueCount')}
      />
    )
  }

  if (overlay === 'wongingDrill') {
    return <WongingDrillScreen onBack={goHome} />
  }

  if (overlay === 'missReplay') {
    return <MissReplayScreen countChecks={missReplayChecks} onBack={goHome} />
  }

  if (phase === 'idle') {
    return (
      <HomeScreen
        onStartSession={handleStartSession}
        recoveryPrompt={recoveryPrompt}
        onRecover={handleRecover}
        onDiscardRecovery={handleDiscardRecovery}
        onShowHistory={() => setOverlay('history')}
        onDeckCountdown={() => setOverlay('deckCountdown')}
        onTrueCountDrill={() => setOverlay('trueCountDrill')}
        onWongingDrill={() => setOverlay('wongingDrill')}
      />
    )
  }

  if (phase === 'completed') {
    return (
      <SummaryScreen
        handsPlayed={handsPlayed}
        countChecks={countChecks}
        startedAt={startedAt}
        mode={mode}
        ruleConfig={ruleConfig}
        onNewSession={handleNewSession}
        onShowHistory={() => setOverlay('history')}
        onMissReplay={() => handleStartMissReplay(countChecks)}
      />
    )
  }

  return <TableScreen onEndSession={handleEndSession} />
}
