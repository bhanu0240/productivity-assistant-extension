/**
 * Content Script for Productivity Assistant
 * Injected into all web pages to enforce restrictions and display overlays
 */

import { ContentScriptMessage } from "../types/index";

// Track current overlay / toast
let currentOverlay: HTMLElement | null = null;
let currentToast: HTMLElement | null = null;
let toastTimeout: number | undefined;
let currentLeavePrompt: HTMLElement | null = null;
let leavePromptTicker: number | undefined;

// Focus session state, mirrored from storage so link clicks can be checked synchronously.
let focusState: { endsAt: number; allowedSites: string[] } | null = null;

/**
 * Initialize content script
 */
function initContentScript() {
  console.log("Productivity Assistant content script loaded");

  // Notify background script that page is loaded
  chrome.runtime.sendMessage({
    type: "PAGE_LOADED",
    payload: { url: window.location.href },
  });

  // Pages restored from the back/forward cache skip the network (and the block rule) — re-check them
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) chrome.runtime.sendMessage({ type: "PAGE_LOADED", payload: { url: window.location.href } });
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleMessage);

  // Track time on page
  trackPageTime();

  // Focus mode: ask before following links off the focus site, and show any pending prompt
  watchFocusState();
  window.addEventListener("click", interceptFocusLinkClick, true);
  chrome.runtime.sendMessage({ type: "GET_LEAVE_PROMPT" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.data) showLeavePrompt(response.data);
  });
}

/**
 * Handle messages from background script
 */
function handleMessage(request: ContentScriptMessage, sender: any, sendResponse: (response: any) => void) {
  try {
    switch (request.type) {
      case "SHOW_OVERLAY":
        showOverlay(request.payload);
        sendResponse({ success: true });
        break;
      case "HIDE_OVERLAY":
        hideOverlay();
        sendResponse({ success: true });
        break;
      case "FOCUS_LEAVE_PROMPT":
        showLeavePrompt(request.payload);
        sendResponse({ success: true });
        break;
      case "FOCUS_LEAVE_PROMPT_CLOSE":
        hideLeavePrompt();
        sendResponse({ success: true });
        break;
      case "FOCUS_TOAST":
        showToast(request.payload?.message || "");
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false });
    }
  } catch (error) {
    console.error("Error in content script:", error);
    sendResponse({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
}

/**
 * Show overlay on page
 */
function showOverlay(payload: { message: string; actionType: string; focusSite?: string }) {
  if (currentOverlay) {
    removeOverlay();
  }

  const overlay = document.createElement("div");
  overlay.id = "productivity-assistant-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  `;

  const container = document.createElement("div");
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "true");
  container.setAttribute("aria-labelledby", "productivity-assistant-overlay-title");
  container.setAttribute("aria-describedby", "productivity-assistant-overlay-message");
  container.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 32px;
    width: min(500px, calc(100vw - 32px));
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;

  const title = document.createElement("h2");
  title.id = "productivity-assistant-overlay-title";
  const titleText =
    payload.actionType === "focusMode"
      ? "🎯 Focus Mode Active"
      : payload.actionType === "timer"
      ? "☕ Break Time!"
      : "⛔ Site Restricted";
  title.textContent = titleText;
  title.style.cssText = `
    margin: 0 0 15px 0;
    font-size: 24px;
    color: #333;
  `;

  const message = document.createElement("p");
  message.id = "productivity-assistant-overlay-message";
  message.textContent = payload.message;
  message.style.cssText = `
    margin: 0 0 30px 0;
    font-size: 16px;
    color: #666;
    line-height: 1.6;
  `;

  const buttonsContainer = document.createElement("div");
  buttonsContainer.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: center;
  `;

  if (payload.actionType === "focusMode" && payload.focusSite) {
    const returnBtn = document.createElement("button");
    returnBtn.textContent = "Return to Focus Site";
    returnBtn.style.cssText = `
      flex: 1;
      padding: 12px 24px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    `;
    returnBtn.onmouseover = () => (returnBtn.style.background = "#45a049");
    returnBtn.onmouseout = () => (returnBtn.style.background = "#4CAF50");
    returnBtn.onclick = () => {
      if (payload.focusSite) {
        window.location.href = payload.focusSite;
      }
    };
    buttonsContainer.appendChild(returnBtn);
  }

  const dismissBtn = document.createElement("button");
  dismissBtn.textContent = "Dismiss";
  dismissBtn.style.cssText = `
    flex: 1;
    padding: 12px 24px;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  `;
  dismissBtn.onmouseover = () => (dismissBtn.style.background = "#da190b");
  dismissBtn.onmouseout = () => (dismissBtn.style.background = "#f44336");
  dismissBtn.onclick = hideOverlay;
  buttonsContainer.appendChild(dismissBtn);

  container.appendChild(title);
  container.appendChild(message);
  container.appendChild(buttonsContainer);
  container.onclick = (event) => event.stopPropagation();
  overlay.onclick = (event) => {
    if (event.target === overlay) hideOverlay();
  };
  overlay.onkeydown = (event) => {
    if (event.key === "Escape") hideOverlay();
  };
  overlay.appendChild(container);

  document.documentElement.appendChild(overlay);
  currentOverlay = overlay;
  dismissBtn.focus();
}

/**
 * Hide overlay
 */
function hideOverlay() {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
}

/**
 * Remove overlay (alias for hideOverlay)
 */
function removeOverlay() {
  hideOverlay();
}

/**
 * Small, non-blocking toast used by focus mode (e.g. "Stay focused — 12:30 left").
 * Focus enforcement itself happens in the background script via the tabs API.
 */
function showToast(text: string) {
  if (!text) return;
  if (!currentToast) {
    currentToast = document.createElement("div");
    currentToast.id = "productivity-assistant-toast";
    currentToast.setAttribute("role", "status");
    currentToast.setAttribute("aria-live", "polite");
    currentToast.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%) translateY(20px);
      max-width: min(480px, calc(100vw - 32px));
      padding: 12px 18px;
      background: #1f2937;
      color: #fff;
      border-left: 4px solid #4CAF50;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      font: 500 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.2s ease;
      pointer-events: none;
    `;
    document.documentElement.appendChild(currentToast);
  }

  const toast = currentToast;
  toast.textContent = text;
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });

  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
  }, 4000);
}

/* ------------------------------------------------------------------ */
/* Focus mode: "leave focus?" confirmation                             */
/* ------------------------------------------------------------------ */

function watchFocusState() {
  const apply = (settings: any) => {
    const f = settings?.focusMode;
    focusState = f?.enabled ? { endsAt: f.endsAt, allowedSites: f.allowedSites || [] } : null;
  };
  chrome.storage.local.get("settings", (result) => apply(result.settings));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) apply(changes.settings.newValue);
  });
}

function isHostAllowed(hostname: string, allowedSites: string[]): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return allowedSites.some((site) => {
    const allowed = site.toLowerCase().replace(/^www\./, "");
    return host === allowed || host.endsWith("." + allowed);
  });
}

/** Stop same-tab links to other sites and ask first (new-tab links are handled by the background). */
function interceptFocusLinkClick(event: MouseEvent) {
  if (!focusState || focusState.endsAt <= Date.now()) return;
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return;
  }

  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.hasAttribute("download")) return;
  const target = (anchor.getAttribute("target") || "").toLowerCase();
  if (target && target !== "_self" && target !== "_top" && target !== "_parent") return;

  let url: URL;
  try {
    url = new URL(anchor.href, location.href);
  } catch {
    return;
  }
  if (!/^https?:$/.test(url.protocol)) return;
  if (!isHostAllowed(location.hostname, focusState.allowedSites)) return; // not on the focus site
  if (isHostAllowed(url.hostname, focusState.allowedSites)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  chrome.runtime.sendMessage({ type: "FOCUS_NAVIGATE_ATTEMPT", payload: { url: url.href } }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.success && !response.prompted) location.href = url.href; // not the locked tab after all
  });
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function hideLeavePrompt() {
  window.clearInterval(leavePromptTicker);
  leavePromptTicker = undefined;
  currentLeavePrompt?.remove();
  currentLeavePrompt = null;
}

function respondToLeavePrompt(leave: boolean) {
  hideLeavePrompt();
  chrome.runtime.sendMessage({ type: "FOCUS_LEAVE_RESPONSE", payload: { leave } });
}

function showLeavePrompt(payload: { targetLabel: string; targetKind: string; endsAt: number; focusDomain: string }) {
  hideLeavePrompt();

  const overlay = document.createElement("div");
  overlay.id = "productivity-assistant-leave-prompt";
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
    display: flex; align-items: center; justify-content: center;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  `;

  const box = document.createElement("div");
  box.setAttribute("role", "alertdialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-labelledby", "pa-leave-title");
  box.setAttribute("aria-describedby", "pa-leave-message");
  box.style.cssText = `
    background: #fff; color: #1f2937; border-radius: 12px; padding: 28px;
    width: min(440px, calc(100vw - 32px)); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center; border-top: 5px solid #4CAF50; box-sizing: border-box;
  `;

  const title = document.createElement("h2");
  title.id = "pa-leave-title";
  title.textContent = payload.targetKind === "close" ? "🎯 Close your focus tab?" : "🎯 Leave your focus session?";
  title.style.cssText = "margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #1f2937;";

  const timeLeft = document.createElement("p");
  timeLeft.style.cssText =
    "margin: 0 0 12px; font-size: 32px; font-weight: 700; color: #2e7d32; font-variant-numeric: tabular-nums;";
  const tick = () => {
    const remaining = payload.endsAt - Date.now();
    timeLeft.textContent = `${formatRemaining(remaining)} left`;
    if (remaining <= 0) hideLeavePrompt(); // session is over; the background unlocks everything
  };
  tick();

  const destination =
    payload.targetKind === "close"
      ? "Closing this tab"
      : payload.targetKind === "newtab"
      ? "Opening a new tab"
      : payload.targetKind === "tab"
      ? `Switching to “${payload.targetLabel}”`
      : `Going to ${payload.targetLabel}`;
  const message = document.createElement("p");
  message.id = "pa-leave-message";
  message.textContent = `You're focusing on ${payload.focusDomain}. ${destination} will end this focus session.`;
  message.style.cssText = "margin: 0 0 24px; font-size: 15px; color: #4b5563; line-height: 1.5; word-break: break-word;";

  const buttons = document.createElement("div");
  buttons.style.cssText = "display: flex; gap: 12px; flex-wrap: wrap;";
  const makeButton = (label: string, primary: boolean) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.cssText = `
      flex: 1 1 160px; padding: 12px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;
      ${primary ? "background: #4CAF50; color: #fff; border: 1px solid #4CAF50;" : "background: #fff; color: #d32f2f; border: 1px solid #f44336;"}
    `;
    return btn;
  };
  const stayBtn = makeButton("Stay focused", true);
  const leaveBtn = makeButton(payload.targetKind === "close" ? "End session & close" : "End session & leave", false);
  stayBtn.onclick = () => respondToLeavePrompt(false);
  leaveBtn.onclick = () => respondToLeavePrompt(true);
  buttons.append(stayBtn, leaveBtn);

  box.append(title, timeLeft, message, buttons);
  overlay.appendChild(box);
  overlay.addEventListener("keydown", (event) => {
    event.stopPropagation(); // keep page shortcuts from firing behind the dialog
    if (event.key === "Escape") respondToLeavePrompt(false);
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) respondToLeavePrompt(false); // backdrop click = stay
  });

  (document.body || document.documentElement).appendChild(overlay);
  currentLeavePrompt = overlay;
  leavePromptTicker = window.setInterval(tick, 1000);
  stayBtn.focus();
}

/**
 * Track time spent on page
 */
function trackPageTime() {
  const startTime = Date.now();

  window.addEventListener("beforeunload", () => {
    const duration = Date.now() - startTime;
    const domain = extractDomain(window.location.href);

    chrome.runtime.sendMessage({
      type: "RECORD_USAGE",
      payload: { domain, duration },
    });
  });
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initContentScript);
} else {
  initContentScript();
}
