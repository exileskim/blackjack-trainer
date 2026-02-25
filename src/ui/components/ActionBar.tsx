interface ActionBarProps {
  mode: 'countingDrill' | 'playAndCount'
  phase: string
  insuranceOffer: {
    evenMoney: boolean
    recommendedTake: boolean
    trueCount: number
  } | null
  canHit: boolean
  canStand: boolean
  canDouble: boolean
  canSplit: boolean
  canSurrender: boolean
  onTakeInsurance: () => void
  onDeclineInsurance: () => void
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
  size = 'normal',
}: {
  label: string
  shortcut: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'primary'
  size?: 'normal' | 'large'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg font-mono text-xs sm:text-sm font-medium uppercase tracking-wider transition-all min-h-[44px] ${
        size === 'large' ? 'px-4 sm:px-6 py-2.5 sm:py-3' : 'px-3 sm:px-4 py-2 sm:py-2.5'
      } ${
        disabled
          ? 'opacity-20 cursor-not-allowed bg-white/5 text-white/30'
          : variant === 'primary'
            ? 'bg-gold-400/15 border border-gold-400/30 text-gold-400 hover:bg-gold-400/25 hover:shadow-[0_0_16px_rgba(212,175,55,0.12)]'
            : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20'
      }`}
    >
      {label}
      <span className="kbd hidden sm:inline-flex">{shortcut}</span>
    </button>
  )
}

export function ActionBar({
  mode,
  phase,
  insuranceOffer,
  canHit,
  canStand,
  canDouble,
  canSplit,
  canSurrender,
  onTakeInsurance,
  onDeclineInsurance,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onSurrender,
  onNextHand,
}: ActionBarProps) {
  const isAwaitingInsurance = phase === 'awaitingInsurance'
  const isAwaitingAction = phase === 'awaitingPlayerAction'
  const isHandResolved = phase === 'handResolved'

  return (
    <div
      className="flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4"
      role="toolbar"
      aria-label="Player actions"
    >
      {mode === 'playAndCount' && isAwaitingInsurance ? (
        <>
          <ActionButton
            label={insuranceOffer?.evenMoney ? 'Take Even' : 'Take Ins'}
            shortcut="I"
            onClick={onTakeInsurance}
            variant={insuranceOffer?.recommendedTake ? 'primary' : 'default'}
            size="large"
          />
          <ActionButton
            label={insuranceOffer?.evenMoney ? 'Decline' : 'No Ins'}
            shortcut="X"
            onClick={onDeclineInsurance}
            variant={insuranceOffer?.recommendedTake ? 'default' : 'primary'}
            size="large"
          />
        </>
      ) : mode === 'playAndCount' && isAwaitingAction ? (
        <>
          {/* Primary actions: Hit and Stand are larger */}
          <ActionButton label="Hit" shortcut="H" onClick={onHit} disabled={!canHit} size="large" />
          <ActionButton label="Stand" shortcut="S" onClick={onStand} disabled={!canStand} size="large" />
          <ActionButton label="Dbl" shortcut="D" onClick={onDouble} disabled={!canDouble} />
          <ActionButton label="Split" shortcut="P" onClick={onSplit} disabled={!canSplit} />
          {canSurrender && (
            <ActionButton label="Surr" shortcut="R" onClick={onSurrender} />
          )}
        </>
      ) : isHandResolved ? (
        <ActionButton label="Next Hand" shortcut="N" onClick={onNextHand} variant="primary" size="large" />
      ) : (
        <div className="h-[44px]" /> // Spacer to prevent layout shift
      )}
    </div>
  )
}
