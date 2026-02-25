# BJ-026 Progress Dashboard + BJ-025 Goals/Streaks

## Summary

Add a Progress screen showing whether accuracy and speed are improving over time, plus auto-unlocking milestones that reward consistency and skill growth. Zero configuration required.

## Architecture

### New files

- `src/modules/stats/progressTracker.ts` — computes trends, aggregates, personal records from `SessionRecord[]`
- `src/modules/stats/milestones.ts` — defines milestones, checks completion, persists unlocked state
- `src/ui/screens/ProgressScreen.tsx` — dashboard UI
- `src/ui/components/Sparkline.tsx` — pure SVG sparkline chart component

### Modified files

- `src/app/App.tsx` — add progress route
- `src/ui/screens/HomeScreen.tsx` — add Progress button, show practice streak counter
- `src/modules/session/sessionStore.ts` — call milestone check on `endSession`
- `src/modules/persistence/repository.ts` — add milestone persistence helpers

### Persistence

New localStorage key `bjt_milestones`:

```typescript
interface PersistedMilestones {
  unlocked: { id: string; unlockedAt: string }[]
}
```

No migration needed — absent key means no milestones unlocked yet.

## BJ-026: Progress Dashboard

### Layout (top to bottom)

1. **Header** — "Progress" title with back button
2. **Hero sparkline** — accuracy % across sessions, filterable by last 10 / last 30 / all
3. **Stat cards (2x2 grid)**:
   - Accuracy: last-5 avg vs overall avg, delta arrow (green up / red down)
   - Speed: last-5 avg response vs overall avg, delta arrow
   - Practice streak: consecutive days with >= 1 session
   - Sessions: total completed count
4. **Personal records** — all-time bests: highest accuracy, fastest avg response, longest correct streak, most hands. Gold highlight if set in most recent session.
5. **Milestones section** — see BJ-025 below
6. **View Full History** button — navigates to existing HistoryScreen

### progressTracker module

```typescript
interface ProgressSnapshot {
  // Trend data (session-over-session)
  sessions: { date: string; accuracy: number; avgResponseMs: number; hands: number }[]

  // Rolling averages
  recentAccuracy: number      // last 5 sessions
  overallAccuracy: number     // all sessions
  recentSpeed: number         // last 5 sessions avg ms
  overallSpeed: number        // all sessions avg ms

  // Deltas
  accuracyDelta: number       // recent - overall (positive = improving)
  speedDelta: number          // overall - recent (positive = improving, since lower is better)

  // Practice streak
  currentStreak: number       // consecutive calendar days with sessions
  longestStreak: number       // all-time longest

  // Personal records
  records: {
    bestAccuracy: { value: number; sessionId: string; date: string }
    fastestSpeed: { value: number; sessionId: string; date: string }
    longestCorrectStreak: { value: number; sessionId: string; date: string }
    mostHands: { value: number; sessionId: string; date: string }
  }

  totalSessions: number
}

function computeProgress(sessions: SessionRecord[]): ProgressSnapshot
```

### Sparkline component

Pure SVG, no dependencies. Props: `data: number[]`, `width`, `height`, `color`, `showDots`. Renders a polyline with optional dot markers. Responsive via viewBox.

## BJ-025: Goals/Streaks (Auto Milestones)

### Milestone tiers

**Bronze** (beginner):
- `first_session` — Complete your first session
- `accuracy_80` — Achieve 80% accuracy in a session
- `streak_10` — Get 10 correct in a row
- `speed_5s` — Average response under 5 seconds

**Silver** (intermediate):
- `accuracy_90` — Achieve 90% accuracy in a session
- `streak_25` — Get 25 correct in a row
- `speed_3s` — Average response under 3 seconds
- `practice_7d` — 7-day practice streak

**Gold** (advanced):
- `accuracy_95` — Achieve 95% accuracy in a session
- `streak_50` — Get 50 correct in a row
- `speed_2s` — Average response under 2 seconds
- `practice_30d` — 30-day practice streak
- `sessions_50` — Complete 50 sessions

### milestones module

```typescript
interface Milestone {
  id: string
  tier: 'bronze' | 'silver' | 'gold'
  label: string
  description: string
  check: (sessions: SessionRecord[], currentStreak: number) => MilestoneProgress
}

interface MilestoneProgress {
  isComplete: boolean
  current: number    // e.g., current streak count
  target: number     // e.g., 25
}

function checkMilestones(
  sessions: SessionRecord[],
  currentStreak: number,
  alreadyUnlocked: string[],
): { newlyUnlocked: string[]; progress: Map<string, MilestoneProgress> }

function loadMilestones(): PersistedMilestones
function saveMilestones(milestones: PersistedMilestones): void
```

### UI treatment

- Unlocked: gold border, filled icon, date achieved
- Locked: greyed border, progress bar showing current/target
- New unlock: brief gold shimmer animation on the milestone card + toast

### Integration

`sessionStore.endSession()` calls `checkMilestones()` after saving the session record. Any newly unlocked milestones are persisted and flagged for the dashboard to show celebration state.

## Data flow

```
SessionRecord[] (existing, up to 100 in localStorage)
       │
       ├──► computeProgress() ──► ProgressSnapshot ──► Dashboard UI
       │
       └──► checkMilestones() ──► newly unlocked ──► persist + toast
```

No new data collection. Everything derived from existing session history.

## Not included (YAGNI)

- Custom user-defined goals
- CSV export (BJ-027, deferred)
- Bet ramp / deep analysis UI (deferred)
- Third-party charting library
- Social/sharing features
- Leaderboards
