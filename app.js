const STORAGE_KEY = "assetpilot-state-v2";
const colors = ["#7c5cfc", "#8d6dff", "#9d7bff", "#ae91ff", "#bfa8ff", "#d1c2ff"];

const seedState = {
  holdings: [
    { id: crypto.randomUUID(), name: "삼성전자", ticker: "005930", type: "국내주식", account: "연금저축", quantity: 120, avgPrice: 70800, price: 76400, target: 24 },
    { id: crypto.randomUUID(), name: "TIGER 미국S&P500", ticker: "360750", type: "ETF", account: "ISA", quantity: 88, avgPrice: 17250, price: 19640, target: 28 },
    { id: crypto.randomUUID(), name: "Apple", ticker: "AAPL", type: "해외주식", account: "해외주식", quantity: 18, avgPrice: 181000, price: 207000, target: 18 },
    { id: crypto.randomUUID(), name: "국고채 3년", ticker: "KR3Y", type: "채권", account: "위탁", quantity: 40, avgPrice: 101000, price: 100400, target: 15 },
    { id: crypto.randomUUID(), name: "예수금", ticker: "CASH", type: "현금", account: "CMA", quantity: 1, avgPrice: 3800000, price: 3800000, target: 10 },
    { id: crypto.randomUUID(), name: "금 현물", ticker: "GOLD", type: "대체자산", account: "위탁", quantity: 8, avgPrice: 133000, price: 146000, target: 5 }
  ],
  transactions: [
    { id: crypto.randomUUID(), date: "2026-06-17", side: "매수", asset: "TIGER 미국S&P500", quantity: 8, price: 19640, memo: "월 적립식" },
    { id: crypto.randomUUID(), date: "2026-06-12", side: "배당", asset: "Apple", quantity: 18, price: 360, memo: "분기 배당" },
    { id: crypto.randomUUID(), date: "2026-06-05", side: "매수", asset: "국고채 3년", quantity: 5, price: 100400, memo: "변동성 완충" },
    { id: crypto.randomUUID(), date: "2026-06-01", side: "입금", asset: "예수금", quantity: 1, price: 600000, memo: "정기 입금" }
  ]
};

let state = loadState();

const formatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2
});

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(seedState);
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(seedState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function money(value) {
  return formatter.format(Math.round(value));
}

function pct(value) {
  return `${numberFormatter.format(value)}%`;
}

function holdingValue(item) {
  return item.quantity * item.price;
}

function holdingCost(item) {
  return item.quantity * item.avgPrice;
}

function totals() {
  const totalValue = state.holdings.reduce((sum, item) => sum + holdingValue(item), 0);
  const totalCost = state.holdings.reduce((sum, item) => sum + holdingCost(item), 0);
  const cashValue = state.holdings
    .filter((item) => item.type === "현금")
    .reduce((sum, item) => sum + holdingValue(item), 0);

  return {
    totalValue,
    totalCost,
    totalProfit: totalValue - totalCost,
    profitRate: totalCost ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    cashValue,
    cashRatio: totalValue ? (cashValue / totalValue) * 100 : 0
  };
}

function groupedByType() {
  const total = totals().totalValue || 1;
  const map = new Map();
  for (const item of state.holdings) {
    const current = map.get(item.type) || { type: item.type, value: 0, target: 0 };
    current.value += holdingValue(item);
    current.target += Number(item.target) || 0;
    map.set(item.type, current);
  }
  return Array.from(map.values()).map((item) => ({
    ...item,
    actual: (item.value / total) * 100
  }));
}

function renderMetrics() {
  const summary = totals();
  const rebalances = groupedByType().filter((item) => Math.abs(item.actual - item.target) >= 5);
  const totalProfit = document.querySelector("#totalProfit");

  document.querySelector("#totalValue").textContent = money(summary.totalValue);
  document.querySelector("#dailyChange").textContent = `평가 기준 ${new Date().toLocaleDateString("ko-KR")}`;
  totalProfit.textContent = `${summary.totalProfit >= 0 ? "+" : ""}${money(summary.totalProfit)}`;
  totalProfit.className = summary.totalProfit >= 0 ? "positive" : "negative";
  document.querySelector("#profitRate").textContent = `수익률 ${summary.profitRate >= 0 ? "+" : ""}${pct(summary.profitRate)}`;
  document.querySelector("#cashRatio").textContent = pct(summary.cashRatio);
  document.querySelector("#cashAmount").textContent = money(summary.cashValue);
  document.querySelector("#rebalanceCount").textContent = `${rebalances.length}건`;
}

function renderHoldings() {
  const body = document.querySelector("#holdingsTable");
  body.innerHTML = "";

  for (const item of state.holdings) {
    const value = holdingValue(item);
    const profit = value - holdingCost(item);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="asset-name"><strong>${item.name}</strong><small>${item.ticker} · ${item.account}</small></span></td>
      <td><span class="pill">${item.type}</span></td>
      <td>${numberFormatter.format(item.quantity)}</td>
      <td>${money(item.avgPrice)}</td>
      <td>${money(item.price)}</td>
      <td>${money(value)}</td>
      <td class="${profit >= 0 ? "positive" : "negative"}">${profit >= 0 ? "+" : ""}${money(profit)}</td>
      <td><button type="button" class="icon-button" title="삭제" data-delete-holding="${item.id}">x</button></td>
    `;
    body.appendChild(row);
  }
}

function renderAllocation() {
  const groups = groupedByType();
  const total = totals().totalValue || 1;
  let cursor = 0;
  const segments = groups.map((group, index) => {
    const start = cursor;
    const end = cursor + (group.value / total) * 100;
    cursor = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });

  document.querySelector("#allocationDonut").style.background = `conic-gradient(${segments.join(", ")})`;

  const legend = document.querySelector("#allocationLegend");
  legend.innerHTML = "";
  groups.forEach((group, index) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span><i class="swatch" style="background:${colors[index % colors.length]}"></i>${group.type}</span>
      <strong>${pct(group.actual)}</strong>
    `;
    legend.appendChild(row);
  });

  const rebalanceList = document.querySelector("#rebalanceList");
  rebalanceList.innerHTML = "";
  const rebalances = groups
    .map((group) => ({ ...group, gap: group.actual - group.target }))
    .filter((group) => Math.abs(group.gap) >= 5);

  if (!rebalances.length) {
    rebalanceList.innerHTML = `<div class="rebalance-item"><div><strong>균형 유지</strong><small>목표비중과 큰 차이가 없습니다.</small></div></div>`;
    return;
  }

  rebalances.forEach((group) => {
    const action = group.gap > 0 ? "축소" : "확대";
    const row = document.createElement("div");
    row.className = "rebalance-item";
    row.innerHTML = `
      <div><strong>${group.type} ${action}</strong><small>현재 ${pct(group.actual)} · 목표 ${pct(group.target)}</small></div>
      <span class="${group.gap > 0 ? "negative" : "positive"}">${pct(Math.abs(group.gap))}p</span>
    `;
    rebalanceList.appendChild(row);
  });
}

function renderAccounts() {
  const accounts = new Map();
  for (const item of state.holdings) {
    accounts.set(item.account, (accounts.get(item.account) || 0) + holdingValue(item));
  }
  const list = document.querySelector("#accountList");
  list.innerHTML = "";
  for (const [name, value] of accounts) {
    const row = document.createElement("div");
    row.className = "account-card";
    row.innerHTML = `<div><strong>${name}</strong><small>${state.holdings.filter((item) => item.account === name).length}개 자산</small></div><span>${money(value)}</span>`;
    list.appendChild(row);
  }
}

function renderTransactions() {
  const body = document.querySelector("#transactionsTable");
  body.innerHTML = "";
  state.transactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((trade) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${trade.date}</td>
        <td><span class="pill">${trade.side}</span></td>
        <td>${trade.asset}</td>
        <td>${numberFormatter.format(trade.quantity)}</td>
        <td>${money(trade.price)}</td>
        <td>${trade.memo || "-"}</td>
      `;
      body.appendChild(row);
    });
}

function render() {
  renderMetrics();
  renderHoldings();
  renderAllocation();
  renderAccounts();
  renderTransactions();
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
}

document.querySelector("#openHoldingForm").addEventListener("click", () => {
  document.querySelector("#holdingForm").reset();
  openDialog(document.querySelector("#holdingDialog"));
});

document.querySelector("#openTradeForm").addEventListener("click", () => {
  const form = document.querySelector("#tradeForm");
  form.reset();
  form.elements.date.valueAsDate = new Date();
  openDialog(document.querySelector("#tradeDialog"));
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelector("#holdingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  state.holdings.push({
    id: crypto.randomUUID(),
    name: data.get("name").trim(),
    ticker: data.get("ticker").trim(),
    type: data.get("type"),
    account: data.get("account").trim(),
    quantity: Number(data.get("quantity")),
    avgPrice: Number(data.get("avgPrice")),
    price: Number(data.get("price")),
    target: Number(data.get("target"))
  });
  saveState();
  render();
  form.closest("dialog").close();
});

document.querySelector("#tradeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  state.transactions.push({
    id: crypto.randomUUID(),
    date: data.get("date"),
    side: data.get("side"),
    asset: data.get("asset").trim(),
    quantity: Number(data.get("quantity")),
    price: Number(data.get("price")),
    memo: data.get("memo").trim()
  });
  saveState();
  render();
  form.closest("dialog").close();
});

document.querySelector("#holdingsTable").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-holding]");
  if (!button) return;
  state.holdings = state.holdings.filter((item) => item.id !== button.dataset.deleteHolding);
  saveState();
  render();
});

document.querySelector("#seedButton").addEventListener("click", () => {
  state = structuredClone(seedState);
  saveState();
  render();
});

document.querySelector("#exportButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `assetpilot-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

render();
