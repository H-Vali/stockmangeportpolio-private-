// 최소한의 진단 로거.
//
// 지금까지는 실패가 console.warn 으로만 흘러가서, 사용자가 "시세가 안 붙는다"고
// 말했을 때 무엇이 언제 실패했는지 재현할 방법이 없었다. 이 로거는 최근 기록을
// 링 버퍼에 남겨 두어 화면이나 내보내기 파일에서 바로 확인할 수 있게 한다.
//
// 서버/DB 단계로 가면 이 자리에 원격 전송을 붙인다.

const MAX_ENTRIES = 200;

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const entries = [];
let minLevel = LEVELS.info;

function push(level, scope, message, detail) {
  const entry = {
    at: new Date().toISOString(),
    level,
    scope,
    message,
    detail: detail instanceof Error ? { name: detail.name, message: detail.message } : detail ?? null
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();

  if (LEVELS[level] < minLevel) return entry;
  const line = `[${scope}] ${message}`;
  if (level === "error") console.error(line, detail ?? "");
  else if (level === "warn") console.warn(line, detail ?? "");
  else if (level === "info") console.info(line);
  else console.debug(line);
  return entry;
}

export const logger = {
  debug: (scope, message, detail) => push("debug", scope, message, detail),
  info: (scope, message, detail) => push("info", scope, message, detail),
  warn: (scope, message, detail) => push("warn", scope, message, detail),
  error: (scope, message, detail) => push("error", scope, message, detail),

  setLevel(level) {
    minLevel = LEVELS[level] ?? LEVELS.info;
  },

  // 최근 기록 사본. 백업 내보내기에 함께 담아 장애 재현에 쓴다.
  history: () => entries.slice(),

  // 마지막 오류만 빠르게 보고 싶을 때.
  lastError: () => entries.filter((entry) => entry.level === "error").at(-1) || null,

  clear: () => void entries.splice(0, entries.length)
};
