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
        className="card-deal-in relative h-[5.5rem] w-[3.75rem] flex-shrink-0 rounded-lg border border-white/10 shadow-lg shadow-black/40"
        style={{ animationDelay: animDelay }}
      >
        {/* Card back pattern */}
        <div className="absolute inset-[3px] rounded-md bg-card-red overflow-hidden">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 4px,
                rgba(255,255,255,0.15) 4px,
                rgba(255,255,255,0.15) 5px
              )`,
            }}
          />
          <div className="absolute inset-2 rounded border border-white/20" />
        </div>
      </div>
    )
  }

  const symbol = SUIT_SYMBOLS[card.suit]
  const colorClass = SUIT_COLORS[card.suit]

  return (
    <div
      className="card-deal-in relative h-[5.5rem] w-[3.75rem] flex-shrink-0 rounded-lg bg-card-white shadow-lg shadow-black/40 border border-white/20"
      style={{ animationDelay: animDelay }}
    >
      {/* Top-left rank + suit */}
      <div className={`absolute top-1 left-1.5 leading-none ${colorClass}`}>
        <div className="font-mono text-[0.7rem] font-bold">{card.rank}</div>
        <div className="text-[0.65rem] -mt-0.5">{symbol}</div>
      </div>

      {/* Center suit */}
      <div className={`absolute inset-0 flex items-center justify-center ${colorClass}`}>
        <span className="text-xl">{symbol}</span>
      </div>

      {/* Bottom-right rank + suit (inverted) */}
      <div className={`absolute bottom-1 right-1.5 leading-none rotate-180 ${colorClass}`}>
        <div className="font-mono text-[0.7rem] font-bold">{card.rank}</div>
        <div className="text-[0.65rem] -mt-0.5">{symbol}</div>
      </div>
    </div>
  )
}
