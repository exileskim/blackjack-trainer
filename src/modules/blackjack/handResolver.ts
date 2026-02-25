import type { Card } from '@/modules/domain/types.ts'
import type { HandOutcome } from '@/modules/domain/enums.ts'
import { handTotal, isBlackjack, isBust } from './rules.ts'

export function resolveOutcome(playerCards: Card[], dealerCards: Card[]): HandOutcome {
  const playerBj = isBlackjack(playerCards)
  const dealerBj = isBlackjack(dealerCards)

  if (playerBj && dealerBj) return 'push'
  if (playerBj) return 'blackjack'
  if (dealerBj) return 'loss'

  if (isBust(playerCards)) return 'loss'
  if (isBust(dealerCards)) return 'win'

  const playerTotal = handTotal(playerCards)
  const dealerTotal = handTotal(dealerCards)

  if (playerTotal > dealerTotal) return 'win'
  if (playerTotal < dealerTotal) return 'loss'
  return 'push'
}
