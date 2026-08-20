import { DIVIDEND_TAX_RATE } from "../../config/constants.js";
import { assetTypeColor, investorColor } from "../../core/colors.js";
import { fxFormatter, money, numberFormatter, pct, qty, signedMoney, usdFormatter } from "../../core/format.js";
import { consolidatedHoldings, dividendFrequencyLabelForTicker } from "../../domain/dividend.js";
import { investorById, replayHoldings } from "../../domain/portfolio.js";
import { currentUsdKrw, state } from "../../state/store.js";
import { visibleOwnerId } from "./layout.js";
import { uiState } from "../uistate.js";

export function renderHoldings() {
  const body = document.querySelector("#holdingsTable");
  body.innerHTML = "";
  for (const item of replayHoldings(visibleOwnerId())) {
    const owner = investorById(item.ownerId);
    const row = document.createElement("tr");
    row.dataset.type = item.type;
    if (uiState.holdingsTypeFilter && item.type !== uiState.holdingsTypeFilter) row.style.display = "none";
    row.innerHTML = `
      <td><span class="asset-name"><strong>${item.ticker}</strong><small>${item.name}</small></span></td>
      <td><span class="owner-label">${owner.name}</span></td>
      <td><span class="pill">${item.type}</span></td>
      <td>${qty(item.quantity)}</td>
      <td>${money(item.avgPrice * item.avgFx)}<small class="subtext">${item.currency} ${numberFormatter.format(item.avgPrice)} · FX ${fxFormatter.format(item.avgFx)}</small></td>
      <td>${money(item.currentPrice * item.currentFx)}<small class="subtext">${item.currency} ${numberFormatter.format(item.currentPrice)} · FX ${fxFormatter.format(item.currentFx)}</small></td>
      <td>${money(item.valueKrw)}</td>
      <td class="${item.profit >= 0 ? "positive" : "negative"}">${signedMoney(item.profit)}<small class="subtext">주가 ${signedMoney(item.stockProfit)} · 환 ${signedMoney(item.fxProfit)}</small></td>
    `;
    body.appendChild(row);
  }
}

export function renderHoldingsPreview() {
  const list = document.querySelector("#holdingsPreview");
  if (!list) return;
  const top = replayHoldings(visibleOwnerId()).slice().sort((a, b) => b.valueKrw - a.valueKrw).slice(0, 3);
  if (!top.length) {
    list.innerHTML = `<p class="empty-hint">보유 종목이 없습니다.</p>`;
    return;
  }
  list.innerHTML = top.map((item) => {
    const owner = investorById(item.ownerId);
    return `
      <div class="market-card">
        <div><strong>${item.ticker}</strong><small>${owner.name} · ${money(item.valueKrw)}</small></div>
        <span class="${item.profit >= 0 ? "positive" : "negative"}">${signedMoney(item.profit)}</span>
      </div>
    `;
  }).join("");
}


export function holdingsDisplayCurrency() {
  return state.displayCurrency === "USD" ? "USD" : "KRW";
}

export function holdingMoney(valueKrw, currency = holdingsDisplayCurrency()) {
  const amount = Number(valueKrw || 0);
  if (currency === "USD") return usdFormatter.format(amount / currentUsdKrw());
  return money(amount);
}

export function signedHoldingMoney(valueKrw, currency = holdingsDisplayCurrency()) {
  const amount = Number(valueKrw || 0);
  const sign = amount >= 0 ? "+" : "-";
  if (currency === "USD") return `${sign}${usdFormatter.format(Math.abs(amount) / currentUsdKrw())}`;
  return `${amount >= 0 ? "+" : ""}${money(amount)}`;
}

export function nativePriceText(item, value) {
  const prefix = item.currency === "USD" ? "$" : "KRW ";
  return `${prefix}${numberFormatter.format(value || 0)}`;
}

export function renderHoldingsView() {
  const grid = document.querySelector("#holdingsViewGrid");
  const summaryEl = document.querySelector("#holdingsViewSummary");
  if (!grid) return;

  const ownerSelect = document.querySelector("#holdingsViewOwnerSelect");
  const typeSelect = document.querySelector("#holdingsViewTypeFilter");
  const sortSelect = document.querySelector("#holdingsViewSortSelect");
  const currencyToggle = document.querySelector("#holdingsCurrencyToggle");
  const filterStatusEl = document.querySelector("#holdingsViewFilterStatus");
  const filter = uiState.holdingsViewFilter;
  const ownerId = filter.owner || null;
  const typeFilter = filter.type || null;
  const currencyFilter = filter.currency || null;
  const displayCurrency = holdingsDisplayCurrency();
  const sortMode = sortSelect?.value || "value";

  if (ownerSelect && ownerSelect.options.length <= 1) {
    state.investors.forEach((inv) => {
      const opt = document.createElement("option");
      opt.value = inv.id;
      opt.textContent = inv.name;
      ownerSelect.appendChild(opt);
    });
  }
  // 표 안 뱃지 클릭으로 건 필터와 상단 셀렉트가 항상 같은 값을 보여주도록 동기화한다.
  if (ownerSelect) ownerSelect.value = ownerId || "";
  if (typeSelect) typeSelect.value = typeFilter || "";
  document.querySelectorAll("#holdingsCurrencyTabs [data-currency-tab]").forEach((btn) => {
    const active = (btn.dataset.currencyTab || null) === currencyFilter;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  const holdings = consolidatedHoldings(ownerId || null, typeFilter || null, currencyFilter || null);
  const totalValue = holdings.reduce((s, h) => s + h.valueKrw, 0);
  const totalProfit = holdings.reduce((s, h) => s + h.profit, 0);
  const totalDividend = holdings.reduce((s, h) => s + h.annualDividend, 0);
  const dividendAfterTax = totalDividend * (1 - DIVIDEND_TAX_RATE);
  const typeCounts = {};
  holdings.forEach((h) => { typeCounts[h.type] = (typeCounts[h.type] || 0) + 1; });
  const typeBreakdown = Object.entries(typeCounts).map(([t, c]) => `${t} ${c}`).join(" · ");

  if (currencyToggle) {
    currencyToggle.textContent = `${displayCurrency} 기준`;
    currencyToggle.setAttribute("aria-label", `${displayCurrency === "KRW" ? "달러" : "원화"} 기준으로 전환`);
  }

  if (filterStatusEl) {
    const chips = [];
    if (typeFilter) chips.push(`<span class="filter-chip" style="--type-color:${assetTypeColor(typeFilter)}">분류 · ${typeFilter}</span>`);
    if (ownerId) chips.push(`<span class="filter-chip" style="--type-color:${investorColor(ownerId, state.investors)}">투자자 · ${investorById(ownerId).name}</span>`);
    filterStatusEl.innerHTML = chips.length
      ? `${chips.join("")}<button type="button" id="holdingsViewFilterClear" class="ghost-button compact-toggle">필터 해제</button>`
      : `<span class="filter-hint">위 드롭다운 또는 표의 분류 뱃지·투자자 아이콘을 눌러 필터링하세요</span>`;
  }

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="hv-summary-item">
        <span>총 평가금액</span>
        <strong>${holdingMoney(totalValue, displayCurrency)}</strong>
      </div>
      <div class="hv-summary-item">
        <span>총 손익</span>
        <strong class="${totalProfit >= 0 ? "positive" : "negative"}">${signedHoldingMoney(totalProfit, displayCurrency)}</strong>
      </div>
      <div class="hv-summary-item">
        <span>연간 배당 (세후)</span>
        <strong>${holdingMoney(dividendAfterTax, displayCurrency)}</strong>
      </div>
      <div class="hv-summary-item">
        <span>종목 구성</span>
        <strong>${holdings.length}종목</strong>
        <small>${typeBreakdown}</small>
      </div>
    `;
  }

  const enriched = holdings.map((item) => {
    const weight = totalValue > 0 ? (item.valueKrw / totalValue) * 100 : 0;
    const returnRate = item.costKrw > 0 ? (item.profit / item.costKrw) * 100 : 0;
    const dividendAfterTaxItem = item.annualDividend * (1 - DIVIDEND_TAX_RATE);
    const dividendYield = item.valueKrw > 0 ? (dividendAfterTaxItem / item.valueKrw) * 100 : 0;
    const breakevenRise = item.profit < 0 && item.valueKrw > 0 ? ((item.costKrw / item.valueKrw) - 1) * 100 : 0;
    return { ...item, weight, returnRate, dividendAfterTaxItem, dividendYield, breakevenRise };
  });

  const sorted = enriched.slice().sort((a, b) => {
    if (sortMode === "profit") return b.profit - a.profit;
    if (sortMode === "return") return b.returnRate - a.returnRate;
    if (sortMode === "weight") return b.weight - a.weight;
    if (sortMode === "dividend") return b.dividendAfterTaxItem - a.dividendAfterTaxItem;
    if (sortMode === "type") return `${a.type}${a.ticker}`.localeCompare(`${b.type}${b.ticker}`, "ko-KR");
    return b.valueKrw - a.valueKrw;
  });

  // 정렬 select와 동일한 키를 쓰는 열만 헤더 클릭 정렬을 지원한다 (select가 단일 소스).
  // 방향 토글은 없다 — value/profit/weight/dividend는 항상 내림차순, type은 가나다순으로 select와 동일하게 동작한다.
  const sortTh = (key, label, alignRight = true) => {
    const active = sortMode === key;
    const arrow = active ? `<span class="ih-sort-arrow">▼</span>` : "";
    return `<th class="ih-sortable${alignRight ? " ih-num" : ""}${active ? " ih-sort-active" : ""}" data-hv-sort-key="${key}">${label}${arrow}</th>`;
  };

  const headHtml = `
    <thead>
      <tr role="row">
        ${sortTh("type", "분류 / 투자자", false)}
        <th>종목</th>
        ${sortTh("value", "평가금액")}
        ${sortTh("weight", "비중")}
        ${sortTh("profit", "손익 / 수익률")}
        <th class="ih-num">수량</th>
        <th class="ih-num">평단 / 현재가</th>
        ${sortTh("dividend", "배당")}
      </tr>
    </thead>
  `;

  if (!sorted.length) {
    grid.className = "table-wrap";
    grid.innerHTML = `<table class="inv-holdings-table hv-table">${headHtml}</table><p class="empty-hint">해당 조건의 보유 종목이 없습니다.</p>`;
    return;
  }

  grid.className = "table-wrap";
  grid.innerHTML = `
    <table class="inv-holdings-table hv-table">
      ${headHtml}
      <tbody>
        ${sorted.map((item) => {
    const owner = investorById(item.ownerId);
    const profitClass = item.profit >= 0 ? "positive" : "negative";
    const hasDividend = item.annualDividend > 0;
    const freqLabel = hasDividend ? dividendFrequencyLabelForTicker(item.ticker, item.dividendForecast) : null;
    const breakeven = item.breakevenRise > 0 ? `<small class="hv-breakeven">손익분기 +${pct(item.breakevenRise)} 필요</small>` : "";
    // 손익을 주가손익과 환차손익으로 갈라 보여준다.
    // 환차손익은 매입시점 평균환율(avgFx) 대비 현재 환율의 차이에서 나온 몫이라,
    // "종목은 올랐는데 환율이 빠져서 손해" 같은 상황을 이 줄 하나로 알 수 있다.
    // 원화 자산은 환차가 구조적으로 0이므로 표시하지 않는다.
    const profitSplit = item.currency === "KRW" ? "" : `
          <small class="hv-profit-split">
            <span class="${item.stockProfit >= 0 ? "positive" : "negative"}">주가 ${signedHoldingMoney(item.stockProfit, displayCurrency)}</span>
            <span class="${item.fxProfit >= 0 ? "positive" : "negative"}">환차 ${signedHoldingMoney(item.fxProfit, displayCurrency)}</span>
          </small>`;
    const dividendText = hasDividend
      ? `<span class="hv-div-freq">${freqLabel}</span><b>${holdingMoney(item.dividendAfterTaxItem, displayCurrency)}/년</b><small>${pct(item.dividendYield)}</small>`
      : `<span class="hv-empty-cell">—</span>`;

    const typeColor = assetTypeColor(item.type);
    const ownerColor = investorColor(item.ownerId, state.investors);
    return `
      <tr data-type="${item.type}">
        <td>
          <div class="hv-cell hv-owner-type">
            <button type="button" class="pill hv-filter-btn" data-filter-type="${item.type}" style="--type-color:${typeColor}" title="'${item.type}' 분류로 필터">${item.type}</button>
            <button type="button" class="hv-owner-chip hv-filter-btn" data-filter-owner="${item.ownerId}" style="--owner-color:${ownerColor}" title="'${owner.name}' 투자자로 필터">${owner.initials}</button>
            <small>${owner.name}</small>
          </div>
        </td>
        <td class="ih-name">
          <strong>${item.ticker}</strong>
          <small>${item.name}</small>
        </td>
        <td class="ih-num">
          <strong>${holdingMoney(item.valueKrw, displayCurrency)}</strong>
          <small>${displayCurrency === "USD" ? money(item.valueKrw) : usdFormatter.format(item.valueKrw / currentUsdKrw())}</small>
        </td>
        <td class="ih-num">
          <strong>${pct(item.weight)}</strong>
          <span class="hv-card-bar"><i class="hv-card-bar-fill" style="width:${Math.max(2, item.weight)}%"></i></span>
        </td>
        <td class="ih-num ${profitClass}">
          <strong class="${profitClass}">${signedHoldingMoney(item.profit, displayCurrency)}</strong>
          <small class="${profitClass}">${item.returnRate >= 0 ? "+" : ""}${pct(item.returnRate)}</small>
          ${profitSplit}
          ${breakeven}
        </td>
        <td class="ih-num">
          <strong>${qty(item.quantity)}</strong>
          <small>${item.currency}</small>
        </td>
        <td class="ih-num">
          <strong>${holdingMoney(item.avgPrice * item.avgFx, displayCurrency)}</strong>
          <small>현재 ${holdingMoney(item.currentPrice * item.currentFx, displayCurrency)}</small>
          <small class="hv-native-price">${nativePriceText(item, item.avgPrice)} → ${nativePriceText(item, item.currentPrice)}</small>
          ${item.currency === "KRW" ? "" : `<small class="hv-native-price">FX ${fxFormatter.format(item.avgFx)} → ${fxFormatter.format(item.currentFx)}</small>`}
        </td>
        <td class="ih-num hv-dividend-cell">
          ${dividendText}
        </td>
      </tr>
    `;
  }).join("")}
      </tbody>
    </table>
  `;
}
