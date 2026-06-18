const STORAGE_KEY = "assetpilot-pooled-state-v1";
const DIVIDEND_TAX_RATE = 0.15;
const colors = ["#7c5cfc", "#8d6dff", "#9d7bff", "#ae91ff", "#bfa8ff", "#d1c2ff"];

const seedState = {
  selectedView: "dashboard",
  selectedInvestorId: "kim",
  investors: [
    { id: "kim", name: "김지훈", initials: "김" },
    { id: "lee", name: "이서연", initials: "이" }
  ],
  marketIndicators: [
    { symbol: "BTC", domestic: 52000000, globalKrw: 50420000 },
    { symbol: "ETH", domestic: 3300000, globalKrw: 3244000 }
  ],
  holdings: [
    { id: crypto.randomUUID(), ownerId: "kim", name: "SCHD", ticker: "SCHD", type: "주식", quantity: 20, avgPrice: 25000, price: 29500, annualDividend: 9881 },
    { id: crypto.randomUUID(), ownerId: "kim", name: "Realty Income", ticker: "O", type: "주식", quantity: 15, avgPrice: 54000, price: 80040, annualDividend: 8200 },
    { id: crypto.randomUUID(), ownerId: "kim", name: "Bitcoin", ticker: "BTC", type: "코인", quantity: 0.005, avgPrice: 40000000, price: 52000000, annualDividend: 0 },
    { id: crypto.randomUUID(), ownerId: "kim", name: "예수금", ticker: "CASH", type: "현금", quantity: 1, avgPrice: 350000, price: 350000, annualDividend: 0 },
    { id: crypto.randomUUID(), ownerId: "lee", name: "TIGER 미국S&P500", ticker: "360750", type: "ETF", quantity: 58, avgPrice: 17250, price: 19640, annualDividend: 4600 },
    { id: crypto.randomUUID(), ownerId: "lee", name: "Ethereum", ticker: "ETH", type: "코인", quantity: 0.42, avgPrice: 2890000, price: 3300000, annualDividend: 0 },
    { id: crypto.randomUUID(), ownerId: "lee", name: "국고채 3년", ticker: "KR3Y", type: "채권", quantity: 12, avgPrice: 101000, price: 100400, annualDividend: 36000 },
    { id: crypto.randomUUID(), ownerId: "lee", name: "예수금", ticker: "CASH", type: "현금", quantity: 1, avgPrice: 720000, price: 720000, annualDividend: 0 }
  ],
  transactions: [
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-17", side: "매수", asset: "SCHD", quantity: 5, price: 29500, memo: "배당주 추가" },
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-12", side: "배당", asset: "SCHD", quantity: 1, price: 9881, memo: "예상 배당 반영" },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-10", side: "매수", asset: "ETH", quantity: 0.08, price: 3300000, memo: "코인 비중 확대" },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-01", side: "입금", asset: "예수금", quantity: 1, price: 500000, memo: "정기 입금" }
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
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.investors) || !parsed.holdings?.every((item) => item.ownerId)) {
      return structuredClone(seedState);
    }
    return parsed;
  } catch {
    return structuredClone(seedState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function money(value) {
  return formatter.format(Math.round(value || 0));
}

function pct(value) {
  return `${numberFormatter.format(value || 0)}%`;
}

function signedMoney(value) {
  return `${value >= 0 ? "+" : ""}${money(value)}`;
}

function investorById(id) {
  return state.investors.find((investor) => investor.id === id) || state.investors[0];
}

function holdingValue(item) {
  return item.quantity * item.price;
}

function holdingCost(item) {
  return item.type === "현금" ? 0 : item.quantity * item.avgPrice;
}

function filteredHoldings(ownerId) {
  return ownerId ? state.holdings.filter((item) => item.ownerId === ownerId) : state.holdings;
}

function filteredTransactions(ownerId) {
  return ownerId ? state.transactions.filter((item) => item.ownerId === ownerId) : state.transactions;
}

function summarize(ownerId) {
  const holdings = filteredHoldings(ownerId);
  const principal = holdings.reduce((sum, item) => sum + holdingCost(item), 0);
  const totalValue = holdings.reduce((sum, item) => sum + holdingValue(item), 0);
  const cashValue = holdings.filter((item) => item.type === "현금").reduce((sum, item) => sum + holdingValue(item), 0);
  const investedValue = totalValue - cashValue;
  const profit = investedValue - principal;
  const dividend = holdings.reduce((sum, item) => sum + (Number(item.annualDividend) || 0), 0);
  const tax = dividend * DIVIDEND_TAX_RATE;
  return {
    holdings,
    principal,
    totalValue,
    cashValue,
    investedValue,
    profit,
    returnRate: principal ? (profit / principal) * 100 : 0,
    dividend,
    tax,
    dividendAfterTax: dividend - tax
  };
}

function groupedByType(ownerId) {
  const summary = summarize(ownerId);
  const total = summary.totalValue || 1;
  const map = new Map();
  for (const item of summary.holdings) {
    const current = map.get(item.type) || { type: item.type, value: 0 };
    current.value += holdingValue(item);
    map.set(item.type, current);
  }
  return Array.from(map.values()).map((item) => ({
    ...item,
    actual: (item.value / total) * 100
  }));
}

function renderView() {
  document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.remove("active-view"));
  document.querySelector(`#${state.selectedView}View`).classList.add("active-view");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.selectedView);
  });
  document.querySelector("#holdingsScope").textContent = state.selectedView === "investor" ? investorById(state.selectedInvestorId).name : "All Investors";
  document.querySelector("#transactionsScope").textContent = state.selectedView === "investor" ? investorById(state.selectedInvestorId).name : "All Investors";
}

function renderDashboard() {
  const summary = summarize();
  const totalProfit = document.querySelector("#totalProfit");
  document.querySelector("#totalValue").textContent = money(summary.totalValue);
  document.querySelector("#totalPrincipal").textContent = money(summary.principal);
  totalProfit.textContent = signedMoney(summary.profit);
  totalProfit.className = summary.profit >= 0 ? "positive" : "negative";
  document.querySelector("#profitRate").textContent = `수익률 ${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`;
  document.querySelector("#totalDividend").textContent = `총배당 ${money(summary.dividend)}`;
  document.querySelector("#cashAmount").textContent = money(summary.cashValue);
  document.querySelector("#cashRatio").textContent = `총액 대비 ${pct(summary.totalValue ? (summary.cashValue / summary.totalValue) * 100 : 0)}`;
}

function renderAllocation() {
  const groups = groupedByType();
  const total = summarize().totalValue || 1;
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
}

function renderMarket() {
  const list = document.querySelector("#marketList");
  list.innerHTML = "";
  state.marketIndicators.forEach((item) => {
    const premium = item.globalKrw ? ((item.domestic / item.globalKrw) - 1) * 100 : 0;
    const row = document.createElement("div");
    row.className = "market-card";
    row.innerHTML = `
      <div><strong>${item.symbol}</strong><small>국내 ${money(item.domestic)} · 해외환산 ${money(item.globalKrw)}</small></div>
      <span class="${premium >= 0 ? "positive" : "negative"}">${premium >= 0 ? "+" : ""}${pct(premium)}</span>
    `;
    list.appendChild(row);
  });
}

function renderInvestorComparison() {
  const list = document.querySelector("#investorComparison");
  list.innerHTML = "";
  const total = summarize().totalValue || 1;
  state.investors.forEach((investor) => {
    const summary = summarize(investor.id);
    const share = (summary.totalValue / total) * 100;
    const row = document.createElement("div");
    row.className = "investor-card";
    row.innerHTML = `
      <div class="avatar">${investor.initials}</div>
      <div><strong>${investor.name}</strong><small>지분 ${pct(share)} · ${summary.holdings.filter((item) => item.type !== "현금").length}개 종목</small></div>
      <span class="${summary.profit >= 0 ? "positive" : "negative"}">${signedMoney(summary.profit)}</span>
    `;
    list.appendChild(row);
  });
}

function renderInvestorTabs() {
  const tabs = document.querySelector("#investorTabs");
  tabs.innerHTML = "";
  state.investors.forEach((investor) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `investor-chip ${investor.id === state.selectedInvestorId ? "active" : ""}`;
    button.dataset.investorId = investor.id;
    button.innerHTML = `<span>${investor.initials}</span>${investor.name}`;
    tabs.appendChild(button);
  });
}

function renderInvestorSheet() {
  const investor = investorById(state.selectedInvestorId);
  const summary = summarize(investor.id);
  const investedHoldings = summary.holdings.filter((item) => item.type !== "현금");
  document.querySelector("#selectedInvestorLabel").textContent = `${investor.name}님의 평가금액`;
  document.querySelector("#investorValue").textContent = money(summary.totalValue);
  document.querySelector("#investorProfit").textContent = signedMoney(summary.profit);
  document.querySelector("#investorProfit").className = summary.profit >= 0 ? "positive" : "negative";
  document.querySelector("#investorReturn").textContent = `수익률 ${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`;
  document.querySelector("#investorHoldingsCount").textContent = `${investedHoldings.length}개 종목`;
  document.querySelector("#investorPrincipal").textContent = money(summary.principal);
  document.querySelector("#investorTax").textContent = money(summary.tax);
  document.querySelector("#investorDividend").textContent = money(summary.dividend);
  document.querySelector("#investorDividendAfterTax").textContent = `세후 ${money(summary.dividendAfterTax)}`;
  document.querySelector("#investorCash").textContent = money(summary.cashValue);
}

function holdingsForCurrentView() {
  return state.selectedView === "investor" ? filteredHoldings(state.selectedInvestorId) : state.holdings;
}

function transactionsForCurrentView() {
  return state.selectedView === "investor" ? filteredTransactions(state.selectedInvestorId) : state.transactions;
}

function renderHoldings() {
  const body = document.querySelector("#holdingsTable");
  body.innerHTML = "";
  for (const item of holdingsForCurrentView()) {
    const value = holdingValue(item);
    const cost = holdingCost(item);
    const profit = item.type === "현금" ? 0 : value - cost;
    const owner = investorById(item.ownerId);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="asset-name"><strong>${item.ticker}</strong><small>${item.name}</small></span></td>
      <td><span class="owner-label">${owner.name}</span></td>
      <td><span class="pill">${item.type}</span></td>
      <td>${numberFormatter.format(item.quantity)}</td>
      <td>${item.type === "현금" ? "-" : money(item.avgPrice)}</td>
      <td>${money(item.price)}</td>
      <td>${money(value)}</td>
      <td class="${profit >= 0 ? "positive" : "negative"}">${item.type === "현금" ? "-" : signedMoney(profit)}</td>
      <td><button type="button" class="icon-button" title="삭제" data-delete-holding="${item.id}">x</button></td>
    `;
    body.appendChild(row);
  }
}

function renderTransactions() {
  const body = document.querySelector("#transactionsTable");
  body.innerHTML = "";
  transactionsForCurrentView()
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((trade) => {
      const owner = investorById(trade.ownerId);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${trade.date}</td>
        <td>${owner.name}</td>
        <td><span class="pill">${trade.side}</span></td>
        <td>${trade.asset}</td>
        <td>${money(trade.quantity * trade.price)}</td>
      `;
      body.appendChild(row);
    });
}

function populateOwnerSelects() {
  for (const id of ["holdingOwnerSelect", "tradeOwnerSelect"]) {
    const select = document.querySelector(`#${id}`);
    select.innerHTML = "";
    state.investors.forEach((investor) => {
      const option = document.createElement("option");
      option.value = investor.id;
      option.textContent = investor.name;
      select.appendChild(option);
    });
    select.value = state.selectedInvestorId;
  }
}

function render() {
  renderView();
  renderDashboard();
  renderAllocation();
  renderMarket();
  renderInvestorComparison();
  renderInvestorTabs();
  renderInvestorSheet();
  renderHoldings();
  renderTransactions();
  populateOwnerSelects();
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedView = button.dataset.view;
    saveState();
    render();
  });
});

document.querySelector("#investorTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-investor-id]");
  if (!button) return;
  state.selectedInvestorId = button.dataset.investorId;
  state.selectedView = "investor";
  saveState();
  render();
});

document.querySelector("#openHoldingForm").addEventListener("click", () => {
  document.querySelector("#holdingForm").reset();
  populateOwnerSelects();
  openDialog(document.querySelector("#holdingDialog"));
});

document.querySelector("#openTradeForm").addEventListener("click", () => {
  const form = document.querySelector("#tradeForm");
  form.reset();
  form.elements.date.valueAsDate = new Date();
  populateOwnerSelects();
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
    ownerId: data.get("ownerId"),
    name: data.get("name").trim(),
    ticker: data.get("ticker").trim(),
    type: data.get("type"),
    quantity: Number(data.get("quantity")),
    avgPrice: Number(data.get("avgPrice")),
    price: Number(data.get("price")),
    annualDividend: Number(data.get("annualDividend")) || 0
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
    ownerId: data.get("ownerId"),
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
