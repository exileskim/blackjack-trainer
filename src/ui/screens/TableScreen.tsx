import { useEffect, useState, useRef } from 'react'
import { useSessionStore } from '@/modules/session/sessionStore.ts'
import { handTotal } from '@/modules/blackjack/rules.ts'
import { DEAL_SPEED_MS } from '@/modules/domain/enums.ts'
import { HandRail } from '@/ui/components/HandRail.tsx'
import { StatusBar } from '@/ui/components/StatusBar.tsx'
import { ActionBar } from '@/ui/components/ActionBar.tsx'
import { CountPromptModal } from '@/ui/components/CountPromptModal.tsx'
import { canSplit, canDouble, canDoubleAfterSplit, canSurrender } from '@/modules/blackjack/rules.ts'

interface TableScreenProps {
  onEndSession: () => void
}

export function TableScreen({ onEndSession }: TableScreenProps) {
  const store = useSessionStore()
  const [lastPromptResult, setLastPromptResult] = useState<{
    enteredCount: number
    expectedCount: number
    isCorrect: boolean
    delta: number
  } | null>(null)
  const autoDealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playerHand = store.playerHands[store.activeHandIndex]
  const canDoubleActive =
    store.phase === 'awaitingPlayerAction' &&
    !!playerHand &&
    canDouble(playerHand) &&
    (!playerHand.isSplit || canDoubleAfterSplit(playerHand, store.ruleConfig))
  const canSplitActive =
    store.phase === 'awaitingPlayerAction' &&
    !!playerHand &&
    canSplit(playerHand)
  const canSurrenderActive =
    store.phase === 'awaitingPlayerAction' &&
    !!playerHand &&
    canSurrender(playerHand, store.ruleConfig)

  const accuracy =
    store.countChecks.length > 0
      ? (store.countChecks.filter((c) => c.isCorrect).length / store.countChecks.length) * 100
      : null

  // Auto-deal in counting drill mode
  useEffect(() => {
    if (store.mode === 'countingDrill' && store.phase === 'handResolved') {
      const delay = DEAL_SPEED_MS[store.ruleConfig.dealSpeed]
      autoDealTimer.current = setTimeout(() => {
        store.dealHand()
      }, delay)
      return () => {
        if (autoDealTimer.current) clearTimeout(autoDealTimer.current)
      }
    }
  }, [store, store.phase, store.mode, store.handNumber, store.ruleConfig.dealSpeed])

  // Start dealing when session begins
  useEffect(() => {
    if (store.phase === 'ready') {
      store.dealHand()
    }
  }, [store, store.phase])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when prompt modal is open (it handles its own input)
      if (store.phase === 'countPromptOpen' && !lastPromptResult) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (store.phase === 'paused') {
            store.resume()
          } else if (store.phase !== 'idle' && store.phase !== 'completed' && store.phase !== 'countPromptOpen') {
            store.pause()
          }
          break
        case 'n':
        case 'N':
          if (store.phase === 'handResolved') {
            if (autoDealTimer.current) clearTimeout(autoDealTimer.current)
            store.dealHand()
          }
          if (lastPromptResult) {
            setLastPromptResult(null)
            store.dismissPrompt()
          }
          break
        case 'h':
        case 'H':
          if (store.phase === 'awaitingPlayerAction') store.playerHit()
          break
        case 's':
        case 'S':
          if (store.phase === 'awaitingPlayerAction') store.playerStand()
          break
        case 'd':
        case 'D':
          if (canDoubleActive) store.playerDouble()
          break
        case 'p':
        case 'P':
          if (canSplitActive) store.playerSplit()
          break
        case 'r':
        case 'R':
          if (canSurrenderActive) store.playerSurrender()
          break
        case 'ArrowUp':
          e.preventDefault()
          store.speedUp()
          break
        case 'ArrowDown':
          e.preventDefault()
          store.speedDown()
          break
        case 'Escape':
          if (lastPromptResult) {
            setLastPromptResult(null)
            store.dismissPrompt()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    store,
    lastPromptResult,
    canDoubleActive,
    canSplitActive,
    canSurrenderActive,
  ])

  const handlePromptSubmit = (enteredCount: number) => {
    const expected = store.runningCount
    const delta = enteredCount - expected
    setLastPromptResult({
      enteredCount,
      expectedCount: expected,
      isCorrect: delta === 0,
      delta,
    })
    store.submitCount(enteredCount)
  }

  const handlePromptContinue = () => {
    setLastPromptResult(null)
    store.dismissPrompt()
  }

  const dealerTotal = store.dealerHand
    ? handTotal(
        store.dealerHand.holeCardRevealed
          ? store.dealerHand.cards
          : [store.dealerHand.cards[0]!],
      )
    : 0

  return (
    <div className="flex flex-col h-full" role="main" aria-label="Blackjack training table">
      {/* Status bar */}
      <StatusBar
        handNumber={store.handNumber}
        handsPlayed={store.handsPlayed}
        promptAccuracy={accuracy}
        dealSpeed={store.ruleConfig.dealSpeed}
        isPaused={store.phase === 'paused'}
        onCycleSpeed={store.cycleDealSpeed}
      />

      {/* Table felt area */}
      <div className="flex-1 felt-surface flex flex-col justify-between py-8 relative">
        {/* Decorative table edge */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-700/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-700/30 to-transparent" />

        {/* Dealer area */}
        <div className="flex-1 flex items-center justify-center">
          {store.dealerHand && (
            <HandRail
              cards={store.dealerHand.cards}
              label="Dealer"
              total={dealerTotal}
              holeCardHidden={!store.dealerHand.holeCardRevealed}
            />
          )}
        </div>

        {/* Center divider with shoe info */}
        <div className="flex items-center justify-center gap-4 py-2">
          <div className="h-px flex-1 max-w-32 bg-gradient-to-r from-transparent to-white/10" />
          <div className="flex items-center gap-3">
            {store.shoe && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/20">
                {store.shoe.cardsRemaining()} cards
              </span>
            )}
          </div>
          <div className="h-px flex-1 max-w-32 bg-gradient-to-l from-transparent to-white/10" />
        </div>

        {/* Player area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-6">
            {store.playerHands.map((hand, i) => (
              <HandRail
                key={i}
                cards={hand.cards}
                label={store.playerHands.length > 1 ? `Hand ${i + 1}` : 'Player'}
                total={handTotal(hand.cards)}
                outcome={hand.outcome}
              />
            ))}
            {store.playerHands.length === 0 && (
              <HandRail cards={[]} label="Player" />
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <ActionBar
        mode={store.mode}
        phase={store.phase}
        canHit={store.phase === 'awaitingPlayerAction'}
        canStand={store.phase === 'awaitingPlayerAction'}
        canDouble={
          canDoubleActive
        }
        canSplit={
          canSplitActive
        }
        canSurrender={
          canSurrenderActive
        }
        onHit={store.playerHit}
        onStand={store.playerStand}
        onDouble={store.playerDouble}
        onSplit={store.playerSplit}
        onSurrender={store.playerSurrender}
        onNextHand={store.dealHand}
      />

      {/* End session button - z-60 so it's clickable above the modal backdrop */}
      <div className="relative z-60 flex justify-center pb-3">
        <button
          onClick={() => {
            if (autoDealTimer.current) clearTimeout(autoDealTimer.current)
            setLastPromptResult(null)
            store.endSession()
            onEndSession()
          }}
          className="font-body text-xs text-white/20 hover:text-white/50 transition-colors uppercase tracking-wider"
        >
          End Session
        </button>
      </div>

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {store.phase === 'paused' && 'Session paused'}
        {store.phase === 'handResolved' && `Hand ${store.handNumber} resolved`}
      </div>

      {/* Count prompt modal */}
      <CountPromptModal
        isOpen={store.phase === 'countPromptOpen' || !!lastPromptResult}
        handNumber={store.handNumber}
        onSubmit={handlePromptSubmit}
        onContinue={handlePromptContinue}
        lastResult={lastPromptResult}
      />
    </div>
  )
}
