import type { SessionPhase } from '@/modules/domain/enums.ts'

/**
 * Valid state transitions for the session lifecycle.
 * Key = current phase, value = set of valid next phases.
 */
const TRANSITIONS: Record<SessionPhase, readonly SessionPhase[]> = {
  idle: ['ready'],
  ready: ['dealing'],
  dealing: ['awaitingPlayerAction', 'dealerTurn', 'handResolved'],
  awaitingPlayerAction: ['dealing', 'dealerTurn', 'paused'],
  dealerTurn: ['handResolved'],
  handResolved: ['dealing', 'countPromptOpen', 'completed', 'paused'],
  countPromptOpen: ['handResolved', 'paused'],
  paused: ['ready', 'dealing', 'awaitingPlayerAction', 'dealerTurn', 'handResolved', 'countPromptOpen', 'completed'],
  completed: ['idle'],
}

export function canTransition(from: SessionPhase, to: SessionPhase): boolean {
  return TRANSITIONS[from].includes(to)
}

export function assertTransition(from: SessionPhase, to: SessionPhase): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid session transition: ${from} -> ${to}`)
  }
}
