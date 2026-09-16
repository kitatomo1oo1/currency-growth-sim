import { useMemo } from "react";
import type { LifecycleState } from "../../core/types";

interface Props {
  name: string;
  holders: number;
  trust: number; // 0..1
  lifecycle: LifecycleState;
  size?: number; // px、基準サイズ（保有者数に応じてさらに拡大する）
}

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 通貨名から一意な色相を決める。同じ名前なら常に同じ色（あなたの通貨だけの色）。 */
function colorFromName(name: string): { hue: number; fill: string; glow: string } {
  const hue = hashName(name || "coin") % 360;
  return {
    hue,
    fill: `hsl(${hue}, 62%, 58%)`,
    glow: `hsl(${hue}, 80%, 70%)`,
  };
}

type Expression = "happy" | "content" | "worried" | "sleepy" | "faded";

function pickExpression(lifecycle: LifecycleState, trust: number): Expression {
  if (lifecycle === "DEAD") return "faded";
  if (lifecycle === "DORMANT") return "sleepy";
  if (lifecycle === "STRESSED") return "worried";
  return trust > 0.6 ? "happy" : "content";
}

function Face({ expression }: { expression: Expression }) {
  const eyeY = 44;
  switch (expression) {
    case "happy":
      return (
        <g stroke="#0b0f1c" strokeWidth="3.2" strokeLinecap="round" fill="none">
          <circle cx="41" cy={eyeY} r="2.4" fill="#0b0f1c" stroke="none" />
          <circle cx="59" cy={eyeY} r="2.4" fill="#0b0f1c" stroke="none" />
          <path d="M38 58 Q50 68 62 58" />
        </g>
      );
    case "content":
      return (
        <g stroke="#0b0f1c" strokeWidth="3.2" strokeLinecap="round" fill="none">
          <circle cx="41" cy={eyeY} r="2.4" fill="#0b0f1c" stroke="none" />
          <circle cx="59" cy={eyeY} r="2.4" fill="#0b0f1c" stroke="none" />
          <path d="M40 60 Q50 64 60 60" />
        </g>
      );
    case "worried":
      return (
        <g stroke="#0b0f1c" strokeWidth="3.2" strokeLinecap="round" fill="none">
          <path d="M36 39 L45 43" />
          <path d="M64 39 L55 43" />
          <circle cx="41" cy={eyeY + 2} r="2.2" fill="#0b0f1c" stroke="none" />
          <circle cx="59" cy={eyeY + 2} r="2.2" fill="#0b0f1c" stroke="none" />
          <path d="M40 64 Q50 57 60 64" />
        </g>
      );
    case "sleepy":
      return (
        <g stroke="#0b0f1c" strokeWidth="3.2" strokeLinecap="round" fill="none">
          <path d="M37 44 Q41 47 45 44" />
          <path d="M55 44 Q59 47 63 44" />
          <path d="M43 60 Q50 62 57 60" />
        </g>
      );
    case "faded":
      return (
        <g stroke="#5a6180" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M37 39 L45 47" />
          <path d="M45 39 L37 47" />
          <path d="M55 39 L63 47" />
          <path d="M63 39 L55 47" />
          <path d="M42 61 L58 61" />
        </g>
      );
  }
}

/** 通貨に見た目の存在を与える。名前で色が決まり、保有者数に応じて育ち、状態で表情が変わる。 */
export default function CoinAvatar({ name, holders, trust, lifecycle, size = 120 }: Props) {
  const { fill, glow } = useMemo(() => colorFromName(name), [name]);
  const expression = pickExpression(lifecycle, trust);

  // holdersのlogスケールで緩やかに育つ見た目(0人->1.0倍、100万人->約1.5倍)
  const growth = 1 + Math.min(0.5, Math.log10(Math.max(1, holders)) / 12);
  const px = Math.round(size * growth);
  const muted = expression === "faded";

  return (
    <div
      style={{
        width: px,
        height: px,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        filter: muted ? "grayscale(0.6) opacity(0.6)" : undefined,
        animation: muted ? undefined : "coin-breathe 3.4s ease-in-out infinite",
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label={`${name}のシンボル`}>
        <defs>
          <radialGradient id={`coin-glow-${name}`} cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor={glow} />
            <stop offset="100%" stopColor={fill} />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill={`url(#coin-glow-${name})`} stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
        <Face expression={expression} />
      </svg>
    </div>
  );
}
