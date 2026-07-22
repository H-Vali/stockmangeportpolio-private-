import { BINANCE_SYMBOLS, COINGECKO_IDS } from "../config/catalog.js";
import { CRYPTO_REALTIME_RENDER_INTERVAL_MS } from "../config/constants.js";
import { replayHoldings } from "../domain/portfolio.js";
import { currentUsdKrw, saveState, state } from "../state/store.js";
import { renderAllocation, renderDashboard } from "../ui/render/dashboard.js";
import { renderHoldings, renderHoldingsPreview } from "../ui/render/holdings.js";
import { renderInvestorSheet } from "../ui/render/investor.js";
import { renderInvestorComparison, renderMarket } from "../ui/render/market.js";
import { renderFx } from "../ui/render/status.js";
import { renderTrend } from "../ui/render/trend.js";

export let cryptoSocket = null;
export let cryptoDomesticTimer = null;
export let cryptoRenderTimer = null;
export let cryptoReconnectTimer = null;
export let cryptoReconnectAttempts = 0;
export let cryptoSocketShouldReconnect = false;
export let cryptoRealtimeSymbolKey = "";
export let cryptoChangeEffectAt = {};

export function cryptoTrackingSymbols() {
  const coinHoldings = replayHoldings().filter((holding) => holding.type === "코인");
  const indicatorSymbols = (state.marketIndicators || [])
    .map((item) => item.symbol?.toUpperCase())
    .filter((symbol) => BINANCE_SYMBOLS[symbol] || COINGECKO_IDS[symbol]);
  return [...new Set([
    ...coinHoldings.map((holding) => holding.ticker.toUpperCase()),
    ...indicatorSymbols
  ])];
}

export function cryptoIndicatorFor(symbol) {
  const upper = symbol.toUpperCase();
  let index = state.marketIndicators.findIndex((item) => item.symbol === upper);
  if (index < 0) {
    state.marketIndicators.push({
      symbol: upper,
      domestic: 0,
      globalKrw: 0,
      domesticChange: 0,
      globalChange: 0,
      updatedAt: null
    });
    index = state.marketIndicators.length - 1;
  }
  return state.marketIndicators[index];
}

export function applyCryptoOverseasQuote(symbol, price, change, updatedAt = new Date().toISOString()) {
  const upper = symbol.toUpperCase();
  const quoteFx = Number(state.cryptoQuoteFx?.rate || currentUsdKrw());
  const usdPrice = Number(price);
  if (!usdPrice) return;
  const asset = state.assetCatalog[upper];
  if (asset && asset.currency !== "KRW") {
    // USD 기준으로 보유한 코인만 해외(USD) 시세로 현재가를 갱신.
    // 빗썸(KRW) 기준 코인은 applyCryptoDomesticQuote가 원화가로 갱신한다.
    asset.currentPrice = usdPrice;
    asset.currentFx = quoteFx;
  }
  const indicator = cryptoIndicatorFor(upper);
  indicator.globalKrw = usdPrice * quoteFx;
  indicator.globalChange = Number(change || indicator.globalChange || 0);
  indicator.quoteFx = quoteFx;
  indicator.quoteFxSource = state.cryptoQuoteFx?.source || "USDT/KRW";
  indicator.updatedAt = updatedAt;
}

export function applyCryptoDomesticQuote(symbol, price, change, updatedAt = new Date().toISOString()) {
  const krwPrice = Number(price);
  if (!krwPrice) return;
  const upper = symbol.toUpperCase();
  const indicator = cryptoIndicatorFor(upper);
  indicator.domestic = krwPrice;
  indicator.domesticChange = Number(change || 0);
  indicator.updatedAt = updatedAt;
  const asset = state.assetCatalog[upper];
  if (asset && asset.currency === "KRW") {
    // 빗썸(원화) 기준 코인은 국내 원화가를 현재가로 사용, 환율은 1.
    asset.currentPrice = krwPrice;
    asset.currentFx = 1;
  }
}

export function scheduleCryptoRealtimeRender() {
  if (cryptoRenderTimer) return;
  cryptoRenderTimer = setTimeout(() => {
    cryptoRenderTimer = null;
    renderDashboard();
    renderAllocation();
    renderMarket();
    renderInvestorComparison();
    renderInvestorSheet();
    renderHoldings();
    renderHoldingsPreview();
    renderTrend();
    renderFx();
  }, CRYPTO_REALTIME_RENDER_INTERVAL_MS);
}

export async function refreshCryptoQuoteFxIfStale(maxAgeMs = 30000) {
  const updatedAt = state.cryptoQuoteFx?.updatedAt ? new Date(state.cryptoQuoteFx.updatedAt).getTime() : 0;
  if (Date.now() - updatedAt < maxAgeMs && Number(state.cryptoQuoteFx?.rate || 0)) return state.cryptoQuoteFx;
  return fetchCryptoQuoteFx();
}

export async function fetchOverseasPricesBinance(symbols) {
  const overseas = {};
  for (const symbol of symbols) {
    const binanceSymbol = BINANCE_SYMBOLS[symbol];
    if (!binanceSymbol) continue;
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`);
    if (!response.ok) throw new Error(`Binance 시세를 가져오지 못했습니다: ${symbol}`);
    const data = await response.json();
    const price = Number(data.lastPrice || data.price);
    if (price) {
      overseas[symbol] = {
        price,
        change: Number(data.priceChangePercent || 0)
      };
    }
  }
  return overseas;
}

export async function fetchOverseasPricesCoinGecko(symbols) {
  const coingeckoIds = symbols.map((symbol) => COINGECKO_IDS[symbol]).filter(Boolean);
  if (!coingeckoIds.length) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds.join(",")}&vs_currencies=usd&include_24hr_change=true`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("CoinGecko 시세를 가져오지 못했습니다.");
  const data = await response.json();
  const overseas = {};
  symbols.forEach((symbol) => {
    const id = COINGECKO_IDS[symbol];
    if (data[id]?.usd) {
      overseas[symbol] = {
        price: Number(data[id].usd),
        change: Number(data[id].usd_24h_change || 0)
      };
    }
  });
  return overseas;
}

export async function fetchOverseasPrices(symbols) {
  try {
    const result = await fetchOverseasPricesBinance(symbols);
    const missing = symbols.filter((symbol) => !result[symbol]?.price);
    if (!missing.length) {
      state.overseasPriceSource = "binance";
      return result;
    }
    const fallback = await fetchOverseasPricesCoinGecko(missing);
    state.overseasPriceSource = Object.keys(result).length ? "mixed" : "coingecko";
    return { ...result, ...fallback };
  } catch (error) {
    console.warn("Binance 시세 조회 실패, CoinGecko로 폴백합니다.", error);
    state.overseasPriceSource = "coingecko";
    return fetchOverseasPricesCoinGecko(symbols);
  }
}

export async function fetchCryptoQuoteFx() {
  try {
    const response = await fetch("https://api.bithumb.com/public/ticker/USDT_KRW");
    if (!response.ok) throw new Error("빗썸 USDT/KRW 시세를 가져오지 못했습니다.");
    const data = await response.json();
    const rate = Number(data?.data?.closing_price);
    if (!rate) throw new Error("빗썸 USDT/KRW 응답이 올바르지 않습니다.");
    const quoteFx = { rate, source: "USDT/KRW", updatedAt: new Date().toISOString() };
    state.cryptoQuoteFx = quoteFx;
    return quoteFx;
  } catch (error) {
    console.warn("USDT/KRW 조회 실패, 앱 USD/KRW 환율로 폴백합니다.", error);
    const quoteFx = {
      rate: currentUsdKrw(),
      source: state.fx.mode === "manual" ? "수동 USD/KRW" : "USD/KRW",
      updatedAt: state.fx.updatedAt || new Date().toISOString()
    };
    state.cryptoQuoteFx = quoteFx;
    return quoteFx;
  }
}

export async function updateCoinQuotes() {
  const symbols = cryptoTrackingSymbols();
  if (!symbols.length) return;
  const overseas = await fetchOverseasPrices(symbols);
  const quoteFx = await fetchCryptoQuoteFx();

  for (const symbol of symbols) {
    try {
      const bithumbResponse = await fetch(`https://api.bithumb.com/public/ticker/${symbol}_KRW`);
      if (!bithumbResponse.ok) throw new Error(`빗썸 시세를 가져오지 못했습니다: ${symbol}`);
      const bithumb = await bithumbResponse.json();
      const domestic = Number(bithumb?.data?.closing_price);
      const domesticChange = Number(bithumb?.data?.fluctate_rate_24H || bithumb?.data?.fluctate_rate_24h || 0);
      const overseasQuote = overseas[symbol];
      const globalUsd = typeof overseasQuote === "number" ? overseasQuote : overseasQuote?.price;
      const globalChange = typeof overseasQuote === "number" ? 0 : Number(overseasQuote?.change || 0);
      if (globalUsd) applyCryptoOverseasQuote(symbol, globalUsd, globalChange);
      if (domestic && globalUsd) {
        const globalKrw = globalUsd * quoteFx.rate;
        const next = {
          symbol,
          domestic,
          globalKrw,
          domesticChange,
          globalChange,
          quoteFx: quoteFx.rate,
          quoteFxSource: quoteFx.source,
          updatedAt: new Date().toISOString()
        };
        const index = state.marketIndicators.findIndex((item) => item.symbol === symbol);
        if (index >= 0) state.marketIndicators[index] = next;
        else state.marketIndicators.push(next);
      }
    } catch (error) {
      console.warn("국내 코인 시세 조회를 건너뜁니다.", error);
    }
  }
}

// 코인은 Finnhub 예산과 무관하므로 보유주식/지수의 실패 백오프에 얽매이지 않고
// 독자적인 주기로 갱신한다. 해외(Binance WS)·국내(빗썸 5초 폴링)는 이미 실시간으로
// 도는 중이라, 이 함수는 그 사이 놓칠 수 있는 값을 보정하는 전체 재동기화다.
export async function refreshCoinQuotes() {
  try {
    await updateCoinQuotes();
    saveState({ snapshot: true, sync: false });
    renderDashboard();
    renderAllocation();
    renderMarket();
    renderInvestorComparison();
    renderInvestorSheet();
    renderHoldings();
    renderHoldingsPreview();
    renderTrend();
    renderFx();
  } catch (error) {
    console.warn("코인 시세 전체 동기화 실패(실시간 스트림은 별도로 계속 동작합니다)", error);
  }
}

export async function updateDomesticCoinQuotesRealtime() {
  const symbols = cryptoTrackingSymbols().filter((symbol) => BINANCE_SYMBOLS[symbol] || COINGECKO_IDS[symbol]);
  if (!symbols.length) return;
  try {
    await refreshCryptoQuoteFxIfStale();
  } catch (error) {
    console.warn("USDT/KRW 실시간 보강 갱신을 건너뜁니다.", error);
  }
  await Promise.allSettled(symbols.map(async (symbol) => {
    const response = await fetch(`https://api.bithumb.com/public/ticker/${symbol}_KRW`);
    if (!response.ok) throw new Error(`빗썸 시세를 가져오지 못했습니다: ${symbol}`);
    const data = await response.json();
    const domestic = Number(data?.data?.closing_price);
    const domesticChange = Number(data?.data?.fluctate_rate_24H || data?.data?.fluctate_rate_24h || 0);
    applyCryptoDomesticQuote(symbol, domestic, domesticChange);
  }));
  scheduleCryptoRealtimeRender();
}

export function binanceSymbolToAssetSymbol(binanceSymbol) {
  return Object.keys(BINANCE_SYMBOLS).find((symbol) => BINANCE_SYMBOLS[symbol] === binanceSymbol) || null;
}

export function startBinanceCryptoSocket(symbols) {
  if (!window.WebSocket) return;
  const streams = symbols
    .map((symbol) => BINANCE_SYMBOLS[symbol])
    .filter(Boolean)
    .map((symbol) => `${symbol.toLowerCase()}@ticker`);
  if (!streams.length) return;

  cryptoSocketShouldReconnect = true;
  clearTimeout(cryptoReconnectTimer);
  if (cryptoSocket) {
    const previousSocket = cryptoSocket;
    cryptoSocket = null;
    cryptoSocketShouldReconnect = false;
    previousSocket.close();
    cryptoSocketShouldReconnect = true;
  }

  const socket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams.join("/")}`);
  cryptoSocket = socket;
  socket.addEventListener("open", () => {
    cryptoReconnectAttempts = 0;
    state.overseasPriceSource = "binance-stream";
    renderMarket();
  });
  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      const data = payload.data || payload;
      const symbol = binanceSymbolToAssetSymbol(data.s);
      const price = Number(data.c);
      if (!symbol || !price) return;
      state.overseasPriceSource = "binance-stream";
      applyCryptoOverseasQuote(symbol, price, Number(data.P || 0), new Date(Number(data.E) || Date.now()).toISOString());
      scheduleCryptoRealtimeRender();
    } catch (error) {
      console.warn("Binance WebSocket 메시지를 처리하지 못했습니다.", error);
    }
  });
  socket.addEventListener("close", () => {
    if (cryptoSocket !== socket || !cryptoSocketShouldReconnect) return;
    cryptoReconnectAttempts += 1;
    const delay = Math.min(30000, 1500 * (2 ** Math.min(cryptoReconnectAttempts, 5)));
    cryptoReconnectTimer = setTimeout(() => startCryptoRealtime(), delay);
  });
  socket.addEventListener("error", () => {
    socket.close();
  });
}

export function startDomesticCryptoPolling() {
  clearInterval(cryptoDomesticTimer);
  updateDomesticCoinQuotesRealtime();
  cryptoDomesticTimer = setInterval(updateDomesticCoinQuotesRealtime, 5000);
}

export function startCryptoRealtime() {
  const symbols = cryptoTrackingSymbols().filter((symbol) => BINANCE_SYMBOLS[symbol] || COINGECKO_IDS[symbol]);
  const symbolKey = symbols.slice().sort().join("|");
  startDomesticCryptoPolling();
  if (symbolKey && symbolKey !== cryptoRealtimeSymbolKey) {
    cryptoRealtimeSymbolKey = symbolKey;
    startBinanceCryptoSocket(symbols);
  }
}
