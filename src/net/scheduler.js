import { startCryptoRealtime } from "./crypto.js";
import { refreshFxRate } from "./fx.js";
import { refreshQuotes } from "./stocks.js";

export let pollingTimer = null;
export let fxTimer = null;

export function startPolling() {
  refreshFxRate();
  refreshQuotes();
  startCryptoRealtime();
  clearInterval(pollingTimer);
  clearInterval(fxTimer);
  pollingTimer = setInterval(refreshQuotes, 60000);
  fxTimer = setInterval(refreshFxRate, 5 * 60 * 1000);
}
