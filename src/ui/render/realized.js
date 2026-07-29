import { CAPITAL_GAINS_DEDUCTION_KRW } from "../../config/constants.js";
import { money, numberFormatter, qty, signedMoney, usdFormatter } from "../../core/format.js";
import { estimatedCapitalGainsTax, investorById, realizedSummary } from "../../domain/portfolio.js";
import { state } from "../../state/store.js";

function populateRealizedOwnerSelect() {
  const select = document.querySelector("#realizedOwnerSelect");
  if (!select || select.options.length > 1) return;
  state.investors.forEach((investor) => {
    const option = document.createElement("option");
    option.value = investor.id;
    option.textContent = investor.name;
    select.appendChild(option);
  });
}

export function renderRealizedView() {
  const list = document.querySelector("#realizedList");
  if (!list) return;

  populateRealizedOwnerSelect();

  const ownerId = document.querySelector("#realizedOwnerSelect")?.value || null;
  const from = document.querySelector("#realizedFrom")?.value || "";
  const to = document.querySelector("#realizedTo")?.value || "";

  const { items, totalKrw, totalUsd, count } = realizedSummary(ownerId, { from, to });

  const year = new Date().getFullYear();
  const yearlyTax = estimatedCapitalGainsTax(ownerId, year);

  const taxBox = document.querySelector("#realizedTaxBox");
  if (taxBox) {
    taxBox.innerHTML = `
      <div class="tax-estimate-row">
        <div>
          <span class="eyebrow">${year}년 해외주식 양도소득세 예상</span>
          <strong class="${yearlyTax.tax > 0 ? "negative" : ""}">${money(yearlyTax.tax)}</strong>
        </div>
        <small>실현이익 ${money(yearlyTax.gain)} · 1인당 기본공제 ${money(CAPITAL_GAINS_DEDUCTION_KRW)} · 세율 22% · 해외주식 매도분만 대상</small>
      </div>
    `;
  }

  const summaryStrip = document.querySelector("#realizedSummaryStrip");
  if (summaryStrip) {
    const usdDetail = totalUsd !== 0
      ? `외화 매도분 ${totalUsd >= 0 ? "+" : "-"}${usdFormatter.format(Math.abs(totalUsd))}`
      : "외화 매도 없음";
    summaryStrip.innerHTML = `
      <div class="hv-summary-item">
        <span>실현손익 합계 (세전)</span>
        <strong class="${totalKrw >= 0 ? "positive" : "negative"}">${signedMoney(totalKrw)}</strong>
        <small>${usdDetail}</small>
      </div>
      <div class="hv-summary-item">
        <span>매도 건수</span>
        <strong>${count}건</strong>
      </div>
    `;
  }

  if (!items.length) {
    list.innerHTML = `<p class="empty-hint">해당 조건에 매도 내역이 없습니다.</p>`;
    return;
  }

  list.innerHTML = `
    <div class="realized-list-head" role="row">
      <span>종목</span>
      <span>투자자 / 날짜</span>
      <span>매도 내역</span>
      <span>실현손익 (세전)</span>
    </div>
    ${items.map((r) => {
      const owner = investorById(r.ownerId);
      const profitClass = r.profitKrw >= 0 ? "positive" : "negative";
      const nativePrefix = r.currency === "USD" ? "$" : "KRW ";
      const usdLine = r.currency === "USD"
        ? `<small>외화 ${r.profitForeign >= 0 ? "+" : "-"}${usdFormatter.format(Math.abs(r.profitForeign))}</small>`
        : "";
      const split = r.currency === "KRW" ? "" : `
          <small class="hv-profit-split">
            <span class="${r.stockProfitKrw >= 0 ? "positive" : "negative"}">주가 ${signedMoney(r.stockProfitKrw)}</span>
            <span class="${r.fxProfitKrw >= 0 ? "positive" : "negative"}">환차 ${signedMoney(r.fxProfitKrw)}</span>
          </small>`;
      return `
        <div class="realized-row" role="row">
          <div class="realized-cell">
            <strong>${r.ticker}</strong>
            <small>${r.name}</small>
          </div>
          <div class="realized-cell">
            <span class="pill">${owner.name}</span>
            <small>${r.date}</small>
          </div>
          <div class="realized-cell">
            <small>매도 ${qty(r.quantity)}주 · ${nativePrefix}${numberFormatter.format(r.sellPrice)}</small>
            <small>평단 ${nativePrefix}${numberFormatter.format(r.avgPrice)}</small>
          </div>
          <div class="realized-cell realized-profit-cell">
            <strong class="${profitClass}">${signedMoney(r.profitKrw)}</strong>
            ${usdLine}
            ${split}
          </div>
        </div>
      `;
    }).join("")}
  `;
}
