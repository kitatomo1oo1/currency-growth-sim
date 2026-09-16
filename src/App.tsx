import { useEffect, useState } from "react";
import type { CurrencyDesign, GameState, LedgerDriver, YearRecord } from "./core/types";
import {
  startNewGame,
  loadContinuedGame,
  hasContinuableGame,
  advanceTurn,
  isGameOver,
  abandonSavedGame,
} from "./game/gameController";
import HomeScreen from "./ui/screens/HomeScreen";
import CreateCurrencyScreen from "./ui/screens/CreateCurrencyScreen";
import BirthScreen from "./ui/screens/BirthScreen";
import TurnScreen from "./ui/screens/TurnScreen";
import FinalHistoryScreen from "./ui/screens/FinalHistoryScreen";

type Screen = "home" | "create" | "birth" | "turn" | "final";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [lastRecords, setLastRecords] = useState<YearRecord[]>([]);
  const [canContinue, setCanContinue] = useState(false);
  const [turnEnded, setTurnEnded] = useState(false);
  const [policyChosenLabel, setPolicyChosenLabel] = useState("");
  const [policyEffectDrivers, setPolicyEffectDrivers] = useState<LedgerDriver[]>([]);

  useEffect(() => {
    setCanContinue(hasContinuableGame());
  }, []);

  function handleStartCreate() {
    setScreen("create");
  }

  function handleContinue() {
    const loaded = loadContinuedGame();
    if (!loaded) {
      setCanContinue(false);
      return;
    }
    setGameState(loaded);
    setLastRecords(loaded.history.slice(-5));
    setPolicyChosenLabel("");
    setPolicyEffectDrivers([]);
    setScreen(isGameOver(loaded) ? "final" : loaded.history.length === 0 ? "birth" : "turn");
  }

  function handleCurrencyCreated(design: CurrencyDesign) {
    const state = startNewGame(design);
    setGameState(state);
    setLastRecords([]);
    setScreen("birth");
  }

  function handleFirstAdvance() {
    if (!gameState) return;
    const { state, yearRecords, gameOver, policyChosenLabel: label, policyEffectDrivers: drivers } = advanceTurn(
      gameState,
      "NO_ACTION"
    );
    setGameState({ ...state });
    setLastRecords(yearRecords);
    setPolicyChosenLabel(label);
    setPolicyEffectDrivers(drivers);
    setTurnEnded(gameOver);
    setScreen("turn");
  }

  function handleAdvanceTurn(policyId: string) {
    if (!gameState) return;
    const { state, yearRecords, gameOver, policyChosenLabel: label, policyEffectDrivers: drivers } = advanceTurn(
      gameState,
      policyId
    );
    setGameState({ ...state });
    setLastRecords(yearRecords);
    setPolicyChosenLabel(label);
    setPolicyEffectDrivers(drivers);
    setTurnEnded(gameOver);
    setScreen("turn");
  }

  function handleFinish() {
    setScreen("final");
  }

  function handleReplaySameDesignNewWorld() {
    if (!gameState) return;
    handleCurrencyCreated(gameState.currencyDesign);
  }

  function handleGoHome() {
    setScreen("home");
    setCanContinue(hasContinuableGame());
  }

  function handleAbandon() {
    abandonSavedGame();
    setGameState(null);
    setCanContinue(false);
    setScreen("home");
  }

  return (
    <div className="app-shell">
      {screen === "home" && (
        <HomeScreen canContinue={canContinue} onStart={handleStartCreate} onContinue={handleContinue} />
      )}
      {screen === "create" && <CreateCurrencyScreen onComplete={handleCurrencyCreated} onBack={handleGoHome} />}
      {screen === "birth" && gameState && <BirthScreen state={gameState} onAdvance={handleFirstAdvance} />}
      {screen === "turn" && gameState && (
        <TurnScreen
          state={gameState}
          records={lastRecords}
          gameOver={turnEnded}
          policyChosenLabel={policyChosenLabel}
          policyEffectDrivers={policyEffectDrivers}
          onAdvance={handleAdvanceTurn}
          onFinish={handleFinish}
        />
      )}
      {screen === "final" && gameState && (
        <FinalHistoryScreen
          state={gameState}
          onReplaySameDesign={handleReplaySameDesignNewWorld}
          onNewCurrency={() => setScreen("create")}
          onHome={handleAbandon}
        />
      )}
    </div>
  );
}
