import { investorById } from "../../domain/portfolio.js";
import { state } from "../../state/store.js";
import { uiState } from "../uistate.js";

// 투자자 삭제 확인 배너. events.js 와 investor.js 양쪽에서 부르므로 렌더 계층에 둔다.
// (events.js 에 두면 이벤트 등록 코드가 렌더 모듈로 딸려 들어와 테스트에서 document 가 필요해진다.)
export function renderDeleteConfirm() {
  document.querySelector("#deleteConfirm").classList.toggle("show", state.pendingDeleteInvestorId === state.selectedInvestorId);
}

export function visibleOwnerId() {
  return state.selectedView === "investor" ? state.selectedInvestorId : null;
}

export function renderView() {
  document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.remove("active-view"));
  const view = document.querySelector(`#${state.selectedView}View`) ? state.selectedView : "dashboard";
  document.querySelector(`#${view}View`).classList.add("active-view");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  const scope = view === "investor" ? investorById(state.selectedInvestorId).name : "All Investors";
  document.querySelector("#holdingsScope").textContent = scope;
  document.querySelector("#transactionsScope").textContent = scope;
  const ledgerWorkspace = document.querySelector("#ledgerWorkspace");
  ledgerWorkspace.classList.toggle("hidden", !["dashboard", "investor"].includes(view));
  ledgerWorkspace.classList.toggle("collapsed-ledger", !uiState.ledgerExpanded);
}
