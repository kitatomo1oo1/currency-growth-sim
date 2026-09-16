// Seeded RNG。Math.random()は使用しない（§41）。
// Master Seedから worldSeed / marketSeed / eventSeed を派生させ、独立したストリームを保つ。

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RngStream {
  /** 0以上1未満の一様乱数 */
  next(): number;
  /** min以上max未満 */
  range(min: number, max: number): number;
  /** min以上max以下の整数 */
  intRange(min: number, max: number): number;
  /** 確率pでtrue */
  chance(p: number): boolean;
  /** 重み付き選択 */
  weightedPick<T>(items: Array<{ item: T; weight: number }>): T | undefined;
}

export function createRngStream(seedString: string): RngStream {
  const seedFn = xmur3(seedString);
  const gen = mulberry32(seedFn());
  return {
    next: () => gen(),
    range: (min, max) => min + gen() * (max - min),
    intRange: (min, max) => Math.floor(min + gen() * (max - min + 1)),
    chance: (p) => gen() < p,
    weightedPick: (items) => {
      const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
      if (total <= 0) return undefined;
      let roll = gen() * total;
      for (const entry of items) {
        roll -= Math.max(0, entry.weight);
        if (roll <= 0) return entry.item;
      }
      return items[items.length - 1]?.item;
    },
  };
}

export interface DerivedSeeds {
  worldSeed: string;
  marketSeed: string;
  eventSeed: string;
}

export function deriveSeeds(masterSeed: string): DerivedSeeds {
  return {
    worldSeed: `${masterSeed}::world`,
    marketSeed: `${masterSeed}::market`,
    eventSeed: `${masterSeed}::event`,
  };
}

/** 年ごとに独立したストリームを作る（同一年内で複数箇所から呼んでも再現性を保つため、用途名を混ぜる） */
export function yearStream(baseSeed: string, year: number, purpose: string): RngStream {
  return createRngStream(`${baseSeed}::${year}::${purpose}`);
}
