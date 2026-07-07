const STORAGE_KEY = "assetpilot-ledger-state-v2";
const LEGACY_STORAGE_KEY = "assetpilot-ledger-state-v1";
const SCHEMA_VERSION = 2;
const DIVIDEND_TAX_RATE = 0.15;
const DEFAULT_USDKRW = 1380;
const DEFAULT_PROXY_BASE_URL = "";
const PROXY_STORAGE_KEY = "assetpilot-proxy-base-url";
// frankfurter는 api.frankfurter.app 도메인이 폐기되어 api.frankfurter.dev(/v1)로 이전됨.
// 기존 .app URL은 CORS/네트워크 실패로 항상 폴백만 타던 문제가 있어 .dev로 교체.
const FX_API_PRIMARY_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW";
const FX_API_FALLBACK_URL = "https://open.er-api.com/v6/latest/USD";
const CRYPTO_REALTIME_RENDER_INTERVAL_MS = 3000;
const CRYPTO_CHANGE_EFFECT_THRESHOLD_PP = 0.05;
const CRYPTO_CHANGE_EFFECT_MIN_INTERVAL_MS = 9000;
const REALTIME_CHANGE_BADGE_DURATION_MS = 3000;
const REALTIME_CHANGE_BADGE_FADE_MS = 650;
const ALLOCATION_RATIOS_KEY = "assetpilot-allocation-ratios-v1";
// 다기기 동기화: 상태를 Cloudflare Worker(/state)로 저장/조회하기 위한 인증 토큰.
// ?synckey=... 로 접속하면 이 키에 저장되고 이후 자동으로 사용됩니다.
const SYNC_TOKEN_KEY = "assetpilot-sync-token";
const SYNC_PUSH_DEBOUNCE_MS = 1200;

function getKstNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    hours: Number(parts.hour),
    minutes: Number(parts.minute),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`
  };
}

function currentFxSlot() {
  const { hours, minutes } = getKstNowParts();
  const minutesNow = hours * 60 + minutes;
  if (minutesNow >= 9 * 60 && minutesNow < 15 * 60 + 30) return "open";
  if (minutesNow >= 15 * 60 + 30) return "close";
  return null;
}
const COINGECKO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  LINK: "chainlink"
};
// 주의: Binance는 USDT 기준가를 반환함. USDT는 통상 1달러에 근접하나 완전히 동일하지는 않음.
const BINANCE_SYMBOLS = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  ADA: "ADAUSDT",
  DOGE: "DOGEUSDT",
  AVAX: "AVAXUSDT",
  LINK: "LINKUSDT",
  BNB: "BNBUSDT"
};
const CRYPTO_LOGOS = {
  BTC: "https://cdn.simpleicons.org/bitcoin/f7931a",
  ETH: "https://cdn.simpleicons.org/ethereum/627eea",
  SOL: "https://cdn.simpleicons.org/solana/9945ff",
  BNB: "https://cdn.simpleicons.org/binance/f3ba2f",
  XRP: "https://cdn.simpleicons.org/xrp/f3f3f7"
};
const DIVIDEND_MONTHS = {
  SCHD: [3, 6, 9, 12],
  O: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  "360750": [1, 4, 7, 10],
  KR3Y: [3, 6, 9, 12]
};
const INDEX_MONITOR_LIST = [
  { ticker: "QQQ", label: "나스닥", group: "ETF", logoText: "Q" },
  { ticker: "SPY", label: "S&P500", group: "ETF", logoText: "S&P" },
  { ticker: "IWM", label: "러셀2000", group: "ETF", logoText: "R2K" },
  { ticker: "SOXX", label: "필라델피아 반도체", group: "ETF", logoText: "SOX" },
  { ticker: "AAPL", label: "Apple", group: "M7", logo: "https://cdn.simpleicons.org/apple/f3f3f7" },
  { ticker: "MSFT", label: "Microsoft", group: "M7", logo: "https://cdn.simpleicons.org/microsoft/f3f3f7" },
  { ticker: "GOOGL", label: "Alphabet", group: "M7", logo: "https://cdn.simpleicons.org/google/f3f3f7" },
  { ticker: "AMZN", label: "Amazon", group: "M7", logo: "https://cdn.simpleicons.org/amazon/f3f3f7" },
  { ticker: "NVDA", label: "NVIDIA", group: "M7", logo: "https://cdn.simpleicons.org/nvidia/f3f3f7" },
  { ticker: "META", label: "Meta", group: "M7", logo: "https://cdn.simpleicons.org/meta/f3f3f7" },
  { ticker: "TSLA", label: "Tesla", group: "M7", logo: "https://cdn.simpleicons.org/tesla/f3f3f7" }
];
const ASSET_DICTIONARY = [
  { ticker: "AAPL", name: "Apple", type: "주식", currency: "USD" },
  { ticker: "MSFT", name: "Microsoft", type: "주식", currency: "USD" },
  { ticker: "NVDA", name: "NVIDIA", type: "주식", currency: "USD" },
  { ticker: "AMZN", name: "Amazon", type: "주식", currency: "USD" },
  { ticker: "GOOGL", name: "Alphabet", type: "주식", currency: "USD" },
  { ticker: "META", name: "Meta Platforms", type: "주식", currency: "USD" },
  { ticker: "TSLA", name: "Tesla", type: "주식", currency: "USD" },
  { ticker: "AVGO", name: "Broadcom", type: "주식", currency: "USD" },
  { ticker: "BRK.B", name: "Berkshire Hathaway", type: "주식", currency: "USD" },
  { ticker: "LLY", name: "Eli Lilly", type: "주식", currency: "USD" },
  { ticker: "JPM", name: "JPMorgan Chase", type: "주식", currency: "USD" },
  { ticker: "V", name: "Visa", type: "주식", currency: "USD" },
  { ticker: "MA", name: "Mastercard", type: "주식", currency: "USD" },
  { ticker: "WMT", name: "Walmart", type: "주식", currency: "USD" },
  { ticker: "XOM", name: "Exxon Mobil", type: "주식", currency: "USD" },
  { ticker: "UNH", name: "UnitedHealth Group", type: "주식", currency: "USD" },
  { ticker: "COST", name: "Costco Wholesale", type: "주식", currency: "USD" },
  { ticker: "HD", name: "Home Depot", type: "주식", currency: "USD" },
  { ticker: "PG", name: "Procter & Gamble", type: "주식", currency: "USD" },
  { ticker: "JNJ", name: "Johnson & Johnson", type: "주식", currency: "USD" },
  { ticker: "ABBV", name: "AbbVie", type: "주식", currency: "USD" },
  { ticker: "NFLX", name: "Netflix", type: "주식", currency: "USD" },
  { ticker: "CRM", name: "Salesforce", type: "주식", currency: "USD" },
  { ticker: "ORCL", name: "Oracle", type: "주식", currency: "USD" },
  { ticker: "AMD", name: "Advanced Micro Devices", type: "주식", currency: "USD" },
  { ticker: "BAC", name: "Bank of America", type: "주식", currency: "USD" },
  { ticker: "KO", name: "Coca-Cola", type: "주식", currency: "USD" },
  { ticker: "PEP", name: "PepsiCo", type: "주식", currency: "USD" },
  { ticker: "MCD", name: "McDonald's", type: "주식", currency: "USD" },
  { ticker: "CSCO", name: "Cisco Systems", type: "주식", currency: "USD" },
  { ticker: "TMO", name: "Thermo Fisher Scientific", type: "주식", currency: "USD" },
  { ticker: "LIN", name: "Linde", type: "주식", currency: "USD" },
  { ticker: "ADBE", name: "Adobe", type: "주식", currency: "USD" },
  { ticker: "WFC", name: "Wells Fargo", type: "주식", currency: "USD" },
  { ticker: "DIS", name: "Walt Disney", type: "주식", currency: "USD" },
  { ticker: "INTU", name: "Intuit", type: "주식", currency: "USD" },
  { ticker: "IBM", name: "IBM", type: "주식", currency: "USD" },
  { ticker: "GE", name: "GE Aerospace", type: "주식", currency: "USD" },
  { ticker: "CAT", name: "Caterpillar", type: "주식", currency: "USD" },
  { ticker: "QCOM", name: "Qualcomm", type: "주식", currency: "USD" },
  { ticker: "TXN", name: "Texas Instruments", type: "주식", currency: "USD" },
  { ticker: "AMAT", name: "Applied Materials", type: "주식", currency: "USD" },
  { ticker: "NOW", name: "ServiceNow", type: "주식", currency: "USD" },
  { ticker: "ISRG", name: "Intuitive Surgical", type: "주식", currency: "USD" },
  { ticker: "VZ", name: "Verizon", type: "주식", currency: "USD" },
  { ticker: "T", name: "AT&T", type: "주식", currency: "USD" },
  { ticker: "CMCSA", name: "Comcast", type: "주식", currency: "USD" },
  { ticker: "NKE", name: "Nike", type: "주식", currency: "USD" },
  { ticker: "PFE", name: "Pfizer", type: "주식", currency: "USD" },
  { ticker: "MRK", name: "Merck", type: "주식", currency: "USD" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF", type: "ETF", currency: "USD" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", type: "ETF", currency: "USD" },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF", currency: "USD" },
  { ticker: "IVV", name: "iShares Core S&P 500 ETF", type: "ETF", currency: "USD" },
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", currency: "USD" },
  { ticker: "SCHD", name: "Schwab U.S. Dividend Equity ETF", type: "ETF", currency: "USD" },
  { ticker: "JEPI", name: "JPMorgan Equity Premium Income ETF", type: "ETF", currency: "USD" },
  { ticker: "JEPQ", name: "JPMorgan Nasdaq Equity Premium Income ETF", type: "ETF", currency: "USD" },
  { ticker: "QQQI", name: "NEOS Nasdaq-100 High Income ETF", type: "ETF", currency: "USD" },
  { ticker: "GPIX", name: "Goldman Sachs S&P 500 Core Premium Income ETF", type: "ETF", currency: "USD" },
  { ticker: "GPIQ", name: "Goldman Sachs Nasdaq-100 Core Premium Income ETF", type: "ETF", currency: "USD" },
  { ticker: "FEPI", name: "REX FANG & Innovation Equity Premium Income ETF", type: "ETF", currency: "USD" },
  { ticker: "DIVO", name: "Amplify CWP Enhanced Dividend Income ETF", type: "ETF", currency: "USD" },
  { ticker: "XYLD", name: "Global X S&P 500 Covered Call ETF", type: "ETF", currency: "USD" },
  { ticker: "QYLD", name: "Global X Nasdaq 100 Covered Call ETF", type: "ETF", currency: "USD" },
  { ticker: "RYLD", name: "Global X Russell 2000 Covered Call ETF", type: "ETF", currency: "USD" },
  { ticker: "TSLY", name: "YieldMax TSLA Option Income Strategy ETF", type: "ETF", currency: "USD" },
  { ticker: "NVDY", name: "YieldMax NVDA Option Income Strategy ETF", type: "ETF", currency: "USD" },
  { ticker: "CONY", name: "YieldMax COIN Option Income Strategy ETF", type: "ETF", currency: "USD" },
  { ticker: "MSTY", name: "YieldMax MSTR Option Income Strategy ETF", type: "ETF", currency: "USD" },
  { ticker: "YMAX", name: "YieldMax Universe Fund of Option Income ETFs", type: "ETF", currency: "USD" },
  { ticker: "YMAG", name: "YieldMax Magnificent 7 Fund of Option Income ETFs", type: "ETF", currency: "USD" },
  { ticker: "TSLL", name: "Direxion Daily TSLA Bull 2X Shares", type: "ETF", currency: "USD" },
  { ticker: "TSLQ", name: "AXS TSLA Bear Daily ETF", type: "ETF", currency: "USD" },
  { ticker: "NVDL", name: "GraniteShares 2x Long NVDA Daily ETF", type: "ETF", currency: "USD" },
  { ticker: "NVDU", name: "Direxion Daily NVDA Bull 2X Shares", type: "ETF", currency: "USD" },
  { ticker: "NVDS", name: "AXS 1.25X NVDA Bear Daily ETF", type: "ETF", currency: "USD" },
  { ticker: "AAPU", name: "Direxion Daily AAPL Bull 2X Shares", type: "ETF", currency: "USD" },
  { ticker: "MSFU", name: "Direxion Daily MSFT Bull 2X Shares", type: "ETF", currency: "USD" },
  { ticker: "GGLL", name: "Direxion Daily GOOGL Bull 2X Shares", type: "ETF", currency: "USD" },
  { ticker: "AMZU", name: "Direxion Daily AMZN Bull 2X Shares", type: "ETF", currency: "USD" },
  { ticker: "METU", name: "Direxion Daily META Bull 2X Shares", type: "ETF", currency: "USD" },
  { ticker: "CONL", name: "GraniteShares 2x Long COIN Daily ETF", type: "ETF", currency: "USD" },
  { ticker: "MSTU", name: "T-Rex 2X Long MSTR Daily Target ETF", type: "ETF", currency: "USD" },
  { ticker: "MSTX", name: "Defiance Daily Target 2X Long MSTR ETF", type: "ETF", currency: "USD" },
  { ticker: "TQQQ", name: "ProShares UltraPro QQQ", type: "ETF", currency: "USD" },
  { ticker: "SQQQ", name: "ProShares UltraPro Short QQQ", type: "ETF", currency: "USD" },
  { ticker: "QLD", name: "ProShares Ultra QQQ", type: "ETF", currency: "USD" },
  { ticker: "UPRO", name: "ProShares UltraPro S&P500", type: "ETF", currency: "USD" },
  { ticker: "SPXL", name: "Direxion Daily S&P 500 Bull 3X Shares", type: "ETF", currency: "USD" },
  { ticker: "SSO", name: "ProShares Ultra S&P500", type: "ETF", currency: "USD" },
  { ticker: "SPXU", name: "ProShares UltraPro Short S&P500", type: "ETF", currency: "USD" },
  { ticker: "UDOW", name: "ProShares UltraPro Dow30", type: "ETF", currency: "USD" },
  { ticker: "URTY", name: "ProShares UltraPro Russell2000", type: "ETF", currency: "USD" },
  { ticker: "TNA", name: "Direxion Daily Small Cap Bull 3X Shares", type: "ETF", currency: "USD" },
  { ticker: "SOXL", name: "Direxion Daily Semiconductor Bull 3X Shares", type: "ETF", currency: "USD" },
  { ticker: "SOXS", name: "Direxion Daily Semiconductor Bear 3X Shares", type: "ETF", currency: "USD" },
  { ticker: "TECL", name: "Direxion Daily Technology Bull 3X Shares", type: "ETF", currency: "USD" },
  { ticker: "TECS", name: "Direxion Daily Technology Bear 3X Shares", type: "ETF", currency: "USD" },
  { ticker: "FNGU", name: "MicroSectors FANG+ Index 3X Leveraged ETN", type: "ETF", currency: "USD" },
  { ticker: "FNGD", name: "MicroSectors FANG+ Index -3X Inverse Leveraged ETN", type: "ETF", currency: "USD" },
  { ticker: "LABU", name: "Direxion Daily S&P Biotech Bull 3X Shares", type: "ETF", currency: "USD" },
  { ticker: "FAS", name: "Direxion Daily Financial Bull 3X Shares", type: "ETF", currency: "USD" },
  { ticker: "ERX", name: "Direxion Daily Energy Bull 2X Shares", type: "ETF", currency: "USD" },
  { ticker: "YINN", name: "Direxion Daily FTSE China Bull 3X Shares", type: "ETF", currency: "USD" },
  { ticker: "WEBL", name: "Direxion Daily Dow Jones Internet Bull 3X Shares", type: "ETF", currency: "USD" },
  { ticker: "BITX", name: "Volatility Shares 2x Bitcoin ETF", type: "ETF", currency: "USD" },
  { ticker: "BITU", name: "ProShares Ultra Bitcoin ETF", type: "ETF", currency: "USD" },
  { ticker: "ETHU", name: "Volatility Shares 2x Ether ETF", type: "ETF", currency: "USD" },
  { ticker: "BOIL", name: "ProShares Ultra Bloomberg Natural Gas", type: "ETF", currency: "USD" },
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", type: "ETF", currency: "USD" },
  { ticker: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", type: "ETF", currency: "USD" },
  { ticker: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", type: "ETF", currency: "USD" },
  { ticker: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF", type: "ETF", currency: "USD" },
  { ticker: "LQD", name: "iShares iBoxx Investment Grade Corporate Bond ETF", type: "ETF", currency: "USD" },
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", type: "ETF", currency: "USD" },
  { ticker: "AGG", name: "iShares Core U.S. Aggregate Bond ETF", type: "ETF", currency: "USD" },
  { ticker: "VNQ", name: "Vanguard Real Estate ETF", type: "ETF", currency: "USD" },
  { ticker: "GLD", name: "SPDR Gold Shares", type: "ETF", currency: "USD" },
  { ticker: "SLV", name: "iShares Silver Trust", type: "ETF", currency: "USD" },
  { ticker: "SOXX", name: "iShares Semiconductor ETF", type: "ETF", currency: "USD" },
  { ticker: "SMH", name: "VanEck Semiconductor ETF", type: "ETF", currency: "USD" },
  { ticker: "XLK", name: "Technology Select Sector SPDR Fund", type: "ETF", currency: "USD" },
  { ticker: "XLF", name: "Financial Select Sector SPDR Fund", type: "ETF", currency: "USD" },
  { ticker: "XLE", name: "Energy Select Sector SPDR Fund", type: "ETF", currency: "USD" },
  { ticker: "XLY", name: "Consumer Discretionary Select Sector SPDR Fund", type: "ETF", currency: "USD" },
  { ticker: "XLP", name: "Consumer Staples Select Sector SPDR Fund", type: "ETF", currency: "USD" },
  { ticker: "XLU", name: "Utilities Select Sector SPDR Fund", type: "ETF", currency: "USD" },
  { ticker: "XLI", name: "Industrial Select Sector SPDR Fund", type: "ETF", currency: "USD" },
  { ticker: "XLV", name: "Health Care Select Sector SPDR Fund", type: "ETF", currency: "USD" },
  { ticker: "ARKK", name: "ARK Innovation ETF", type: "ETF", currency: "USD" },
  { ticker: "069500", name: "KODEX 200", type: "ETF", currency: "KRW" },
  { ticker: "102110", name: "TIGER 200", type: "ETF", currency: "KRW" },
  { ticker: "133690", name: "TIGER 미국나스닥100", type: "ETF", currency: "KRW" },
  { ticker: "360750", name: "TIGER 미국S&P500", type: "ETF", currency: "KRW" },
  { ticker: "379800", name: "KODEX 미국S&P500TR", type: "ETF", currency: "KRW" },
  { ticker: "381180", name: "TIGER 미국필라델피아반도체나스닥", type: "ETF", currency: "KRW" },
  { ticker: "458730", name: "TIGER 미국배당다우존스", type: "ETF", currency: "KRW" },
  { ticker: "441640", name: "KODEX 미국배당프리미엄액티브", type: "ETF", currency: "KRW" },
  { ticker: "305540", name: "TIGER 2차전지테마", type: "ETF", currency: "KRW" },
  { ticker: "229200", name: "KODEX 코스닥150", type: "ETF", currency: "KRW" },
  { ticker: "KR3Y", name: "국고채 3년", type: "채권", currency: "KRW" },
  { ticker: "BTC", name: "Bitcoin", type: "코인", currency: "USD" },
  { ticker: "ETH", name: "Ethereum", type: "코인", currency: "USD" },
  { ticker: "SOL", name: "Solana", type: "코인", currency: "USD" },
  { ticker: "BNB", name: "BNB", type: "코인", currency: "USD" },
  { ticker: "XRP", name: "XRP", type: "코인", currency: "USD" },
  { ticker: "ADA", name: "Cardano", type: "코인", currency: "USD" },
  { ticker: "DOGE", name: "Dogecoin", type: "코인", currency: "USD" },
  { ticker: "AVAX", name: "Avalanche", type: "코인", currency: "USD" },
  { ticker: "LINK", name: "Chainlink", type: "코인", currency: "USD" },
  { ticker: "DOT", name: "Polkadot", type: "코인", currency: "USD" },
  { ticker: "MATIC", name: "Polygon", type: "코인", currency: "USD" },
  { ticker: "TON", name: "Toncoin", type: "코인", currency: "USD" },
  { ticker: "TRX", name: "TRON", type: "코인", currency: "USD" },
  { ticker: "LTC", name: "Litecoin", type: "코인", currency: "USD" },
  { ticker: "BCH", name: "Bitcoin Cash", type: "코인", currency: "USD" },
  { ticker: "UNI", name: "Uniswap", type: "코인", currency: "USD" },
  { ticker: "AAVE", name: "Aave", type: "코인", currency: "USD" },
  { ticker: "NEAR", name: "NEAR Protocol", type: "코인", currency: "USD" },
  { ticker: "ATOM", name: "Cosmos", type: "코인", currency: "USD" },
  { ticker: "FIL", name: "Filecoin", type: "코인", currency: "USD" },
  { ticker: "ICP", name: "Internet Computer", type: "코인", currency: "USD" },
  { ticker: "ETC", name: "Ethereum Classic", type: "코인", currency: "USD" },
  { ticker: "XLM", name: "Stellar", type: "코인", currency: "USD" },
  { ticker: "HBAR", name: "Hedera", type: "코인", currency: "USD" },
  { ticker: "APT", name: "Aptos", type: "코인", currency: "USD" },
  { ticker: "SUI", name: "Sui", type: "코인", currency: "USD" },
  { ticker: "ARB", name: "Arbitrum", type: "코인", currency: "USD" },
  { ticker: "OP", name: "Optimism", type: "코인", currency: "USD" },
  { ticker: "PEPE", name: "Pepe", type: "코인", currency: "USD" },
  { ticker: "SHIB", name: "Shiba Inu", type: "코인", currency: "USD" }
];
const allocationColors = {
  코인: "#7C5CFC",
  주식: "#FF7AC8",
  ETF: "#3BB5A6",
  채권: "#E8B339",
  예수금: "#5A5A68"
};
const ALLOCATION_ORDER = ["주식", "ETF", "코인", "채권", "예수금"];
const fallbackColors = ["#ff7ac8", "#3bb5a6", "#7c5cfc", "#e8b339", "#5a5a68"];
const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
let previousAllocationRatios = loadAllocationRatios();
let realtimeDemoInterval = null;
const ENABLE_AUTO_REALTIME_DEMO = true;
let previousRealtimeValues = {
  market: {},
  investors: {},
  index: {}
};
let holdingsTypeFilter = null;
let quickTradeSide = "buy";

const seedState = {
  schemaVersion: SCHEMA_VERSION,
  selectedView: "dashboard",
  selectedInvestorId: "kim",
  pendingDeleteInvestorId: null,
  displayCurrency: "KRW",
  fx: {
    usdkrw: DEFAULT_USDKRW,
    mode: "auto",
    manualUsdkrw: DEFAULT_USDKRW,
    source: "manual",
    updatedAt: null,
    lastAutoFetchDate: null,
    lastAutoFetchSlot: null
  },
  market: {
    lastUpdatedAt: null,
    failedAt: null,
    lastSuccessAt: null,
    error: null
  },
  overseasPriceSource: "seed",
  cryptoQuoteFx: {
    rate: null,
    source: null,
    updatedAt: null
  },
  snapshots: [],
  investors: [
    { id: "kim", name: "김지훈", initials: "김" },
    { id: "lee", name: "이서연", initials: "이" }
  ],
  assetCatalog: {
    SCHD: { ticker: "SCHD", name: "SCHD", type: "주식", currency: "USD", currentPrice: 29.5, currentFx: DEFAULT_USDKRW, annualDividend: 9881 },
    O: { ticker: "O", name: "Realty Income", type: "주식", currency: "USD", currentPrice: 58, currentFx: DEFAULT_USDKRW, annualDividend: 8200 },
    BTC: { ticker: "BTC", name: "Bitcoin", type: "코인", currency: "USD", currentPrice: 38000, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    ETH: { ticker: "ETH", name: "Ethereum", type: "코인", currency: "USD", currentPrice: 2391, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    "360750": { ticker: "360750", name: "TIGER 미국S&P500", type: "ETF", currency: "KRW", currentPrice: 19640, currentFx: 1, annualDividend: 4600 },
    KR3Y: { ticker: "KR3Y", name: "국고채 3년", type: "채권", currency: "KRW", currentPrice: 100400, currentFx: 1, annualDividend: 36000 },
    XRP: { ticker: "XRP", name: "XRP", type: "코인", currency: "USD", currentPrice: 2.44, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    QQQ: { ticker: "QQQ", name: "Invesco QQQ Trust", type: "주식", currency: "USD", currentPrice: 740.62, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    SPY: { ticker: "SPY", name: "SPDR S&P 500 ETF", type: "주식", currency: "USD", currentPrice: 746.74, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    IWM: { ticker: "IWM", name: "iShares Russell 2000 ETF", type: "주식", currency: "USD", currentPrice: 295.59, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    SOXX: { ticker: "SOXX", name: "iShares Semiconductor ETF", type: "주식", currency: "USD", currentPrice: 639.45, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    AAPL: { ticker: "AAPL", name: "Apple", type: "주식", currency: "USD", currentPrice: 298.01, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    MSFT: { ticker: "MSFT", name: "Microsoft", type: "주식", currency: "USD", currentPrice: 379.4, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    GOOGL: { ticker: "GOOGL", name: "Alphabet", type: "주식", currency: "USD", currentPrice: 368.03, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    AMZN: { ticker: "AMZN", name: "Amazon", type: "주식", currency: "USD", currentPrice: 244.39, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    NVDA: { ticker: "NVDA", name: "NVIDIA", type: "주식", currency: "USD", currentPrice: 210.69, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    META: { ticker: "META", name: "Meta", type: "주식", currency: "USD", currentPrice: 577.22, currentFx: DEFAULT_USDKRW, annualDividend: 0 },
    TSLA: { ticker: "TSLA", name: "Tesla", type: "주식", currency: "USD", currentPrice: 400.49, currentFx: DEFAULT_USDKRW, annualDividend: 0 }
  },
  indexQuotes: {},
  marketIndicators: [
    { symbol: "BTC", domestic: 52000000, globalKrw: 50420000, domesticChange: 0, globalChange: 0, updatedAt: null },
    { symbol: "ETH", domestic: 3300000, globalKrw: 3244000, domesticChange: 0, globalChange: 0, updatedAt: null },
    { symbol: "SOL", domestic: 224000, globalKrw: 216800, domesticChange: 0, globalChange: 0, updatedAt: null },
    { symbol: "BNB", domestic: 978000, globalKrw: 951000, domesticChange: 0, globalChange: 0, updatedAt: null },
    { symbol: "XRP", domestic: 3500, globalKrw: 3370, domesticChange: 0, globalChange: 0, updatedAt: null }
  ],
  cashflows: [
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-01", type: "deposit", amount: 3000000, memo: "초기 입금" },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-01", type: "deposit", amount: 3400000, memo: "초기 입금" }
  ],
  trades: [
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-03", side: "buy", ticker: "SCHD", name: "SCHD", type: "주식", currency: "USD", quantity: 20, price: 25, fx: 1360 },
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-04", side: "buy", ticker: "O", name: "Realty Income", type: "주식", currency: "USD", quantity: 15, price: 54, fx: 1370 },
    { id: crypto.randomUUID(), ownerId: "kim", date: "2026-06-08", side: "buy", ticker: "BTC", name: "Bitcoin", type: "코인", currency: "USD", quantity: 0.005, price: 29000, fx: DEFAULT_USDKRW },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-05", side: "buy", ticker: "360750", name: "TIGER 미국S&P500", type: "ETF", currency: "KRW", quantity: 58, price: 17250, fx: 1 },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-10", side: "buy", ticker: "ETH", name: "Ethereum", type: "코인", currency: "USD", quantity: 0.42, price: 2094, fx: DEFAULT_USDKRW },
    { id: crypto.randomUUID(), ownerId: "lee", date: "2026-06-12", side: "buy", ticker: "KR3Y", name: "국고채 3년", type: "채권", currency: "KRW", quantity: 12, price: 101000, fx: 1 }
  ]
};

let state = loadState();
const requestedView = new URLSearchParams(window.location.search).get("view");
const requestedProxy = new URLSearchParams(window.location.search).get("proxy");
if (requestedProxy) {
  localStorage.setItem(PROXY_STORAGE_KEY, requestedProxy.replace(/\/$/, ""));
}
const requestedSyncKey = new URLSearchParams(window.location.search).get("synckey");
if (requestedSyncKey) {
  localStorage.setItem(SYNC_TOKEN_KEY, requestedSyncKey.trim());
}
if (["dashboard", "investor", "dividend", "calendar"].includes(requestedView)) {
  state.selectedView = requestedView;
}
let pendingImportState = null;
let importRollbackState = null;
let toastTimer = null;
let pollingTimer = null;
let fxTimer = null;
let cryptoSocket = null;
let cryptoDomesticTimer = null;
let cryptoRenderTimer = null;
let cryptoReconnectTimer = null;
let cryptoReconnectAttempts = 0;
let cryptoSocketShouldReconnect = false;
let cryptoRealtimeSymbolKey = "";
let cryptoChangeEffectAt = {};
let dividendDetailOpen = false;
let ledgerExpanded = false;

const formatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 4
});

const fxFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3
});

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function mergeMarketIndicators(input, defaults) {
  const map = new Map();
  defaults.forEach((item) => map.set(item.symbol, item));
  if (Array.isArray(input)) input.forEach((item) => map.set(item.symbol, item));
  return Array.from(map.values());
}

function normalizeState(input) {
  const base = structuredClone(seedState);
  const parsed = input && typeof input === "object" ? input : {};
  return {
    ...base,
    ...parsed,
    schemaVersion: parsed.schemaVersion || 1,
    fx: { ...base.fx, ...(parsed.fx || {}) },
    market: { ...base.market, ...(parsed.market || {}) },
    overseasPriceSource: parsed.overseasPriceSource || base.overseasPriceSource,
    cryptoQuoteFx: { ...base.cryptoQuoteFx, ...(parsed.cryptoQuoteFx || {}) },
    snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
    indexQuotes: parsed.indexQuotes || {},
    investors: parsed.investors,
    assetCatalog: { ...base.assetCatalog, ...(parsed.assetCatalog || {}) },
    marketIndicators: mergeMarketIndicators(parsed.marketIndicators, base.marketIndicators),
    cashflows: parsed.cashflows,
    trades: parsed.trades
  };
}

function validateImportState(candidate) {
  const errors = [];
  const isArray = (key) => {
    if (!Array.isArray(candidate?.[key])) errors.push(`${key} 배열이 없습니다.`);
  };
  isArray("investors");
  isArray("trades");
  isArray("cashflows");

  if (errors.length) return errors;

  candidate.investors.forEach((investor, index) => {
    if (typeof investor.id !== "string" || typeof investor.name !== "string") {
      errors.push(`investors[${index}] 필수 필드가 올바르지 않습니다.`);
    }
  });
  candidate.cashflows.forEach((flow, index) => {
    if (typeof flow.ownerId !== "string" || !["deposit", "withdraw"].includes(flow.type) || typeof flow.amount !== "number") {
      errors.push(`cashflows[${index}] 필수 필드가 올바르지 않습니다.`);
    }
  });
  candidate.trades.forEach((trade, index) => {
    if (
      typeof trade.ownerId !== "string" ||
      !["buy", "sell"].includes(trade.side) ||
      typeof trade.ticker !== "string" ||
      typeof trade.quantity !== "number" ||
      typeof trade.price !== "number" ||
      typeof trade.fx !== "number"
    ) {
      errors.push(`trades[${index}] 필수 필드가 올바르지 않습니다.`);
    }
  });

  return errors;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return structuredClone(seedState);
  try {
    const parsed = JSON.parse(raw);
    const errors = validateImportState(parsed);
    if (errors.length) return structuredClone(seedState);
    return normalizeState(parsed);
  } catch {
    return structuredClone(seedState);
  }
}

function exportableState() {
  return {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString()
  };
}

function saveState(options = {}) {
  state.schemaVersion = SCHEMA_VERSION;
  persistLocal();
  schedulePush();
  if (options.snapshot !== false) recordSnapshot();
}

// --- 다기기 동기화 (Cloudflare Worker + KV) -------------------------------
let syncPushTimer = null;
let syncPushInFlight = false;
let syncPushQueued = false;

function getSyncToken() {
  return (localStorage.getItem(SYNC_TOKEN_KEY) || "").trim();
}

// 동기화는 프록시 Worker URL과 인증 토큰이 둘 다 있을 때만 활성화됨.
function syncEnabled() {
  return Boolean(proxyBaseUrl() && getSyncToken());
}

// 로컬 캐시(오프라인 대비 및 즉시 첫 화면 렌더용).
function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// 잦은 저장을 묶어서 서버로 한 번만 올림.
function schedulePush() {
  if (!syncEnabled()) return;
  if (syncPushTimer) clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(pushStateToServer, SYNC_PUSH_DEBOUNCE_MS);
}

async function pushStateToServer() {
  if (!syncEnabled()) return;
  if (syncPushInFlight) { syncPushQueued = true; return; }
  syncPushInFlight = true;
  try {
    const payload = { ...state, schemaVersion: SCHEMA_VERSION, syncedAt: new Date().toISOString() };
    const response = await fetch(`${proxyBaseUrl()}/state`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getSyncToken()}`
      },
      body: JSON.stringify(payload)
    });
    setSyncStatus(response.ok ? "synced" : "error", response.ok ? null : `저장 실패 (${response.status})`);
  } catch (error) {
    setSyncStatus("offline", "서버에 연결할 수 없어 로컬에만 저장했습니다.");
  } finally {
    syncPushInFlight = false;
    if (syncPushQueued) {
      syncPushQueued = false;
      schedulePush();
    }
  }
}

// 부팅 시: 서버(공유 원본)에 저장된 상태가 있으면 그걸 정본으로 채택.
// 서버가 비어 있으면 현재 로컬 상태를 서버에 최초 업로드.
async function hydrateFromServer() {
  if (!syncEnabled()) return;
  try {
    const response = await fetch(`${proxyBaseUrl()}/state`, {
      headers: { "Authorization": `Bearer ${getSyncToken()}` }
    });
    if (!response.ok) {
      setSyncStatus("error", `동기화 불러오기 실패 (${response.status})`);
      return;
    }
    const data = await response.json();
    if (!data || data.state == null) {
      // 서버가 비어 있음 -> 현재 로컬 상태를 최초 업로드.
      await pushStateToServer();
      return;
    }
    const errors = validateImportState(data.state);
    if (errors.length) {
      setSyncStatus("error", "서버 데이터 형식 오류로 로컬 상태를 유지합니다.");
      return;
    }
    state = normalizeState(data.state);
    persistLocal();
    setSyncStatus("synced");
    render();
  } catch (error) {
    setSyncStatus("offline", "서버에 연결할 수 없어 로컬 데이터로 시작합니다.");
  }
}

let lastSyncStatus = null;
function setSyncStatus(status, message) {
  // 상태가 바뀔 때만 토스트로 알림(성공은 조용히, 실패/오프라인은 안내).
  if (status !== lastSyncStatus && message) {
    showToast(message, status === "error" || status === "offline" ? "error" : "info");
  }
  lastSyncStatus = status;
}

function loadAllocationRatios() {
  try {
    return JSON.parse(localStorage.getItem(ALLOCATION_RATIOS_KEY) || "{}") || {};
  } catch (error) {
    return {};
  }
}

function money(value) {
  return `KRW ${formatter.format(Math.round(value || 0))}`;
}

function moneyParts(value) {
  return {
    symbol: "KRW",
    amount: new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(value || 0))
  };
}

const _animatingElements = new Map();

function animateNumberTo(element, targetValue, duration = 420) {
  if (!element) return;
  const key = element;
  const existing = _animatingElements.get(key);
  const startValue = existing ? existing.current : (parseFloat(element.dataset.animValue) || 0);
  if (existing) cancelAnimationFrame(existing.raf);
  if (Math.abs(startValue - targetValue) < 0.5) {
    _animatingElements.delete(key);
    element.dataset.animValue = targetValue;
    return targetValue;
  }
  const startTime = performance.now();
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);
    const current = startValue + (targetValue - startValue) * eased;
    const entry = _animatingElements.get(key);
    if (entry) entry.current = current;
    element.dataset.animValue = current;
    if (progress < 1) {
      const raf = requestAnimationFrame(tick);
      if (entry) entry.raf = raf;
    } else {
      _animatingElements.delete(key);
      element.dataset.animValue = targetValue;
    }
    return current;
  }
  const state = { current: startValue, raf: requestAnimationFrame(tick) };
  _animatingElements.set(key, state);
  return startValue;
}

function setMoneyElement(selector, value) {
  const element = document.querySelector(selector);
  if (!element) return;
  const prev = parseFloat(element.dataset.animValue) || 0;
  const parts = moneyParts(value);
  if (Math.abs(prev - value) < 0.5) {
    element.innerHTML = `<span class="currency-prefix">${parts.symbol}</span>${parts.amount}`;
    element.dataset.animValue = value;
    return;
  }
  const duration = 420;
  const startTime = performance.now();
  const existing = _animatingElements.get(element);
  if (existing) cancelAnimationFrame(existing.raf);
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = prev + (value - prev) * easeOutCubic(progress);
    const p = moneyParts(current);
    element.innerHTML = `<span class="currency-prefix">${p.symbol}</span>${p.amount}`;
    element.dataset.animValue = current;
    if (progress < 1) {
      const raf = requestAnimationFrame(tick);
      const entry = _animatingElements.get(element);
      if (entry) entry.raf = raf;
    } else {
      _animatingElements.delete(element);
      element.dataset.animValue = value;
    }
  }
  _animatingElements.set(element, { current: prev, raf: requestAnimationFrame(tick) });
}

function setSignedMoneyElement(selector, value) {
  const element = document.querySelector(selector);
  if (!element) return;
  const sign = value >= 0 ? "+" : "-";
  const parts = moneyParts(Math.abs(value));
  element.innerHTML = `<span class="currency-prefix">${sign}${parts.symbol}</span>${parts.amount}`;
}

function pct(value) {
  return `${percentFormatter.format(value || 0)}%`;
}

function qty(value) {
  return numberFormatter.format(value || 0);
}

function signedMoney(value) {
  return `${value >= 0 ? "+" : ""}${money(value)}`;
}

function signedUsd(value) {
  return `${value >= 0 ? "+" : "-"}${usdFormatter.format(Math.abs(value || 0))}`;
}

function markRealtimeChange(card, diff, formatter = signedMoney) {
  if (!card || !Number.isFinite(diff) || Math.abs(diff) < 0.000001) return;
  const direction = diff >= 0 ? "up" : "down";
  const flashClass = direction === "up" ? "realtime-flash-up" : "realtime-flash-down";
  card.classList.remove("realtime-flash-up", "realtime-flash-down");
  void card.offsetWidth;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      card.classList.add(flashClass);
    });
  });
  card.querySelectorAll(".metric-change-badge").forEach((existingBadge) => {
    existingBadge.classList.add("fading");
    setTimeout(() => existingBadge.remove(), REALTIME_CHANGE_BADGE_FADE_MS);
  });
  const badge = document.createElement("b");
  badge.className = `metric-change-badge ${direction === "up" ? "positive" : "negative"}`;
  badge.textContent = `${formatter(diff)} ${direction === "up" ? "▲" : "▼"}`;
  const slot = card.querySelector(".metric-badge-slot");
  if (slot) slot.appendChild(badge);
  else {
    const title = card.querySelector("strong");
    if (title) title.appendChild(badge);
    else card.appendChild(badge);
  }
  setTimeout(() => {
    badge.classList.add("fading");
  }, Math.max(0, REALTIME_CHANGE_BADGE_DURATION_MS - REALTIME_CHANGE_BADGE_FADE_MS));
  setTimeout(() => {
    badge.remove();
    card.classList.remove("realtime-flash-up", "realtime-flash-down");
  }, REALTIME_CHANGE_BADGE_DURATION_MS);
}

function signedPercentChange(value) {
  return `${value >= 0 ? "+" : ""}${pct(value)}`;
}

function formatCompact(value) {
  const abs = Math.abs(value);
  if (abs >= 100000000) return `KRW ${(value / 100000000).toFixed(1)}억`;
  if (abs >= 10000) return `KRW ${(value / 10000).toFixed(1)}만`;
  return money(value);
}

function renderMetricTitle(label) {
  return `<strong class="metric-title"><span>${label}</span><i class="metric-badge-slot" aria-hidden="true"></i></strong>`;
}

function renderCryptoLogo(symbol) {
  const logo = CRYPTO_LOGOS[symbol];
  const text = symbol.slice(0, 3);
  return logo
    ? `<i class="stock-logo-frame crypto-logo-frame"><img src="${logo}" alt="${symbol}" loading="lazy" /></i>`
    : `<i class="stock-logo-frame stock-logo-text crypto-logo-frame"><b>${text}</b></i>`;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function nudgeValue(value, percent, minimum = 0) {
  return Math.max(minimum, value * (1 + percent / 100));
}

function triggerDashboardChangeDemo(options = {}) {
  const silent = Boolean(options.silent);
  const now = new Date().toISOString();

  replayHoldings().forEach((holding) => {
    if (holding.type === "코인") return;
    const asset = state.assetCatalog[holding.ticker];
    if (asset?.currentPrice) {
      asset.currentPrice = Number(nudgeValue(asset.currentPrice, randomBetween(-0.36, 0.44), 0.0001).toFixed(asset.currency === "KRW" ? 0 : 2));
    }
  });

  state.indexQuotes = state.indexQuotes || {};
  INDEX_MONITOR_LIST.forEach((idx) => {
    const asset = state.assetCatalog[idx.ticker];
    if (!asset) return;
    const existing = state.indexQuotes[idx.ticker];
    const move = randomBetween(-0.58, 0.72);
    const basePrice = Number(existing?.price || asset.currentPrice || 1);
    const nextPrice = Number(nudgeValue(basePrice, move, 0.0001).toFixed(2));
    asset.currentPrice = nextPrice;
    state.indexQuotes[idx.ticker] = {
      price: nextPrice,
      changePercent: Math.max(-7.5, Math.min(7.5, Number(((existing?.changePercent || 0) + move).toFixed(2)))),
      updatedAt: now
    };
  });

  render();
  if (!silent) showToast("실시간 변동 효과 테스트 중입니다. 실제 데이터는 저장되지 않습니다.");
}

function startRealtimeDemoLoop() {
  if (!ENABLE_AUTO_REALTIME_DEMO) return;
  clearInterval(realtimeDemoInterval);
  realtimeDemoInterval = setInterval(() => {
    if (state.selectedView === "dashboard") triggerDashboardChangeDemo({ silent: true });
  }, 3000);
}

function currentUsdKrw() {
  return state.fx.mode === "manual" ? Number(state.fx.manualUsdkrw || DEFAULT_USDKRW) : Number(state.fx.usdkrw || DEFAULT_USDKRW);
}

function proxyBaseUrl() {
  return (localStorage.getItem(PROXY_STORAGE_KEY) || DEFAULT_PROXY_BASE_URL).replace(/\/$/, "");
}

function formatClock(value) {
  if (!value) return "대기 중";
  return new Date(value).toLocaleTimeString("ko-KR", { hour12: false });
}

function formatMinutesAgo(value) {
  if (!value) return "갱신 전";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  return `${minutes}분 전 기준`;
}

function showToast(message, variant = "info") {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.toggle("negative", variant === "error");
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function investorById(id) {
  return state.investors.find((investor) => investor.id === id) || state.investors[0];
}

function makeInvestor(name) {
  const clean = name.trim();
  return {
    id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: clean,
    initials: clean.slice(0, 1).toUpperCase()
  };
}

function addInvestorByName(name, options = {}) {
  const clean = name.trim();
  if (!clean) return null;
  const investor = makeInvestor(clean);
  state.investors.push(investor);
  state.selectedInvestorId = investor.id;
  state.pendingDeleteInvestorId = null;
  if (options.openSheet) state.selectedView = "investor";
  saveState();
  render();
  showToast(`${investor.name} 투자자를 추가했습니다.`);
  return investor;
}

function updateInvestorName(id, name) {
  const clean = name.trim();
  const investor = state.investors.find((item) => item.id === id);
  if (!investor || !clean) return false;
  if (investor.name === clean) return true;
  investor.name = clean;
  investor.initials = clean.slice(0, 1).toUpperCase();
  saveState();
  render();
  showToast("투자자 이름을 저장했습니다.");
  return true;
}

function tradeAmountKrw(trade) {
  return trade.quantity * trade.price * trade.fx;
}

function getAsset(ticker, fallback = {}) {
  return state.assetCatalog[ticker] || {
    ticker,
    name: fallback.name || ticker,
    type: fallback.type || "주식",
    currency: fallback.currency || "USD",
    currentPrice: fallback.price || 0,
    currentFx: fallback.fx || currentUsdKrw(),
    annualDividend: 0
  };
}

function ensureAssetFromTrade(trade) {
  const existing = state.assetCatalog[trade.ticker];
  state.assetCatalog[trade.ticker] = {
    ticker: trade.ticker,
    name: trade.name || existing?.name || trade.ticker,
    type: trade.type || existing?.type || "주식",
    currency: trade.currency || existing?.currency || "USD",
    currentPrice: existing?.currentPrice ?? trade.price,
    currentFx: existing?.currentFx ?? trade.fx,
    annualDividend: existing?.annualDividend ?? 0
  };
}

function computeAveragingPreview({ ownerId, side, ticker, quantity, price, fx, currency, currentFx, currentPrice }) {
  const before = replayHoldings(ownerId).find((holding) => holding.ticker === ticker);
  const tradeForeign = quantity * price;
  const tradeKrw = tradeForeign * fx;

  if (!ticker || !quantity || !price) {
    return { before, text: "종목, 수량, 체결가를 입력하면 물타기 결과가 표시됩니다." };
  }

  if (side === "sell") {
    return {
      before,
      text: `예상 매도대금 ${money(tradeKrw)} · 보유수량 ${qty(before?.quantity || 0)}`,
      proceeds: tradeKrw
    };
  }

  const prevQty = before?.quantity || 0;
  const prevForeign = before?.costForeign || 0;
  const prevKrw = before?.costKrw || 0;
  const nextQty = prevQty + quantity;
  const nextForeign = prevForeign + tradeForeign;
  const nextKrw = prevKrw + tradeKrw;
  const beforeAvgPrice = prevQty ? prevForeign / prevQty : 0;
  const beforeAvgFx = prevForeign ? prevKrw / prevForeign : fx;
  const afterAvgPrice = nextQty ? nextForeign / nextQty : 0;
  const afterAvgFx = nextForeign ? nextKrw / nextForeign : fx;
  const expectedValue = nextQty * currentPrice * currentFx;
  const expectedProfit = expectedValue - nextKrw;
  return {
    before,
    beforeAvgPrice,
    beforeAvgFx,
    afterAvgPrice,
    afterAvgFx,
    expectedProfit,
    text: `매수 후 수량 ${qty(nextQty)} · 새 평단 ${money(afterAvgPrice * afterAvgFx)} · 평균환율 ${qty(afterAvgFx)} · 예상손익 ${signedMoney(expectedProfit)}`
  };
}

function commitTrade(data) {
  const ticker = data.ticker.trim().toUpperCase();
  const asset = getAsset(ticker, data);
  const currency = data.currency || asset.currency;
  const fx = currency === "KRW" ? 1 : Number(data.fx || asset.currentFx || currentUsdKrw());
  const currentFx = currency === "KRW" ? 1 : Number(data.currentFx || asset.currentFx || fx);
  const currentPrice = Number(data.currentPrice || asset.currentPrice || data.price);
  const quantity = Number(data.quantity) || 0;
  const price = Number(data.price) || 0;
  const amount = quantity * price * fx;
  const existing = replayHoldings(data.ownerId).find((holding) => holding.ticker === ticker);

  if (!ticker || !quantity || !price) return { ok: false, message: "종목, 수량, 체결가를 입력하세요." };
  const registerHeld = data.registerHeld === true && data.side === "buy";
  if (data.side === "buy" && !registerHeld && cashBalance(data.ownerId) < amount) {
    return { ok: false, field: "quantity", message: "매수금액이 예수금을 초과합니다." };
  }
  if (data.side === "sell" && (!existing || existing.quantity < quantity)) {
    return { ok: false, field: "quantity", message: "매도수량이 보유수량을 초과합니다." };
  }

  const trade = {
    id: crypto.randomUUID(),
    ownerId: data.ownerId,
    date: data.date || new Date().toISOString().slice(0, 10),
    side: data.side,
    ticker,
    name: data.name || asset.name || ticker,
    type: data.type || asset.type,
    currency,
    quantity,
    price,
    fx,
    memo: data.memo || ""
  };
  ensureAssetFromTrade({ ...trade, price: currentPrice, fx: currentFx });
  state.assetCatalog[ticker].currentPrice = currentPrice;
  state.assetCatalog[ticker].currentFx = currentFx;
  if (registerHeld && amount > 0) {
    state.cashflows.push({
      id: crypto.randomUUID(),
      ownerId: data.ownerId,
      date: trade.date,
      type: "deposit",
      amount: Math.round(amount),
      memo: "보유 등록 자동 입금",
      autoFor: trade.id
    });
  }
  state.trades.push(trade);
  saveState();
  render();
  return { ok: true, trade };
}

let editingTradeId = null;

function tradeById(id) {
  return state.trades.find((trade) => trade.id === id);
}

// 거래 수정 모달을 기존 거래 값으로 채워 연다.
function openTradeEditor(tradeId) {
  const trade = tradeById(tradeId);
  if (!trade) return;
  editingTradeId = tradeId;
  const form = document.querySelector("#tradeForm");
  populateOwnerSelects();
  form.elements.ownerId.value = trade.ownerId;
  form.elements.date.value = trade.date;
  form.elements.side.value = trade.side;
  form.elements.currency.value = trade.currency;
  form.elements.ticker.value = trade.ticker;
  form.elements.name.value = trade.name || "";
  form.elements.type.value = trade.type || "주식";
  form.elements.quantity.value = trade.quantity;
  form.elements.price.value = trade.price;
  form.elements.fx.value = trade.fx;
  const asset = state.assetCatalog[trade.ticker] || {};
  form.elements.currentPrice.value = asset.currentPrice ?? trade.price;
  form.elements.currentFx.value = trade.currency === "KRW" ? 1 : (asset.currentFx ?? trade.fx);
  form.elements.memo.value = trade.memo || "";
  setTradeDialogMode("edit");
  renderTradePreview();
  openDialog(document.querySelector("#tradeDialog"));
}

function setTradeDialogMode(mode) {
  const title = document.querySelector("#tradeDialogTitle");
  const del = document.querySelector("#deleteTradeButton");
  if (title) title.textContent = mode === "edit" ? "거래 수정" : "매수·매도 입력";
  if (del) del.hidden = mode !== "edit";
  if (mode !== "edit") editingTradeId = null;
}

// 기존 거래를 수정. 연결된 '보유 등록 자동 입금'도 함께 동기화한다.
function updateTrade(id, data) {
  const trade = tradeById(id);
  if (!trade) return { ok: false, message: "거래를 찾을 수 없습니다." };
  const ticker = (data.ticker || "").trim().toUpperCase();
  const quantity = Number(data.quantity) || 0;
  const price = Number(data.price) || 0;
  if (!ticker || !quantity || !price) return { ok: false, field: "ticker", message: "종목, 수량, 체결가를 입력하세요." };
  const currency = data.currency;
  const fx = currency === "KRW" ? 1 : Number(data.fx) || 1;
  Object.assign(trade, {
    ownerId: data.ownerId,
    date: data.date || trade.date,
    side: data.side,
    ticker,
    name: (data.name || "").trim() || ticker,
    type: data.type,
    currency,
    quantity,
    price,
    fx,
    memo: (data.memo || "").trim()
  });
  const currentPrice = Number(data.currentPrice) || price;
  const currentFx = currency === "KRW" ? 1 : Number(data.currentFx) || fx;
  ensureAssetFromTrade({ ...trade, price: currentPrice, fx: currentFx });
  state.assetCatalog[ticker].currentPrice = currentPrice;
  state.assetCatalog[ticker].currentFx = currentFx;
  const auto = state.cashflows.find((flow) => flow.autoFor === id);
  if (auto) {
    if (trade.side === "buy") {
      auto.amount = Math.round(quantity * price * fx);
      auto.date = trade.date;
      auto.ownerId = trade.ownerId;
    } else {
      state.cashflows = state.cashflows.filter((flow) => flow.autoFor !== id);
    }
  }
  saveState();
  render();
  return { ok: true };
}

function deleteTrade(id) {
  state.trades = state.trades.filter((trade) => trade.id !== id);
  state.cashflows = state.cashflows.filter((flow) => flow.autoFor !== id);
  editingTradeId = null;
  saveState();
  render();
}

// 한 종목이 여러 거래로 구성된 경우, 거래 목록에서 수정/삭제할 항목을 고른다.
function openHoldingTrades(ownerId, ticker) {
  const trades = state.trades
    .filter((trade) => trade.ownerId === ownerId && trade.ticker === ticker)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  if (trades.length === 1) {
    openTradeEditor(trades[0].id);
    return;
  }
  const list = document.querySelector("#holdingTradesList");
  const titleEl = document.querySelector("#holdingTradesTitle");
  if (!list) return;
  if (titleEl) titleEl.textContent = `${ticker} 거래 내역`;
  list.innerHTML = trades
    .map((trade) => {
      const label = trade.side === "buy" ? "매수" : "매도";
      const tone = trade.side === "buy" ? "buy" : "sell";
      const nat = trade.currency === "USD" ? `$${trade.price}` : `${Math.round(trade.price).toLocaleString("ko-KR")}원`;
      return `
        <div class="holding-trade-row">
          <div><i class="activity-badge ${tone}">${label}</i><strong>${trade.date}</strong><small>${trade.quantity} × ${nat}${trade.currency === "USD" ? ` · 환율 ${trade.fx}` : ""}</small></div>
          <div class="holding-trade-actions">
            <button type="button" class="ghost-button" data-edit-trade="${trade.id}">수정</button>
            <button type="button" class="danger-text-button" data-delete-trade="${trade.id}">삭제</button>
          </div>
        </div>`;
    })
    .join("");
  openDialog(document.querySelector("#holdingTradesDialog"));
}

function replayHoldings(ownerId) {
  const lots = new Map();
  const trades = state.trades
    .filter((trade) => !ownerId || trade.ownerId === ownerId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const trade of trades) {
    const key = `${trade.ownerId}:${trade.ticker}`;
    const asset = getAsset(trade.ticker, trade);
    const lot = lots.get(key) || {
      ownerId: trade.ownerId,
      ticker: trade.ticker,
      name: trade.name || asset.name,
      type: trade.type || asset.type,
      currency: trade.currency || asset.currency,
      quantity: 0,
      costForeign: 0,
      costKrw: 0
    };

    const tradeForeign = trade.quantity * trade.price;
    const tradeKrw = tradeForeign * trade.fx;
    if (trade.side === "buy") {
      lot.quantity += trade.quantity;
      lot.costForeign += tradeForeign;
      lot.costKrw += tradeKrw;
    } else if (trade.side === "sell" && lot.quantity > 0) {
      const sellQty = Math.min(trade.quantity, lot.quantity);
      const ratio = sellQty / lot.quantity;
      lot.quantity -= sellQty;
      lot.costForeign -= lot.costForeign * ratio;
      lot.costKrw -= lot.costKrw * ratio;
    }

    if (lot.quantity > 0.00000001) lots.set(key, lot);
    else lots.delete(key);
  }

  return Array.from(lots.values()).map((lot) => {
    const asset = getAsset(lot.ticker, lot);
    const avgPrice = lot.quantity ? lot.costForeign / lot.quantity : 0;
    const avgFx = lot.costForeign ? lot.costKrw / lot.costForeign : 1;
    const currentFx = asset.currency === "KRW" ? 1 : asset.currentFx;
    const currentPrice = asset.currentPrice;
    const valueKrw = lot.quantity * currentPrice * currentFx;
    const stockProfit = lot.quantity * (currentPrice - avgPrice) * currentFx;
    const fxProfit = asset.currency === "KRW" ? 0 : lot.quantity * avgPrice * (currentFx - avgFx);
    return {
      ...lot,
      name: asset.name,
      type: asset.type,
      currency: asset.currency,
      currentPrice,
      currentFx,
      avgPrice,
      avgFx,
      valueKrw,
      stockProfit,
      fxProfit,
      profit: stockProfit + fxProfit,
      annualDividend: asset.annualDividend || 0
    };
  });
}

function netCashflow(ownerId) {
  return state.cashflows
    .filter((flow) => !ownerId || flow.ownerId === ownerId)
    .reduce((sum, flow) => sum + (flow.type === "deposit" ? flow.amount : -flow.amount), 0);
}

function cashBalance(ownerId) {
  const principal = netCashflow(ownerId);
  const tradeCash = state.trades
    .filter((trade) => !ownerId || trade.ownerId === ownerId)
    .reduce((sum, trade) => sum + (trade.side === "buy" ? -tradeAmountKrw(trade) : tradeAmountKrw(trade)), 0);
  return principal + tradeCash;
}

function expectedDividend(ownerId) {
  return replayHoldings(ownerId).reduce((sum, holding) => sum + holding.annualDividend, 0);
}

function summarize(ownerId) {
  const holdings = replayHoldings(ownerId);
  const principal = netCashflow(ownerId);
  const cash = cashBalance(ownerId);
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.valueKrw, 0);
  const totalValue = holdingsValue + cash;
  const profit = totalValue - principal;
  const dividend = expectedDividend(ownerId);
  const tax = dividend * DIVIDEND_TAX_RATE;
  return {
    holdings,
    principal,
    cash,
    holdingsValue,
    totalValue,
    profit,
    returnRate: principal ? (profit / principal) * 100 : 0,
    dividend,
    tax,
    dividendAfterTax: dividend - tax
  };
}

function groupedByType(ownerId) {
  const summary = summarize(ownerId);
  const total = Math.max(summary.totalValue, 1);
  const map = new Map();
  for (const holding of summary.holdings) {
    const current = map.get(holding.type) || { type: holding.type, value: 0 };
    current.value += holding.valueKrw;
    map.set(holding.type, current);
  }
  if (summary.cash !== 0) {
    map.set("예수금", { type: "예수금", value: summary.cash });
  }
  return Array.from(map.values()).map((item) => ({
    ...item,
    actual: (item.value / total) * 100
  }));
}

function recordSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  const totalValue = summarize().totalValue;
  const next = (state.snapshots || []).filter((item) => item.date !== today);
  next.push({ date: today, totalValue });
  next.sort((a, b) => a.date.localeCompare(b.date));
  state.snapshots = next;
  persistLocal();
  schedulePush();
}

function visibleOwnerId() {
  return state.selectedView === "investor" ? state.selectedInvestorId : null;
}

function renderView() {
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
  ledgerWorkspace.classList.toggle("collapsed-ledger", !ledgerExpanded);
}

function getAllocationSlices(ownerId) {
  const holdings = replayHoldings(ownerId);
  const summary = summarize(ownerId);
  const totals = {};

  holdings.forEach((item) => {
    totals[item.type] = (totals[item.type] || 0) + item.valueKrw;
  });
  if (summary.cash > 0) totals["예수금"] = summary.cash;

  const slices = ALLOCATION_ORDER
    .filter((key) => totals[key] > 0)
    .map((key) => ({
      key,
      amount: totals[key],
      pct: summary.totalValue > 0 ? (totals[key] / summary.totalValue) * 100 : 0,
      color: allocationColors[key] || fallbackColors[0]
    }));

  return { slices, totalValue: summary.totalValue };
}

function smoothTextUpdate(selector, newText) {
  const el = document.querySelector(selector);
  if (!el || el.textContent === newText) return;
  el.style.transition = "opacity 180ms ease";
  el.style.opacity = "0.4";
  requestAnimationFrame(() => {
    el.textContent = newText;
    requestAnimationFrame(() => { el.style.opacity = "1"; });
  });
}

function renderDashboard() {
  const summary = summarize();
  const totalProfit = document.querySelector("#totalProfit");
  setMoneyElement("#totalValue", summary.totalValue);
  setMoneyElement("#totalPrincipal", summary.principal);
  const profitText = signedMoney(summary.profit);
  if (totalProfit.textContent !== profitText) {
    totalProfit.style.transition = "opacity 180ms ease";
    totalProfit.style.opacity = "0.4";
    requestAnimationFrame(() => {
      totalProfit.textContent = profitText;
      totalProfit.className = summary.profit >= 0 ? "positive" : "negative";
      requestAnimationFrame(() => { totalProfit.style.opacity = "1"; });
    });
  }
  smoothTextUpdate("#profitRate", `수익률 ${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`);
  smoothTextUpdate("#totalDividend", `총배당 ${money(summary.dividend)}`);
  setMoneyElement("#cashAmount", summary.cash);
  smoothTextUpdate("#cashRatio", `평가금액 포함 · ${pct(summary.totalValue ? (summary.cash / summary.totalValue) * 100 : 0)}`);
}

function renderAllocation() {
  const ownerId = visibleOwnerId();
  const { slices, totalValue } = getAllocationSlices(ownerId);
  renderDonutInto(
    "#allocationDonut",
    "#allocationLegend",
    { label: "#allocationCenterLabel", pct: "#allocationCenterPct", amt: "#allocationCenterAmt" },
    slices,
    totalValue
  );
  renderAllocationInvestorBreakdown();
  wireAllocationInteractions(
    slices,
    totalValue,
    "#allocationDonut",
    "#allocationLegend",
    "#allocationCenterLabel",
    "#allocationCenterPct",
    "#allocationCenterAmt"
  );
}

function renderAllocationDonut(slices, totalValue) {
  renderDonutInto(
    "#allocationDonut",
    null,
    { label: "#allocationCenterLabel", pct: "#allocationCenterPct", amt: "#allocationCenterAmt" },
    slices,
    totalValue
  );
}

function renderDonutInto(svgSelector, legendSelector, centerSelectors, slices, totalValue) {
  const svg = document.querySelector(svgSelector);
  if (!svg) return;
  const r = 40;
  const circumference = 2 * Math.PI * r;
  let cursor = 0;
  const segmentsSvg = slices
    .map((slice) => {
      const length = (slice.pct / 100) * circumference;
      const dasharray = `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`;
      const rotate = -90 + (cursor / 100) * 360;
      cursor += slice.pct;
      return `<circle class="donut-seg" data-key="${slice.key}" data-amt="${Math.round(slice.amount)}" data-pct="${slice.pct.toFixed(3)}" stroke="${slice.color}" cx="50" cy="50" r="${r}" fill="none" stroke-width="16" stroke-dasharray="${dasharray}" transform="rotate(${rotate.toFixed(2)} 50 50)"></circle>`;
    })
    .join("");
  svg.innerHTML = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="#1C1C25" stroke-width="16"></circle>${segmentsSvg}`;

  if (legendSelector) {
    renderAllocationLegend(slices, legendSelector);
  }

  if (centerSelectors) {
    const centerAmt = document.querySelector(centerSelectors.amt);
    const centerPct = document.querySelector(centerSelectors.pct);
    const centerLabel = document.querySelector(centerSelectors.label);
    if (centerLabel) centerLabel.textContent = "전체";
    if (centerPct) centerPct.textContent = totalValue > 0 ? "100.0%" : "0.0%";
    if (centerAmt) centerAmt.textContent = money(totalValue);
  }
}

function renderAllocationLegend(slices, selector = "#allocationLegend") {
  const legend = document.querySelector(selector);
  if (!legend) return;
  legend.innerHTML = slices
    .map((slice) => `
      <div class="leg-row" data-key="${slice.key}">
        <span class="leg-label">
          <i class="swatch" style="background:${slice.color}"></i>${slice.key}
        </span>
        <span class="leg-value">${slice.pct.toFixed(3)}%</span>
      </div>
    `)
    .join("");
}

function renderAllocationInvestorBreakdown() {
  const container = document.querySelector("#allocationInvestorBreakdown");
  if (!container) return;
  container.innerHTML = state.investors
    .map((investor) => {
      const myHoldings = replayHoldings(investor.id);
      const mySummary = summarize(investor.id);
      const myTotals = {};
      myHoldings.forEach((item) => {
        myTotals[item.type] = (myTotals[item.type] || 0) + item.valueKrw;
      });
      if (mySummary.cash > 0) myTotals["예수금"] = mySummary.cash;
      const segments = ALLOCATION_ORDER
        .filter((key) => myTotals[key] > 0)
        .map((key) => {
          const ratio = mySummary.totalValue > 0 ? (myTotals[key] / mySummary.totalValue) * 100 : 0;
          return `<div class="ibar-seg" style="width:${ratio.toFixed(2)}%;background:${allocationColors[key] || fallbackColors[0]}" title="${key} ${ratio.toFixed(1)}%"></div>`;
        })
        .join("");
      return `
        <div class="investor-bar-row">
          <div class="investor-bar-head"><span style="font-weight:600">${investor.name}</span><span class="muted">${money(mySummary.totalValue)}</span></div>
          <div class="investor-bar-track">${segments}</div>
        </div>
      `;
    })
    .join("");
}

function wireAllocationInteractions(
  slices,
  totalValue,
  svgSelector = "#allocationDonut",
  legendSelector = "#allocationLegend",
  centerLabelSelector = "#allocationCenterLabel",
  centerPctSelector = "#allocationCenterPct",
  centerAmtSelector = "#allocationCenterAmt"
) {
  const segments = document.querySelectorAll(`${svgSelector} .donut-seg`);
  const rows = document.querySelectorAll(`${legendSelector} .leg-row`);
  const centerLabel = document.querySelector(centerLabelSelector);
  const centerPct = document.querySelector(centerPctSelector);
  const centerAmt = document.querySelector(centerAmtSelector);

  function setCenter(key) {
    if (!centerLabel || !centerPct || !centerAmt) return;
    if (!key) {
      centerLabel.textContent = "전체";
      centerPct.textContent = totalValue > 0 ? "100.0%" : "0.0%";
      centerAmt.textContent = money(totalValue);
      return;
    }
    const slice = slices.find((item) => item.key === key);
    if (!slice) return;
    centerLabel.textContent = slice.key;
    centerPct.textContent = `${slice.pct.toFixed(1)}%`;
    centerAmt.textContent = money(slice.amount);
  }

  function highlight(key) {
    segments.forEach((segment) => {
      const active = segment.dataset.key === key;
      segment.style.strokeWidth = active ? "19" : "16";
      segment.style.opacity = key && !active ? "0.35" : "1";
      segment.style.filter = active ? "drop-shadow(0 0 9px rgba(157, 123, 255, 0.36))" : "";
    });
    rows.forEach((row) => row.classList.toggle("hl", row.dataset.key === key));
    setCenter(key);
  }

  segments.forEach((segment) => {
    segment.addEventListener("mouseenter", () => highlight(segment.dataset.key));
    segment.addEventListener("mouseleave", () => highlight(null));
    segment.addEventListener("click", () => filterHoldingsByType(segment.dataset.key));
  });
  rows.forEach((row) => {
    row.addEventListener("mouseenter", () => highlight(row.dataset.key));
    row.addEventListener("mouseleave", () => highlight(null));
    row.addEventListener("click", () => filterHoldingsByType(row.dataset.key));
  });
}

function filterHoldingsByType(type) {
  const table = document.querySelector("#holdingsTable");
  if (!table) return;
  holdingsTypeFilter = type;
  ledgerExpanded = true;
  renderView();
  table.querySelectorAll("tr").forEach((row) => {
    if (row.dataset.type) row.style.display = row.dataset.type === type ? "" : "none";
  });
  const banner = document.querySelector("#holdingsFilterBanner");
  if (banner) {
    banner.classList.add("active");
    const label = banner.querySelector("#holdingsFilterLabel");
    if (label) label.textContent = `${type} 종목만 표시 중`;
  }
  document.querySelector("#holdings")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearHoldingsFilter() {
  holdingsTypeFilter = null;
  const table = document.querySelector("#holdingsTable");
  if (table) {
    table.querySelectorAll("tr").forEach((row) => {
      row.style.display = "";
    });
  }
  const banner = document.querySelector("#holdingsFilterBanner");
  if (banner) banner.classList.remove("active");
}

function overseasPriceSourceLabel() {
  if (state.overseasPriceSource === "binance-stream") return "Binance 실시간";
  if (state.overseasPriceSource === "binance") return "Binance 기준";
  if (state.overseasPriceSource === "mixed") return "Binance+CoinGecko 기준";
  if (state.overseasPriceSource === "coingecko") return "CoinGecko 기준(폴백)";
  return "시드 데이터";
}

function renderCryptoChangeChip(label, value) {
  const change = Number(value || 0);
  const tone = change >= 0 ? "positive" : "negative";
  return `<span class="crypto-change-chip ${tone}"><b>${label}</b>${change >= 0 ? "+" : ""}${pct(change)}</span>`;
}

function shouldShowCryptoChangeEffect(symbol, domesticDiff) {
  const magnitude = Math.abs(domesticDiff || 0);
  if (magnitude < CRYPTO_CHANGE_EFFECT_THRESHOLD_PP) return false;
  const now = Date.now();
  const lastAt = cryptoChangeEffectAt[symbol] || 0;
  if (now - lastAt < CRYPTO_CHANGE_EFFECT_MIN_INTERVAL_MS) return false;
  cryptoChangeEffectAt[symbol] = now;
  return true;
}

function renderMarket() {
  const list = document.querySelector("#marketList");
  const sourceLabel = overseasPriceSourceLabel();
  const ratePill = document.querySelector("#cryptoRatePill");
  if (ratePill) {
    const rate = Number(state.cryptoQuoteFx?.rate || 0);
    const source = state.cryptoQuoteFx?.source || "USDT/KRW";
    const updatedAt = state.cryptoQuoteFx?.updatedAt ? `${formatClock(state.cryptoQuoteFx.updatedAt)} 갱신` : "업데이트 대기";
    ratePill.textContent = rate ? `${source} ${fxFormatter.format(rate)} · ${updatedAt}` : `${source} 대기 중`;
  }
  const nextValues = {};
  const existingCards = list.querySelectorAll(".market-card[data-symbol]");
  const existingMap = new Map();
  existingCards.forEach((card) => existingMap.set(card.dataset.symbol, card));
  const activeSymbols = new Set();
  state.marketIndicators.forEach((item) => {
    const domesticChange = Number(item.domesticChange || 0);
    const globalChange = Number(item.globalChange || 0);
    nextValues[item.symbol] = { domestic: domesticChange, global: globalChange };
    activeSymbols.add(item.symbol);
    let row = existingMap.get(item.symbol);
    if (row) {
      const detail = row.querySelector("small");
      if (detail) detail.textContent = `국내 ${money(item.domestic)} · 해외환산 ${money(item.globalKrw)} · ${sourceLabel}`;
      const stack = row.querySelector(".crypto-change-stack");
      if (stack) stack.innerHTML = `${renderCryptoChangeChip("국내", domesticChange)}${renderCryptoChangeChip("해외", globalChange)}`;
    } else {
      row = document.createElement("div");
      row.className = "market-card";
      row.dataset.symbol = item.symbol;
      row.innerHTML = `
        <div class="market-title-row">
          ${renderCryptoLogo(item.symbol)}
          <div>${renderMetricTitle(item.symbol)}<small>국내 ${money(item.domestic)} · 해외환산 ${money(item.globalKrw)} · ${sourceLabel}</small></div>
        </div>
        <div class="crypto-change-stack">
          ${renderCryptoChangeChip("국내", domesticChange)}
          ${renderCryptoChangeChip("해외", globalChange)}
        </div>
      `;
      list.appendChild(row);
    }
    const previous = previousRealtimeValues.market[item.symbol];
    if (previous && typeof previous.domestic === "number") {
      const domesticDiff = domesticChange - previous.domestic;
      if (shouldShowCryptoChangeEffect(item.symbol, domesticDiff)) {
        markRealtimeChange(row, domesticDiff, (value) => `${value >= 0 ? "+" : ""}${pct(value)}p`);
      }
    }
  });
  existingMap.forEach((card, symbol) => {
    if (!activeSymbols.has(symbol)) {
      card.style.opacity = "0";
      card.style.transform = "scale(0.95)";
      setTimeout(() => card.remove(), 300);
    }
  });
  previousRealtimeValues.market = nextValues;
}

function renderIndexMonitor() {
  const list = document.querySelector("#indexMonitorList");
  if (!list) return;
  const connected = Boolean(proxyBaseUrl());
  const nextValues = {};
  const snapshots = INDEX_MONITOR_LIST.map((idx) => {
    const asset = state.assetCatalog[idx.ticker];
    const quote = (state.indexQuotes || {})[idx.ticker];
    const price = quote ? quote.price : (asset ? asset.currentPrice : 0);
    const hasQuote = Boolean(quote);
    const change = hasQuote ? quote.changePercent : 0;
    nextValues[idx.ticker] = change;
    const glow = change > 0 ? "positive-glow" : change < 0 ? "negative-glow" : "neutral-glow";
    const changeClass = change > 0 ? "positive" : change < 0 ? "negative" : "neutral-text";
    const status = quote ? `실시간 · ${formatClock(quote.updatedAt)}` : (connected ? "갱신 대기" : "프록시 연결 대기");
    const changeLabel = hasQuote ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%` : "—";
    const logoText = idx.logoText || idx.ticker.slice(0, 2);
    const logo = idx.logo
      ? `<i class="stock-logo-frame"><img src="${idx.logo}" alt="" loading="lazy" onerror="this.remove()" /><b>${logoText}</b></i>`
      : `<i class="stock-logo-frame stock-logo-text"><b>${logoText}</b></i>`;
    return { ...idx, price, change, glow, changeClass, status, changeLabel, logo };
  });
  const cardMarkup = (idx) => `
      <div class="market-card index-card stock-index-card ${idx.group === "M7" ? "m7-index-card" : "etf-index-card"} ${idx.glow}" data-ticker="${idx.ticker}">
        ${idx.logo}
        <div>${renderMetricTitle(idx.label)}<small>${idx.group} · ${idx.ticker} · $${numberFormatter.format(idx.price)} · ${idx.status}</small></div>
        <span class="${idx.changeClass}">${idx.changeLabel}</span>
      </div>
    `;
  const track = list.querySelector(".index-track");
  const expectedCards = INDEX_MONITOR_LIST.length * 2;
  if (!track || list.querySelectorAll(".index-card").length !== expectedCards) {
    const cards = snapshots.map(cardMarkup).join("");
    list.innerHTML = `
      <div class="index-track">
        ${cards}
        <div class="index-clone" aria-hidden="true">${cards}</div>
      </div>
    `;
  } else {
    snapshots.forEach((idx) => {
      list.querySelectorAll(`.index-card[data-ticker="${idx.ticker}"]`).forEach((card) => {
        card.classList.remove("positive-glow", "negative-glow", "neutral-glow");
        card.classList.add(idx.glow);
        const detail = card.querySelector("small");
        const value = card.querySelector(":scope > span");
        if (detail) detail.textContent = `${idx.group} · ${idx.ticker} · $${numberFormatter.format(idx.price)} · ${idx.status}`;
        if (value) {
          value.className = idx.changeClass;
          value.textContent = idx.changeLabel;
        }
      });
    });
  }
  snapshots.forEach((idx) => {
    const previous = previousRealtimeValues.index[idx.ticker];
    if (typeof previous === "number") {
      list.querySelectorAll(`.index-track > .index-card[data-ticker="${idx.ticker}"]`).forEach((card) => {
        markRealtimeChange(card, nextValues[idx.ticker] - previous, (amount) => `${amount >= 0 ? "+" : ""}${amount.toFixed(2)}%`);
      });
    }
  });
  previousRealtimeValues.index = nextValues;
}

function renderInvestorComparison() {
  const list = document.querySelector("#investorComparison");
  list.innerHTML = "";
  const total = summarize().totalValue || 1;
  const nextValues = {};
  state.investors.forEach((investor) => {
    const summary = summarize(investor.id);
    nextValues[investor.id] = summary.profit;
    const share = (summary.totalValue / total) * 100;
    const row = document.createElement("div");
    row.className = "investor-card";
    row.innerHTML = `
      <div class="avatar">${investor.initials}</div>
      <div>${renderMetricTitle(investor.name)}<small>지분 ${pct(share)} · ${summary.holdings.length}개 종목</small></div>
      <span class="${summary.profit >= 0 ? "positive" : "negative"}">${signedMoney(summary.profit)}</span>
    `;
    list.appendChild(row);
    const previous = previousRealtimeValues.investors[investor.id];
    if (typeof previous === "number") markRealtimeChange(row, summary.profit - previous);
  });
  previousRealtimeValues.investors = nextValues;
}

function renderInvestorTabs() {
  const tabs = document.querySelector("#investorTabs");
  tabs.innerHTML = "";
  state.investors.forEach((investor) => {
    const summary = summarize(investor.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `investor-chip ${investor.id === state.selectedInvestorId ? "active" : ""}`;
    button.dataset.investorId = investor.id;
    button.innerHTML = `<span class="chip-initial">${investor.initials}</span><span class="chip-name">${investor.name}</span><span class="tab-balance">${formatCompact(summary.totalValue)}</span>`;
    tabs.appendChild(button);
  });
}

function renderInvestorSheet() {
  const investor = investorById(state.selectedInvestorId);
  const summary = summarize(investor.id);
  document.querySelector("#selectedInvestorLabel").textContent = `${investor.name}님의 평가금액`;
  const editNameInput = document.querySelector("#editInvestorNameInput");
  if (editNameInput && document.activeElement !== editNameInput) editNameInput.value = investor.name;
  setMoneyElement("#investorValue", summary.totalValue);
  document.querySelector("#investorProfit").textContent = signedMoney(summary.profit);
  document.querySelector("#investorProfit").className = summary.profit >= 0 ? "positive" : "negative";
  document.querySelector("#investorReturn").textContent = `수익률 ${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`;
  document.querySelector("#investorHoldingsCount").textContent = `${summary.holdings.length}개 종목`;
  setMoneyElement("#investorPrincipal", summary.principal);
  setSignedMoneyElement("#investorStatProfit", summary.profit);
  document.querySelector("#investorStatProfit").className = summary.profit >= 0 ? "positive" : "negative";
  document.querySelector("#investorReturnRate").textContent = `${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}`;
  setMoneyElement("#investorDividendAfterTax", summary.dividendAfterTax);
  document.querySelector("#investorDividendDetail").textContent = `세전 ${money(summary.dividend)} · 세금 ${money(summary.tax)}`;
  setMoneyElement("#investorCash", summary.cash);
  document.querySelector("#deleteInvestorButton").disabled = state.investors.length <= 1;
  renderDeleteConfirm();
  renderInvestorAllocation();
  renderInvestorHoldingsPreview();
  renderUpcomingDividend();
  renderInvestorProfitBreakdown();
  renderInvestorActivityTimeline();
  populateQuickTradeTicker();
  renderCashflows();
  renderTradePreview();
}

function renderInvestorAllocation() {
  const { slices, totalValue } = getAllocationSlices(state.selectedInvestorId);
  renderDonutInto(
    "#investorAllocationDonut",
    "#investorAllocationLegend",
    {
      label: "#investorAllocationCenterLabel",
      pct: "#investorAllocationCenterPct",
      amt: "#investorAllocationCenterAmt"
    },
    slices,
    totalValue
  );
  wireAllocationInteractions(
    slices,
    totalValue,
    "#investorAllocationDonut",
    "#investorAllocationLegend",
    "#investorAllocationCenterLabel",
    "#investorAllocationCenterPct",
    "#investorAllocationCenterAmt"
  );
}

function renderInvestorHoldingsPreview() {
  const list = document.querySelector("#investorHoldingsPreview");
  if (!list) return;
  const holdings = replayHoldings(state.selectedInvestorId)
    .slice()
    .sort((a, b) => b.valueKrw - a.valueKrw);
  if (!holdings.length) {
    list.innerHTML = `<p class="empty-hint">보유 종목이 없습니다.</p>`;
    return;
  }
  const nativePrice = (currency, value) =>
    currency === "USD"
      ? `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : `${Math.round(value).toLocaleString("ko-KR")}원`;
  const krw = (value) => Math.round(value).toLocaleString("ko-KR");
  const rows = holdings
    .map((item) => {
      const cost = item.costKrw || item.valueKrw - item.profit;
      const ret = cost ? (item.profit / cost) * 100 : 0;
      const tone = item.profit >= 0 ? "up" : "down";
      const qty = Number(item.quantity).toLocaleString("en-US", { maximumFractionDigits: 8 });
      return `
        <tr>
          <td class="ih-name"><strong>${item.ticker}</strong><small>${item.type} · ${item.currency}</small></td>
          <td class="ih-num">${qty}</td>
          <td class="ih-num">${nativePrice(item.currency, item.avgPrice)}<small>→ ${nativePrice(item.currency, item.currentPrice)}</small></td>
          <td class="ih-num">${krw(item.valueKrw)}</td>
          <td class="ih-num ${tone}">${item.profit >= 0 ? "+" : "-"}${krw(Math.abs(item.profit))}<small class="${tone}">${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%</small></td>
          <td class="ih-edit"><button type="button" class="ih-edit-btn" data-edit-holding="${item.ticker}" title="거래 수정" aria-label="${item.ticker} 거래 수정">수정</button></td>
        </tr>`;
    })
    .join("");
  list.innerHTML = `
    <table class="inv-holdings-table">
      <thead>
        <tr>
          <th>종목</th>
          <th class="ih-num">수량</th>
          <th class="ih-num">평단 → 현재가</th>
          <th class="ih-num">평가금액<small>KRW</small></th>
          <th class="ih-num">손익 / 수익률</th>
          <th class="ih-edit" aria-label="수정"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderUpcomingDividend() {
  const el = document.querySelector("#investorUpcomingDividend");
  if (!el) return;
  const holdings = replayHoldings(state.selectedInvestorId).filter((item) => item.annualDividend > 0);
  const currentMonth = new Date().getMonth() + 1;
  let best = null;
  holdings.forEach((item) => {
    const months = DIVIDEND_MONTHS[item.ticker] || [];
    months.forEach((month) => {
      const diff = month >= currentMonth ? month - currentMonth : month + 12 - currentMonth;
      if (!best || diff < best.diff) {
        best = {
          ticker: item.ticker,
          diff,
          perPayment: (item.annualDividend / months.length) * (1 - DIVIDEND_TAX_RATE)
        };
      }
    });
  });
  const summary = summarize(state.selectedInvestorId);
  if (!best) {
    el.innerHTML = `<p class="empty-hint">예정된 배당이 없습니다.</p>`;
    return;
  }
  el.innerHTML = `
    <div class="investor-kpi-line"><strong>${best.ticker}</strong><span>약 D-${best.diff * 30}</span></div>
    <div class="investor-kpi-value positive">${signedMoney(best.perPayment)}</div>
    <small class="muted">연간 예상 세후 배당 ${money(summary.dividendAfterTax)}</small>
  `;
}

function renderInvestorProfitBreakdown() {
  const el = document.querySelector("#investorProfitBreakdown");
  if (!el) return;
  const holdings = replayHoldings(state.selectedInvestorId);
  const stockProfit = holdings.reduce((sum, item) => sum + (item.stockProfit || 0), 0);
  const fxProfit = holdings.reduce((sum, item) => sum + (item.fxProfit || 0), 0);
  const summary = summarize(state.selectedInvestorId);
  const rows = [
    ["주가", stockProfit],
    ["환차", fxProfit],
    ["배당", summary.dividendAfterTax]
  ];
  el.innerHTML = rows
    .map(([label, value]) => `
      <div class="breakdown-row">
        <span>${label}</span>
        <strong class="${value >= 0 ? "positive" : "negative"}">${signedMoney(value)}</strong>
      </div>
    `)
    .join("");
}

function renderInvestorActivityTimeline() {
  const list = document.querySelector("#investorActivity");
  if (!list) return;
  const items = visibleTransactions().slice(0, 8);
  if (!items.length) {
    list.innerHTML = `<p class="empty-hint">활동 내역이 없습니다.</p>`;
    return;
  }
  list.innerHTML = items
    .map((item) => {
      const isCashflow = item.kind === "cashflow";
      const label = isCashflow ? (item.type === "deposit" ? "입금" : "출금") : item.side === "buy" ? "매수" : "매도";
      const tone = isCashflow ? "cash" : item.side === "buy" ? "buy" : "sell";
      const detail = isCashflow ? (item.memo ? ` · ${item.memo}` : "") : ` · ${item.ticker}`;
      const amount = isCashflow ? item.amount : tradeAmountKrw(item);
      return `
        <div class="activity-row">
          <span><i class="activity-badge ${tone}">${label}</i>${item.date}${detail}</span>
          <strong>${money(amount)}</strong>
        </div>
      `;
    })
    .join("");
}

function quickTradeAsset() {
  const ticker = document.querySelector("#quickTradeTicker")?.value;
  return ticker ? state.assetCatalog[ticker] : null;
}

function shouldShowQuickTradeFx(asset) {
  return asset?.currency === "USD";
}

function newAssetField(selector) {
  return document.querySelector(selector);
}

function normalizeAssetSearch(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function assetLookupEntries() {
  const merged = new Map();
  ASSET_DICTIONARY.forEach((asset) => {
    merged.set(asset.ticker.toUpperCase(), { ...asset, ticker: asset.ticker.toUpperCase() });
  });
  Object.values(state.assetCatalog || {}).forEach((asset) => {
    const ticker = asset.ticker.toUpperCase();
    const known = merged.get(ticker);
    merged.set(ticker, known ? {
      ...known,
      currentPrice: asset.currentPrice,
      currentFx: asset.currentFx,
      annualDividend: asset.annualDividend
    } : { ...asset, ticker });
  });
  return [...merged.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

// 전체 미국 상장 종목(개별주+ETF) DB. 초기 로딩을 막지 않도록 지연 로딩한다.
let usSymbols = null;
let usSymbolTickerMap = null;
let usSymbolsLoading = null;

function loadUsSymbols() {
  if (usSymbols) return Promise.resolve(usSymbols);
  if (usSymbolsLoading) return usSymbolsLoading;
  usSymbolsLoading = fetch("./data/us-symbols.json")
    .then((response) => (response.ok ? response.json() : []))
    .then((rows) => {
      usSymbols = Array.isArray(rows) ? rows : [];
      usSymbolTickerMap = new Map(usSymbols.map((row) => [row[0], row]));
      return usSymbols;
    })
    .catch(() => {
      usSymbols = [];
      usSymbolTickerMap = new Map();
      return usSymbols;
    });
  return usSymbolsLoading;
}

function symbolRowToAsset(row) {
  return { ticker: row[0], name: row[1], type: row[2] === 1 ? "ETF" : "주식", currency: "USD" };
}

function usSymbolByTicker(ticker) {
  const row = usSymbolTickerMap && usSymbolTickerMap.get(String(ticker).trim().toUpperCase());
  return row ? symbolRowToAsset(row) : null;
}

function usSymbolByName(query) {
  if (!usSymbols || query.length < 2) return null;
  const exact = usSymbols.find((row) => normalizeAssetSearch(row[1]) === query);
  if (exact) return symbolRowToAsset(exact);
  if (query.length >= 3) {
    const prefix = usSymbols.find((row) => normalizeAssetSearch(row[1]).startsWith(query));
    if (prefix) return symbolRowToAsset(prefix);
  }
  return null;
}

function findAssetLookupMatch(value, mode) {
  const query = normalizeAssetSearch(value);
  if (!query) return null;
  const entries = assetLookupEntries();
  if (mode === "ticker") {
    const upper = value.trim().toUpperCase();
    return entries.find((asset) => asset.ticker === upper) || usSymbolByTicker(upper) || null;
  }
  return entries.find((asset) => normalizeAssetSearch(asset.name) === query)
    || (query.length >= 3 ? entries.find((asset) => normalizeAssetSearch(asset.name).startsWith(query)) : null)
    || usSymbolByName(query)
    || null;
}

function applyNewAssetLookup(asset, sourceField) {
  if (!asset) return;
  const tickerInput = newAssetField("#newAssetTicker");
  const nameInput = newAssetField("#newAssetName");
  const typeInput = newAssetField("#newAssetType");
  const currencyInput = newAssetField("#newAssetCurrency");
  const priceInput = newAssetField("#newAssetPrice");
  const fxInput = newAssetField("#newAssetFx");

  if (tickerInput) tickerInput.value = asset.ticker;
  if (nameInput) nameInput.value = asset.name;
  if (typeInput && asset.type) typeInput.value = asset.type;
  if (currencyInput && asset.currency) currencyInput.value = asset.currency;
  if (priceInput && !priceInput.value && asset.currentPrice) priceInput.value = asset.currentPrice;
  if (fxInput && !fxInput.value && asset.currency === "USD") fxInput.value = Math.round(asset.currentFx || currentUsdKrw());
  updateNewAssetFxVisibility();
  updateNewAssetSubmitState();
}

function isNewAssetFormValid() {
  const ticker = newAssetField("#newAssetTicker")?.value.trim();
  const name = newAssetField("#newAssetName")?.value.trim();
  const currency = newAssetField("#newAssetCurrency")?.value;
  const quantity = Number(newAssetField("#newAssetQty")?.value);
  const price = Number(newAssetField("#newAssetPrice")?.value);
  const fx = Number(newAssetField("#newAssetFx")?.value);
  if (!ticker || !name || !quantity || quantity <= 0 || !price || price <= 0) return false;
  if (currency === "USD" && (!fx || fx <= 0)) return false;
  return true;
}

function updateNewAssetSubmitState() {
  const button = newAssetField("#newAssetSubmit");
  if (!button) return;
  button.classList.toggle("enabled", isNewAssetFormValid());
}

function updateNewAssetFxVisibility() {
  const currency = newAssetField("#newAssetCurrency")?.value;
  const fxWrap = newAssetField("#newAssetFxWrap");
  const fxInput = newAssetField("#newAssetFx");
  if (fxWrap) fxWrap.style.display = currency === "USD" ? "" : "none";
  if (currency === "KRW" && fxInput) fxInput.value = 1;
  if (currency === "USD" && fxInput && !fxInput.value) fxInput.value = Math.round(currentUsdKrw());
  updateNewAssetSubmitState();
}

function resetNewAssetForm() {
  ["#newAssetTicker", "#newAssetName", "#newAssetQty", "#newAssetPrice", "#newAssetFx"].forEach((selector) => {
    const field = newAssetField(selector);
    if (field) field.value = "";
  });
  updateNewAssetFxVisibility();
}

function setupNewAssetForm() {
  const submit = newAssetField("#newAssetSubmit");
  if (!submit) return;
  ["#newAssetTicker", "#newAssetName"].forEach((selector) => {
    newAssetField(selector)?.addEventListener("focus", loadUsSymbols, { once: true });
  });
  newAssetField("#newAssetTicker")?.addEventListener("input", (event) => {
    const match = findAssetLookupMatch(event.target.value, "ticker");
    if (match) applyNewAssetLookup(match, "ticker");
    updateNewAssetSubmitState();
  });
  newAssetField("#newAssetTicker")?.addEventListener("change", (event) => {
    applyNewAssetLookup(findAssetLookupMatch(event.target.value, "ticker"), "ticker");
  });
  newAssetField("#newAssetName")?.addEventListener("input", (event) => {
    const match = findAssetLookupMatch(event.target.value, "name");
    if (match) applyNewAssetLookup(match, "name");
    updateNewAssetSubmitState();
  });
  newAssetField("#newAssetName")?.addEventListener("change", (event) => {
    applyNewAssetLookup(findAssetLookupMatch(event.target.value, "name"), "name");
  });
  ["#newAssetTicker", "#newAssetName", "#newAssetQty", "#newAssetPrice", "#newAssetFx"].forEach((selector) => {
    newAssetField(selector)?.addEventListener("input", updateNewAssetSubmitState);
  });
  newAssetField("#newAssetCurrency")?.addEventListener("change", updateNewAssetFxVisibility);
  newAssetField("#newAssetType")?.addEventListener("change", () => {
    // 코인은 빗썸(원화) 거래가 기본 — 통화를 KRW로 맞춰준다.
    const currencyField = newAssetField("#newAssetCurrency");
    if (newAssetField("#newAssetType")?.value === "코인" && currencyField) {
      currencyField.value = "KRW";
      updateNewAssetFxVisibility();
    }
    updateNewAssetSubmitState();
  });
  submit.addEventListener("click", () => {
    if (!isNewAssetFormValid()) {
      showToast("필수 항목을 모두 입력하세요.", "error");
      return;
    }
    const ticker = newAssetField("#newAssetTicker").value.trim().toUpperCase();
    const name = newAssetField("#newAssetName").value.trim();
    const type = newAssetField("#newAssetType").value;
    const currency = newAssetField("#newAssetCurrency").value;
    const quantity = Number(newAssetField("#newAssetQty").value);
    const price = Number(newAssetField("#newAssetPrice").value);
    const fx = currency === "USD" ? Number(newAssetField("#newAssetFx").value) : 1;
    const currentFx = currency === "USD" ? fx : 1;
    const registerHeld = newAssetField("#newAssetRegisterHeld")?.checked === true;

    const hadAsset = Boolean(state.assetCatalog[ticker]);
    if (!hadAsset) {
      state.assetCatalog[ticker] = {
        ticker,
        name,
        type,
        currency,
        currentPrice: price,
        currentFx,
        annualDividend: 0
      };
    }

    const result = commitTrade({
      ownerId: state.selectedInvestorId,
      side: "buy",
      ticker,
      name,
      type,
      currency,
      quantity,
      price,
      fx,
      currentPrice: price,
      currentFx,
      registerHeld,
      date: new Date().toISOString().slice(0, 10),
      memo: registerHeld ? "보유 종목 등록" : "신규 자산 등록"
    });
    if (!result.ok) {
      if (!hadAsset) delete state.assetCatalog[ticker];
      showToast(result.message, "error");
      return;
    }
    resetNewAssetForm();
    showToast(registerHeld ? `${ticker} 보유분을 등록했습니다 (예수금 유지).` : `${ticker} 신규 등록 및 매수가 반영되었습니다.`);
  });
  updateNewAssetFxVisibility();
}

function populateQuickTradeTicker() {
  const select = document.querySelector("#quickTradeTicker");
  if (!select) return;
  const current = select.value;
  const holdings = replayHoldings(state.selectedInvestorId);
  select.innerHTML = holdings.length
    ? holdings.map((item) => `<option value="${item.ticker}">${item.ticker} · ${item.name || item.ticker}</option>`).join("")
    : `<option value="">보유 종목 없음</option>`;
  if (holdings.some((item) => item.ticker === current)) select.value = current;
  updateQuickTradeDefaults();
}

function updateQuickTradeDefaults() {
  const asset = quickTradeAsset();
  const fxRow = document.querySelector("#quickTradeFxRow");
  const fxInput = document.querySelector("#quickTradeFx");
  const fxLabel = document.querySelector("#quickTradeFxLabel");
  const priceInput = document.querySelector("#quickTradePrice");
  const submit = document.querySelector("#quickTradeSubmit");
  if (!fxInput || !priceInput) return;
  if (fxLabel) fxLabel.textContent = quickTradeSide === "buy" ? "매입환율" : "매도환율";
  if (!asset) {
    if (fxRow) fxRow.style.display = "none";
    if (submit) submit.disabled = true;
    renderQuickTradePreview();
    return;
  }
  if (submit) submit.disabled = false;
  if (fxRow) fxRow.style.display = shouldShowQuickTradeFx(asset) ? "" : "none";
  if (!fxInput.value) fxInput.value = asset.currency === "KRW" ? 1 : Math.round(asset.currentFx || currentUsdKrw());
  if (!priceInput.value) priceInput.value = asset.currentPrice || "";
  renderQuickTradePreview();
}

function renderQuickTradePreview() {
  const preview = document.querySelector("#quickTradePreview");
  if (!preview) return;
  const ticker = document.querySelector("#quickTradeTicker")?.value;
  const asset = quickTradeAsset();
  const quantity = Number(document.querySelector("#quickTradeQty")?.value) || 0;
  const price = Number(document.querySelector("#quickTradePrice")?.value) || 0;
  if (!ticker || !asset || !quantity || !price) {
    preview.hidden = true;
    return;
  }
  const fxInput = Number(document.querySelector("#quickTradeFx")?.value) || 0;
  const fx = asset.currency === "KRW" ? 1 : shouldShowQuickTradeFx(asset) ? fxInput || asset.currentFx || currentUsdKrw() : currentUsdKrw();
  const result = computeAveragingPreview({
    ownerId: state.selectedInvestorId,
    side: quickTradeSide,
    ticker,
    quantity,
    price,
    fx,
    currency: asset.currency,
    currentFx: asset.currency === "KRW" ? 1 : asset.currentFx || fx,
    currentPrice: asset.currentPrice || price
  });
  preview.hidden = false;
  if (quickTradeSide === "sell") {
    preview.innerHTML = `<strong>매도 미리보기</strong><span>${result.text}</span>`;
    return;
  }
  preview.innerHTML = `
    <strong>물타기 미리보기</strong>
    <span>평단 ${money((result.beforeAvgPrice || 0) * (result.beforeAvgFx || fx))} → ${money((result.afterAvgPrice || 0) * (result.afterAvgFx || fx))}</span>
    <span>평균환율 ${qty(result.beforeAvgFx || fx)} → ${qty(result.afterAvgFx || fx)}</span>
  `;
}

function setQuickTradeSide(side) {
  quickTradeSide = side;
  const buyBtn = document.querySelector("#quickTradeBuy");
  const sellBtn = document.querySelector("#quickTradeSell");
  buyBtn.classList.toggle("active", side === "buy");
  buyBtn.classList.toggle("buy", side === "buy");
  sellBtn.classList.toggle("active", side === "sell");
  sellBtn.classList.toggle("sell", side === "sell");
  document.querySelector("#quickTradeSubmit").textContent = side === "buy" ? "매수 추가" : "매도 추가";
  const fxLabel = document.querySelector("#quickTradeFxLabel");
  if (fxLabel) fxLabel.textContent = side === "buy" ? "매입환율" : "매도환율";
  renderQuickTradePreview();
}

function resetQuickTradeInputs() {
  document.querySelector("#quickTradeQty").value = "";
  document.querySelector("#quickTradePrice").value = "";
  document.querySelector("#quickTradeFx").value = "";
  document.querySelector("#quickTradePreview").hidden = true;
  updateQuickTradeDefaults();
}

function setupQuickTrade() {
  document.querySelector("#quickTradeBuy").addEventListener("click", () => setQuickTradeSide("buy"));
  document.querySelector("#quickTradeSell").addEventListener("click", () => setQuickTradeSide("sell"));
  document.querySelector("#quickTradeTicker").addEventListener("change", updateQuickTradeDefaults);
  ["#quickTradeQty", "#quickTradePrice", "#quickTradeFx"].forEach((selector) => {
    document.querySelector(selector).addEventListener("input", renderQuickTradePreview);
  });
  document.querySelector("#quickTradeSubmit").addEventListener("click", () => {
    const ticker = document.querySelector("#quickTradeTicker").value;
    const asset = quickTradeAsset();
    const quantity = Number(document.querySelector("#quickTradeQty").value) || 0;
    const price = Number(document.querySelector("#quickTradePrice").value) || 0;
    if (!ticker || !asset || !quantity || !price) {
      showToast("보유 종목, 수량, 체결가를 입력하세요.", "error");
      return;
    }
    const fxInput = Number(document.querySelector("#quickTradeFx").value) || 0;
    const fx = asset.currency === "KRW" ? 1 : shouldShowQuickTradeFx(asset) ? fxInput || asset.currentFx || currentUsdKrw() : currentUsdKrw();
    const result = commitTrade({
      ownerId: state.selectedInvestorId,
      side: quickTradeSide,
      ticker,
      name: asset.name,
      type: asset.type,
      currency: asset.currency,
      quantity,
      price,
      fx,
      currentPrice: asset.currentPrice || price,
      currentFx: asset.currency === "KRW" ? 1 : asset.currentFx || fx,
      date: new Date().toISOString().slice(0, 10),
      memo: "빠른 입력"
    });
    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }
    resetQuickTradeInputs();
    showToast(`${ticker} ${quickTradeSide === "buy" ? "매수" : "매도"} 거래를 추가했습니다.`);
  });
  document.querySelector("#openTradeModalLink").addEventListener("click", (event) => {
    event.preventDefault();
    const form = document.querySelector("#tradeForm");
    form.reset();
    setTradeDialogMode("add");
    populateOwnerSelects();
    form.elements.ownerId.value = state.selectedInvestorId;
    form.elements.date.valueAsDate = new Date();
    form.elements.fx.value = currentUsdKrw();
    form.elements.currentFx.value = currentUsdKrw();
    renderTradePreview();
    openDialog(document.querySelector("#tradeDialog"));
  });
}

function renderHoldings() {
  const body = document.querySelector("#holdingsTable");
  body.innerHTML = "";
  for (const item of replayHoldings(visibleOwnerId())) {
    const owner = investorById(item.ownerId);
    const row = document.createElement("tr");
    row.dataset.type = item.type;
    if (holdingsTypeFilter && item.type !== holdingsTypeFilter) row.style.display = "none";
    row.innerHTML = `
      <td><span class="asset-name"><strong>${item.ticker}</strong><small>${item.name}</small></span></td>
      <td><span class="owner-label">${owner.name}</span></td>
      <td><span class="pill">${item.type}</span></td>
      <td>${qty(item.quantity)}</td>
      <td>${money(item.avgPrice * item.avgFx)}<small class="subtext">${item.currency} ${numberFormatter.format(item.avgPrice)} · FX ${fxFormatter.format(item.avgFx)}</small></td>
      <td>${money(item.currentPrice * item.currentFx)}<small class="subtext">${item.currency} ${numberFormatter.format(item.currentPrice)} · FX ${fxFormatter.format(item.currentFx)}</small></td>
      <td>${money(item.valueKrw)}</td>
      <td class="${item.profit >= 0 ? "positive" : "negative"}">${signedMoney(item.profit)}<small class="subtext">주가 ${signedMoney(item.stockProfit)} · 환 ${signedMoney(item.fxProfit)}</small></td>
    `;
    body.appendChild(row);
  }
}

function renderHoldingsPreview() {
  const list = document.querySelector("#holdingsPreview");
  if (!list) return;
  const top = replayHoldings(visibleOwnerId()).slice().sort((a, b) => b.valueKrw - a.valueKrw).slice(0, 3);
  if (!top.length) {
    list.innerHTML = `<p class="empty-hint">보유 종목이 없습니다.</p>`;
    return;
  }
  list.innerHTML = top.map((item) => {
    const owner = investorById(item.ownerId);
    return `
      <div class="market-card">
        <div><strong>${item.ticker}</strong><small>${owner.name} · ${money(item.valueKrw)}</small></div>
        <span class="${item.profit >= 0 ? "positive" : "negative"}">${signedMoney(item.profit)}</span>
      </div>
    `;
  }).join("");
}

function visibleTransactions() {
  const ownerId = visibleOwnerId();
  return [
    ...state.cashflows.map((flow) => ({ ...flow, kind: "cashflow" })),
    ...state.trades.map((trade) => ({ ...trade, kind: "trade" }))
  ]
    .filter((item) => !ownerId || item.ownerId === ownerId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderTransactions() {
  const body = document.querySelector("#transactionsTable");
  body.innerHTML = "";
  visibleTransactions().forEach((item) => {
    const owner = investorById(item.ownerId);
    const isCashflow = item.kind === "cashflow";
    const label = isCashflow ? (item.type === "deposit" ? "입금" : "출금") : (item.side === "buy" ? "매수" : "매도");
    const asset = isCashflow ? "예수금" : item.ticker;
    const amount = isCashflow ? item.amount : tradeAmountKrw(item);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${owner.name}</td>
      <td><span class="pill">${label}</span></td>
      <td>${asset}</td>
      <td>${money(amount)}</td>
    `;
    body.appendChild(row);
  });
}

function renderLedgerPreview() {
  const list = document.querySelector("#ledgerPreview");
  if (!list) return;
  const top = visibleTransactions().slice(0, 3);
  if (!top.length) {
    list.innerHTML = `<p class="empty-hint">거래 내역이 없습니다.</p>`;
    return;
  }
  list.innerHTML = top.map((item) => {
    const owner = investorById(item.ownerId);
    const isCashflow = item.kind === "cashflow";
    const label = isCashflow ? (item.type === "deposit" ? "입금" : "출금") : (item.side === "buy" ? "매수" : "매도");
    const asset = isCashflow ? "예수금" : item.ticker;
    const amount = isCashflow ? item.amount : tradeAmountKrw(item);
    return `
      <div class="market-card">
        <div><strong>${item.date}</strong><small>${owner.name} · ${label} · ${asset}</small></div>
        <span>${money(amount)}</span>
      </div>
    `;
  }).join("");
}

function renderCashflows() {
  const list = document.querySelector("#cashflowList");
  list.innerHTML = "";
  state.cashflows
    .filter((flow) => flow.ownerId === state.selectedInvestorId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .forEach((flow) => {
      const row = document.createElement("div");
      row.className = "cashflow-row";
      const colorClass = flow.type === "withdraw" ? "negative" : "";
      row.innerHTML = `
        <span>${flow.date}</span>
        <strong class="${colorClass}">${flow.type === "deposit" ? "입금" : "출금"} ${money(flow.amount)}</strong>
      `;
      list.appendChild(row);
    });
}

function totalValueHistory() {
  const snapshots = (state.snapshots || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!snapshots.length) {
    return [{ date: new Date().toISOString().slice(0, 10), totalValue: summarize().totalValue }];
  }
  return snapshots;
}

function chartPoints(history, width, height, pad) {
  const values = history.map((item) => item.totalValue);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const center = (rawMin + rawMax) / 2;
  const rawSpan = Math.max(rawMax - rawMin, 1);
  const minVisualSpan = Math.max(center * 0.01, rawSpan * 5, 1);
  const span = Math.max(rawSpan * 1.4, minVisualSpan);
  const min = center - span / 2;
  return history.map((item, index) => {
    const x = pad + (index / Math.max(history.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((item.totalValue - min) / span) * (height - pad * 2);
    return { x, y, item };
  });
}

function renderHeroSparkline() {
  const plot = document.querySelector("#heroSparklinePlot");
  const history = totalValueHistory();
  if (!plot) return;
  const width = 360;
  const height = 120;
  const pad = 12;
  const summary = summarize();
  const summaryClass = summary.profit >= 0 ? "positive-spark" : "negative-spark";
  const summaryBadge = `
    <g class="spark-summary ${summaryClass}" transform="translate(90 34)">
      <rect x="-76" y="-24" width="152" height="48" rx="12"></rect>
      <text class="spark-summary-rate" x="0" y="-5" text-anchor="middle">${summary.returnRate >= 0 ? "+" : ""}${pct(summary.returnRate)}</text>
      <text class="spark-summary-profit" x="0" y="15" text-anchor="middle">${signedMoney(summary.profit)} · ${signedUsd(summary.profit / currentUsdKrw())}</text>
    </g>
  `;
  const wavePaths = `
    <path class="spark-wave spark-wave-one" d="M${pad} 91 C46 76, 72 100, 104 86 S164 77, 201 91 S262 102, 303 84 S335 78, ${width - pad} 91"></path>
    <path class="spark-wave spark-wave-two" d="M${pad} 101 C38 111, 76 88, 119 99 S177 115, 219 95 S285 82, 319 99 S342 108, ${width - pad} 97"></path>
  `;
  if (history.length < 2) {
    plot.innerHTML = `
      <path d="M${pad} 78 L${width - pad} 78" fill="none" stroke="url(#spark)" stroke-width="4" stroke-linecap="round" opacity=".7" />
      ${wavePaths}
      <circle class="spark-last-dot" cx="${width - pad}" cy="78" r="7"></circle>
      ${summaryBadge}
    `;
    return;
  }
  const points = chartPoints(history, width, height, pad);
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const baseline = height - pad;
  const area = `${points[0].x},${baseline} ${line} ${points.at(-1).x},${baseline}`;
  const lastPoint = points.at(-1);
  plot.innerHTML = `
    <polygon class="spark-area" points="${area}" fill="url(#sparkFill)"></polygon>
    ${wavePaths}
    <polyline points="${line}" fill="none" stroke="url(#spark)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    <circle class="spark-last-halo" cx="${lastPoint.x}" cy="${lastPoint.y}" r="11"></circle>
    <circle class="spark-last-dot" cx="${lastPoint.x}" cy="${lastPoint.y}" r="7"></circle>
    ${summaryBadge}
  `;
}

function renderTrend() {
  const area = document.querySelector("#trendArea");
  const snapshots = totalValueHistory();
  if (snapshots.length < 2) {
    area.innerHTML = `<div class="empty-state compact-empty">데이터가 쌓이면 추이가 표시됩니다.</div>`;
    document.querySelector("#trendHint").textContent = "";
    renderHeroSparkline();
    return;
  }
  const width = 760;
  const compact = snapshots.length < 7;
  const height = compact ? 110 : 220;
  const pad = 18;
  const values = snapshots.map((item) => item.totalValue);
  const max = Math.max(...values);
  const points = chartPoints(snapshots, width, height, pad);
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  document.querySelector("#trendHint").textContent = compact ? `최근 ${snapshots.length}일 데이터 · 더 쌓이면 정확한 추이가 표시됩니다` : "";
  area.innerHTML = `
    <svg class="trend-svg ${compact ? "compact-trend" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="총자산 추이">
      <polyline points="${pointString}" fill="none" stroke="#9d7bff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#f3f3f7"></circle>`).join("")}
      <text x="${pad}" y="${height - 2}" fill="#8e8e9c" font-size="12">${snapshots[0].date}</text>
      <text x="${width - pad}" y="${height - 2}" fill="#8e8e9c" font-size="12" text-anchor="end">${snapshots.at(-1).date}</text>
      <text x="${pad}" y="14" fill="#8e8e9c" font-size="12">${money(max)}</text>
    </svg>
  `;
  renderHeroSparkline();
}

function renderFx() {
  document.querySelector("#fxRateLabel").textContent = fxFormatter.format(currentUsdKrw());
  const source = state.fx.source === "hana" ? "하나은행 기준"
    : state.fx.source === "frankfurter" ? "환율 API 기준 (Frankfurter)"
    : state.fx.source === "exchangerate-api" ? "환율 API 기준 (폴백)"
    : state.fx.source === "fallback" ? "환율 API 기준 (폴백)"
    : "수동 기준";
  document.querySelector("#fxSourceLabel").textContent = `${source} · ${state.fx.updatedAt ? `${formatClock(state.fx.updatedAt)} 갱신` : "업데이트 대기"}`;
  document.querySelector("#manualFxToggle").checked = state.fx.mode === "manual";
  document.querySelector("#manualFxInput").value = state.fx.manualUsdkrw || currentUsdKrw();
  document.querySelector("#manualFxInput").disabled = state.fx.mode !== "manual";
  const usdtRate = Number(state.cryptoQuoteFx?.rate || 0);
  document.querySelector("#usdtKrwLabel").textContent = usdtRate ? fxFormatter.format(usdtRate) : "대기 중";
  document.querySelector("#usdtKrwSourceLabel").textContent = state.cryptoQuoteFx?.updatedAt ? `${formatClock(state.cryptoQuoteFx.updatedAt)} 갱신` : "업데이트 대기";
}

function renderMarketStatus() {
  const label = document.querySelector("#marketStatus");
  if (state.market.error) {
    label.textContent = `시세 갱신 실패 · ${formatMinutesAgo(state.market.lastSuccessAt)}`;
    label.classList.add("negative");
  } else {
    label.textContent = `마지막 갱신: ${formatClock(state.market.lastUpdatedAt)}`;
    label.classList.remove("negative");
  }
}

function populateOwnerSelects() {
  for (const id of ["cashflowOwnerSelect", "tradeOwnerSelect"]) {
    const select = document.querySelector(`#${id}`);
    select.innerHTML = "";
    state.investors.forEach((investor) => {
      const option = document.createElement("option");
      option.value = investor.id;
      option.textContent = investor.name;
      select.appendChild(option);
    });
    select.value = state.selectedInvestorId;
  }

  const calendarSelect = document.querySelector("#calendarTargetSelect");
  for (const select of [calendarSelect]) {
    const current = select.value;
    select.innerHTML = `<option value="">통합</option>`;
    state.investors.forEach((investor) => {
      const option = document.createElement("option");
      option.value = investor.id;
      option.textContent = investor.name;
      select.appendChild(option);
    });
    select.value = current;
  }
}

function updateAssetFieldsFromTicker(ticker) {
  const upper = ticker.trim().toUpperCase();
  const asset = state.assetCatalog[upper] || usSymbolByTicker(upper);
  if (!asset) return;
  const form = document.querySelector("#tradeForm");
  form.elements.name.value = asset.name;
  form.elements.type.value = asset.type;
  if (asset.currency) form.elements.currency.value = asset.currency;
  if (asset.currentPrice != null) form.elements.currentPrice.value = asset.currentPrice;
  if (asset.currentFx != null) form.elements.currentFx.value = asset.currentFx;
}

function tradePreviewData() {
  const form = document.querySelector("#tradeForm");
  const ownerId = form.elements.ownerId.value;
  const side = form.elements.side.value;
  const ticker = form.elements.ticker.value.trim().toUpperCase();
  const quantity = Number(form.elements.quantity.value) || 0;
  const price = Number(form.elements.price.value) || 0;
  const fx = Number(form.elements.fx.value) || 1;
  const asset = getAsset(ticker, { price, fx, currency: form.elements.currency.value });
  const currentFx = asset.currency === "KRW" ? 1 : Number(form.elements.currentFx.value || asset.currentFx || fx);
  const currentPrice = Number(form.elements.currentPrice.value || asset.currentPrice || price);
  return computeAveragingPreview({
    ownerId,
    side,
    ticker,
    quantity,
    price,
    fx,
    currency: form.elements.currency.value,
    currentFx,
    currentPrice
  });
}

function renderTradePreview() {
  const preview = document.querySelector("#tradePreview");
  if (!preview) return;
  preview.textContent = tradePreviewData().text;
}

function canWithdraw(ownerId, amount) {
  return cashBalance(ownerId) >= amount;
}

function dividendScenario() {
  const form = document.querySelector("#dividendSimForm");
  const ticker = form.elements.ticker.value.trim().toUpperCase() || "CUSTOM";
  const quantity = Number(form.elements.quantity.value) || 0;
  const price = Number(form.elements.price.value) || 0;
  const currency = form.elements.currency.value;
  const fx = currency === "KRW" ? 1 : Number(form.elements.fx.value) || currentUsdKrw();
  const annualYield = (Number(form.elements.yield.value) || 0) / 100;
  const frequency = Number(form.elements.frequency.value) || 12;
  const years = Math.min(30, Math.max(1, Number(form.elements.years.value) || 10));
  const growthRate = (Number(form.elements.growth.value) || 0) / 100;
  const drip = form.elements.drip.checked;
  const priceKrw = price * fx;
  const principal = quantity * priceKrw;
  const annualBeforeTax = principal * annualYield;
  const annualBeforeTaxNative = quantity * price * annualYield;

  return {
    ticker,
    quantity,
    price,
    currency,
    fx,
    annualYield,
    frequency,
    years,
    growthRate,
    drip,
    priceKrw,
    principal,
    annualBeforeTax,
    annualBeforeTaxNative
  };
}

function dividendRows(scenario) {
  let quantity = scenario.quantity;
  const rows = [];
  let cumulativeAfterTax = 0;
  for (let year = 1; year <= scenario.years; year += 1) {
    const valueKrw = quantity * scenario.priceKrw;
    const beforeTax = valueKrw * scenario.annualYield * Math.pow(1 + scenario.growthRate, year - 1);
    const afterTax = beforeTax * (1 - DIVIDEND_TAX_RATE);
    const addedQuantity = scenario.drip && scenario.priceKrw > 0 ? afterTax / scenario.priceKrw : 0;
    if (scenario.drip) {
      quantity += addedQuantity;
    }
    cumulativeAfterTax += afterTax;
    rows.push({ year, valueKrw, beforeTax, afterTax, cumulativeAfterTax, addedQuantity, endingQuantity: quantity });
  }
  return rows;
}

function renderDividendSimulation() {
  const form = document.querySelector("#dividendSimForm");
  if (!form) return;
  if (!form.elements.fx.dataset.touched) {
    form.elements.fx.value = fxFormatter.format(currentUsdKrw()).replace(/,/g, "");
  }
  const scenario = dividendScenario();
  const rows = dividendRows(scenario);
  const first = rows[0] || { beforeTax: 0, afterTax: 0, cumulativeAfterTax: 0, addedQuantity: 0, endingQuantity: scenario.quantity };
  const last = rows.at(-1) || first;
  const periodAfterTax = first.afterTax / scenario.frequency;
  const totalReturnOnCost = scenario.principal ? (last.cumulativeAfterTax / scenario.principal) * 100 : 0;
  const monthlyAfterTax = first.afterTax / 12;
  const nativePrefix = scenario.currency === "USD" ? "$" : "KRW ";
  const basisText = `${qty(scenario.quantity)}주 × ${nativePrefix}${numberFormatter.format(scenario.price)} × ${numberFormatter.format(scenario.fx)}`;
  const afterTaxYield = scenario.annualYield * (1 - DIVIDEND_TAX_RATE) * 100;
  const growthText = `성장률 ${pct(scenario.growthRate * 100)} 가정`;

  document.querySelector("#dividendSummaryCards").innerHTML = `
    <div class="sim-result-main">
      <div>
        <p class="eyebrow">예상 연 배당 · 세후</p>
        <strong>${money(first.afterTax)}</strong>
      </div>
      <span>월 평균 <b>${money(monthlyAfterTax)}</b></span>
      <span>세전 <b>${nativePrefix}${numberFormatter.format(scenario.annualBeforeTaxNative)}</b> (${money(first.beforeTax)})</span>
    </div>
    <div class="sim-result-sub">
      <div>
        <p class="eyebrow">현재 투자원금</p>
        <strong>${money(scenario.principal)}</strong>
        <small>${basisText}</small>
      </div>
      <div>
        <p class="eyebrow">현재 배당수익률</p>
        <strong class="positive">${pct(scenario.annualYield * 100)}</strong>
        <small>세후 환산 ${pct(afterTaxYield)}</small>
      </div>
      <div>
        <p class="eyebrow">${scenario.years}년 누적 · 세후</p>
        <strong>${money(last.cumulativeAfterTax)}</strong>
        <small>${growthText}</small>
      </div>
    </div>
  `;

  renderTargetDividend(scenario);

  const max = Math.max(...rows.map((row) => row.afterTax), 1);
  const width = 760;
  const height = 240;
  const barWidth = Math.max(8, (width - 48) / rows.length - 6);
  document.querySelector("#dividendChartTitle").textContent = `연도별 예상 배당 · 세후 (DRIP ${scenario.drip ? "on" : "off"} 적용)`;
  document.querySelector("#dividendChart").innerHTML = `
    <svg class="dividend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="배당 시뮬레이션">
      ${rows.map((row, index) => {
        const x = 24 + index * ((width - 48) / rows.length);
        const barHeight = (row.afterTax / max) * (height - 44);
        const y = height - 24 - barHeight;
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5" fill="#7c5cfc"></rect>
          <text x="${x + barWidth / 2}" y="${height - 5}" fill="#8e8e9c" font-size="11" text-anchor="middle">${row.year}년</text>
        `;
      }).join("")}
      <text x="24" y="14" fill="#8e8e9c" font-size="12">${money(max)}</text>
    </svg>
  `;

  document.querySelector("#dividendDetailTableWrap").classList.toggle("hidden", !dividendDetailOpen);
  document.querySelector("#toggleDividendDetail").textContent = dividendDetailOpen ? "표 숨기기" : "표로 보기";
  document.querySelector("#dividendTable").innerHTML = rows.map((row) => `
    <tr>
      <td>${row.year}년차</td>
      <td>${money(row.valueKrw)}</td>
      <td>${money(row.beforeTax)}</td>
      <td>${money(row.afterTax)}</td>
      <td>${money(row.cumulativeAfterTax)}</td>
      <td>${qty(row.addedQuantity)}</td>
    </tr>
  `).join("");
}

function renderTargetDividend(scenario) {
  const targetInput = document.querySelector("#targetMonthlyDividend");
  const target = Number(targetInput.value) || 0;
  const effectiveYield = scenario.annualYield * (1 - DIVIDEND_TAX_RATE);
  const results = document.querySelector("#targetDividendResults");
  if (!effectiveYield || scenario.priceKrw <= 0) {
    results.innerHTML = `<div class="target-message">배당수익률과 현재가를 입력하면 계산됩니다.</div>`;
    return;
  }
  const requiredAnnualAfterTax = target * 12;
  const requiredPrincipal = requiredAnnualAfterTax / effectiveYield;
  const requiredQuantity = requiredPrincipal / scenario.priceKrw;
  const additionalQuantity = requiredQuantity - scenario.quantity;
  const basis = `현재 종목 단가(${scenario.currency === "USD" ? "$" : "KRW "}${numberFormatter.format(scenario.price)})·환율(${numberFormatter.format(scenario.fx)})·배당수익률(${pct(scenario.annualYield * 100)}) 기준`;
  const message = additionalQuantity > 0
    ? `현재 보유수량 대비 추가 매수 ${qty(additionalQuantity)}주 필요`
    : "이미 목표 초과 달성";
  results.innerHTML = `
    <div class="target-result-card">
      <span>필요 투자금액</span>
      <strong>${money(requiredPrincipal)}</strong>
    </div>
    <div class="target-result-card">
      <span>필요 보유수량</span>
      <strong>${qty(requiredQuantity)}주</strong>
    </div>
    <div class="target-message">${basis} · ${message}</div>
  `;
}

function renderDividendCalendar() {
  const ownerId = document.querySelector("#calendarTargetSelect").value || null;
  const holdings = replayHoldings(ownerId).filter((holding) => holding.annualDividend > 0);
  const grid = document.querySelector("#dividendCalendar");
  const summaryEl = document.querySelector("#calendarSummary");
  grid.innerHTML = "";

  const now = new Date();
  const kstParts = getKstNowParts(now);
  const currentMonth = Number(kstParts.dateKey.split("-")[1]);

  const monthlyTotals = new Array(12).fill(0);
  const monthlyItems = Array.from({ length: 12 }, () => []);

  holdings.forEach((holding) => {
    const months = DIVIDEND_MONTHS[holding.ticker] || [3, 6, 9, 12];
    const perPayout = (holding.annualDividend / months.length) * (1 - DIVIDEND_TAX_RATE);
    months.forEach((m) => {
      monthlyTotals[m - 1] += perPayout;
      monthlyItems[m - 1].push({ ticker: holding.ticker, amount: perPayout });
    });
  });

  const annualTotal = monthlyTotals.reduce((s, v) => s + v, 0);
  const monthlyAvg = annualTotal / 12;
  const maxMonthly = Math.max(...monthlyTotals, 1);
  const activeMonths = monthlyTotals.filter((v) => v > 0).length;

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="cal-summary-card cal-summary-total">
        <span>연간 예상 배당 (세후)</span>
        <strong>${money(annualTotal)}</strong>
      </div>
      <div class="cal-summary-card">
        <span>월 평균</span>
        <strong>${money(monthlyAvg)}</strong>
      </div>
      <div class="cal-summary-card">
        <span>배당 수령 월</span>
        <strong>${activeMonths}개월 / 12개월</strong>
      </div>
      <div class="cal-summary-card">
        <span>배당 종목 수</span>
        <strong>${holdings.length}종목</strong>
      </div>
    `;
  }

  monthNames.forEach((monthName, monthIndex) => {
    const month = monthIndex + 1;
    const total = monthlyTotals[monthIndex];
    const items = monthlyItems[monthIndex];
    const isCurrent = month === currentMonth;
    const barWidth = maxMonthly > 0 ? (total / maxMonthly) * 100 : 0;

    const itemsHtml = items.length > 0
      ? items.map((item) => {
          const ratio = total > 0 ? ((item.amount / total) * 100).toFixed(1) : 0;
          const freq = dividendFrequencyLabel(item.ticker);
          return `<div class="calendar-item">
            <div class="cal-item-info"><strong>${item.ticker}</strong><span class="cal-item-freq">${freq}</span><span class="cal-item-ratio">${ratio}%</span></div>
            <span class="cal-item-amount">${money(item.amount)}</span>
          </div>`;
        }).join("")
      : `<div class="cal-empty"><span>배당 없음</span></div>`;

    const card = document.createElement("article");
    card.className = `month-card${isCurrent ? " month-current" : ""}${total === 0 ? " month-empty" : ""}`;
    card.innerHTML = `
      <div class="month-header">
        <h3>${monthName}${isCurrent ? '<i class="month-now-badge">NOW</i>' : ""}</h3>
        <span class="month-total">${total > 0 ? money(total) : "—"}</span>
      </div>
      <div class="month-bar-track"><div class="month-bar-fill${total === maxMonthly && total > 0 ? " month-bar-peak" : ""}" style="width:${barWidth}%"></div></div>
      <div class="month-items">${itemsHtml}</div>
    `;
    grid.appendChild(card);
  });
}

function dividendFrequencyLabel(ticker) {
  const months = DIVIDEND_MONTHS[ticker];
  if (!months) return "분기";
  if (months.length === 12) return "월배당";
  if (months.length === 4) return "분기";
  if (months.length === 2) return "반기";
  if (months.length === 1) return "연 1회";
  return `연 ${months.length}회`;
}

function dividendMonthsForTicker(ticker) {
  return DIVIDEND_MONTHS[ticker] || [3, 6, 9, 12];
}

function consolidatedHoldings(ownerId, typeFilter) {
  const all = replayHoldings(ownerId).filter((h) => h.quantity > 0.00000001);
  if (typeFilter) return all.filter((h) => h.type === typeFilter);
  return all;
}

function holdingsDisplayCurrency() {
  return state.displayCurrency === "USD" ? "USD" : "KRW";
}

function holdingMoney(valueKrw, currency = holdingsDisplayCurrency()) {
  const amount = Number(valueKrw || 0);
  if (currency === "USD") return usdFormatter.format(amount / currentUsdKrw());
  return money(amount);
}

function signedHoldingMoney(valueKrw, currency = holdingsDisplayCurrency()) {
  const amount = Number(valueKrw || 0);
  const sign = amount >= 0 ? "+" : "-";
  if (currency === "USD") return `${sign}${usdFormatter.format(Math.abs(amount) / currentUsdKrw())}`;
  return `${amount >= 0 ? "+" : ""}${money(amount)}`;
}

function nativePriceText(item, value) {
  const prefix = item.currency === "USD" ? "$" : "KRW ";
  return `${prefix}${numberFormatter.format(value || 0)}`;
}

function renderHoldingsView() {
  const grid = document.querySelector("#holdingsViewGrid");
  const summaryEl = document.querySelector("#holdingsViewSummary");
  if (!grid) return;

  const ownerSelect = document.querySelector("#holdingsViewOwnerSelect");
  const typeSelect = document.querySelector("#holdingsViewTypeFilter");
  const sortSelect = document.querySelector("#holdingsViewSortSelect");
  const currencyToggle = document.querySelector("#holdingsCurrencyToggle");
  const ownerId = ownerSelect?.value || null;
  const typeFilter = typeSelect?.value || null;
  const displayCurrency = holdingsDisplayCurrency();
  const sortMode = sortSelect?.value || "value";

  if (ownerSelect && ownerSelect.options.length <= 1) {
    state.investors.forEach((inv) => {
      const opt = document.createElement("option");
      opt.value = inv.id;
      opt.textContent = inv.name;
      ownerSelect.appendChild(opt);
    });
  }

  const holdings = consolidatedHoldings(ownerId || null, typeFilter || null);
  const totalValue = holdings.reduce((s, h) => s + h.valueKrw, 0);
  const totalProfit = holdings.reduce((s, h) => s + h.profit, 0);
  const totalDividend = holdings.reduce((s, h) => s + h.annualDividend, 0);
  const dividendAfterTax = totalDividend * (1 - DIVIDEND_TAX_RATE);
  const typeCounts = {};
  holdings.forEach((h) => { typeCounts[h.type] = (typeCounts[h.type] || 0) + 1; });
  const typeBreakdown = Object.entries(typeCounts).map(([t, c]) => `${t} ${c}`).join(" · ");

  if (currencyToggle) {
    currencyToggle.textContent = `${displayCurrency} 기준`;
    currencyToggle.setAttribute("aria-label", `${displayCurrency === "KRW" ? "달러" : "원화"} 기준으로 전환`);
  }

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="hv-summary-item">
        <span>총 평가금액</span>
        <strong>${holdingMoney(totalValue, displayCurrency)}</strong>
      </div>
      <div class="hv-summary-item">
        <span>총 손익</span>
        <strong class="${totalProfit >= 0 ? "positive" : "negative"}">${signedHoldingMoney(totalProfit, displayCurrency)}</strong>
      </div>
      <div class="hv-summary-item">
        <span>연간 배당 (세후)</span>
        <strong>${holdingMoney(dividendAfterTax, displayCurrency)}</strong>
      </div>
      <div class="hv-summary-item">
        <span>종목 구성</span>
        <strong>${holdings.length}종목</strong>
        <small>${typeBreakdown}</small>
      </div>
    `;
  }

  const enriched = holdings.map((item) => {
    const weight = totalValue > 0 ? (item.valueKrw / totalValue) * 100 : 0;
    const returnRate = item.costKrw > 0 ? (item.profit / item.costKrw) * 100 : 0;
    const dividendAfterTaxItem = item.annualDividend * (1 - DIVIDEND_TAX_RATE);
    const dividendYield = item.valueKrw > 0 ? (dividendAfterTaxItem / item.valueKrw) * 100 : 0;
    const breakevenRise = item.profit < 0 && item.valueKrw > 0 ? ((item.costKrw / item.valueKrw) - 1) * 100 : 0;
    return { ...item, weight, returnRate, dividendAfterTaxItem, dividendYield, breakevenRise };
  });

  const sorted = enriched.slice().sort((a, b) => {
    if (sortMode === "profit") return b.profit - a.profit;
    if (sortMode === "return") return b.returnRate - a.returnRate;
    if (sortMode === "weight") return b.weight - a.weight;
    if (sortMode === "dividend") return b.dividendAfterTaxItem - a.dividendAfterTaxItem;
    if (sortMode === "type") return `${a.type}${a.ticker}`.localeCompare(`${b.type}${b.ticker}`, "ko-KR");
    return b.valueKrw - a.valueKrw;
  });

  if (!sorted.length) {
    grid.className = "holdings-list";
    grid.innerHTML = `<p class="empty-hint">보유 종목이 없습니다.</p>`;
    return;
  }

  grid.className = "holdings-list";
  grid.innerHTML = `
    <div class="hv-list-head" role="row">
      <span>분류 / 투자자</span>
      <span>티커</span>
      <span>평가금액</span>
      <span>비중</span>
      <span>손익 / 수익률</span>
      <span>수량</span>
      <span>평단 / 현재가</span>
      <span>배당</span>
    </div>
    ${sorted.map((item) => {
    const owner = investorById(item.ownerId);
    const profitClass = item.profit >= 0 ? "positive" : "negative";
    const hasDividend = item.annualDividend > 0;
    const freqLabel = hasDividend ? dividendFrequencyLabel(item.ticker) : null;
    const breakeven = item.breakevenRise > 0 ? `<small class="hv-breakeven">손익분기 +${pct(item.breakevenRise)} 필요</small>` : "";
    const dividendText = hasDividend
      ? `<span class="hv-div-freq">${freqLabel}</span><b>${holdingMoney(item.dividendAfterTaxItem, displayCurrency)}/년</b><small>${pct(item.dividendYield)}</small>`
      : `<span class="hv-empty-cell">—</span>`;

    return `
      <div class="hv-row" data-type="${item.type}" role="row">
        <div class="hv-cell hv-owner-type">
          <span class="pill">${item.type}</span>
          <span class="hv-owner-chip">${owner.initials}</span>
          <small>${owner.name}</small>
        </div>
        <div class="hv-cell hv-ticker-cell">
          <div class="hv-card-title">
            <strong>${item.ticker}</strong>
            <small>${item.name}</small>
          </div>
        </div>
        <div class="hv-cell hv-money-cell">
          <strong>${holdingMoney(item.valueKrw, displayCurrency)}</strong>
          <small>${displayCurrency === "USD" ? money(item.valueKrw) : usdFormatter.format(item.valueKrw / currentUsdKrw())}</small>
        </div>
        <div class="hv-cell hv-weight-cell">
          <strong>${pct(item.weight)}</strong>
          <span class="hv-card-bar"><i class="hv-card-bar-fill" style="width:${Math.max(2, item.weight)}%"></i></span>
        </div>
        <div class="hv-cell hv-profit-cell">
          <strong class="${profitClass}">${signedHoldingMoney(item.profit, displayCurrency)}</strong>
          <small class="${profitClass}">${item.returnRate >= 0 ? "+" : ""}${pct(item.returnRate)}</small>
          ${breakeven}
        </div>
        <div class="hv-cell hv-qty-cell">
          <strong>${qty(item.quantity)}</strong>
          <small>${item.currency}</small>
        </div>
        <div class="hv-cell hv-price-cell">
          <strong>${holdingMoney(item.avgPrice * item.avgFx, displayCurrency)}</strong>
          <small>현재 ${holdingMoney(item.currentPrice * item.currentFx, displayCurrency)}</small>
          <small class="hv-native-price">${nativePriceText(item, item.avgPrice)} → ${nativePriceText(item, item.currentPrice)}</small>
        </div>
        <div class="hv-cell hv-dividend-cell">
          ${dividendText}
        </div>
      </div>
    `;
    }).join("")}
  `;
}

let _renderRafId = null;
function render() {
  if (_renderRafId) return;
  _renderRafId = requestAnimationFrame(() => {
    _renderRafId = null;
    renderView();
    renderDashboard();
    renderAllocation();
    renderMarket();
    renderIndexMonitor();
    renderInvestorComparison();
    renderInvestorTabs();
    renderInvestorSheet();
    renderHoldings();
    renderHoldingsPreview();
    renderHoldingsView();
    renderTransactions();
    renderLedgerPreview();
    renderTrend();
    renderFx();
    renderMarketStatus();
    populateOwnerSelects();
    renderDividendSimulation();
    renderDividendCalendar();
    document.querySelector("#undoImportButton").classList.toggle("hidden", !importRollbackState);
  });
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
}

function cryptoTrackingSymbols() {
  const coinHoldings = replayHoldings().filter((holding) => holding.type === "코인");
  const indicatorSymbols = (state.marketIndicators || [])
    .map((item) => item.symbol?.toUpperCase())
    .filter((symbol) => BINANCE_SYMBOLS[symbol] || COINGECKO_IDS[symbol]);
  return [...new Set([
    ...coinHoldings.map((holding) => holding.ticker.toUpperCase()),
    ...indicatorSymbols
  ])];
}

function cryptoIndicatorFor(symbol) {
  const upper = symbol.toUpperCase();
  let index = state.marketIndicators.findIndex((item) => item.symbol === upper);
  if (index < 0) {
    state.marketIndicators.push({
      symbol: upper,
      domestic: 0,
      globalKrw: 0,
      domesticChange: 0,
      globalChange: 0,
      updatedAt: null
    });
    index = state.marketIndicators.length - 1;
  }
  return state.marketIndicators[index];
}

function applyCryptoOverseasQuote(symbol, price, change, updatedAt = new Date().toISOString()) {
  const upper = symbol.toUpperCase();
  const quoteFx = Number(state.cryptoQuoteFx?.rate || currentUsdKrw());
  const usdPrice = Number(price);
  if (!usdPrice) return;
  const asset = state.assetCatalog[upper];
  if (asset && asset.currency !== "KRW") {
    // USD 기준으로 보유한 코인만 해외(USD) 시세로 현재가를 갱신.
    // 빗썸(KRW) 기준 코인은 applyCryptoDomesticQuote가 원화가로 갱신한다.
    asset.currentPrice = usdPrice;
    asset.currentFx = quoteFx;
  }
  const indicator = cryptoIndicatorFor(upper);
  indicator.globalKrw = usdPrice * quoteFx;
  indicator.globalChange = Number(change || indicator.globalChange || 0);
  indicator.quoteFx = quoteFx;
  indicator.quoteFxSource = state.cryptoQuoteFx?.source || "USDT/KRW";
  indicator.updatedAt = updatedAt;
}

function applyCryptoDomesticQuote(symbol, price, change, updatedAt = new Date().toISOString()) {
  const krwPrice = Number(price);
  if (!krwPrice) return;
  const upper = symbol.toUpperCase();
  const indicator = cryptoIndicatorFor(upper);
  indicator.domestic = krwPrice;
  indicator.domesticChange = Number(change || 0);
  indicator.updatedAt = updatedAt;
  const asset = state.assetCatalog[upper];
  if (asset && asset.currency === "KRW") {
    // 빗썸(원화) 기준 코인은 국내 원화가를 현재가로 사용, 환율은 1.
    asset.currentPrice = krwPrice;
    asset.currentFx = 1;
  }
}

function scheduleCryptoRealtimeRender() {
  if (cryptoRenderTimer) return;
  cryptoRenderTimer = setTimeout(() => {
    cryptoRenderTimer = null;
    renderDashboard();
    renderAllocation();
    renderMarket();
    renderInvestorComparison();
    renderInvestorSheet();
    renderHoldings();
    renderHoldingsPreview();
    renderTrend();
    renderFx();
  }, CRYPTO_REALTIME_RENDER_INTERVAL_MS);
}

async function refreshCryptoQuoteFxIfStale(maxAgeMs = 30000) {
  const updatedAt = state.cryptoQuoteFx?.updatedAt ? new Date(state.cryptoQuoteFx.updatedAt).getTime() : 0;
  if (Date.now() - updatedAt < maxAgeMs && Number(state.cryptoQuoteFx?.rate || 0)) return state.cryptoQuoteFx;
  return fetchCryptoQuoteFx();
}

async function fetchOverseasPricesBinance(symbols) {
  const overseas = {};
  for (const symbol of symbols) {
    const binanceSymbol = BINANCE_SYMBOLS[symbol];
    if (!binanceSymbol) continue;
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`);
    if (!response.ok) throw new Error(`Binance 시세를 가져오지 못했습니다: ${symbol}`);
    const data = await response.json();
    const price = Number(data.lastPrice || data.price);
    if (price) {
      overseas[symbol] = {
        price,
        change: Number(data.priceChangePercent || 0)
      };
    }
  }
  return overseas;
}

async function fetchOverseasPricesCoinGecko(symbols) {
  const coingeckoIds = symbols.map((symbol) => COINGECKO_IDS[symbol]).filter(Boolean);
  if (!coingeckoIds.length) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds.join(",")}&vs_currencies=usd&include_24hr_change=true`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("CoinGecko 시세를 가져오지 못했습니다.");
  const data = await response.json();
  const overseas = {};
  symbols.forEach((symbol) => {
    const id = COINGECKO_IDS[symbol];
    if (data[id]?.usd) {
      overseas[symbol] = {
        price: Number(data[id].usd),
        change: Number(data[id].usd_24h_change || 0)
      };
    }
  });
  return overseas;
}

async function fetchOverseasPrices(symbols) {
  try {
    const result = await fetchOverseasPricesBinance(symbols);
    const missing = symbols.filter((symbol) => !result[symbol]?.price);
    if (!missing.length) {
      state.overseasPriceSource = "binance";
      return result;
    }
    const fallback = await fetchOverseasPricesCoinGecko(missing);
    state.overseasPriceSource = Object.keys(result).length ? "mixed" : "coingecko";
    return { ...result, ...fallback };
  } catch (error) {
    console.warn("Binance 시세 조회 실패, CoinGecko로 폴백합니다.", error);
    state.overseasPriceSource = "coingecko";
    return fetchOverseasPricesCoinGecko(symbols);
  }
}

async function fetchCryptoQuoteFx() {
  try {
    const response = await fetch("https://api.bithumb.com/public/ticker/USDT_KRW");
    if (!response.ok) throw new Error("빗썸 USDT/KRW 시세를 가져오지 못했습니다.");
    const data = await response.json();
    const rate = Number(data?.data?.closing_price);
    if (!rate) throw new Error("빗썸 USDT/KRW 응답이 올바르지 않습니다.");
    const quoteFx = { rate, source: "USDT/KRW", updatedAt: new Date().toISOString() };
    state.cryptoQuoteFx = quoteFx;
    return quoteFx;
  } catch (error) {
    console.warn("USDT/KRW 조회 실패, 앱 USD/KRW 환율로 폴백합니다.", error);
    const quoteFx = {
      rate: currentUsdKrw(),
      source: state.fx.mode === "manual" ? "수동 USD/KRW" : "USD/KRW",
      updatedAt: state.fx.updatedAt || new Date().toISOString()
    };
    state.cryptoQuoteFx = quoteFx;
    return quoteFx;
  }
}

async function updateCoinQuotes() {
  const symbols = cryptoTrackingSymbols();
  if (!symbols.length) return;
  const overseas = await fetchOverseasPrices(symbols);
  const quoteFx = await fetchCryptoQuoteFx();

  for (const symbol of symbols) {
    try {
      const bithumbResponse = await fetch(`https://api.bithumb.com/public/ticker/${symbol}_KRW`);
      if (!bithumbResponse.ok) throw new Error(`빗썸 시세를 가져오지 못했습니다: ${symbol}`);
      const bithumb = await bithumbResponse.json();
      const domestic = Number(bithumb?.data?.closing_price);
      const domesticChange = Number(bithumb?.data?.fluctate_rate_24H || bithumb?.data?.fluctate_rate_24h || 0);
      const overseasQuote = overseas[symbol];
      const globalUsd = typeof overseasQuote === "number" ? overseasQuote : overseasQuote?.price;
      const globalChange = typeof overseasQuote === "number" ? 0 : Number(overseasQuote?.change || 0);
      if (globalUsd) applyCryptoOverseasQuote(symbol, globalUsd, globalChange);
      if (domestic && globalUsd) {
        const globalKrw = globalUsd * quoteFx.rate;
        const next = {
          symbol,
          domestic,
          globalKrw,
          domesticChange,
          globalChange,
          quoteFx: quoteFx.rate,
          quoteFxSource: quoteFx.source,
          updatedAt: new Date().toISOString()
        };
        const index = state.marketIndicators.findIndex((item) => item.symbol === symbol);
        if (index >= 0) state.marketIndicators[index] = next;
        else state.marketIndicators.push(next);
      }
    } catch (error) {
      console.warn("국내 코인 시세 조회를 건너뜁니다.", error);
    }
  }
}

async function updateDomesticCoinQuotesRealtime() {
  const symbols = cryptoTrackingSymbols().filter((symbol) => BINANCE_SYMBOLS[symbol] || COINGECKO_IDS[symbol]);
  if (!symbols.length) return;
  try {
    await refreshCryptoQuoteFxIfStale();
  } catch (error) {
    console.warn("USDT/KRW 실시간 보강 갱신을 건너뜁니다.", error);
  }
  await Promise.allSettled(symbols.map(async (symbol) => {
    const response = await fetch(`https://api.bithumb.com/public/ticker/${symbol}_KRW`);
    if (!response.ok) throw new Error(`빗썸 시세를 가져오지 못했습니다: ${symbol}`);
    const data = await response.json();
    const domestic = Number(data?.data?.closing_price);
    const domesticChange = Number(data?.data?.fluctate_rate_24H || data?.data?.fluctate_rate_24h || 0);
    applyCryptoDomesticQuote(symbol, domestic, domesticChange);
  }));
  scheduleCryptoRealtimeRender();
}

function binanceSymbolToAssetSymbol(binanceSymbol) {
  return Object.keys(BINANCE_SYMBOLS).find((symbol) => BINANCE_SYMBOLS[symbol] === binanceSymbol) || null;
}

function startBinanceCryptoSocket(symbols) {
  if (!window.WebSocket) return;
  const streams = symbols
    .map((symbol) => BINANCE_SYMBOLS[symbol])
    .filter(Boolean)
    .map((symbol) => `${symbol.toLowerCase()}@ticker`);
  if (!streams.length) return;

  cryptoSocketShouldReconnect = true;
  clearTimeout(cryptoReconnectTimer);
  if (cryptoSocket) {
    const previousSocket = cryptoSocket;
    cryptoSocket = null;
    cryptoSocketShouldReconnect = false;
    previousSocket.close();
    cryptoSocketShouldReconnect = true;
  }

  const socket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams.join("/")}`);
  cryptoSocket = socket;
  socket.addEventListener("open", () => {
    cryptoReconnectAttempts = 0;
    state.overseasPriceSource = "binance-stream";
    renderMarket();
  });
  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      const data = payload.data || payload;
      const symbol = binanceSymbolToAssetSymbol(data.s);
      const price = Number(data.c);
      if (!symbol || !price) return;
      state.overseasPriceSource = "binance-stream";
      applyCryptoOverseasQuote(symbol, price, Number(data.P || 0), new Date(Number(data.E) || Date.now()).toISOString());
      scheduleCryptoRealtimeRender();
    } catch (error) {
      console.warn("Binance WebSocket 메시지를 처리하지 못했습니다.", error);
    }
  });
  socket.addEventListener("close", () => {
    if (cryptoSocket !== socket || !cryptoSocketShouldReconnect) return;
    cryptoReconnectAttempts += 1;
    const delay = Math.min(30000, 1500 * (2 ** Math.min(cryptoReconnectAttempts, 5)));
    cryptoReconnectTimer = setTimeout(() => startCryptoRealtime(), delay);
  });
  socket.addEventListener("error", () => {
    socket.close();
  });
}

function startDomesticCryptoPolling() {
  clearInterval(cryptoDomesticTimer);
  updateDomesticCoinQuotesRealtime();
  cryptoDomesticTimer = setInterval(updateDomesticCoinQuotesRealtime, 5000);
}

function startCryptoRealtime() {
  const symbols = cryptoTrackingSymbols().filter((symbol) => BINANCE_SYMBOLS[symbol] || COINGECKO_IDS[symbol]);
  const symbolKey = symbols.slice().sort().join("|");
  startDomesticCryptoPolling();
  if (symbolKey && symbolKey !== cryptoRealtimeSymbolKey) {
    cryptoRealtimeSymbolKey = symbolKey;
    startBinanceCryptoSocket(symbols);
  }
}

async function updateStockQuotes() {
  const baseUrl = proxyBaseUrl();
  if (!baseUrl) return;
  const holdings = replayHoldings().filter((holding) => holding.type === "주식" && holding.currency === "USD");
  const symbols = [...new Set(holdings.map((holding) => holding.ticker))];
  for (const symbol of symbols) {
    const response = await fetch(`${baseUrl}/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!response.ok) throw new Error("미국주식 시세를 가져오지 못했습니다.");
    const quote = await response.json();
    if (quote.c && state.assetCatalog[symbol]) {
      state.assetCatalog[symbol].currentPrice = Number(quote.c);
      state.assetCatalog[symbol].currentFx = currentUsdKrw();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function updateIndexQuotes() {
  const baseUrl = proxyBaseUrl();
  if (!baseUrl) return;
  state.indexQuotes = state.indexQuotes || {};
  for (const idx of INDEX_MONITOR_LIST) {
    const response = await fetch(`${baseUrl}/quote?symbol=${encodeURIComponent(idx.ticker)}`);
    if (!response.ok) throw new Error("주요 지수 시세를 가져오지 못했습니다.");
    const quote = await response.json();
    const price = Number(quote.c || 0);
    const changePercent = Number(quote.dp || 0);
    if (price) {
      state.indexQuotes[idx.ticker] = { price, changePercent, updatedAt: new Date().toISOString() };
      if (state.assetCatalog[idx.ticker]) {
        state.assetCatalog[idx.ticker].currentPrice = price;
        state.assetCatalog[idx.ticker].currentFx = currentUsdKrw();
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function refreshQuotes() {
  try {
    await updateCoinQuotes();
    await updateStockQuotes();
    await updateIndexQuotes();
    state.market = {
      lastUpdatedAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      failedAt: null,
      error: null
    };
    saveState({ snapshot: true });
    startCryptoRealtime();
    render();
  } catch (error) {
    state.market.failedAt = new Date().toISOString();
    state.market.error = error.message;
    saveState({ snapshot: false });
    renderMarketStatus();
  }
}

async function fetchFxRateFrankfurter() {
  const response = await fetch(FX_API_PRIMARY_URL);
  if (!response.ok) throw new Error("Frankfurter 환율 조회 실패");
  const data = await response.json();
  const rate = data.rates && data.rates.KRW;
  if (!rate) throw new Error("Frankfurter 응답에 KRW 없음");
  return Number(rate);
}

async function fetchFxRateExchangeRateApi() {
  const response = await fetch(FX_API_FALLBACK_URL);
  if (!response.ok) throw new Error("ExchangeRate-API 환율 조회 실패");
  const data = await response.json();
  const rate = data.rates && data.rates.KRW;
  if (!rate) throw new Error("ExchangeRate-API 응답에 KRW 없음");
  return Number(rate);
}

async function refreshFxRate() {
  if (state.fx.mode === "manual") return;

  const { dateKey } = getKstNowParts();
  const slot = currentFxSlot();
  if (!slot) return;
  if (state.fx.lastAutoFetchDate === dateKey && state.fx.lastAutoFetchSlot === slot) return;

  const baseUrl = proxyBaseUrl();
  let usdkrw = null;
  let source = null;
  let updatedAt = new Date().toISOString();

  if (baseUrl) {
    try {
      const response = await fetch(`${baseUrl}/fxrate`);
      if (!response.ok) throw new Error("환율을 가져오지 못했습니다.");
      const data = await response.json();
      usdkrw = Number(data.usdkrw);
      if (!usdkrw) throw new Error("환율 응답이 올바르지 않습니다.");
      source = data.source === "fallback" ? "fallback" : "hana";
      updatedAt = data.updatedAt || updatedAt;
    } catch (error) {
      console.warn("프록시 환율 갱신 실패", error);
    }
  } else {
    try {
      usdkrw = await fetchFxRateFrankfurter();
      source = "frankfurter";
    } catch (primaryError) {
      try {
        usdkrw = await fetchFxRateExchangeRateApi();
        source = "exchangerate-api";
      } catch (fallbackError) {
        console.warn("환율 자동 갱신 실패", primaryError, fallbackError);
      }
    }
  }

  if (!usdkrw || !source) return;

  state.fx.usdkrw = usdkrw;
  state.fx.source = source;
  state.fx.updatedAt = updatedAt;
  state.fx.lastAutoFetchDate = dateKey;
  state.fx.lastAutoFetchSlot = slot;
  Object.values(state.assetCatalog).forEach((asset) => {
    if (asset.currency === "USD") asset.currentFx = usdkrw;
  });
  saveState({ snapshot: true });
  render();
}

function startPolling() {
  refreshFxRate();
  refreshQuotes();
  startCryptoRealtime();
  clearInterval(pollingTimer);
  clearInterval(fxTimer);
  pollingTimer = setInterval(refreshQuotes, 60000);
  fxTimer = setInterval(refreshFxRate, 5 * 60 * 1000);
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedView = button.dataset.view;
    saveState({ snapshot: false });
    render();
  });
});

document.querySelectorAll("[data-expand-ledger]").forEach((link) => {
  link.addEventListener("click", () => {
    ledgerExpanded = true;
    renderView();
  });
});

document.querySelector("#collapseLedgerButton").addEventListener("click", () => {
  ledgerExpanded = false;
  renderView();
});

document.querySelector("#clearHoldingsFilterButton").addEventListener("click", clearHoldingsFilter);

document.querySelector("#investorTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-investor-id]");
  if (!button) return;
  state.selectedInvestorId = button.dataset.investorId;
  state.selectedView = "investor";
  state.pendingDeleteInvestorId = null;
  saveState({ snapshot: false });
  render();
});

document.querySelector("#addInvestorForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.investorName;
  if (!input.value.trim()) return;
  addInvestorByName(input.value, { openSheet: true });
  input.value = "";
});

document.querySelector("#dashboardAddInvestorForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.investorName;
  if (!input.value.trim()) return;
  addInvestorByName(input.value, { openSheet: false });
  input.value = "";
});

document.querySelector("#editInvestorNameForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.investorName;
  const clean = input.value.trim();
  if (!clean) {
    showToast("투자자 이름을 입력하세요.", "error");
    return;
  }
  updateInvestorName(state.selectedInvestorId, clean);
});

document.querySelector("#heroMenuToggle").addEventListener("click", (event) => {
  event.stopPropagation();
  const dropdown = document.querySelector("#heroMenuDropdown");
  dropdown.hidden = !dropdown.hidden;
});

document.querySelector("#heroMenuDropdown").addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("click", () => {
  const dropdown = document.querySelector("#heroMenuDropdown");
  if (dropdown) dropdown.hidden = true;
});

document.querySelector("#deleteInvestorButton").addEventListener("click", () => {
  if (state.investors.length <= 1) return;
  document.querySelector("#heroMenuDropdown").hidden = true;
  state.pendingDeleteInvestorId = state.selectedInvestorId;
  renderDeleteConfirm();
});

document.querySelector("#cancelDeleteInvestor").addEventListener("click", () => {
  state.pendingDeleteInvestorId = null;
  renderDeleteConfirm();
});

document.querySelector("#confirmDeleteInvestor").addEventListener("click", () => {
  const id = state.pendingDeleteInvestorId;
  if (!id || state.investors.length <= 1) return;
  state.investors = state.investors.filter((investor) => investor.id !== id);
  state.trades = state.trades.filter((trade) => trade.ownerId !== id);
  state.cashflows = state.cashflows.filter((flow) => flow.ownerId !== id);
  state.selectedInvestorId = state.investors[0].id;
  state.pendingDeleteInvestorId = null;
  saveState();
  render();
});

function renderDeleteConfirm() {
  document.querySelector("#deleteConfirm").classList.toggle("show", state.pendingDeleteInvestorId === state.selectedInvestorId);
}

document.querySelector("#cashflowForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const ownerId = form.elements.ownerId.value;
  const type = event.submitter?.dataset.cashflowType || "deposit";
  const amount = Number(form.elements.amount.value) || 0;
  if (!amount) return;
  if (type === "withdraw" && !canWithdraw(ownerId, amount)) {
    form.elements.amount.setCustomValidity("출금액이 예수금을 초과합니다.");
    form.reportValidity();
    form.elements.amount.setCustomValidity("");
    return;
  }
  state.cashflows.push({
    id: crypto.randomUUID(),
    ownerId,
    date: form.elements.date.value,
    type,
    amount,
    memo: form.elements.memo.value.trim()
  });
  form.reset();
  form.elements.date.valueAsDate = new Date();
  saveState();
  render();
});

document.querySelector("#openTradeForm").addEventListener("click", () => {
  loadUsSymbols();
  const form = document.querySelector("#tradeForm");
  form.reset();
  setTradeDialogMode("add");
  form.elements.date.valueAsDate = new Date();
  form.elements.fx.value = currentUsdKrw();
  form.elements.currentFx.value = currentUsdKrw();
  populateOwnerSelects();
  renderTradePreview();
  openDialog(document.querySelector("#tradeDialog"));
});

document.querySelector("#deleteTradeButton").addEventListener("click", () => {
  const button = document.querySelector("#deleteTradeButton");
  if (button.dataset.confirm !== "1") {
    button.dataset.confirm = "1";
    button.textContent = "삭제 확인";
    return;
  }
  const id = editingTradeId;
  button.dataset.confirm = "";
  button.textContent = "삭제";
  if (id) {
    deleteTrade(id);
    document.querySelector("#tradeDialog").close();
    showToast("거래를 삭제했습니다.");
  }
});

document.querySelector("#holdingTradesList").addEventListener("click", (event) => {
  const editBtn = event.target.closest("[data-edit-trade]");
  const delBtn = event.target.closest("[data-delete-trade]");
  if (editBtn) {
    document.querySelector("#holdingTradesDialog").close();
    openTradeEditor(editBtn.dataset.editTrade);
  } else if (delBtn) {
    deleteTrade(delBtn.dataset.deleteTrade);
    showToast("거래를 삭제했습니다.");
    document.querySelector("#holdingTradesDialog").close();
  }
});

document.querySelector("#investorHoldingsPreview").addEventListener("click", (event) => {
  const editBtn = event.target.closest("[data-edit-holding]");
  if (!editBtn) return;
  openHoldingTrades(state.selectedInvestorId, editBtn.dataset.editHolding);
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelector("#tradeForm").addEventListener("input", (event) => {
  if (event.target.name === "ticker") updateAssetFieldsFromTicker(event.target.value);
  if (event.target.name === "currency" && event.target.value === "KRW") {
    event.currentTarget.elements.fx.value = 1;
    event.currentTarget.elements.currentFx.value = 1;
  }
  renderTradePreview();
});

document.querySelector("#tradeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    ownerId: form.elements.ownerId.value,
    date: form.elements.date.value,
    side: form.elements.side.value,
    ticker: form.elements.ticker.value,
    name: form.elements.name.value.trim(),
    type: form.elements.type.value,
    currency: form.elements.currency.value,
    quantity: Number(form.elements.quantity.value) || 0,
    price: Number(form.elements.price.value) || 0,
    fx: Number(form.elements.fx.value) || 1,
    currentPrice: Number(form.elements.currentPrice.value) || Number(form.elements.price.value) || 0,
    currentFx: form.elements.currency.value === "KRW" ? 1 : Number(form.elements.currentFx.value) || Number(form.elements.fx.value) || 1,
    memo: form.elements.memo.value.trim()
  };
  if (editingTradeId) {
    const result = updateTrade(editingTradeId, payload);
    if (!result.ok) {
      const field = form.elements[result.field || "ticker"];
      field.setCustomValidity(result.message);
      form.reportValidity();
      field.setCustomValidity("");
      return;
    }
    setTradeDialogMode("add");
    form.closest("dialog").close();
    showToast("거래를 수정했습니다.");
    return;
  }
  const result = commitTrade({
    ownerId: form.elements.ownerId.value,
    date: form.elements.date.value,
    side: form.elements.side.value,
    ticker: form.elements.ticker.value,
    name: form.elements.name.value.trim(),
    type: form.elements.type.value,
    currency: form.elements.currency.value,
    quantity: Number(form.elements.quantity.value) || 0,
    price: Number(form.elements.price.value) || 0,
    fx: Number(form.elements.fx.value) || 1,
    currentPrice: Number(form.elements.currentPrice.value) || Number(form.elements.price.value) || 0,
    currentFx: form.elements.currency.value === "KRW" ? 1 : Number(form.elements.currentFx.value) || Number(form.elements.fx.value) || 1,
    memo: form.elements.memo.value.trim()
  });
  if (!result.ok) {
    const field = form.elements[result.field || "ticker"];
    field.setCustomValidity(result.message);
    form.reportValidity();
    field.setCustomValidity("");
    return;
  }
  form.closest("dialog").close();
});

document.querySelector("#seedButton").addEventListener("click", () => {
  state = structuredClone(seedState);
  saveState();
  render();
  showToast("데모 데이터를 초기화했습니다.");
});

document.querySelector("#demoChangeButton").addEventListener("click", triggerDashboardChangeDemo);

document.querySelector("#exportButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(exportableState(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `assetpilot-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importButton").addEventListener("click", () => {
  document.querySelector("#importFileInput").click();
});

document.querySelector("#importFileInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const errors = validateImportState(parsed);
    if (errors.length) {
      showToast(errors[0], "error");
      return;
    }
    if (parsed.schemaVersion && parsed.schemaVersion !== SCHEMA_VERSION) {
      showToast(`백업 스키마 v${parsed.schemaVersion}입니다. 경고 후 계속 진행할 수 있습니다.`);
    }
    pendingImportState = normalizeState(parsed);
    openDialog(document.querySelector("#confirmImportDialog"));
  } catch {
    showToast("JSON 파일을 읽을 수 없습니다.", "error");
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#confirmImportButton").addEventListener("click", () => {
  if (!pendingImportState) return;
  importRollbackState = structuredClone(state);
  state = pendingImportState;
  state.schemaVersion = SCHEMA_VERSION;
  pendingImportState = null;
  saveState();
  render();
  document.querySelector("#confirmImportDialog").close();
  showToast(`${dateFormatter.format(new Date())} 백업을 불러왔습니다.`);
});

document.querySelector("#undoImportButton").addEventListener("click", () => {
  if (!importRollbackState) return;
  state = importRollbackState;
  importRollbackState = null;
  saveState();
  render();
  showToast("가져오기 전 상태로 되돌렸습니다.");
});

document.querySelector("#manualFxToggle").addEventListener("change", (event) => {
  state.fx.mode = event.target.checked ? "manual" : "auto";
  if (state.fx.mode === "manual") state.fx.source = "manual";
  saveState();
  render();
  refreshFxRate();
});

document.querySelector("#manualFxInput").addEventListener("change", (event) => {
  const value = Number(event.target.value);
  if (!value) return;
  state.fx.manualUsdkrw = value;
  state.fx.usdkrw = state.fx.mode === "manual" ? value : state.fx.usdkrw;
  if (state.fx.mode === "manual") {
    Object.values(state.assetCatalog).forEach((asset) => {
      if (asset.currency === "USD") asset.currentFx = value;
    });
  }
  saveState();
  render();
});

document.querySelector("#dividendSimForm").addEventListener("input", (event) => {
  if (event.target.name === "fx") event.target.dataset.touched = "true";
  if (event.target.name === "currency" && event.target.value === "KRW") {
    event.currentTarget.elements.fx.value = 1;
  }
  renderDividendSimulation();
});
document.querySelector("#toggleDividendDetail").addEventListener("click", () => {
  dividendDetailOpen = !dividendDetailOpen;
  renderDividendSimulation();
});
document.querySelector("#targetMonthlyDividend").addEventListener("input", renderDividendSimulation);
document.querySelector("#calendarTargetSelect").addEventListener("change", renderDividendCalendar);

document.querySelector("#holdingsViewOwnerSelect").addEventListener("change", renderHoldingsView);
document.querySelector("#holdingsViewTypeFilter").addEventListener("change", renderHoldingsView);
document.querySelector("#holdingsViewSortSelect").addEventListener("change", renderHoldingsView);
document.querySelector("#holdingsCurrencyToggle").addEventListener("click", () => {
  state.displayCurrency = holdingsDisplayCurrency() === "KRW" ? "USD" : "KRW";
  saveState({ snapshot: false });
  renderHoldingsView();
});

document.querySelector("#cashflowForm").elements.date.valueAsDate = new Date();
setupNewAssetForm();
setupQuickTrade();
recordSnapshot();
render();
hydrateFromServer();
setTimeout(loadUsSymbols, 1500);
startPolling();
startRealtimeDemoLoop();
