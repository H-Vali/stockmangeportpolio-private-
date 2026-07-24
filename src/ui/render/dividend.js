import { DIVIDEND_TAX_RATE, monthNames } from "../../config/constants.js";
import { fxFormatter, money, numberFormatter, pct, qty, usdFormatter } from "../../core/format.js";
import { getKstNowParts } from "../../core/time.js";
import { dividendPayoutsByMonth, dividendRows } from "../../domain/dividend.js";
import { currentUsdKrw } from "../../state/store.js";
import { uiState } from "../uistate.js";

function dividendItemKey(item) {
  return `${item.ticker}|${item.payDate}`;
}

export function dividendScenario() {
  const form = document.querySelector("#dividendSimForm");
  const ticker = form.elements.ticker.value.trim().toUpperCase() || "CUSTOM";
  const quantity = Number(form.elements.quantity.value) || 0;
  const price = Number(form.elements.price.value) || 0;
  const currency = form.elements.currency.value;
  const fx = currency === "KRW" ? 1 : Number(form.elements.fx.value) || currentUsdKrw();
  const annualYield = (Number(form.elements.yield.value) || 0) / 100;
  const frequency = Number(form.elements.frequency.value) || 12;
  const years = Math.min(30, Math.max(1, Number(form.elements.years.value) || 10));
  const growthRate = (Number(form.elements.growth.value) || 0) / 100;
  const drip = form.elements.drip.checked;
  const priceKrw = price * fx;
  const principal = quantity * priceKrw;
  const annualBeforeTax = principal * annualYield;
  const annualBeforeTaxNative = quantity * price * annualYield;

  return {
    ticker,
    quantity,
    price,
    currency,
    fx,
    annualYield,
    frequency,
    years,
    growthRate,
    drip,
    priceKrw,
    principal,
    annualBeforeTax,
    annualBeforeTaxNative
  };
}


export function renderDividendSimulation() {
  const form = document.querySelector("#dividendSimForm");
  if (!form) return;
  if (!form.elements.fx.dataset.touched) {
    form.elements.fx.value = fxFormatter.format(currentUsdKrw()).replace(/,/g, "");
  }
  const scenario = dividendScenario();
  const rows = dividendRows(scenario);
  const first = rows[0] || { beforeTax: 0, afterTax: 0, cumulativeAfterTax: 0, addedQuantity: 0, endingQuantity: scenario.quantity };
  const last = rows.at(-1) || first;
  const periodAfterTax = first.afterTax / scenario.frequency;
  const totalReturnOnCost = scenario.principal ? (last.cumulativeAfterTax / scenario.principal) * 100 : 0;
  const monthlyAfterTax = first.afterTax / 12;
  const nativePrefix = scenario.currency === "USD" ? "$" : "KRW ";
  const basisText = `${qty(scenario.quantity)}주 × ${nativePrefix}${numberFormatter.format(scenario.price)} × ${numberFormatter.format(scenario.fx)}`;
  const afterTaxYield = scenario.annualYield * (1 - DIVIDEND_TAX_RATE) * 100;
  const growthText = `성장률 ${pct(scenario.growthRate * 100)} 가정`;

  document.querySelector("#dividendSummaryCards").innerHTML = `
    <div class="sim-result-main">
      <div>
        <p class="eyebrow">예상 연 배당 · 세후</p>
        <strong>${money(first.afterTax)}</strong>
      </div>
      <span>월 평균 <b>${money(monthlyAfterTax)}</b></span>
      <span>세전 <b>${nativePrefix}${numberFormatter.format(scenario.annualBeforeTaxNative)}</b> (${money(first.beforeTax)})</span>
    </div>
    <div class="sim-result-sub">
      <div>
        <p class="eyebrow">현재 투자원금</p>
        <strong>${money(scenario.principal)}</strong>
        <small>${basisText}</small>
      </div>
      <div>
        <p class="eyebrow">현재 배당수익률</p>
        <strong class="positive">${pct(scenario.annualYield * 100)}</strong>
        <small>세후 환산 ${pct(afterTaxYield)}</small>
      </div>
      <div>
        <p class="eyebrow">${scenario.years}년 누적 · 세후</p>
        <strong>${money(last.cumulativeAfterTax)}</strong>
        <small>${growthText}</small>
      </div>
    </div>
  `;

  renderTargetDividend(scenario);

  const max = Math.max(...rows.map((row) => row.afterTax), 1);
  const width = 760;
  const height = 240;
  const barWidth = Math.max(8, (width - 48) / rows.length - 6);
  document.querySelector("#dividendChartTitle").textContent = `연도별 예상 배당 · 세후 (DRIP ${scenario.drip ? "on" : "off"} 적용)`;
  document.querySelector("#dividendChart").innerHTML = `
    <svg class="dividend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="배당 시뮬레이션">
      ${rows.map((row, index) => {
        const x = 24 + index * ((width - 48) / rows.length);
        const barHeight = (row.afterTax / max) * (height - 44);
        const y = height - 24 - barHeight;
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5" fill="#7c5cfc"></rect>
          <text x="${x + barWidth / 2}" y="${height - 5}" fill="#8e8e9c" font-size="11" text-anchor="middle">${row.year}년</text>
        `;
      }).join("")}
      <text x="24" y="14" fill="#8e8e9c" font-size="12">${money(max)}</text>
    </svg>
  `;

  document.querySelector("#dividendDetailTableWrap").classList.toggle("hidden", !uiState.dividendDetailOpen);
  document.querySelector("#toggleDividendDetail").textContent = uiState.dividendDetailOpen ? "표 숨기기" : "표로 보기";
  document.querySelector("#dividendTable").innerHTML = rows.map((row) => `
    <tr>
      <td>${row.year}년차</td>
      <td>${money(row.valueKrw)}</td>
      <td>${money(row.beforeTax)}</td>
      <td>${money(row.afterTax)}</td>
      <td>${money(row.cumulativeAfterTax)}</td>
      <td>${qty(row.addedQuantity)}</td>
    </tr>
  `).join("");
}

export function renderTargetDividend(scenario) {
  const targetInput = document.querySelector("#targetMonthlyDividend");
  const target = Number(targetInput.value) || 0;
  const effectiveYield = scenario.annualYield * (1 - DIVIDEND_TAX_RATE);
  const results = document.querySelector("#targetDividendResults");
  if (!effectiveYield || scenario.priceKrw <= 0) {
    results.innerHTML = `<div class="target-message">배당수익률과 현재가를 입력하면 계산됩니다.</div>`;
    return;
  }
  const requiredAnnualAfterTax = target * 12;
  const requiredPrincipal = requiredAnnualAfterTax / effectiveYield;
  const requiredQuantity = requiredPrincipal / scenario.priceKrw;
  const additionalQuantity = requiredQuantity - scenario.quantity;
  const basis = `현재 종목 단가(${scenario.currency === "USD" ? "$" : "KRW "}${numberFormatter.format(scenario.price)})·환율(${numberFormatter.format(scenario.fx)})·배당수익률(${pct(scenario.annualYield * 100)}) 기준`;
  const message = additionalQuantity > 0
    ? `현재 보유수량 대비 추가 매수 ${qty(additionalQuantity)}주 필요`
    : "이미 목표 초과 달성";
  results.innerHTML = `
    <div class="target-result-card">
      <span>필요 투자금액</span>
      <strong>${money(requiredPrincipal)}</strong>
    </div>
    <div class="target-result-card">
      <span>필요 보유수량</span>
      <strong>${qty(requiredQuantity)}주</strong>
    </div>
    <div class="target-message">${basis} · ${message}</div>
  `;
}

export function renderDividendCalendar() {
  const ownerId = document.querySelector("#calendarTargetSelect").value || null;
  const { monthlyTotals, monthlyItems, dividendHoldingsCount } = dividendPayoutsByMonth(ownerId);
  const grid = document.querySelector("#dividendCalendar");
  const summaryEl = document.querySelector("#calendarSummary");
  grid.innerHTML = "";

  const now = new Date();
  const kstParts = getKstNowParts(now);
  const currentMonth = Number(kstParts.dateKey.split("-")[1]);

  const annualTotal = monthlyTotals.reduce((s, v) => s + v, 0);
  const monthlyAvg = annualTotal / 12;
  const maxMonthly = Math.max(...monthlyTotals, 1);
  const activeMonths = monthlyTotals.filter((v) => v > 0).length;

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="cal-summary-card cal-summary-total">
        <span>향후 12개월 예상 배당 (세후)</span>
        <strong>${money(annualTotal)}</strong>
      </div>
      <div class="cal-summary-card">
        <span>월 평균</span>
        <strong>${money(monthlyAvg)}</strong>
      </div>
      <div class="cal-summary-card">
        <span>배당 수령 월</span>
        <strong>${activeMonths}개월 / 12개월</strong>
      </div>
      <div class="cal-summary-card">
        <span>배당 종목 수</span>
        <strong>${dividendHoldingsCount}종목</strong>
      </div>
    `;
  }

  monthNames.forEach((monthName, monthIndex) => {
    const month = monthIndex + 1;
    const total = monthlyTotals[monthIndex];
    const items = monthlyItems[monthIndex].slice().sort((a, b) => a.payDate.localeCompare(b.payDate));
    const isCurrent = month === currentMonth;
    const barWidth = maxMonthly > 0 ? (total / maxMonthly) * 100 : 0;

    const itemsHtml = items.length > 0
      ? items.map((item) => {
          const ratio = total > 0 ? ((item.amount / total) * 100).toFixed(1) : 0;
          const day = Number(item.payDate.slice(8, 10));
          const key = dividendItemKey(item);
          const isOpen = uiState.dividendBasisOpenTickers.has(key);
          return `<div class="calendar-item${isOpen ? " basis-open" : ""}">
            <button type="button" class="calendar-item-toggle" data-basis-key="${key}">
              <span class="cal-item-info"><strong>${item.ticker}</strong><span class="cal-item-freq">${day}일${item.estimated ? " · 예측" : " · 확정"}</span><span class="cal-item-ratio">${ratio}%</span></span>
              <span class="cal-item-amount">${money(item.amount)}<span class="basis-toggle-caret">${isOpen ? "▲" : "▼"}</span></span>
            </button>
            <div class="basis-body${isOpen ? "" : " hidden"}">
              <p class="basis-formula">보유수량 <b>${qty(item.quantity)}주</b> × 주당 배당금 <b>${usdFormatter.format(item.amountPerShare)}</b> − 해외주식 배당소득세 15% · 적용환율 ${fxFormatter.format(item.fx)}원</p>
              <div class="basis-stats">
                <div class="basis-stat"><span>세전 합계</span><b>${usdFormatter.format(item.beforeTaxUsd)}</b></div>
                <div class="basis-stat"><span>세후 합계($)</span><b>${usdFormatter.format(item.afterTaxUsd)}</b></div>
                <div class="basis-stat"><span>세후 합계(KRW)</span><b>${money(item.amount)}</b></div>
              </div>
            </div>
          </div>`;
        }).join("")
      : `<div class="cal-empty"><span>배당 없음</span></div>`;

    const card = document.createElement("article");
    card.className = `month-card${isCurrent ? " month-current" : ""}${total === 0 ? " month-empty" : ""}`;
    card.innerHTML = `
      <div class="month-header">
        <h3>${monthName}${isCurrent ? '<i class="month-now-badge">NOW</i>' : ""}</h3>
        <span class="month-total">${total > 0 ? money(total) : "—"}</span>
      </div>
      <div class="month-bar-track"><div class="month-bar-fill${total === maxMonthly && total > 0 ? " month-bar-peak" : ""}" style="width:${barWidth}%"></div></div>
      <div class="month-items">${itemsHtml}</div>
    `;
    grid.appendChild(card);
  });
}
