// app.js(단일 3,898줄)를 src/ 하위 ES 모듈로 분해한 1회성 코드모드. (실행 완료)
//
// ⚠️ 이제 실행되지 않습니다. 입력이던 app.js 는 분해 완료 후 삭제했습니다.
//    (필요하면 `git show 8e754ee:app.js` 로 원본을 볼 수 있습니다.)
//
//    이 파일은 **"원본의 어느 줄이 어느 모듈로 갔는가" 의 기록**으로 남겨 둡니다.
//    아래 BREAKPOINTS 표가 그 대응표입니다. 예전 커밋의 app.js 줄 번호를 보고
//    지금 어느 파일을 열어야 하는지 찾을 때 쓰세요.
//
//    되살려 재실행하더라도, 분해 이후 src/ 에 손으로 넣은 수정(setState 도입,
//    uiState 정리, shadowing 제거, renderDeleteConfirm 이동, 환율 동기화 등)이
//    전부 사라집니다. 실수 방지를 위해 --force 없이는 동작하지 않습니다.
//
// 동작 방식
//  1) BREAKPOINTS 에 정의된 [시작줄, 대상파일] 목록으로 app.js 를 연속 구간으로 자른다.
//  2) 각 구간을 대상 파일에 순서대로 이어붙인다.
//  3) 각 파일의 최상위 선언(function/const/let)을 찾아 export 를 붙인다.
//  4) 파일 간 참조를 정적 분석해 import 문을 자동 생성한다.
//  5) 모듈 경계를 넘는 가변 변수는 uiState 객체 프로퍼티로 치환한다.
//
// 원본 로직은 한 줄도 바꾸지 않는다. 실행 후 app.js 는 삭제하지 않고 남겨두며,
// 검증이 끝난 뒤 수동으로 제거한다.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "src");

const DROP = "__DROP__";

// [시작줄(1-indexed), 대상 모듈]. 각 구간은 다음 시작줄 직전까지.
const BREAKPOINTS = [
  [1, "config/constants.js"],
  [23, "core/time.js"],
  [52, "config/catalog.js"],
  [275, "config/constants.js"],
  [285, DROP], // 가변 UI 변수 -> ui/uistate.js 로 손수 재작성
  [296, "config/constants.js"],
  [304, "state/schema.js"],
  [340, "state/store.js"], // let state = loadState();
  [341, "app/bootstrap.js"],
  [353, DROP],
  [355, "ui/dom.js"], // toastTimer
  [356, "net/scheduler.js"], // pollingTimer, fxTimer
  [358, "net/crypto.js"], // crypto* 타이머/소켓 상태
  [366, DROP],
  [369, "core/format.js"],
  [399, "state/schema.js"],
  [451, "state/validate.js"],
  [488, "state/store.js"],
  [523, "state/sync.js"],
  [627, DROP], // loadAllocationRatios -> uistate.js
  [635, "core/format.js"],
  [646, "ui/dom.js"],
  [725, "core/format.js"],
  [741, "ui/dom.js"],
  [775, "core/format.js"],
  [786, "ui/dom.js"],
  [798, "ui/demo.js"],
  [846, "state/store.js"], // currentUsdKrw, proxyBaseUrl
  [854, "core/time.js"],
  [865, "ui/dom.js"], // showToast
  [874, "domain/portfolio.js"],
  [891, "domain/actions.js"],
  [918, "domain/portfolio.js"],
  [987, "domain/actions.js"],
  [1042, "ui/trade-dialog.js"],
  [1083, "domain/actions.js"],
  [1133, "ui/trade-dialog.js"],
  [1165, "domain/portfolio.js"],
  [1290, "state/store.js"], // recordSnapshot
  [1301, "ui/render/layout.js"],
  [1320, "domain/allocation.js"],
  [1342, "ui/dom.js"], // smoothTextUpdate
  [1353, "ui/render/dashboard.js"],
  [1564, "ui/render/market.js"],
  [1736, "ui/render/investor.js"],
  [1930, "ui/forms/new-asset.js"],
  [1966, "net/symbols.js"],
  [2022, "ui/forms/new-asset.js"],
  [2167, "ui/forms/quick-trade.js"],
  [2314, "ui/render/holdings.js"],
  [2355, "ui/render/transactions.js"],
  [2429, "ui/render/trend.js"],
  [2527, "ui/render/status.js"],
  [2554, "ui/forms/common.js"],
  [2627, "ui/render/dividend.js"],
  [2662, "domain/dividend.js"], // dividendRows (순수 계산)
  [2680, "ui/render/dividend.js"],
  [2873, "domain/dividend.js"],
  [2893, "ui/render/holdings.js"],
  [3064, "ui/render/index.js"],
  [3096, "net/crypto.js"],
  [3389, "net/stocks.js"],
  [3449, "net/fx.js"],
  [3520, "net/scheduler.js"],
  [3530, "ui/events.js"],
  [3890, "app/main.js"]
];

// 모듈 경계를 넘어 재할당되는 UI 가변 변수. uiState.<name> 으로 치환한다.
const UI_STATE_KEYS = [
  "previousAllocationRatios",
  "realtimeDemoInterval",
  "previousRealtimeValues",
  "holdingsTypeFilter",
  "quickTradeSide",
  "pendingImportState",
  "importRollbackState",
  "dividendDetailOpen",
  "ledgerExpanded",
  "editingTradeId"
];

// 손으로 작성해 두었으므로 코드모드가 덮어쓰지 않는 파일.
const HAND_WRITTEN = new Set(["ui/uistate.js"]);

// 손으로 작성한 모듈이 제공하는 export (import 자동 생성이 알아야 함).
const EXTRA_EXPORTS = {
  "ui/uistate.js": ["uiState", "loadAllocationRatios"],
  "state/persistence.js": ["storage"],
  "core/logger.js": ["logger"],
  "core/http.js": ["fetchJson", "HttpError"]
};

function slice(lines) {
  const chunks = new Map();
  for (let i = 0; i < BREAKPOINTS.length; i += 1) {
    const [start, file] = BREAKPOINTS[i];
    const end = i + 1 < BREAKPOINTS.length ? BREAKPOINTS[i + 1][0] - 1 : lines.length;
    if (file === DROP) continue;
    const body = lines.slice(start - 1, end).join("\n");
    if (!chunks.has(file)) chunks.set(file, []);
    chunks.get(file).push(body);
  }
  return new Map([...chunks].map(([file, parts]) => [file, parts.join("\n\n")]));
}

const DECL_RE = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/;

function topLevelNames(body) {
  const names = [];
  for (const line of body.split("\n")) {
    const match = DECL_RE.exec(line);
    if (match) names.push(match[1] || match[2]);
  }
  return names;
}

function addExports(body) {
  return body
    .split("\n")
    .map((line) => (DECL_RE.test(line) ? `export ${line}` : line))
    .join("\n");
}

// 앞에 '.' 이 없는 식별자만 참조로 인정(프로퍼티 접근 오탐 방지).
function referencedNames(body) {
  const found = new Set();
  const re = /(^|[^.\w$])([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = re.exec(body)) !== null) found.add(match[2]);
  return found;
}

function importPath(fromFile, toFile) {
  const rel = relative(dirname(fromFile), toFile).replace(/\\/g, "/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function main() {
  if (!process.argv.includes("--force")) {
    console.error(
      "이 코드모드는 이미 적용되었습니다. 재실행하면 src/ 의 이후 수정이 사라집니다.\n" +
        "정말 다시 돌리려면 --force 를 붙이세요."
    );
    process.exit(1);
  }
  const lines = readFileSync(resolve(ROOT, "app.js"), "utf8").split(/\r?\n/);
  const chunks = slice(lines);

  // 소유자 맵: 식별자 -> 정의된 모듈
  const owner = new Map();
  for (const [file, body] of chunks) {
    for (const name of topLevelNames(body)) {
      if (owner.has(name)) throw new Error(`중복 최상위 선언: ${name} (${owner.get(name)} / ${file})`);
      owner.set(name, file);
    }
  }
  for (const [file, names] of Object.entries(EXTRA_EXPORTS)) {
    for (const name of names) owner.set(name, file);
  }

  const uiStateKeys = new Set(UI_STATE_KEYS);
  const written = [];

  for (const [file, rawBody] of chunks) {
    if (HAND_WRITTEN.has(file)) continue;

    // 1) 모듈 경계를 넘는 가변 UI 변수를 uiState.<key> 로 치환하고,
    //    localStorage 직접 접근을 storage 어댑터 경유로 바꾼다(브라우저 밖에서도 동작).
    let body = rawBody.replace(/(^|[^.\w$])([A-Za-z_$][\w$]*)/g, (whole, lead, name) => {
      if (uiStateKeys.has(name)) return `${lead}uiState.${name}`;
      if (name === "localStorage") return `${lead}storage`;
      return whole;
    });

    // 2) 최상위 선언에 export 부여
    body = addExports(body);

    // 3) import 생성
    const local = new Set(topLevelNames(rawBody));
    const needed = new Map();
    const uses = referencedNames(body);
    if (/\buiState\./.test(body)) uses.add("uiState");
    for (const name of uses) {
      if (local.has(name)) continue;
      const from = owner.get(name);
      if (!from || from === file) continue;
      if (!needed.has(from)) needed.set(from, new Set());
      needed.get(from).add(name);
    }

    const header = [...needed.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([from, names]) => `import { ${[...names].sort().join(", ")} } from "${importPath(file, from)}";`)
      .join("\n");

    const out = resolve(SRC, file);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${header}${header ? "\n\n" : ""}${body.trim()}\n`, "utf8");
    written.push(`${file} (${body.split("\n").length} lines, ${needed.size} imports)`);
  }

  console.log(written.sort().join("\n"));
  console.log(`\n${written.length} modules written to src/`);
}

main();
