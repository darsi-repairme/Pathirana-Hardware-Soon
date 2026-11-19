// Device-tier detection and adaptive rendering settings.
export function detectQuality() {
  const nav = navigator;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 820;
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || 4;
  const low = (coarse && small) || cores <= 4 || mem <= 4;
  return {
    tier: low ? 'low' : 'high',
    maxDpr: low ? 1.5 : 2,
    minDpr: 1,
    shadowSize: low ? 1024 : 2048,
    antialias: !low || (window.devicePixelRatio || 1) < 2,
    ambientFps: low ? 30 : 60,
  };
}

/**
 * Watches frame times and steps the pixel ratio down if the device struggles.
 * Calls onChange(newDpr) when the ratio changes.
 */
export class AdaptiveDpr {
  constructor(start, min, onChange) {
    this.dpr = start;
    this.min = min;
    this.onChange = onChange;
    this.samples = [];
    this.cooldown = 1.5; // wait for warm-up before judging
  }
  sample(dt) {
    if (this.cooldown > 0) { this.cooldown -= dt; return; }
    this.samples.push(dt);
    if (this.samples.length < 45) return;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples.length = 0;
    if (avg > 1 / 40 && this.dpr > this.min) {
      this.dpr = Math.max(this.min, +(this.dpr - 0.25).toFixed(2));
      this.onChange(this.dpr);
      this.cooldown = 1;
    }
  }
}
