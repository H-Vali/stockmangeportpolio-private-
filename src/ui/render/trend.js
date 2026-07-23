import { money, pct, signedMoney, signedUsd } from "../../core/format.js";
import { summarize } from "../../domain/portfolio.js";
import { currentUsdKrw, state } from "../../state/store.js";

export function totalValueHistory() {
  const snapshots = (state.snapshots || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!snapshots.length) {
    return [{ date: new Date().toISOString().slice(0, 10), totalValue: summarize().totalValue }];
  }
  return snapshots;
}

export function chartPoints(history, width, height, pad) {
  const values = history.map((item) => item.totalValue);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const center = (rawMin + rawMax) / 2;
  const rawSpan = Math.max(rawMax - rawMin, 1);
  const minVisualSpan = Math.max(center * 0.01, rawSpan * 5, 1);
  const span = Math.max(rawSpan * 1.4, minVisualSpan);
  const min = center - span / 2;
  return history.map((item, index) => {
    const x = pad + (index / Math.max(history.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((item.totalValue - min) / span) * (height - pad * 2);
    return { x, y, item };
  });
}

export function renderHeroSparkline() {
  const plot = document.querySelector("#heroSparklinePlot");
  const history = totalValueHistory();
  if (!plot) return;
  const width = 360;
  const height = 120;
  const pad = 12;
  const summary = summarize();
  const summaryClass = summary.profit >= 0 ? "positive-spark" : "negative-spark";
  const summaryBadge = `
    <g class="spark-summary ${summaryClass}" transform="translate(90 34)">
      <rect x="-76" y="-24" width="152" height="48" rx="12"></rect>
      <text class="spark-summary-rate" x="0" y="-5" text-anchor="middle">${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}</text>
      <text class="spark-summary-profit" x="0" y="15" text-anchor="middle">${signedMoney(summary.profit)} · ${signedUsd(summary.profit / currentUsdKrw())}</text>
    </g>
  `;
  const wavePaths = `
    <path class="spark-wave spark-wave-one" d="M${pad} 91 C46 76, 72 100, 104 86 S164 77, 201 91 S262 102, 303 84 S335 78, ${width - pad} 91"></path>
    <path class="spark-wave spark-wave-two" d="M${pad} 101 C38 111, 76 88, 119 99 S177 115, 219 95 S285 82, 319 99 S342 108, ${width - pad} 97"></path>
  `;
  if (history.length < 2) {
    plot.innerHTML = `
      <path d="M${pad} 78 L${width - pad} 78" fill="none" stroke="url(#spark)" stroke-width="4" stroke-linecap="round" opacity=".7" />
      ${wavePaths}
      <circle class="spark-last-dot" cx="${width - pad}" cy="78" r="7"></circle>
      ${summaryBadge}
    `;
    return;
  }
  const points = chartPoints(history, width, height, pad);
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const baseline = height - pad;
  const area = `${points[0].x},${baseline} ${line} ${points.at(-1).x},${baseline}`;
  const lastPoint = points.at(-1);
  plot.innerHTML = `
    <polygon class="spark-area" points="${area}" fill="url(#sparkFill)"></polygon>
    ${wavePaths}
    <polyline points="${line}" fill="none" stroke="url(#spark)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    <circle class="spark-last-halo" cx="${lastPoint.x}" cy="${lastPoint.y}" r="11"></circle>
    <circle class="spark-last-dot" cx="${lastPoint.x}" cy="${lastPoint.y}" r="7"></circle>
    ${summaryBadge}
  `;
}

export function renderTrend() {
  const area = document.querySelector("#trendArea");
  const snapshots = totalValueHistory();
  document.querySelector("#trendPanel")?.classList.toggle("trend-empty", snapshots.length < 2);
  if (snapshots.length < 2) {
    area.innerHTML = `<div class="empty-state compact-empty">데이터가 쌓이면 추이가 표시됩니다.</div>`;
    document.querySelector("#trendHint").textContent = "";
    renderHeroSparkline();
    return;
  }
  const width = 760;
  const compact = snapshots.length < 7;
  const height = compact ? 110 : 220;
  const pad = 18;
  const values = snapshots.map((item) => item.totalValue);
  const max = Math.max(...values);
  const points = chartPoints(snapshots, width, height, pad);
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  document.querySelector("#trendHint").textContent = compact ? `최근 ${snapshots.length}일 데이터 · 더 쌓이면 정확한 추이가 표시됩니다` : "";
  area.innerHTML = `
    <svg class="trend-svg ${compact ? "compact-trend" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="총자산 추이">
      <polyline points="${pointString}" fill="none" stroke="#9d7bff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#f3f3f7"></circle>`).join("")}
      <text x="${pad}" y="${height - 2}" fill="#8e8e9c" font-size="12">${snapshots[0].date}</text>
      <text x="${width - pad}" y="${height - 2}" fill="#8e8e9c" font-size="12" text-anchor="end">${snapshots.at(-1).date}</text>
      <text x="${pad}" y="14" fill="#8e8e9c" font-size="12">${money(max)}</text>
    </svg>
  `;
  renderHeroSparkline();
}
