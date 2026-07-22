import { money } from "../../core/format.js";
import { investorById, tradeAmountKrw } from "../../domain/portfolio.js";
import { state } from "../../state/store.js";
import { visibleOwnerId } from "./layout.js";

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
    const amount = isCashflow ? item.amount : tradeAmountKrw(item);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${owner.name}</td>
      <td><span class="pill">${label}</span></td>
      <td>${asset}</td>
      <td>${money(amount)}</td>
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
    const amount = isCashflow ? item.amount : tradeAmountKrw(item);
    return `
      <div class="market-card">
        <div><strong>${item.date}</strong><small>${owner.name} · ${label} · ${asset}</small></div>
        <span>${money(amount)}</span>
      </div>
    `;
  }).join("");
}

export function renderCashflows() {
  const list = document.querySelector("#cashflowList");
  list.innerHTML = "";
  state.cashflows
    .filter((flow) => flow.ownerId === state.selectedInvestorId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .forEach((flow) => {
      const row = document.createElement("div");
      row.className = "cashflow-row";
      const colorClass = flow.type === "withdraw" ? "negative" : "";
      row.innerHTML = `
        <span>${flow.date}</span>
        <strong class="${colorClass}">${flow.type === "deposit" ? "입금" : "출금"} ${money(flow.amount)}</strong>
      `;
      list.appendChild(row);
    });
}
