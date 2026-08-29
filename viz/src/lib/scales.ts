export function linear(
  domain: [number, number],
  range: [number, number],
): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

export function sqrtScale(
  domain: [number, number],
  range: [number, number],
): (v: number) => number {
  const s = linear([Math.sqrt(domain[0]), Math.sqrt(domain[1])], range);
  return (v) => s(Math.sqrt(Math.max(0, v)));
}

export interface Band {
  center: (i: number) => number;
  start: (i: number) => number;
  width: number;
  step: number;
}

export function band(count: number, range: [number, number], paddingFrac = 0.1): Band {
  const span = range[1] - range[0];
  const step = span / count;
  const width = step * (1 - paddingFrac * 2);
  return {
    start: (i) => range[0] + i * step + step * paddingFrac,
    center: (i) => range[0] + i * step + step / 2,
    width,
    step,
  };
}

export function polar(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// Deterministic small hash of a string, mapped to [0, 1).
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}
