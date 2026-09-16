// §42: 学習トピック一覧。表示順は 現象→暮らしへの影響→なぜ？→専門用語。採点は行わない。
export const ALL_LEARNING_TOPICS = [
  "需要と供給",
  "通貨供給",
  "インフレ",
  "デフレ",
  "バブル",
  "暴落",
  "為替",
  "通貨高",
  "通貨安",
  "流動性",
  "信用",
  "固定価格",
  "ペッグ危機",
  "金利",
] as const;

export type LearningTopic = (typeof ALL_LEARNING_TOPICS)[number];
