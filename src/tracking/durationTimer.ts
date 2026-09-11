/**
 * Ticks at a fixed interval and reports elapsed wall-clock delta since the
 * last tick. Deliberately dumb — it has no idea about RUNNING/PAUSED;
 * the state machine decides whether to apply the delta (tickDuration()
 * no-ops unless state === RUNNING). This keeps "is time counting right now"
 * logic in exactly one place.
 */
export class DurationTimer {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTickAt: number | null = null;

  start(onTick: (deltaMs: number) => void, intervalMs = 1000): void {
    if (this.intervalId !== null) return; // already running
    this.lastTickAt = Date.now();
    this.intervalId = setInterval(() => {
      const now = Date.now();
      const delta = now - (this.lastTickAt ?? now);
      this.lastTickAt = now;
      onTick(delta);
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.lastTickAt = null;
    }
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }
}