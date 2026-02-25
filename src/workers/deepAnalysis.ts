// Deep Analysis - Main-thread API
// Provides a typed interface for communicating with the deep analysis Web Worker.
// Falls back to synchronous computation when Web Workers are unavailable.

// Re-export computeAnalysis so the fallback path and tests can use it directly
export { computeAnalysis } from './deepAnalysis.worker.ts'

// ---- Message types for worker communication ----

export type AnalysisMode = 'fast' | 'deep'

export interface AnalysisRequest {
  readonly id: string
  readonly type: 'ev' | 'variance' | 'ror' | 'strategy' | 'full'
  readonly mode: AnalysisMode
  readonly params: AnalysisParams
}

export interface AnalysisParams {
  /** Number of hands played in the session */
  readonly handsPlayed: number
  /** Total amount wagered across all hands */
  readonly totalWagered: number
  /** Net result (profit or loss) in units */
  readonly netResult: number
  /** Per-hand bet history with outcomes */
  readonly betHistory: { units: number; outcome: string; payout: number }[]
  /** Number of decks in the shoe */
  readonly decks: number
  /** Whether the dealer hits on soft 17 */
  readonly dealerHitsSoft17: boolean
  /** Deck penetration (0-1, e.g. 0.75 = 75%) */
  readonly penetration: number
  /** Player's basic strategy accuracy (0-1) */
  readonly strategyAccuracy?: number
  /** Accuracy of index play / deviation decisions (0-1) */
  readonly deviationAccuracy?: number
  /** Accuracy of the running/true count (0-1) */
  readonly countAccuracy?: number
}

export interface AnalysisResult {
  readonly id: string
  readonly type: AnalysisRequest['type']
  readonly mode: AnalysisMode
  readonly data: AnalysisData
  readonly computeTimeMs: number
}

export interface AnalysisData {
  // EV analysis
  readonly expectedValue?: number
  readonly houseEdge?: number
  readonly playerAdvantage?: number

  // Variance analysis
  readonly standardDeviation?: number
  readonly variancePerHand?: number
  readonly nZero?: number

  // Risk of Ruin
  readonly riskOfRuin?: number
  readonly kellyFraction?: number
  readonly optimalUnitSize?: number

  // Strategy quality
  readonly costOfErrors?: number
  readonly deviationValue?: number

  // Simulation results (deep mode only)
  readonly simulations?: number
  readonly confidenceInterval?: [number, number]
  readonly ruinProbByHands?: { hands: number; probability: number }[]
}

export interface AnalysisError {
  readonly id: string
  readonly error: string
}

// ---- Worker handle interface ----

export interface AnalysisWorkerHandle {
  /** Submit an analysis request and receive a promise for the result. */
  analyze(request: Omit<AnalysisRequest, 'id'>): Promise<AnalysisResult>
  /** Cancel a pending request by ID. */
  cancel(id: string): void
  /** Terminate the worker and reject all pending requests. */
  terminate(): void
  /** Whether Web Workers are available in this environment. */
  readonly isAvailable: boolean
}

// ---- ID generation ----

let idCounter = 0

export function generateRequestId(): string {
  idCounter++
  return `analysis-${Date.now()}-${idCounter}`
}

// ---- Factory ----

export function createAnalysisWorker(): AnalysisWorkerHandle {
  const workersAvailable = typeof Worker !== 'undefined'

  // Pending request map: id -> { resolve, reject }
  const pending = new Map<
    string,
    { resolve: (result: AnalysisResult) => void; reject: (error: Error) => void }
  >()

  let worker: Worker | null = null

  function ensureWorker(): Worker | null {
    if (!workersAvailable) return null
    if (worker) return worker

    worker = new Worker(new URL('./deepAnalysis.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent<AnalysisResult | AnalysisError>) => {
      const msg = event.data
      const entry = pending.get(msg.id)
      if (!entry) return

      pending.delete(msg.id)

      if ('error' in msg) {
        entry.reject(new Error((msg as AnalysisError).error))
      } else {
        entry.resolve(msg as AnalysisResult)
      }
    }

    worker.onerror = (event: ErrorEvent) => {
      // Reject all pending requests on unrecoverable worker error
      const error = new Error(`Worker error: ${event.message}`)
      for (const [id, entry] of pending) {
        entry.reject(error)
        pending.delete(id)
      }
    }

    return worker
  }

  // Synchronous fallback for environments without Web Workers
  async function analyzeSync(
    request: AnalysisRequest,
  ): Promise<AnalysisResult> {
    // Dynamic import to avoid circular dependency at module level.
    // computeAnalysis is already re-exported above, but we import it
    // lazily here so the worker file is only loaded when needed.
    const { computeAnalysis } = await import('./deepAnalysis.worker.ts')
    const start = performance.now()
    const data = computeAnalysis(request)
    const computeTimeMs = performance.now() - start

    return {
      id: request.id,
      type: request.type,
      mode: request.mode,
      data,
      computeTimeMs,
    }
  }

  return {
    get isAvailable(): boolean {
      return workersAvailable
    },

    analyze(request: Omit<AnalysisRequest, 'id'>): Promise<AnalysisResult> {
      const id = generateRequestId()
      const fullRequest: AnalysisRequest = { ...request, id }

      const w = ensureWorker()

      if (!w) {
        // Fallback: run synchronously on the main thread
        return analyzeSync(fullRequest)
      }

      return new Promise<AnalysisResult>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        w.postMessage(fullRequest)
      })
    },

    cancel(id: string): void {
      const entry = pending.get(id)
      if (entry) {
        entry.reject(new Error(`Request ${id} was cancelled`))
        pending.delete(id)
      }
    },

    terminate(): void {
      // Reject all pending requests
      for (const [id, entry] of pending) {
        entry.reject(new Error('Worker terminated'))
        pending.delete(id)
      }

      if (worker) {
        worker.terminate()
        worker = null
      }
    },
  }
}
