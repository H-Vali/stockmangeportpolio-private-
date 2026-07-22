import { SYNC_TOKEN_KEY } from "../config/constants.js";
import { storage } from "../state/persistence.js";
import { state } from "../state/store.js";

export const requestedView = new URLSearchParams(window.location.search).get("view");
export const requestedSyncKey = new URLSearchParams(window.location.search).get("synckey");
if (requestedSyncKey) {
  storage.setItem(SYNC_TOKEN_KEY, requestedSyncKey.trim());
}
if (["dashboard", "investor", "dividend", "calendar"].includes(requestedView)) {
  state.selectedView = requestedView;
}
