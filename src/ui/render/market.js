import { INDEX_MONITOR_LIST } from "../../config/catalog.js";
import { CRYPTO_CHANGE_EFFECT_MIN_INTERVAL_MS, CRYPTO_CHANGE_EFFECT_THRESHOLD_PP } from "../../config/constants.js";
import { fxFormatter, money, numberFormatter, pct, signedMoney } from "../../core/format.js";
import { formatClock } from "../../core/time.js";
import { summarize } from "../../domain/portfolio.js";
import { cryptoChangeEffectAt } from "../../net/crypto.js";
import { proxyBaseUrl, state } from "../../state/store.js";
import { markRealtimeChange, renderCryptoLogo, renderMetricTitle } from "../dom.js";
import { uiState } from "../uistate.js";

export function overseasPriceSourceLabel() {
  if (state.overseasPriceSource === "binance-stream") return "Binance 실시간";
  if (state.overseasPriceSource === "binance") return "Binance 기준";
  if (state.overseasPriceSource === "mixed") return "Binance+CoinGecko 기준";
  if (state.overseasPriceSource === "coingecko") return "CoinGecko 기준(폴백)";
  return "시드 데이터";
}

export function renderCryptoChangeChip(label, value) {
  const change = Number(value || 0);
  const tone = change >= 0 ? "positive" : "negative";
  return `<span class="crypto-change-chip ${tone}"><b>${label}</b>${change >= 0 ? "+" : ""}${pct(change)}</span>`;
}

export function shouldShowCryptoChangeEffect(symbol, domesticDiff) {
  const magnitude = Math.abs(domesticDiff || 0);
  if (magnitude < CRYPTO_CHANGE_EFFECT_THRESHOLD_PP) return false;
  const now = Date.now();
  const lastAt = cryptoChangeEffectAt[symbol] || 0;
  if (now - lastAt < CRYPTO_CHANGE_EFFECT_MIN_INTERVAL_MS) return false;
  cryptoChangeEffectAt[symbol] = now;
  return true;
}

export function renderMarket() {
  const list = document.querySelector("#marketList");
  const sourceLabel = overseasPriceSourceLabel();
  const ratePill = document.querySelector("#cryptoRatePill");
  if (ratePill) {
    const rate = Number(state.cryptoQuoteFx?.rate || 0);
    const source = state.cryptoQuoteFx?.source || "USDT/KRW";
    const updatedAt = state.cryptoQuoteFx?.updatedAt ? `${formatClock(state.cryptoQuoteFx.updatedAt)} 갱신` : "업데이트 대기";
    ratePill.textContent = rate ? `${source} ${fxFormatter.format(rate)} · ${updatedAt}` : `${source} 대기 중`;
  }
  const nextValues = {};
  const existingCards = list.querySelectorAll(".market-card[data-symbol]");
  const existingMap = new Map();
  existingCards.forEach((card) => existingMap.set(card.dataset.symbol, card));
  const activeSymbols = new Set();
  state.marketIndicators.forEach((item) => {
    const domesticChange = Number(item.domesticChange || 0);
    const globalChange = Number(item.globalChange || 0);
    nextValues[item.symbol] = { domestic: domesticChange, global: globalChange };
    activeSymbols.add(item.symbol);
    let row = existingMap.get(item.symbol);
    if (row) {
      const detail = row.querySelector("small");
      if (detail) detail.textContent = `국내 ${money(item.domestic)} · 해외환산 ${money(item.globalKrw)} · ${sourceLabel}`;
      const stack = row.querySelector(".crypto-change-stack");
      if (stack) stack.innerHTML = `${renderCryptoChangeChip("국내", domesticChange)}${renderCryptoChangeChip("해외", globalChange)}`;
    } else {
      row = document.createElement("div");
      row.className = "market-card";
      row.dataset.symbol = item.symbol;
      row.innerHTML = `
        <div class="market-title-row">
          ${renderCryptoLogo(item.symbol)}
          <div>${renderMetricTitle(item.symbol)}<small>국내 ${money(item.domestic)} · 해외환산 ${money(item.globalKrw)} · ${sourceLabel}</small></div>
        </div>
        <div class="crypto-change-stack">
          ${renderCryptoChangeChip("국내", domesticChange)}
          ${renderCryptoChangeChip("해외", globalChange)}
        </div>
      `;
      list.appendChild(row);
    }
    const previous = uiState.previousRealtimeValues.market[item.symbol];
    if (previous && typeof previous.domestic === "number") {
      const domesticDiff = domesticChange - previous.domestic;
      if (shouldShowCryptoChangeEffect(item.symbol, domesticDiff)) {
        markRealtimeChange(row, domesticDiff, (value) => `${value >= 0 ? "+" : ""}${pct(value)}p`);
      }
    }
  });
  existingMap.forEach((card, symbol) => {
    if (!activeSymbols.has(symbol)) {
      card.style.opacity = "0";
      card.style.transform = "scale(0.95)";
      setTimeout(() => card.remove(), 300);
    }
  });
  uiState.previousRealtimeValues.market = nextValues;
}

export function renderIndexMonitor() {
  const list = document.querySelector("#indexMonitorList");
  if (!list) return;
  const connected = Boolean(proxyBaseUrl());
  const nextValues = {};
  const snapshots = INDEX_MONITOR_LIST.map((idx) => {
    const asset = state.assetCatalog[idx.ticker];
    const quote = (state.indexQuotes || {})[idx.ticker];
    const price = quote ? quote.price : (asset ? asset.currentPrice : 0);
    const hasQuote = Boolean(quote);
    const change = hasQuote ? quote.changePercent : 0;
    nextValues[idx.ticker] = change;
    const glow = change > 0 ? "positive-glow" : change < 0 ? "negative-glow" : "neutral-glow";
    const changeClass = change > 0 ? "positive" : change < 0 ? "negative" : "neutral-text";
    const status = quote ? `실시간 · ${formatClock(quote.updatedAt)}` : (connected ? "갱신 대기" : "프록시 연결 대기");
    const changeLabel = hasQuote ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : "—";
    const logoText = idx.logoText || idx.ticker.slice(0, 2);
    const logo = idx.logo
      ? `<i class="stock-logo-frame"><img src="${idx.logo}" alt="" loading="lazy" onerror="this.remove()" /><b>${logoText}</b></i>`
      : `<i class="stock-logo-frame stock-logo-text"><b>${logoText}</b></i>`;
    return { ...idx, price, change, glow, changeClass, status, changeLabel, logo };
  });
  const cardMarkup = (idx) => `
      <div class="market-card index-card stock-index-card ${idx.group === "M7" ? "m7-index-card" : "etf-index-card"} ${idx.glow}" data-ticker="${idx.ticker}">
        ${idx.logo}
        <div>${renderMetricTitle(idx.label)}<small>${idx.group} · ${idx.ticker} · $${numberFormatter.format(idx.price)} · ${idx.status}</small></div>
        <span class="${idx.changeClass}">${idx.changeLabel}</span>
      </div>
    `;
  const track = list.querySelector(".index-track");
  const expectedCards = INDEX_MONITOR_LIST.length * 2;
  if (!track || list.querySelectorAll(".index-card").length !== expectedCards) {
    const cards = snapshots.map(cardMarkup).join("");
    list.innerHTML = `
      <div class="index-track">
        ${cards}
        <div class="index-clone" aria-hidden="true">${cards}</div>
      </div>
    `;
  } else {
    snapshots.forEach((idx) => {
      list.querySelectorAll(`.index-card[data-ticker="${idx.ticker}"]`).forEach((card) => {
        card.classList.remove("positive-glow", "negative-glow", "neutral-glow");
        card.classList.add(idx.glow);
        const detail = card.querySelector("small");
        const value = card.querySelector(":scope > span");
        if (detail) detail.textContent = `${idx.group} · ${idx.ticker} · $${numberFormatter.format(idx.price)} · ${idx.status}`;
        if (value) {
          value.className = idx.changeClass;
          value.textContent = idx.changeLabel;
        }
      });
    });
  }
  snapshots.forEach((idx) => {
    const previous = uiState.previousRealtimeValues.index[idx.ticker];
    if (typeof previous === "number") {
      list.querySelectorAll(`.index-track > .index-card[data-ticker="${idx.ticker}"]`).forEach((card) => {
        markRealtimeChange(card, nextValues[idx.ticker] - previous, (amount) => `${amount >= 0 ? "+" : ""}${amount.toFixed(2)}%`);
      });
    }
  });
  uiState.previousRealtimeValues.index = nextValues;
}

export function renderInvestorComparison() {
  const list = document.querySelector("#investorComparison");
  list.innerHTML = "";
  const total = summarize().totalValue || 1;
  const nextValues = {};
  state.investors.forEach((investor) => {
    const summary = summarize(investor.id);
    nextValues[investor.id] = summary.profit;
    const share = (summary.totalValue / total) * 100;
    const row = document.createElement("div");
    row.className = "investor-card";
    row.innerHTML = `
      <div class="avatar">${investor.initials}</div>
      <div>${renderMetricTitle(investor.name)}<small>지분 ${pct(share)} · ${summary.holdings.length}개 종목</small></div>
      <span class="${summary.profit >= 0 ? "positive" : "negative"}">${signedMoney(summary.profit)}</span>
    `;
    list.appendChild(row);
    const previous = uiState.previousRealtimeValues.investors[investor.id];
    if (typeof previous === "number") markRealtimeChange(row, summary.profit - previous);
  });
  uiState.previousRealtimeValues.investors = nextValues;
}
