// One Euro filter (Casiez et al.) for jittery landmark coordinates. Time in seconds.

const alpha = (cutoff: number, dt: number): number => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export interface OneEuroConfig {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  constructor(private readonly cfg: OneEuroConfig) {}

  filter(value: number, tSec: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = tSec;
      return value;
    }
    const dt = tSec - this.t;
    if (!(dt > 1e-6)) return this.x;
    this.t = tSec;
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.cfg.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.cfg.minCutoff + this.cfg.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset(): void {
    this.x = null;
    this.dx = 0;
  }
}
