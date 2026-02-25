import type { Rank } from '@/modules/domain/enums.ts'
import type { Card } from '@/modules/domain/types.ts'

const HI_LO_MAP: Record<Rank, -1 | 0 | 1> = {
  '2': 1,
  '3': 1,
  '4': 1,
  '5': 1,
  '6': 1,
  '7': 0,
  '8': 0,
  '9': 0,
  '10': -1,
  J: -1,
  Q: -1,
  K: -1,
  A: -1,
}

export function getHiLoValue(rank: Rank): -1 | 0 | 1 {
  return HI_LO_MAP[rank]
}

export function updateRunningCount(currentCount: number, cards: Card[]): number {
  return cards.reduce((count, card) => count + card.countValue, currentCount)
}

export function updateRunningCountSingle(currentCount: number, card: Card): number {
  return currentCount + card.countValue
}
