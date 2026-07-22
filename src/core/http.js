// 외부 API 호출 공통 계층.
//
// 기존 코드는 fetch 를 직접 부르면서 타임아웃이 없었다. 빗썸/바이낸스가 응답을
// 붙잡고 있으면 1분 폴링 주기가 겹쳐 요청이 계속 쌓였다. 여기서 타임아웃과
// 재시도를 한 곳에 모아 둔다.

import { logger } from "./logger.js";

export class HttpError extends Error {
  constructor(message, { status = 0, url = "", cause = null } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.cause = cause;
  }
}

const DEFAULT_TIMEOUT_MS = 8000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 5xx 와 네트워크 오류만 재시도한다. 4xx 는 다시 보내도 같은 답이 온다.
function isRetryable(error) {
  if (!(error instanceof HttpError)) return false;
  return error.status === 0 || error.status === 429 || error.status >= 500;
}

/**
 * JSON 응답을 기대하는 GET 요청.
 *
 * @param {string} url
 * @param {{ scope?: string, timeoutMs?: number, retries?: number, headers?: object, signal?: AbortSignal }} options
 */
export async function fetchJson(url, options = {}) {
  const {
    scope = "http",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 1,
    headers = {},
    signal
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) signal.addEventListener("abort", onAbort, { once: true });

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", ...headers },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new HttpError(`요청 실패 (${response.status})`, { status: response.status, url });
      }
      return await response.json();
    } catch (error) {
      lastError =
        error instanceof HttpError
          ? error
          : new HttpError(error.name === "AbortError" ? `응답 시간 초과 (${timeoutMs}ms)` : error.message, {
              url,
              cause: error
            });

      if (attempt < retries && isRetryable(lastError)) {
        const backoff = 400 * 2 ** attempt;
        logger.warn(scope, `${url} 실패, ${backoff}ms 후 재시도`, lastError);
        await sleep(backoff);
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }

  logger.error(scope, `${url} 최종 실패`, lastError);
  throw lastError;
}
