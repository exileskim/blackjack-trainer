import type { Card } from '@/modules/domain/types.ts'
import { CardView } from './CardView.tsx'

interface HandRailProps {
  cards: Card[]
  label?: string
  total?: number
  outcome?: string
  holeCardHidden?: boolean
  resolving?: boolean
}

export function HandRail({ cards, label, total, outcome, holeCardHidden = false, resolving = false }: HandRailProps) {
  return (
    <div className="flex flex-col items-center gap-2" aria-label={`${label ?? 'Hand'}${total !== undefined ? `, total ${total}` : ''}${outcome ? `, ${outcome}` : ''}${resolving ? ', resolving' : ''}`}>
      {/* Label + total */}
      {label && (
        <div className="flex items-center gap-3">
          <span className="font-body text-xs font-medium uppercase tracking-widest text-white/40">
            {label}
          </span>
          {total !== undefined && (
            <span className="font-mono text-sm font-semibold text-gold-400">
              {total}
            </span>
          )}
          {resolving && !outcome && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gold-400/10 text-gold-400/70">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold-400/80 animate-pulse" />
              Resolving
            </span>
          )}
          {outcome && (
            <span
              className={`font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                outcome === 'win' || outcome === 'blackjack'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : outcome === 'loss' || outcome === 'surrender'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-white/10 text-white/60'
              }`}
            >
              {outcome}
            </span>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="flex items-center gap-1.5">
        {cards.map((card, i) => (
          <CardView
            key={`${card.rank}${card.suit}-${i}`}
            card={card}
            faceDown={holeCardHidden && i === 1}
            index={i}
          />
        ))}
        {cards.length === 0 && (
          <div className="h-[5.5rem] w-[3.75rem] rounded-lg border border-dashed border-white/10" />
        )}
      </div>
    </div>
  )
}
