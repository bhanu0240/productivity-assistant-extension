/**
 * Content Script for Productivity Assistant
 * Injected into all web pages to enforce restrictions and display overlays
 */

import { ContentScriptMessage } from "../types/index";

// Track current overlay
let currentOverlay: HTMLElement | null = null;
let focusModeActive = false;

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

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleMessage);

  // Track time on page
  trackPageTime();
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
      case "ENABLE_FOCUS_MODE":
        focusModeActive = true;
        handleFocusModeNavigation(request.payload);
        sendResponse({ success: true });
        break;
      case "DISABLE_FOCUS_MODE":
        focusModeActive = false;
        hideOverlay();
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
  container.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 40px;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;

  const title = document.createElement("h2");
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
  overlay.appendChild(container);

  document.documentElement.appendChild(overlay);
  currentOverlay = overlay;
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
 * Handle focus mode - prevent navigation away
 */
function handleFocusModeNavigation(focusMode: any) {
  // Prevent link clicks to non-allowed sites
  document.addEventListener(
    "click",
    (event: Event) => {
      if (!focusModeActive) return;

      const target = event.target as HTMLElement;
      const link = target.closest("a");

      if (link && link.href) {
        const linkDomain = extractDomain(link.href);
        if (!focusMode.allowedSites.includes(linkDomain)) {
          event.preventDefault();
          event.stopPropagation();

          showOverlay({
            message: `Focus mode is active. Stick to ${focusMode.focusDomain} to maintain deep work.`,
            actionType: "focusMode",
            focusSite: focusMode.focusSite,
          });

          return false;
        }
      }
    },
    true
  );
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
