const STORAGE_KEY = "assetpilot-ledger-state-v1";
const DIVIDEND_TAX_RATE = 0.15;
const colors = ["#7c5cfc", "#8d6dff", "#9d7bff", "#ae91ff", "#bfa8ff", "#d1c2ff"];

const seedState = {
  selectedView: "dashboard",
  selectedInvestorId: "kim",
  pendingDeleteInvestorId: null,
  investors: [
    { id: "kim", name: "김지훈", initials: "김" },
    { id: "lee", name: "이서연", initials: "이" }
  ],
  assetCatalog: {
    SCHD: { ticker: "SCHD", name: "SCHD", type: "주식", currency: "USD", currentPrice: 29.5, currentFx: 1380, annualDividend: 9881 },
    O: { ticker: "O", name: "Realty Income", type: "주식", currency: "USD", currentPrice: 58, currentFx: 1380, annualDividend: 8200 },
    BTC: { ticker: "BTC", name: "Bitcoin", type: "코인", currency: "USD", currentPrice: 38000, currentFx: 1380, annualDividend: 0 },
    ETH: { ticker: "ETH", name: "Ethereum", type: "코인", currency: "USD", currentPrice: 2391, currentFx: 1380, annualDividend: 0 },
    "360750": { ticker: "360750", name: "TIGER 미국S&P500", type: "ETF", currency: "KRW", currentPrice: 19640, currentFx: 1, annualDividend: 4600 },
    KR3Y: { ticker: "KR3Y", name: "국고채 3년", type: "채권", currency: "KRW", currentPrice: 100400, currentFx: 1, annualDividend: 36000 }
  },
  marketIndicators: [
    { symbol: "BTC", domestic: 52000000, globalKrw: 50420000 },
    { symbol: "ETH", domestic: 3300000, globalKrw: 3244000 }
  ],
  cashflows: [
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-01", type: "deposit", amount: 3000000, memo: "초기 입금" },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-01", type: "deposit", amount: 3400000, memo: "초기 입금" }
  ],
  trades: [
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-03", side: "buy", ticker: "SCHD", name: "SCHD", type: "주식", currency: "USD", quantity: 20, price: 25, fx: 1360 },
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-04", side: "buy", ticker: "O", name: "Realty Income", type: "주식", currency: "USD", quantity: 15, price: 54, fx: 1370 },
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-08", side: "buy", ticker: "BTC", name: "Bitcoin", type: "코인", currency: "USD", quantity: 0.005, price: 29000, fx: 1380 },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-05", side: "buy", ticker: "360750", name: "TIGER 미국S&P500", type: "ETF", currency: "KRW", quantity: 58, price: 17250, fx: 1 },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-10", side: "buy", ticker: "ETH", name: "Ethereum", type: "코인", currency: "USD", quantity: 0.42, price: 2094, fx: 1380 },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-12", side: "buy", ticker: "KR3Y", name: "국고채 3년", type: "채권", currency: "KRW", quantity: 12, price: 101000, fx: 1 }
  ]
};

let state = loadState();

const formatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 4
});

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(seedState);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.investors) || !Array.isArray(parsed.trades) || !Array.isArray(parsed.cashflows)) {
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

function qty(value) {
  return numberFormatter.format(value || 0);
}

function signedMoney(value) {
  return `${value >= 0 ? "+" : ""}${money(value)}`;
}

function investorById(id) {
  return state.investors.find((investor) => investor.id === id) || state.investors[0];
}

function makeInvestor(name) {
  const clean = name.trim();
  return {
    id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: clean,
    initials: clean.slice(0, 1).toUpperCase()
  };
}

function tradeAmountKrw(trade) {
  return trade.quantity * trade.price * trade.fx;
}

function getAsset(ticker, fallback = {}) {
  return state.assetCatalog[ticker] || {
    ticker,
    name: fallback.name || ticker,
    type: fallback.type || "주식",
    currency: fallback.currency || "USD",
    currentPrice: fallback.price || 0,
    currentFx: fallback.fx || 1,
    annualDividend: 0
  };
}

function ensureAssetFromTrade(trade) {
  const existing = state.assetCatalog[trade.ticker];
  state.assetCatalog[trade.ticker] = {
    ticker: trade.ticker,
    name: trade.name || existing?.name || trade.ticker,
    type: trade.type || existing?.type || "주식",
    currency: trade.currency || existing?.currency || "USD",
    currentPrice: existing?.currentPrice ?? trade.price,
    currentFx: existing?.currentFx ?? trade.fx,
    annualDividend: existing?.annualDividend ?? 0
  };
}

function replayHoldings(ownerId) {
  const lots = new Map();
  const trades = state.trades
    .filter((trade) => !ownerId || trade.ownerId === ownerId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const trade of trades) {
    const key = `${trade.ownerId}:${trade.ticker}`;
    const asset = getAsset(trade.ticker, trade);
    const lot = lots.get(key) || {
      ownerId: trade.ownerId,
      ticker: trade.ticker,
      name: trade.name || asset.name,
      type: trade.type || asset.type,
      currency: trade.currency || asset.currency,
      quantity: 0,
      costForeign: 0,
      costKrw: 0
    };

    const tradeForeign = trade.quantity * trade.price;
    const tradeKrw = tradeForeign * trade.fx;
    if (trade.side === "buy") {
      lot.quantity += trade.quantity;
      lot.costForeign += tradeForeign;
      lot.costKrw += tradeKrw;
    } else if (trade.side === "sell" && lot.quantity > 0) {
      const sellQty = Math.min(trade.quantity, lot.quantity);
      const ratio = sellQty / lot.quantity;
      lot.quantity -= sellQty;
      lot.costForeign -= lot.costForeign * ratio;
      lot.costKrw -= lot.costKrw * ratio;
    }

    if (lot.quantity > 0.00000001) lots.set(key, lot);
    else lots.delete(key);
  }

  return Array.from(lots.values()).map((lot) => {
    const asset = getAsset(lot.ticker, lot);
    const avgPrice = lot.quantity ? lot.costForeign / lot.quantity : 0;
    const avgFx = lot.costForeign ? lot.costKrw / lot.costForeign : 1;
    const currentFx = asset.currency === "KRW" ? 1 : asset.currentFx;
    const currentPrice = asset.currentPrice;
    const valueKrw = lot.quantity * currentPrice * currentFx;
    const stockProfit = lot.quantity * (currentPrice - avgPrice) * currentFx;
    const fxProfit = asset.currency === "KRW" ? 0 : lot.quantity * avgPrice * (currentFx - avgFx);
    return {
      ...lot,
      name: asset.name,
      type: asset.type,
      currency: asset.currency,
      currentPrice,
      currentFx,
      avgPrice,
      avgFx,
      valueKrw,
      stockProfit,
      fxProfit,
      profit: stockProfit + fxProfit,
      annualDividend: asset.annualDividend || 0
    };
  });
}

function netCashflow(ownerId) {
  return state.cashflows
    .filter((flow) => !ownerId || flow.ownerId === ownerId)
    .reduce((sum, flow) => sum + (flow.type === "deposit" ? flow.amount : -flow.amount), 0);
}

function cashBalance(ownerId) {
  const principal = netCashflow(ownerId);
  const tradeCash = state.trades
    .filter((trade) => !ownerId || trade.ownerId === ownerId)
    .reduce((sum, trade) => sum + (trade.side === "buy" ? -tradeAmountKrw(trade) : tradeAmountKrw(trade)), 0);
  return principal + tradeCash;
}

function expectedDividend(ownerId) {
  return replayHoldings(ownerId).reduce((sum, holding) => sum + holding.annualDividend, 0);
}

function summarize(ownerId) {
  const holdings = replayHoldings(ownerId);
  const principal = netCashflow(ownerId);
  const cash = cashBalance(ownerId);
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.valueKrw, 0);
  const totalValue = holdingsValue + cash;
  const profit = totalValue - principal;
  const dividend = expectedDividend(ownerId);
  const tax = dividend * DIVIDEND_TAX_RATE;
  return {
    holdings,
    principal,
    cash,
    holdingsValue,
    totalValue,
    profit,
    returnRate: principal ? (profit / principal) * 100 : 0,
    dividend,
    tax,
    dividendAfterTax: dividend - tax
  };
}

function groupedByType(ownerId) {
  const summary = summarize(ownerId);
  const total = Math.max(summary.totalValue, 1);
  const map = new Map();
  for (const holding of summary.holdings) {
    const current = map.get(holding.type) || { type: holding.type, value: 0 };
    current.value += holding.valueKrw;
    map.set(holding.type, current);
  }
  if (summary.cash !== 0) {
    map.set("예수금", { type: "예수금", value: summary.cash });
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
  const scope = state.selectedView === "investor" ? investorById(state.selectedInvestorId).name : "All Investors";
  document.querySelector("#holdingsScope").textContent = scope;
  document.querySelector("#transactionsScope").textContent = scope;
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
  document.querySelector("#cashAmount").textContent = money(summary.cash);
  document.querySelector("#cashRatio").textContent = `평가금액 포함 · ${pct(summary.totalValue ? (summary.cash / summary.totalValue) * 100 : 0)}`;
}

function renderAllocation() {
  const groups = groupedByType();
  const total = Math.max(summarize().totalValue, 1);
  let cursor = 0;
  const segments = groups.map((group, index) => {
    const value = Math.max(group.value, 0);
    const start = cursor;
    const end = cursor + (value / total) * 100;
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
      <strong class="${group.value < 0 ? "negative" : ""}">${pct(group.actual)}</strong>
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
      <div><strong>${investor.name}</strong><small>지분 ${pct(share)} · ${summary.holdings.length}개 종목</small></div>
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
  document.querySelector("#selectedInvestorLabel").textContent = `${investor.name}님의 평가금액`;
  document.querySelector("#investorValue").textContent = money(summary.totalValue);
  document.querySelector("#investorProfit").textContent = signedMoney(summary.profit);
  document.querySelector("#investorProfit").className = summary.profit >= 0 ? "positive" : "negative";
  document.querySelector("#investorReturn").textContent = `수익률 ${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`;
  document.querySelector("#investorHoldingsCount").textContent = `${summary.holdings.length}개 종목`;
  document.querySelector("#investorPrincipal").textContent = money(summary.principal);
  document.querySelector("#investorTax").textContent = money(summary.tax);
  document.querySelector("#investorDividend").textContent = money(summary.dividend);
  document.querySelector("#investorDividendAfterTax").textContent = `세후 ${money(summary.dividendAfterTax)}`;
  document.querySelector("#investorCash").textContent = money(summary.cash);
  document.querySelector("#deleteInvestorButton").disabled = state.investors.length <= 1;
  renderDeleteConfirm();
  renderCashflows();
  renderTradePreview();
}

function visibleOwnerId() {
  return state.selectedView === "investor" ? state.selectedInvestorId : null;
}

function renderHoldings() {
  const body = document.querySelector("#holdingsTable");
  body.innerHTML = "";
  for (const item of replayHoldings(visibleOwnerId())) {
    const owner = investorById(item.ownerId);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="asset-name"><strong>${item.ticker}</strong><small>${item.name}</small></span></td>
      <td><span class="owner-label">${owner.name}</span></td>
      <td><span class="pill">${item.type}</span></td>
      <td>${qty(item.quantity)}</td>
      <td>${money(item.avgPrice * item.avgFx)}<small class="subtext">${item.currency} ${numberFormatter.format(item.avgPrice)} · FX ${numberFormatter.format(item.avgFx)}</small></td>
      <td>${money(item.currentPrice * item.currentFx)}<small class="subtext">${item.currency} ${numberFormatter.format(item.currentPrice)} · FX ${numberFormatter.format(item.currentFx)}</small></td>
      <td>${money(item.valueKrw)}</td>
      <td class="${item.profit >= 0 ? "positive" : "negative"}">${signedMoney(item.profit)}<small class="subtext">주가 ${signedMoney(item.stockProfit)} · 환 ${signedMoney(item.fxProfit)}</small></td>
    `;
    body.appendChild(row);
  }
}

function visibleTransactions() {
  const ownerId = visibleOwnerId();
  return [
    ...state.cashflows.map((flow) => ({ ...flow, kind: "cashflow" })),
    ...state.trades.map((trade) => ({ ...trade, kind: "trade" }))
  ]
    .filter((item) => !ownerId || item.ownerId === ownerId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderTransactions() {
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

function renderCashflows() {
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
      row.innerHTML = `
        <span>${flow.date}</span>
        <strong class="${flow.type === "deposit" ? "positive" : "negative"}">${flow.type === "deposit" ? "입금" : "출금"} ${money(flow.amount)}</strong>
      `;
      list.appendChild(row);
    });
}

function populateOwnerSelects() {
  for (const id of ["cashflowOwnerSelect", "tradeOwnerSelect"]) {
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

function updateAssetFieldsFromTicker(ticker) {
  const asset = state.assetCatalog[ticker.trim().toUpperCase()];
  if (!asset) return;
  const form = document.querySelector("#tradeForm");
  form.elements.name.value = asset.name;
  form.elements.type.value = asset.type;
  form.elements.currency.value = asset.currency;
  form.elements.currentPrice.value = asset.currentPrice;
  form.elements.currentFx.value = asset.currentFx;
}

function tradePreviewData() {
  const form = document.querySelector("#tradeForm");
  const ownerId = form.elements.ownerId.value;
  const side = form.elements.side.value;
  const ticker = form.elements.ticker.value.trim().toUpperCase();
  const quantity = Number(form.elements.quantity.value) || 0;
  const price = Number(form.elements.price.value) || 0;
  const fx = Number(form.elements.fx.value) || 1;
  const before = replayHoldings(ownerId).find((holding) => holding.ticker === ticker);
  const buyForeign = quantity * price;
  const buyKrw = buyForeign * fx;

  if (!ticker || !quantity || !price) {
    return { before, text: "종목, 수량, 체결가를 입력하면 물타기 결과가 표시됩니다." };
  }

  if (side === "sell") {
    const proceeds = buyKrw;
    return { before, text: `예상 매도대금 ${money(proceeds)} · 보유수량 ${qty(before?.quantity || 0)}` };
  }

  const prevQty = before?.quantity || 0;
  const prevForeign = before?.costForeign || 0;
  const prevKrw = before?.costKrw || 0;
  const newQty = prevQty + quantity;
  const newForeign = prevForeign + buyForeign;
  const newKrw = prevKrw + buyKrw;
  const newAvgPrice = newQty ? newForeign / newQty : 0;
  const newAvgFx = newForeign ? newKrw / newForeign : fx;
  const asset = getAsset(ticker, { price, fx, currency: form.elements.currency.value });
  const currentFx = asset.currency === "KRW" ? 1 : Number(form.elements.currentFx.value || asset.currentFx || fx);
  const currentPrice = Number(form.elements.currentPrice.value || asset.currentPrice || price);
  const expectedValue = newQty * currentPrice * currentFx;
  const expectedProfit = expectedValue - newKrw;
  return {
    before,
    text: `매수 후 수량 ${qty(newQty)} · 새 평단 ${money(newAvgPrice * newAvgFx)} · 평균환율 ${qty(newAvgFx)} · 예상손익 ${signedMoney(expectedProfit)}`
  };
}

function renderTradePreview() {
  const preview = document.querySelector("#tradePreview");
  if (!preview) return;
  preview.textContent = tradePreviewData().text;
}

function canWithdraw(ownerId, amount) {
  return cashBalance(ownerId) >= amount;
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
  state.pendingDeleteInvestorId = null;
  saveState();
  render();
});

document.querySelector("#addInvestorForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.investorName;
  if (!input.value.trim()) return;
  const investor = makeInvestor(input.value);
  state.investors.push(investor);
  state.selectedInvestorId = investor.id;
  state.selectedView = "investor";
  input.value = "";
  saveState();
  render();
});

document.querySelector("#deleteInvestorButton").addEventListener("click", () => {
  if (state.investors.length <= 1) return;
  state.pendingDeleteInvestorId = state.selectedInvestorId;
  renderDeleteConfirm();
});

document.querySelector("#cancelDeleteInvestor").addEventListener("click", () => {
  state.pendingDeleteInvestorId = null;
  renderDeleteConfirm();
});

document.querySelector("#confirmDeleteInvestor").addEventListener("click", () => {
  const id = state.pendingDeleteInvestorId;
  if (!id || state.investors.length <= 1) return;
  state.investors = state.investors.filter((investor) => investor.id !== id);
  state.trades = state.trades.filter((trade) => trade.ownerId !== id);
  state.cashflows = state.cashflows.filter((flow) => flow.ownerId !== id);
  state.selectedInvestorId = state.investors[0].id;
  state.pendingDeleteInvestorId = null;
  saveState();
  render();
});

function renderDeleteConfirm() {
  document.querySelector("#deleteConfirm").classList.toggle("show", state.pendingDeleteInvestorId === state.selectedInvestorId);
}

document.querySelector("#cashflowForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const ownerId = form.elements.ownerId.value;
  const type = event.submitter?.dataset.cashflowType || "deposit";
  const amount = Number(form.elements.amount.value) || 0;
  if (!amount) return;
  if (type === "withdraw" && !canWithdraw(ownerId, amount)) {
    form.elements.amount.setCustomValidity("출금액이 예수금을 초과합니다.");
    form.reportValidity();
    form.elements.amount.setCustomValidity("");
    return;
  }
  state.cashflows.push({
    id: crypto.randomUUID(),
    ownerId,
    date: form.elements.date.value,
    type,
    amount,
    memo: form.elements.memo.value.trim()
  });
  form.reset();
  form.elements.date.valueAsDate = new Date();
  saveState();
  render();
});

document.querySelector("#openTradeForm").addEventListener("click", () => {
  const form = document.querySelector("#tradeForm");
  form.reset();
  form.elements.date.valueAsDate = new Date();
  form.elements.fx.value = 1;
  form.elements.currentFx.value = 1;
  populateOwnerSelects();
  renderTradePreview();
  openDialog(document.querySelector("#tradeDialog"));
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelector("#tradeForm").addEventListener("input", (event) => {
  if (event.target.name === "ticker") updateAssetFieldsFromTicker(event.target.value);
  if (event.target.name === "currency" && event.target.value === "KRW") {
    event.currentTarget.elements.fx.value = 1;
    event.currentTarget.elements.currentFx.value = 1;
  }
  renderTradePreview();
});

document.querySelector("#tradeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const ownerId = form.elements.ownerId.value;
  const side = form.elements.side.value;
  const ticker = form.elements.ticker.value.trim().toUpperCase();
  const quantity = Number(form.elements.quantity.value) || 0;
  const price = Number(form.elements.price.value) || 0;
  const fx = Number(form.elements.fx.value) || 1;
  const currentPrice = Number(form.elements.currentPrice.value) || price;
  const currentFx = form.elements.currency.value === "KRW" ? 1 : Number(form.elements.currentFx.value) || fx;
  const amount = quantity * price * fx;
  const existing = replayHoldings(ownerId).find((holding) => holding.ticker === ticker);

  if (side === "buy" && cashBalance(ownerId) < amount) {
    form.elements.quantity.setCustomValidity("매수금액이 예수금을 초과합니다.");
    form.reportValidity();
    form.elements.quantity.setCustomValidity("");
    return;
  }
  if (side === "sell" && (!existing || existing.quantity < quantity)) {
    form.elements.quantity.setCustomValidity("매도수량이 보유수량을 초과합니다.");
    form.reportValidity();
    form.elements.quantity.setCustomValidity("");
    return;
  }

  const trade = {
    id: crypto.randomUUID(),
    ownerId,
    date: form.elements.date.value,
    side,
    ticker,
    name: form.elements.name.value.trim() || ticker,
    type: form.elements.type.value,
    currency: form.elements.currency.value,
    quantity,
    price,
    fx,
    memo: form.elements.memo.value.trim()
  };
  ensureAssetFromTrade({ ...trade, price: currentPrice, fx: currentFx });
  state.assetCatalog[ticker].currentPrice = currentPrice;
  state.assetCatalog[ticker].currentFx = currentFx;
  state.trades.push(trade);
  saveState();
  render();
  form.closest("dialog").close();
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

document.querySelector("#cashflowForm").elements.date.valueAsDate = new Date();
render();
