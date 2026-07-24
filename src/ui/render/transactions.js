import { money, usdFormatter } from "../../core/format.js";
import { investorById, tradeAmountKrw } from "../../domain/portfolio.js";
import { state } from "../../state/store.js";
import { uiState } from "../uistate.js";
import { visibleOwnerId } from "./layout.js";

// 입출금은 KRW/USD 통화 그대로 표기한다(예: 배당 USD 입금이 "KRW 500"처럼
// 잘못 보이지 않도록). 거래는 기존대로 tradeAmountKrw로 KRW 환산해서 보여준다.
function formatCashflowAmount(flow) {
  return (flow.currency || "KRW") === "USD" ? usdFormatter.format(flow.amount) : money(flow.amount);
}

export function visibleTransactions() {
  const ownerId = visibleOwnerId();
  return [
    ...state.cashflows.map((flow) => ({ ...flow, kind: "cashflow" })),
    ...state.trades.map((trade) => ({ ...trade, kind: "trade" }))
  ]
    .filter((item) => !ownerId || item.ownerId === ownerId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function renderTransactions() {
  const body = document.querySelector("#transactionsTable");
  body.innerHTML = "";
  visibleTransactions().forEach((item) => {
    const owner = investorById(item.ownerId);
    const isCashflow = item.kind === "cashflow";
    const label = isCashflow ? (item.type === "deposit" ? "입금" : "출금") : (item.side === "buy" ? "매수" : "매도");
    const asset = isCashflow ? "예수금" : item.ticker;
    const amountText = isCashflow ? formatCashflowAmount(item) : money(tradeAmountKrw(item));
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${owner.name}</td>
      <td><span class="pill">${label}</span></td>
      <td>${asset}</td>
      <td>${amountText}</td>
    `;
    body.appendChild(row);
  });
}

export function renderLedgerPreview() {
  const list = document.querySelector("#ledgerPreview");
  if (!list) return;
  const top = visibleTransactions().slice(0, 3);
  if (!top.length) {
    list.innerHTML = `<p class="empty-hint">거래 내역이 없습니다.</p>`;
    return;
  }
  list.innerHTML = top.map((item) => {
    const owner = investorById(item.ownerId);
    const isCashflow = item.kind === "cashflow";
    const label = isCashflow ? (item.type === "deposit" ? "입금" : "출금") : (item.side === "buy" ? "매수" : "매도");
    const asset = isCashflow ? "예수금" : item.ticker;
    const amountText = isCashflow ? formatCashflowAmount(item) : money(tradeAmountKrw(item));
    return `
      <div class="market-card">
        <div><strong>${item.date}</strong><small>${owner.name} · ${label} · ${asset}</small></div>
        <span>${amountText}</span>
      </div>
    `;
  }).join("");
}

export function renderCashflows() {
  const list = document.querySelector("#cashflowList");
  const head = document.querySelector("#cashflowListHead");
  const rangeLabel = document.querySelector("#cashflowListRange");
  if (!list || !head) return;
  const query = uiState.cashflowQuery;
  if (!query.open) {
    list.hidden = true;
    head.hidden = true;
    list.innerHTML = "";
    return;
  }
  const rows = state.cashflows
    .filter((flow) => flow.ownerId === state.selectedInvestorId)
    .filter((flow) => !query.from || flow.date >= query.from)
    .filter((flow) => !query.to || flow.date <= query.to)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  head.hidden = false;
  rangeLabel.textContent = query.from || query.to
    ? `${query.from || "처음"} ~ ${query.to || "지금"}`
    : "전체 기간";
  list.hidden = false;
  list.innerHTML = rows.length
    ? rows.map((flow) => {
        const colorClass = flow.type === "withdraw" ? "negative" : "";
        return `
          <div class="cashflow-row">
            <span>${flow.date}</span>
            <strong class="${colorClass}">${flow.type === "deposit" ? "입금" : "출금"} ${formatCashflowAmount(flow)}</strong>
          </div>
        `;
      }).join("")
    : `<p class="empty-hint">해당 기간의 입출금 내역이 없습니다.</p>`;
}
