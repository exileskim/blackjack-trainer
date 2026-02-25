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

const OUTCOME_STYLES: Record<string, string> = {
  win: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  blackjack: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  loss: 'bg-red-500/20 text-red-400 border-red-500/40',
  surrender: 'bg-red-500/20 text-red-400 border-red-500/40',
  push: 'bg-white/10 text-white/60 border-white/20',
}

const OUTCOME_LABELS: Record<string, string> = {
  win: 'Win',
  blackjack: 'Blackjack',
  loss: 'Loss',
  surrender: 'Surrender',
  push: 'Push',
}

export function HandRail({ cards, label, total, outcome, holeCardHidden = false, resolving = false }: HandRailProps) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 sm:gap-2"
      aria-label={`${label ?? 'Hand'}${total !== undefined ? `, total ${total}` : ''}${outcome ? `, ${outcome}` : ''}${resolving ? ', resolving' : ''}`}
    >
      {/* Label + total + badge */}
      {label && (
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-body text-[10px] sm:text-xs font-medium uppercase tracking-widest text-white/40">
            {label}
          </span>
          {total !== undefined && (
            <span className="font-mono text-xs sm:text-sm font-semibold text-gold-400">
              {total}
            </span>
          )}
          {resolving && !outcome && (
            <span
              className="inline-flex items-center gap-1.5 font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gold-400/10 text-gold-400/70 border border-gold-400/20"
              style={{ animation: 'pulse-ring 1.5s ease-out infinite' }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold-400/80 animate-pulse" />
              Resolving
            </span>
          )}
          {outcome && (
            <span
              className={`badge-pop-in font-mono text-[9px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                OUTCOME_STYLES[outcome] ?? 'bg-white/10 text-white/60 border-white/20'
              }`}
            >
              {OUTCOME_LABELS[outcome] ?? outcome}
            </span>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {cards.map((card, i) => (
          <CardView
            key={`${card.rank}${card.suit}-${i}`}
            card={card}
            faceDown={holeCardHidden && i === 1}
            index={i}
          />
        ))}
        {cards.length === 0 && (
          <div className="h-20 w-14 sm:h-[5.5rem] sm:w-[3.75rem] rounded-lg border border-dashed border-white/10" />
        )}
      </div>
    </div>
  )
}
