// src/ 전체의 import 그래프를 정적 검사한다.
//
// 브라우저에서만 확인하면 오타 하나에 흰 화면만 뜨고 원인을 못 찾는다.
// 이 스크립트는 번들러 없이도 다음을 잡아낸다.
//   - 존재하지 않는 파일을 가리키는 import
//   - 대상 모듈이 export 하지 않는 이름을 가져오는 import
//   - 같은 이름을 두 모듈이 export (분해 과정의 중복)
//   - import 로 들여온 바인딩에 재할당 (ES 모듈에서 런타임 오류)
//
// npm run check 로 테스트 전에 돌린다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "src");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (extname(full) === ".js") out.push(full);
  }
  return out;
}

const IMPORT_RE = /^import\s+\{([^}]*)\}\s+from\s+"([^"]+)";/gm;
const EXPORT_RE = /^export\s+(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*))/gm;
const EXPORT_LIST_RE = /^export\s*\{([^}]*)\};/gm;

function exportsOf(source) {
  const names = new Set();
  for (const match of source.matchAll(EXPORT_RE)) {
    names.add(match[1] || match[2] || match[3]);
  }
  for (const match of source.matchAll(EXPORT_LIST_RE)) {
    for (const raw of match[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/).pop();
      if (name) names.add(name);
    }
  }
  return names;
}

function importsOf(source) {
  const list = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const names = match[1]
      .split(",")
      .map((raw) => raw.trim().split(/\s+as\s+/)[0])
      .filter(Boolean);
    list.push({ names, from: match[2] });
  }
  return list;
}

const files = walk(SRC);
const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));
const exportMap = new Map([...sources].map(([file, source]) => [file, exportsOf(source)]));

const problems = [];
const rel = (file) => relative(ROOT, file).replace(/\\/g, "/");

// 1) 중복 export
const seen = new Map();
for (const [file, names] of exportMap) {
  for (const name of names) {
    if (seen.has(name)) problems.push(`중복 export "${name}": ${rel(seen.get(name))} / ${rel(file)}`);
    else seen.set(name, file);
  }
}

// 2) import 해석
for (const [file, source] of sources) {
  for (const { names, from } of importsOf(source)) {
    const target = resolve(dirname(file), from);
    if (!sources.has(target)) {
      problems.push(`${rel(file)}: 해석 불가 import "${from}"`);
      continue;
    }
    for (const name of names) {
      if (!exportMap.get(target).has(name)) {
        problems.push(`${rel(file)}: "${from}" 이(가) "${name}" 을(를) export 하지 않습니다`);
      }
    }
  }
}

// import 문을 제외한 본문 (사용 여부/재할당 판정용)
function bodyOf(source) {
  return source.replace(IMPORT_RE, "");
}

// 3) import 한 바인딩에 재할당 (const 바인딩이라 런타임에 TypeError)
//    문자열·속성 리터럴("...-state-v3", data-pct=" 등)은 제외한다.
for (const [file, source] of sources) {
  const body = bodyOf(source);
  const imported = new Set(importsOf(source).flatMap(({ names }) => names));
  for (const name of imported) {
    const assign = new RegExp(`(^|[^-.:"'\\w$])${name}\\s*(=[^=]|\\+\\+|--)`, "m");
    if (assign.test(body)) {
      problems.push(`${rel(file)}: import 한 "${name}" 에 재할당 — 소유 모듈에 setter 를 두세요`);
    }
  }
}

// 4) 쓰이지 않는 import — 분해 과정에서 문자열 안의 단어를 참조로 오인해 생긴
//    가짜 의존이 대부분이다. 그대로 두면 없어도 될 모듈 간 순환이 남는다.
for (const [file, source] of sources) {
  const body = bodyOf(source);
  for (const { names, from } of importsOf(source)) {
    for (const name of names) {
      const used = new RegExp(`(^|[^-.:"'\\w$])${name}\\b`).test(body);
      if (!used) problems.push(`${rel(file)}: 쓰이지 않는 import "${name}" (${from})`);
    }
  }
}

if (problems.length) {
  console.error(`모듈 검사 실패 (${problems.length}건)\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`모듈 검사 통과: ${files.length}개 파일, ${seen.size}개 export`);
