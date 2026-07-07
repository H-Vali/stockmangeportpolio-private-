// 미국 상장 종목(개별주+ETF) DB 생성 스크립트.
// NASDAQ Trader 심볼 디렉터리(공개·무료)를 받아 us-symbols.json으로 변환한다.
// 실행: node data/build-symbols.mjs   (Node 18+ 필요, data/ 에 파일 생성)
import { writeFileSync } from "node:fs";

const SOURCES = [
  // file, symIdx, nameIdx, etfIdx, testIdx
  ["https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt", 0, 1, 6, 3],
  ["https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt", 0, 1, 4, 6]
];

function cleanName(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*-?\s*(Common Stock|Common Shares|Ordinary Shares)$/i, "")
    .trim();
}

async function fetchRows([url, symIdx, nameIdx, etfIdx, testIdx]) {
  const text = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 AssetPilot" } }).then((r) => r.text());
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("File Creation Time")) continue;
    const cols = line.split("|");
    const sym = (cols[symIdx] || "").trim();
    if (!sym || /[$]/.test(sym)) continue;
    if ((cols[testIdx] || "").trim() === "Y") continue;
    const etf = (cols[etfIdx] || "").trim().toUpperCase() === "Y" ? 1 : 0;
    rows.push([sym.toUpperCase(), cleanName(cols[nameIdx]), etf]);
  }
  return rows;
}

const all = (await Promise.all(SOURCES.map(fetchRows))).flat();
const map = new Map();
for (const row of all) if (!map.has(row[0])) map.set(row[0], row);
const list = [...map.values()].sort((a, b) => a[0].localeCompare(b[0]));

writeFileSync(new URL("./us-symbols.json", import.meta.url), JSON.stringify(list));
const etf = list.filter((r) => r[2] === 1).length;
console.log(`us-symbols.json 생성: ${list.length}개 (개별주 ${list.length - etf} · ETF ${etf})`);
