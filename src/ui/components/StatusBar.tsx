import type { DealSpeed } from '@/modules/domain/enums.ts'

const SPEED_LABELS: Record<DealSpeed, string> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
  veryFast: 'V.Fast',
}

interface StatusBarProps {
  handNumber: number
  handsPlayed: number
  promptAccuracy: number | null
  dealSpeed: DealSpeed
  isPaused: boolean
  onCycleSpeed: () => void
}

export function StatusBar({
  handNumber,
  handsPlayed,
  promptAccuracy,
  dealSpeed,
  isPaused,
  onCycleSpeed,
}: StatusBarProps) {
  return (
    <div
      className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-2.5 bg-black/40 border-b border-white/5"
      role="status"
      aria-label="Session status"
    >
      {/* Left: hand info */}
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[10px] sm:text-xs uppercase tracking-wider text-white/30 font-body hidden sm:inline">Hand</span>
          <span className="text-[10px] sm:text-xs uppercase tracking-wider text-white/30 font-body sm:hidden">#</span>
          <span className="font-mono text-xs sm:text-sm font-semibold text-card-white">{handNumber}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[10px] sm:text-xs uppercase tracking-wider text-white/30 font-body hidden sm:inline">Played</span>
          <span className="font-mono text-xs sm:text-sm font-semibold text-card-white">{handsPlayed}</span>
        </div>
        {promptAccuracy !== null && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-white/30 font-body hidden sm:inline">Accuracy</span>
            <span
              className={`font-mono text-xs sm:text-sm font-semibold ${
                promptAccuracy >= 80 ? 'text-emerald-400' : promptAccuracy >= 50 ? 'text-gold-400' : 'text-red-400'
              }`}
            >
              {promptAccuracy.toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Center: pause indicator */}
      {isPaused && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
          <span className="font-mono text-[10px] sm:text-xs uppercase tracking-wider text-gold-400">Paused</span>
        </div>
      )}

      {/* Right: speed control */}
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={onCycleSpeed}
          className="flex items-center gap-1.5 font-mono text-[10px] sm:text-xs uppercase text-white/40 hover:text-gold-400 transition-colors group min-h-[36px] min-w-[36px] justify-center sm:justify-start"
          title="Click or press ↑/↓ to change speed"
        >
          <span className="group-hover:text-gold-400">{SPEED_LABELS[dealSpeed]}</span>
          <span className="kbd text-[8px] sm:text-[9px] hidden sm:inline-flex">↑↓</span>
        </button>
        <div className="items-center gap-1.5 text-white/20 hidden sm:flex">
          <span className="kbd">Space</span>
          <span className="text-[10px]">Pause</span>
        </div>
      </div>
    </div>
  )
}
