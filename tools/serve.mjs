// 로컬 개발용 정적 서버.
//
// ES 모듈은 file:// 로 열면 CORS 때문에 import 가 막힌다. 배포는 여전히
// 빌드 없는 정적 호스팅(GitHub Pages)이지만, 로컬 확인에는 서버가 필요하다.
//
//   npm run dev   ->  http://localhost:4173

import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

// ?rafshim=1 로 접속하면 requestAnimationFrame 을 setTimeout 으로 갈아끼운다.
//
// 앱의 render() 는 rAF 로 디바운스되어 있어서, 화면에 보이지 않는 탭(document.hidden)
// 에서는 rAF 가 아예 발화하지 않아 DOM 이 갱신되지 않는다. 자동화된 기능 점검에서만
// 필요한 우회이며, 개발 서버에서만 주입된다. 배포 산출물에는 들어가지 않는다.
const RAF_SHIM = `<script>
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  window.__rafShimmed = true;
</script>`;

createServer((request, response) => {
  const requestUrl = new URL(request.url, "http://localhost");
  const urlPath = decodeURIComponent(requestUrl.pathname);
  // 경로 탈출(../) 차단
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let file = join(ROOT, safe === "/" ? "index.html" : safe);

  try {
    if (statSync(file).isDirectory()) file = join(file, "index.html");
    statSync(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`404 ${safe}`);
    return;
  }

  const headers = {
    "Content-Type": TYPES[extname(file)] || "application/octet-stream",
    // 개발 중에는 캐시가 오히려 방해가 된다.
    "Cache-Control": "no-store"
  };

  if (requestUrl.searchParams.get("rafshim") === "1" && extname(file) === ".html") {
    const html = readFileSync(file, "utf8").replace("</head>", `${RAF_SHIM}</head>`);
    response.writeHead(200, headers);
    response.end(html);
    return;
  }

  response.writeHead(200, headers);
  createReadStream(file).pipe(response);
}).listen(PORT, () => {
  console.log(`AssetPilot dev server: http://localhost:${PORT}`);
});
