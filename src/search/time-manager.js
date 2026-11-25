const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class TimeManager {
  constructor(limits = {}, now = defaultNow) {
    this.now = now;
    this.startTime = now();
    this.movetime = limits.movetime > 0 ? limits.movetime : 0; // ms, 0 = unlimited
  }
  elapsed() { return this.now() - this.startTime; }
  /** Hard limit: stop immediately and discard the unfinished iteration. */
  hardExpired() { return this.movetime > 0 && this.elapsed() >= this.movetime; }
  /** Soft limit: an iteration usually costs 2-3x the previous one, so don't start one we can't finish. */
  mayStartIteration() { return this.movetime === 0 || this.elapsed() < this.movetime * 0.55; }
}
