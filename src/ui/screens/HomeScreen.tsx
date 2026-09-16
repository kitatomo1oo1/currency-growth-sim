interface Props {
  canContinue: boolean;
  onStart: () => void;
  onContinue: () => void;
}

export default function HomeScreen({ canContinue, onStart, onContinue }: Props) {
  return (
    <div className="screen" style={{ justifyContent: "center" }}>
      <div className="center-col">
        <span className="badge">通貨育成シミュレーション</span>
        <h1>
          もし、自分で
          <br />
          「新しいお金」を作れたら？
        </h1>
        <p>
          そのお金は50年後、どうなっているでしょう。
          <br />
          経済の知識は必要ありません。
        </p>
      </div>

      <div className="bottom-bar" style={{ marginTop: "auto" }}>
        {canContinue && (
          <button className="btn btn-secondary" style={{ marginBottom: 10 }} onClick={onContinue}>
            続きから始める
          </button>
        )}
        <button className="btn btn-primary" onClick={onStart}>
          自分のお金を作る
        </button>
      </div>
    </div>
  );
}
