export const formatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0
});

export const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

export const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 4
});

export const fxFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const percentFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3
});

export const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});


export function money(value) {
  return `KRW ${formatter.format(Math.round(value || 0))}`;
}

export function moneyParts(value) {
  return {
    symbol: "KRW",
    amount: new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(value || 0))
  };
}


export function pct(value) {
  return `${percentFormatter.format(value || 0)}%`;
}

export function qty(value) {
  return numberFormatter.format(value || 0);
}

export function signedMoney(value) {
  return `${value >= 0 ? "+" : ""}${money(value)}`;
}

export function signedUsd(value) {
  return `${value >= 0 ? "+" : "-"}${usdFormatter.format(Math.abs(value || 0))}`;
}


export function signedPercentChange(value) {
  return `${value >= 0 ? "+" : ""}${pct(value)}`;
}

export function formatCompact(value) {
  const abs = Math.abs(value);
  if (abs >= 100000000) return `KRW ${(value / 100000000).toFixed(1)}억`;
  if (abs >= 10000) return `KRW ${(value / 10000).toFixed(1)}만`;
  return money(value);
}
