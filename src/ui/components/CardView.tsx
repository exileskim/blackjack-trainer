import type { Card } from '@/modules/domain/types.ts'

const SUIT_SYMBOLS: Record<string, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
}

const SUIT_COLORS: Record<string, string> = {
  S: 'text-card-black',
  H: 'text-card-red',
  D: 'text-card-red',
  C: 'text-card-black',
}

interface CardViewProps {
  card: Card | null
  faceDown?: boolean
  index?: number
}

export function CardView({ card, faceDown = false, index = 0 }: CardViewProps) {
  const animDelay = `${index * 0.1}s`

  if (faceDown || !card) {
    return (
      <div
        className="card-deal-in relative h-20 w-14 sm:h-[5.5rem] sm:w-[3.75rem] flex-shrink-0 rounded-lg border border-white/10 shadow-lg shadow-black/50"
        style={{ animationDelay: animDelay }}
        aria-label="Face-down card"
      >
        {/* Card back pattern */}
        <div className="absolute inset-[3px] rounded-md bg-card-red overflow-hidden">
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 3px,
                rgba(255,255,255,0.12) 3px,
                rgba(255,255,255,0.12) 4px
              )`,
            }}
          />
          <div className="absolute inset-1.5 sm:inset-2 rounded border border-white/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white/15" />
          </div>
        </div>
      </div>
    )
  }

  const symbol = SUIT_SYMBOLS[card.suit]
  const colorClass = SUIT_COLORS[card.suit]

  return (
    <div
      className="card-deal-in relative h-20 w-14 sm:h-[5.5rem] sm:w-[3.75rem] flex-shrink-0 rounded-lg bg-card-white border border-white/20"
      style={{
        animationDelay: animDelay,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
      }}
      aria-label={`${card.rank} of ${card.suit === 'S' ? 'spades' : card.suit === 'H' ? 'hearts' : card.suit === 'D' ? 'diamonds' : 'clubs'}`}
    >
      {/* Top-left rank + suit */}
      <div className={`absolute top-0.5 left-1 sm:top-1 sm:left-1.5 leading-none ${colorClass}`}>
        <div className="font-mono text-[0.6rem] sm:text-[0.7rem] font-bold">{card.rank}</div>
        <div className="text-[0.55rem] sm:text-[0.65rem] -mt-0.5">{symbol}</div>
      </div>

      {/* Center suit */}
      <div className={`absolute inset-0 flex items-center justify-center ${colorClass}`}>
        <span className="text-lg sm:text-xl">{symbol}</span>
      </div>

      {/* Bottom-right rank + suit (inverted) */}
      <div className={`absolute bottom-0.5 right-1 sm:bottom-1 sm:right-1.5 leading-none rotate-180 ${colorClass}`}>
        <div className="font-mono text-[0.6rem] sm:text-[0.7rem] font-bold">{card.rank}</div>
        <div className="text-[0.55rem] sm:text-[0.65rem] -mt-0.5">{symbol}</div>
      </div>
    </div>
  )
}
