import { FX_API_FALLBACK_URL, FX_API_PRIMARY_URL } from "../config/constants.js";
import { currentFxSlot, getKstNowParts } from "../core/time.js";
import { proxyBaseUrl, saveState, state, syncUsdAssetFx } from "../state/store.js";
import { render } from "../ui/render/index.js";

export async function fetchFxRateFrankfurter() {
  const response = await fetch(FX_API_PRIMARY_URL);
  if (!response.ok) throw new Error("Frankfurter 환율 조회 실패");
  const data = await response.json();
  const rate = data.rates && data.rates.KRW;
  if (!rate) throw new Error("Frankfurter 응답에 KRW 없음");
  return Number(rate);
}

export async function fetchFxRateExchangeRateApi() {
  const response = await fetch(FX_API_FALLBACK_URL);
  if (!response.ok) throw new Error("ExchangeRate-API 환율 조회 실패");
  const data = await response.json();
  const rate = data.rates && data.rates.KRW;
  if (!rate) throw new Error("ExchangeRate-API 응답에 KRW 없음");
  return Number(rate);
}

export async function refreshFxRate() {
  // 자산 환율 동기화는 조회 throttle 앞에 둔다.
  //
  // 아래 조기 return 들(수동 모드 / 장 시간대 밖 / 이미 이번 슬롯에 조회함)은
  // "환율을 새로 가져올지" 만 판단해야 한다. 예전에는 동기화 코드가 이 뒤에 있어서,
  // 환율을 받아온 뒤에 등록한 USD 종목이 폼에 적힌 옛 환율을 그대로 들고 있었다.
  if (syncUsdAssetFx()) render();

  if (state.fx.mode === "manual") return;

  const { dateKey } = getKstNowParts();
  const slot = currentFxSlot();
  if (!slot) return;
  if (state.fx.lastAutoFetchDate === dateKey && state.fx.lastAutoFetchSlot === slot) return;

  const baseUrl = proxyBaseUrl();
  let usdkrw = null;
  let source = null;
  let updatedAt = new Date().toISOString();

  if (baseUrl) {
    try {
      const response = await fetch(`${baseUrl}/fxrate`);
      if (!response.ok) throw new Error("환율을 가져오지 못했습니다.");
      const data = await response.json();
      usdkrw = Number(data.usdkrw);
      if (!usdkrw) throw new Error("환율 응답이 올바르지 않습니다.");
      source = data.source === "fallback" ? "fallback" : "hana";
      updatedAt = data.updatedAt || updatedAt;
    } catch (error) {
      console.warn("프록시 환율 갱신 실패", error);
    }
  } else {
    try {
      usdkrw = await fetchFxRateFrankfurter();
      source = "frankfurter";
    } catch (primaryError) {
      try {
        usdkrw = await fetchFxRateExchangeRateApi();
        source = "exchangerate-api";
      } catch (fallbackError) {
        console.warn("환율 자동 갱신 실패", primaryError, fallbackError);
      }
    }
  }

  if (!usdkrw || !source) return;

  state.fx.usdkrw = usdkrw;
  state.fx.source = source;
  state.fx.updatedAt = updatedAt;
  state.fx.lastAutoFetchDate = dateKey;
  state.fx.lastAutoFetchSlot = slot;
  // 코인은 제외한다(USDT/KRW 로 환산해야 하므로 빗썸 시세 경로가 따로 관리).
  syncUsdAssetFx();
  // 환율도 기기마다 스스로 받아오는 값이라 서버에는 올리지 않는다.
  saveState({ snapshot: true, sync: false });
  render();
}
