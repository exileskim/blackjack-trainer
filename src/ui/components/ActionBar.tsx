interface ActionBarProps {
  mode: 'countingDrill' | 'playAndCount'
  phase: string
  canHit: boolean
  canStand: boolean
  canDouble: boolean
  canSplit: boolean
  canSurrender: boolean
  onHit: () => void
  onStand: () => void
  onDouble: () => void
  onSplit: () => void
  onSurrender: () => void
  onNextHand: () => void
}

function ActionButton({
  label,
  shortcut,
  onClick,
  disabled,
  variant = 'default',
}: {
  label: string
  shortcut: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'primary'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-sm font-medium uppercase tracking-wider transition-all ${
        disabled
          ? 'opacity-20 cursor-not-allowed bg-white/5 text-white/30'
          : variant === 'primary'
            ? 'bg-gold-400/15 border border-gold-400/30 text-gold-400 hover:bg-gold-400/25'
            : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
      <span className="kbd">{shortcut}</span>
    </button>
  )
}

export function ActionBar({
  mode,
  phase,
  canHit,
  canStand,
  canDouble,
  canSplit,
  canSurrender,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onSurrender,
  onNextHand,
}: ActionBarProps) {
  const isAwaitingAction = phase === 'awaitingPlayerAction'
  const isHandResolved = phase === 'handResolved'

  return (
    <div className="flex items-center justify-center gap-3 px-6 py-4" role="toolbar" aria-label="Player actions">
      {mode === 'playAndCount' && isAwaitingAction ? (
        <>
          <ActionButton label="Hit" shortcut="H" onClick={onHit} disabled={!canHit} />
          <ActionButton label="Hold" shortcut="S" onClick={onStand} disabled={!canStand} />
          <ActionButton label="Double" shortcut="D" onClick={onDouble} disabled={!canDouble} />
          <ActionButton label="Split" shortcut="P" onClick={onSplit} disabled={!canSplit} />
          {canSurrender && (
            <ActionButton label="Surrender" shortcut="R" onClick={onSurrender} />
          )}
        </>
      ) : isHandResolved ? (
        <ActionButton label="Next Hand" shortcut="N" onClick={onNextHand} variant="primary" />
      ) : (
        <div className="h-[2.75rem]" /> // Spacer to prevent layout shift
      )}
    </div>
  )
}
