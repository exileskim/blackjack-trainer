import { useEffect, useState, useRef } from 'react'
import type { Card, CountCheck } from '@/modules/domain/types.ts'
import type { PlayerAction } from '@/modules/domain/enums.ts'
import { useSessionStore } from '@/modules/session/sessionStore.ts'
import { handTotal, isBust, isSoft } from '@/modules/blackjack/rules.ts'
import { DEAL_SPEED_MS, DEALER_CARD_DELAY_MS, DEALER_REVEAL_DELAY_MS } from '@/modules/domain/enums.ts'
import { HandRail } from '@/ui/components/HandRail.tsx'
import { StatusBar } from '@/ui/components/StatusBar.tsx'
import { ActionBar } from '@/ui/components/ActionBar.tsx'
import { CountPromptModal } from '@/ui/components/CountPromptModal.tsx'
import { canSplit, canDouble, canDoubleAfterSplit, canSurrender } from '@/modules/blackjack/rules.ts'

interface TableScreenProps {
  onEndSession: () => void
}

// ─── BJ-029: Round phase for the timeline indicator ────────────────────────
type RoundPhase = 'deal' | 'player' | 'reveal' | 'draw' | 'result'

function currentRoundPhase(
  sessionPhase: string,
  dealerDrawQueueLen: number,
): RoundPhase {
  if (sessionPhase === 'ready' || sessionPhase === 'dealing') return 'deal'
  if (sessionPhase === 'awaitingPlayerAction') return 'player'
  if (sessionPhase === 'dealerTurn') {
    return dealerDrawQueueLen > 0 ? 'draw' : 'reveal'
  }
  return 'result'
}

const PHASE_LABELS: { key: RoundPhase; label: string }[] = [
  { key: 'deal', label: 'Deal' },
  { key: 'player', label: 'Player' },
  { key: 'reveal', label: 'Reveal' },
  { key: 'draw', label: 'Draw' },
  { key: 'result', label: 'Result' },
]

// ─── BJ-032: Dealer explainer ──────────────────────────────────────────────
function dealerExplainerText(
  dealerCards: Card[] | undefined,
  holeRevealed: boolean,
  dealerHitsSoft17: boolean,
): string | null {
  if (!dealerCards || !holeRevealed || dealerCards.length < 2) return null
  const total = handTotal(dealerCards)
  if (isBust(dealerCards)) return `Dealer busts at ${total}`
  if (total === 17 && isSoft(dealerCards) && !dealerHitsSoft17) return 'Dealer stands on soft 17'
  if (total >= 17) return `Dealer stands on ${total}`
  return null
}

export function TableScreen({ onEndSession }: TableScreenProps) {
  const store = useSessionStore()
  const [lastPromptResult, setLastPromptResult] = useState<CountCheck | null>(null)
  const autoDealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dealerTurnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didKickoffReadyRef = useRef(false)
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

  const isDealerTurn = store.phase === 'dealerTurn'
  const isResolved = store.phase === 'handResolved' || store.phase === 'countPromptOpen'

  // ─── BJ-030: Auto-advance dealer turn on timer ─────────────────────────
  useEffect(() => {
    if (store.phase !== 'dealerTurn') return

    // First call uses reveal delay, subsequent calls use card delay
    const isFirstAdvance = store.dealerDrawQueue.length > 0 &&
      store.dealerHand?.cards.length === 2 // hole card just revealed, no draws yet
    const delay = isFirstAdvance
      ? DEALER_REVEAL_DELAY_MS[store.ruleConfig.dealSpeed]
      : DEALER_CARD_DELAY_MS[store.ruleConfig.dealSpeed]

    dealerTurnTimer.current = setTimeout(() => {
      store.advanceDealerTurn()
    }, delay)

    return () => {
      if (dealerTurnTimer.current) clearTimeout(dealerTurnTimer.current)
    }
  }, [store, store.phase, store.dealerDrawQueue.length, store.ruleConfig.dealSpeed, store.dealerHand?.cards.length])

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
      if (!didKickoffReadyRef.current) {
        didKickoffReadyRef.current = true
        store.dealHand()
      }
      return
    }
    didKickoffReadyRef.current = false
  }, [store, store.phase, store.dealHand])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when prompt modal is open (it handles its own input)
      if (store.phase === 'countPromptOpen' && !lastPromptResult) return
      // Don't capture during dealer turn
      if (store.phase === 'dealerTurn') return

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

  const handlePromptSubmitCount = (enteredCount: number) => {
    const before = useSessionStore.getState().countChecks.length
    store.submitCount(enteredCount)
    const checks = useSessionStore.getState().countChecks
    if (checks.length === before) return
    const lastCheck = checks[checks.length - 1]
    if (lastCheck) setLastPromptResult(lastCheck)
  }

  const handlePromptSubmitAction = (enteredAction: PlayerAction) => {
    const before = useSessionStore.getState().countChecks.length
    store.submitBestAction(enteredAction)
    const checks = useSessionStore.getState().countChecks
    if (checks.length === before) return
    const lastCheck = checks[checks.length - 1]
    if (lastCheck) setLastPromptResult(lastCheck)
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
  const isPromptModalOpen = store.phase === 'countPromptOpen' || !!lastPromptResult

  // BJ-029: Current round phase
  const roundPhase = currentRoundPhase(store.phase, store.dealerDrawQueue.length)

  // BJ-031: Gate outcomes — only show after dealer turn completes
  const showOutcomes = isResolved

  // BJ-032: Dealer explainer — visible after dealer turn resolves in drill mode
  const explainer = (isResolved || (isDealerTurn && store.dealerDrawQueue.length === 0))
    ? dealerExplainerText(store.dealerHand?.cards, store.dealerHand?.holeCardRevealed ?? false, store.ruleConfig.dealerHitsSoft17)
    : null

  return (
    <div className="flex flex-col h-full" role="main" aria-label="Blackjack training table">
      <div aria-hidden={isPromptModalOpen}>
        {/* Status bar */}
        <StatusBar
          handNumber={store.handNumber}
          handsPlayed={store.handsPlayed}
          promptAccuracy={accuracy}
          dealSpeed={store.ruleConfig.dealSpeed}
          isPaused={store.phase === 'paused'}
          onCycleSpeed={store.cycleDealSpeed}
        />

        {/* BJ-029: Round timeline */}
        {store.handNumber > 0 && (
          <div className="flex items-center justify-center gap-0.5 sm:gap-1 px-3 sm:px-6 py-1.5 sm:py-2 border-b border-white/[0.03]">
            {PHASE_LABELS.map(({ key, label }, i) => {
              const isActive = key === roundPhase
              const isPast = PHASE_LABELS.findIndex((p) => p.key === roundPhase) > i
              // Skip 'player' label in counting drill
              if (key === 'player' && store.mode === 'countingDrill') {
                return (
                  <div key={key} className="flex items-center gap-0.5 sm:gap-1">
                    <span className="font-mono text-[7px] sm:text-[8px] uppercase tracking-widest text-white/10 line-through">
                      {label}
                    </span>
                    {i < PHASE_LABELS.length - 1 && (
                      <span className="font-mono text-[7px] sm:text-[8px] text-white/10 mx-0.5">›</span>
                    )}
                  </div>
                )
              }
              return (
                <div key={key} className="flex items-center gap-0.5 sm:gap-1">
                  <span
                    className={`font-mono text-[7px] sm:text-[8px] uppercase tracking-widest transition-colors duration-300 ${
                      isActive
                        ? 'text-gold-400'
                        : isPast
                          ? 'text-white/25'
                          : 'text-white/10'
                    }`}
                  >
                    {label}
                  </span>
                  {i < PHASE_LABELS.length - 1 && (
                    <span className={`font-mono text-[7px] sm:text-[8px] mx-0.5 ${isPast ? 'text-white/15' : 'text-white/10'}`}>›</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Table felt area */}
        <div className="flex-1 felt-surface flex flex-col justify-between py-4 sm:py-8 relative">
          {/* Decorative table edge */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-700/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-700/30 to-transparent" />

          {/* Dealer area */}
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 sm:gap-2">
            {store.dealerHand && (
              <HandRail
                cards={store.dealerHand.cards}
                label="Dealer"
                total={dealerTotal}
                holeCardHidden={!store.dealerHand.holeCardRevealed}
                resolving={isDealerTurn}
              />
            )}

            {/* BJ-032: Dealer explainer hint */}
            {explainer && store.mode === 'countingDrill' && (
              <p className="font-mono text-[9px] sm:text-[10px] text-white/25 mt-1 italic">
                {explainer}
              </p>
            )}
          </div>

          {/* Center divider with shoe info */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 py-1.5 sm:py-2">
            <div className="h-px flex-1 max-w-20 sm:max-w-32 bg-gradient-to-r from-transparent to-white/10" />
            <div className="flex items-center gap-3">
              {store.shoe && (
                <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-white/20">
                  {store.shoe.cardsRemaining()} cards
                </span>
              )}
            </div>
            <div className="h-px flex-1 max-w-20 sm:max-w-32 bg-gradient-to-l from-transparent to-white/10" />
          </div>

          {/* Player area */}
          <div className="flex-1 flex items-center justify-center">
            <div className="flex gap-3 sm:gap-6">
              {store.playerHands.map((hand, i) => (
                <HandRail
                  key={i}
                  cards={hand.cards}
                  label={store.playerHands.length > 1 ? `Hand ${i + 1}` : 'Player'}
                  total={handTotal(hand.cards)}
                  outcome={showOutcomes ? hand.outcome : undefined}
                  resolving={isDealerTurn && !hand.outcome}
                />
              ))}
              {store.playerHands.length === 0 && (
                <HandRail cards={[]} label="Player" />
              )}
            </div>
          </div>
        </div>

        {/* BJ-034: Strategy coach feedback */}
        {store.mode === 'playAndCount' && store.strategyCoachEnabled && store.lastActionFeedback && (
          <div
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-1.5 font-mono text-[10px] sm:text-[11px] transition-colors ${
              store.lastActionFeedback.isCorrect
                ? 'text-emerald-400/70'
                : 'text-red-400/80'
            }`}
            role="status"
            aria-live="polite"
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              store.lastActionFeedback.isCorrect ? 'bg-emerald-400/60' : 'bg-red-400/60'
            }`} />
            <span className="truncate">
            {store.lastActionFeedback.isCorrect
              ? store.lastActionFeedback.deviationName
                ? `Correct deviation: ${store.lastActionFeedback.deviationName}`
                : 'Correct play'
              : `Should ${store.lastActionFeedback.recommendedAction}${
                  store.lastActionFeedback.deviationName
                    ? ` (${store.lastActionFeedback.deviationName})`
                    : ''
                }`
            }
            </span>
          </div>
        )}

        {/* Action bar */}
        <ActionBar
          mode={store.mode}
          phase={store.phase}
          canHit={store.phase === 'awaitingPlayerAction'}
          canStand={store.phase === 'awaitingPlayerAction'}
          canDouble={canDoubleActive}
          canSplit={canSplitActive}
          canSurrender={canSurrenderActive}
          onHit={store.playerHit}
          onStand={store.playerStand}
          onDouble={store.playerDouble}
          onSplit={store.playerSplit}
          onSurrender={store.playerSurrender}
          onNextHand={store.dealHand}
        />

        {/* End session / coach toggle */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 pb-2 sm:pb-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {store.mode === 'playAndCount' && (
            <button
              onClick={store.toggleStrategyCoach}
              className={`font-mono text-[10px] uppercase tracking-wider transition-colors min-h-[36px] px-2 ${
                store.strategyCoachEnabled ? 'text-gold-400/50 hover:text-gold-400/80' : 'text-white/15 hover:text-white/30'
              }`}
            >
              Coach {store.strategyCoachEnabled ? 'ON' : 'OFF'}
            </button>
          )}
          <button
            onClick={() => {
              if (autoDealTimer.current) clearTimeout(autoDealTimer.current)
              if (dealerTurnTimer.current) clearTimeout(dealerTurnTimer.current)
              setLastPromptResult(null)
              store.endSession()
              onEndSession()
            }}
            className="font-body text-xs text-white/20 hover:text-white/50 transition-colors uppercase tracking-wider min-h-[36px] px-2"
          >
            End Session
          </button>
        </div>

        {/* Screen reader announcements */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {store.phase === 'paused' && 'Session paused'}
          {store.phase === 'dealerTurn' && 'Dealer is drawing'}
          {store.phase === 'handResolved' && `Hand ${store.handNumber} resolved`}
        </div>
      </div>

      {/* Count prompt modal */}
      <CountPromptModal
        isOpen={isPromptModalOpen}
        handNumber={store.handNumber}
        promptType={store.activePromptType}
        onSubmitCount={handlePromptSubmitCount}
        onSubmitAction={handlePromptSubmitAction}
        onContinue={handlePromptContinue}
        lastResult={lastPromptResult}
      />
    </div>
  )
}
