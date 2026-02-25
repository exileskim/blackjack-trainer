# Blackjack Count Trainer

A web-first blackjack training app focused on Hi-Lo card counting practice.

## Core Modes
- **Play + Count** (default): You actively play each hand with `Hit`, `Hold`, `Double`, `Split`, and `Surrender` while tracking the running count.
- **Counting Drill**: Hands auto-resolve and periodic prompts ask for the running count.

## Features
- Hi-Lo running count engine
- Real blackjack rules (H17/S17, DAS, surrender, penetration)
- Prompt cadence every 4 or 5 resolved hands
- Prompt accuracy and response-time tracking
- Session autosave + recovery after interruption
- Session history and summary metrics
- Accessibility controls: high contrast + text scaling
- PWA manifest/icons for installable web experience

## Keyboard Controls
- `H`: Hit
- `S`: Hold (stand)
- `D`: Double
- `P`: Split
- `R`: Surrender
- `N`: Next hand / continue after prompt
- `Space`: Pause/resume
- `↑` / `↓`: Increase/decrease drill speed

## Development

```bash
pnpm install
pnpm dev
```

## Validation Commands

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

### Long Reliability Run (manual gate)

Run a configurable long browser reliability session (default 30 minutes):

```bash
RUN_LONG_RELIABILITY=1 RELIABILITY_DURATION_MS=1800000 pnpm test:e2e:reliability
```

## Deployment

This project uses a **web deployment pipeline** (GitHub Pages). No Windows installer pipeline is required.
