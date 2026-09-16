import type { GameState } from "../types";
import { clamp01 } from "./mathUtils";

/**
 * 国はプレイヤー通貨に依存しない外生変数のみを緩やかに変化させる。
 * プレイヤー通貨のStateをここから直接書き換えることは禁止（責務分離、仕様監査§1）。
 */
export function updateCountries(state: GameState): void {
  for (const country of Object.values(state.countries)) {
    // World要因を受けて既存通貨信用・デジタル対応度がゆっくり動く
    const growthEffect = state.world.globalGrowth * 0.01;
    country.digitalReadiness = clamp01(country.digitalReadiness + 0.005 + growthEffect * 0.2);

    const crisisDrag = state.world.globalCrisisPressure * 0.02;
    country.incumbentCurrencyTrust = clamp01(country.incumbentCurrencyTrust - crisisDrag + 0.01);

    // 人口はゆるやかに増加（上限は設けるがゲーム内では実質到達しない）
    country.population = Math.min(country.population * 1.004, 2_000_000_000);
  }
}
