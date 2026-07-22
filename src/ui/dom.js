import { CRYPTO_LOGOS } from "../config/catalog.js";
import { REALTIME_CHANGE_BADGE_DURATION_MS, REALTIME_CHANGE_BADGE_FADE_MS } from "../config/constants.js";
import { moneyParts, signedMoney } from "../core/format.js";
import { state } from "../state/store.js";

export let toastTimer = null;

export const _animatingElements = new Map();

export function animateNumberTo(element, targetValue, duration = 420) {
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
  // 지역 변수명이 전역 state 와 겹치지 않도록 entry 로 둔다.
  const entry = { current: startValue, raf: requestAnimationFrame(tick) };
  _animatingElements.set(key, entry);
  return startValue;
}

export function setMoneyElement(selector, value) {
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

export function setSignedMoneyElement(selector, value) {
  const element = document.querySelector(selector);
  if (!element) return;
  const sign = value >= 0 ? "+" : "-";
  const parts = moneyParts(Math.abs(value));
  element.innerHTML = `<span class="currency-prefix">${sign}${parts.symbol}</span>${parts.amount}`;
}


// format: 배지 문구를 만들 포매터. 기본은 부호 붙은 원화 표기.
export function markRealtimeChange(card, diff, format = signedMoney) {
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
  badge.textContent = `${format(diff)} ${direction === "up" ? "▲" : "▼"}`;
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


export function renderMetricTitle(label) {
  return `<strong class="metric-title"><span>${label}</span><i class="metric-badge-slot" aria-hidden="true"></i></strong>`;
}

export function renderCryptoLogo(symbol) {
  const logo = CRYPTO_LOGOS[symbol];
  const text = symbol.slice(0, 3);
  return logo
    ? `<i class="stock-logo-frame crypto-logo-frame"><img src="${logo}" alt="${symbol}" loading="lazy" /></i>`
    : `<i class="stock-logo-frame stock-logo-text crypto-logo-frame"><b>${text}</b></i>`;
}


export function showToast(message, variant = "info") {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.toggle("negative", variant === "error");
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}


export function smoothTextUpdate(selector, newText) {
  const el = document.querySelector(selector);
  if (!el || el.textContent === newText) return;
  el.style.transition = "opacity 180ms ease";
  el.style.opacity = "0.4";
  requestAnimationFrame(() => {
    el.textContent = newText;
    requestAnimationFrame(() => { el.style.opacity = "1"; });
  });
}
