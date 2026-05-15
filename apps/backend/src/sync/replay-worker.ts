import type { SaleReplayBatchSummary } from "./sale-replay.ts";

export interface SaleReplayWorkerOptions {
  intervalMs: number;
  limit: number;
  replay(limit: number): Promise<SaleReplayBatchSummary>;
}

export interface SaleReplayWorkerStatus {
  enabled: boolean;
  running: boolean;
  inFlight: boolean;
  intervalMs: number;
  limit: number;
  runs: number;
  failures: number;
  lastRunAt?: string;
  lastSummary?: SaleReplayBatchSummary;
  lastError?: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return String(error);
}

export class SaleReplayWorker {
  private readonly intervalMs: number;
  private readonly limit: number;
  private readonly replay: (limit: number) => Promise<SaleReplayBatchSummary>;
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private runs = 0;
  private failures = 0;
  private lastRunAt: string | undefined;
  private lastSummary: SaleReplayBatchSummary | undefined;
  private lastError: string | undefined;

  constructor(options: SaleReplayWorkerOptions) {
    this.intervalMs = options.intervalMs;
    this.limit = options.limit;
    this.replay = options.replay;
  }

  start(): void {
    if (this.timer !== null) {
      return;
    }

    this.timer = setInterval(() => {
      this.runOnce().catch(() => {
        // Failure details are captured in status. Keep the worker alive.
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer === null) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(): Promise<SaleReplayBatchSummary> {
    if (this.inFlight) {
      return {
        scanned: 0,
        replayed: 0,
        skipped: 0,
        failed: 0
      };
    }

    this.inFlight = true;
    this.lastRunAt = new Date().toISOString();

    try {
      const summary = await this.replay(this.limit);
      this.runs += 1;
      this.lastSummary = summary;
      this.lastError = undefined;
      return summary;
    } catch (error) {
      this.failures += 1;
      this.lastError = errorMessage(error);
      throw error;
    } finally {
      this.inFlight = false;
    }
  }

  getStatus(): SaleReplayWorkerStatus {
    return {
      enabled: this.timer !== null,
      running: this.timer !== null,
      inFlight: this.inFlight,
      intervalMs: this.intervalMs,
      limit: this.limit,
      runs: this.runs,
      failures: this.failures,
      ...(this.lastRunAt ? { lastRunAt: this.lastRunAt } : {}),
      ...(this.lastSummary ? { lastSummary: this.lastSummary } : {}),
      ...(this.lastError ? { lastError: this.lastError } : {})
    };
  }
}
