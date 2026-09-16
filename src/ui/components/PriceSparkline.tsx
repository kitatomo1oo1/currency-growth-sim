interface Props {
  points: number[]; // 年ごとの価格推移
  height?: number;
}

/** 50年間の価格推移を折れ線で見せる。テキストの数字の羅列より、一目で流れがわかるように。 */
export default function PriceSparkline({ points, height = 120 }: Props) {
  if (points.length < 2) return null;

  const width = 320;
  const padding = 6;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const peakIndex = points.indexOf(max);
  const peakX = padding + (peakIndex / (points.length - 1)) * (width - padding * 2);
  const peakY = height - padding - ((max - min) / range) * (height - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="価格の推移">
      <polyline points={coords.join(" ")} fill="none" stroke="var(--accent-2)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={peakX} cy={peakY} r="3.5" fill="var(--accent-2)" />
    </svg>
  );
}
