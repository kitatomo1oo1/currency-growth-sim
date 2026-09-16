export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (!Number.isFinite(value)) return value > 0 ? max : min;
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function clampMin0(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/** ロジスティック関数。無限発散の防止に使用（§13）。x=0で0.5、傾きkでスケール。 */
export function logistic(x: number, k = 1): number {
  return 1 / (1 + Math.exp(-k * x));
}

/** -1..1のロジスティック（自己強化系のモメンタムなどに使う） */
export function logisticSigned(x: number, k = 1): number {
  return logistic(x, k) * 2 - 1;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(denominator) || denominator === 0) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
