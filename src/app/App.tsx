import { useCallback, useEffect, useState } from 'react'
import { useSessionStore } from '@/modules/session/sessionStore.ts'
import { HomeScreen } from '@/ui/screens/HomeScreen.tsx'
import { TableScreen } from '@/ui/screens/TableScreen.tsx'
import { SummaryScreen } from '@/ui/screens/SummaryScreen.tsx'
import { loadActiveSession, clearActiveSession, type SessionSnapshot } from '@/modules/persistence/repository.ts'
import type { TrainingMode } from '@/modules/domain/enums.ts'
import type { RuleConfig } from '@/modules/domain/types.ts'

export function App() {
  const phase = useSessionStore((s) => s.phase)
  const handsPlayed = useSessionStore((s) => s.handsPlayed)
  const countChecks = useSessionStore((s) => s.countChecks)
  const startSession = useSessionStore((s) => s.startSession)
  const resetToIdle = useSessionStore((s) => s.resetToIdle)
  const restoreSession = useSessionStore((s) => s.restoreSession)

  const [recoveryPrompt, setRecoveryPrompt] = useState<SessionSnapshot | null>(null)

  // Check for interrupted session on mount
  useEffect(() => {
    const saved = loadActiveSession()
    if (saved && saved.handsPlayed > 0) {
      setRecoveryPrompt(saved)
    }
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
    (mode: TrainingMode, rules: RuleConfig) => {
      startSession(mode, rules)
    },
    [startSession],
  )

  const handleEndSession = useCallback(() => {
    // Phase transitions to 'completed' are handled by the store
  }, [])

  const handleNewSession = useCallback(() => {
    resetToIdle()
  }, [resetToIdle])

  if (phase === 'idle') {
    return (
      <HomeScreen
        onStartSession={handleStartSession}
        recoveryPrompt={recoveryPrompt}
        onRecover={handleRecover}
        onDiscardRecovery={handleDiscardRecovery}
      />
    )
  }

  if (phase === 'completed') {
    return (
      <SummaryScreen
        handsPlayed={handsPlayed}
        countChecks={countChecks}
        onNewSession={handleNewSession}
      />
    )
  }

  return <TableScreen onEndSession={handleEndSession} />
}
