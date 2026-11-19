// Opening-sequence timing (seconds) and easing helpers.
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export const ease = {
  linear: (t) => t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

/** Progress (0..1) of a phase that runs from `start` for `dur` seconds. */
export const phase = (t, start, dur, fn = ease.linear) => fn(clamp01((t - start) / dur));

/** Cinematic timeline. All values in seconds. */
export const T = {
  grid:        [0.0, 1.2],  // blueprint grid reveal
  camera:      [0.0, 6.0],  // camera dolly into final composition
  wire:        [1.0, 1.6],  // building wireframe draws
  guides:      [1.2, 1.6],  // gold construction guidelines draw
  crane:       [0.6, 1.4],  // crane fades in
  solid:       [2.4, 2.2],  // wireframe -> solid materials (rising)
  slew:        [2.5, 2.0],  // crane rotates to the work position
  trolley:     [2.7, 1.6],  // trolley travels along the jib
  lower:       [3.6, 1.6],  // beam lowers into place
  light:       [3.4, 2.6],  // cinematic lighting reveal
  supplies:    [4.5, 1.5],  // foreground hardware materials
  END:         6.2,
};
