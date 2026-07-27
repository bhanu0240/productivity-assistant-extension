/**
 * Background Service Worker for Productivity Assistant
 * Handles timers, notifications, site tracking, and focus mode enforcement
 */

import {
  getSettings,
  saveSettings,
  addTimer,
  removeTimer,
  getActiveTimers,
  isRestrictedDomain,
  getFocusMode,
  getRestrictedSites,
  recordSiteUsage,
  extractDomain,
  getAISettings,
} from "../utils/storage";
import { generateMotivationalMessage } from "../utils/aiHelper";
import { TimerConfig } from "../types/index";

interface ActiveTimer {
  timerId: string;
  alarmName: string;
}

const ACTIVE_TIMERS: Map<string, ActiveTimer> = new Map();
const SITE_TRACKER: Map<string, { domain: string; startTime: number }> = new Map();

/**
 * Initialize service worker
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log("Productivity Assistant installed");
  initializeExtension();
});

async function initializeExtension() {
  const settings = await getSettings();
  console.log("Extension initialized with settings:", settings);
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.type) {
        case "START_TIMER":
          await handleStartTimer(request.payload, sendResponse);
          break;
        case "STOP_TIMER":
          await handleStopTimer(request.payload, sendResponse);
          break;
        case "GET_TIMERS":
          const timers = await getActiveTimers();
          sendResponse({ success: true, data: timers });
          break;
        case "TOGGLE_FOCUS_MODE":
          await handleFocusMode(request.payload, sendResponse);
          break;
        case "GET_FOCUS_MODE":
          const focusMode = await getFocusMode();
          sendResponse({ success: true, data: focusMode });
          break;
        case "ADD_RESTRICTED_SITE":
          await handleAddRestrictedSite(request.payload, sendResponse);
          break;
        case "GET_RESTRICTED_SITES":
          const sites = await getRestrictedSites();
          sendResponse({ success: true, data: sites });
          break;
        case "RECORD_USAGE":
          await recordSiteUsage(request.payload.domain, request.payload.duration);
          sendResponse({ success: true });
          break;
        case "PAGE_LOADED":
          await handlePageLoaded(sender.tab?.url, sender.tab?.id);
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  })();

  return true; // Keep the message channel open for async response
});

/**
 * Start a break timer
 */
async function handleStartTimer(
  payload: {
    duration: number;
    message?: string;
    context?: string;
  },
  sendResponse: (response: any) => void
) {
  const timerId = `timer_${Date.now()}`;
  const alarmName = `timer_${timerId}`;

  // Create timer config
  const timerConfig: TimerConfig = {
    id: timerId,
    duration: payload.duration,
    message: payload.message || "",
    isAIGenerated: false,
    context: payload.context,
    createdAt: Date.now(),
  };

  // If no message provided, generate one with AI
  if (!payload.message) {
    const aiSettings = await getAISettings();
    if (aiSettings.enabled) {
      const hoursSpent = await getHoursSpent();
      const aiResponse = await generateMotivationalMessage(
        {
          hoursSpent,
          currentTask: payload.context,
          timeOfDay: getTimeOfDay(),
        },
        aiSettings
      );

      if (aiResponse.success && aiResponse.message) {
        timerConfig.message = aiResponse.message;
        timerConfig.isAIGenerated = true;
      }
    }
  }

  // Save timer
  await addTimer(timerConfig);

  // Set alarm
  chrome.alarms.create(alarmName, { delayInMinutes: payload.duration });

  // Track active timer
  ACTIVE_TIMERS.set(timerId, { timerId, alarmName });

  sendResponse({
    success: true,
    timerId,
    message: timerConfig.message,
  });
}

/**
 * Stop a timer
 */
async function handleStopTimer(payload: { timerId: string }, sendResponse: (response: any) => void) {
  const activeTimer = ACTIVE_TIMERS.get(payload.timerId);
  if (activeTimer) {
    chrome.alarms.clear(activeTimer.alarmName);
    ACTIVE_TIMERS.delete(payload.timerId);
  }

  await removeTimer(payload.timerId);
  sendResponse({ success: true });
}

/**
 * Handle focus mode toggle
 */
async function handleFocusMode(
  payload: {
    enabled: boolean;
    focusSite?: string;
    duration?: number;
  },
  sendResponse: (response: any) => void
) {
  if (payload.enabled && payload.focusSite) {
    const domain = extractDomain(payload.focusSite);
    const settings = await getSettings();
    settings.focusMode = {
      enabled: true,
      focusSite: payload.focusSite,
      focusDomain: domain,
      startTime: Date.now(),
      duration: payload.duration || 25,
      allowedSites: [domain],
    };
    await saveSettings(settings);

    // Notify content scripts about focus mode
    broadcastToAllTabs({
      type: "ENABLE_FOCUS_MODE",
      payload: settings.focusMode,
    });
  } else {
    const settings = await getSettings();
    settings.focusMode.enabled = false;
    await saveSettings(settings);

    // Notify content scripts
    broadcastToAllTabs({
      type: "DISABLE_FOCUS_MODE",
    });
  }

  sendResponse({ success: true });
}

/**
 * Handle adding restricted site
 */
async function handleAddRestrictedSite(
  payload: { url: string; reason?: string },
  sendResponse: (response: any) => void
) {
  const domain = extractDomain(payload.url);
  const settings = await getSettings();

  if (!settings.restrictedSites.find((s) => s.domain === domain)) {
    settings.restrictedSites.push({
      url: payload.url,
      domain,
      addedAt: Date.now(),
      reason: payload.reason,
    });
    await saveSettings(settings);
  }

  sendResponse({ success: true });
}

/**
 * Handle page load - check for restrictions and focus mode
 */
async function handlePageLoaded(pageUrl: string | undefined, tabId: number | undefined) {
  if (!pageUrl || !tabId) return;

  const domain = extractDomain(pageUrl);
  const focusMode = await getFocusMode();
  const restrictedSites = await getRestrictedSites();

  // Check if site is restricted
  if (restrictedSites.some((site) => site.domain === domain)) {
    chrome.tabs.sendMessage(tabId, {
      type: "SHOW_OVERLAY",
      payload: {
        message: `This site is restricted. You blocked this domain to improve productivity.`,
        actionType: "blocked",
      },
    });
  }

  const isAllowedInFocusMode = focusMode.enabled && (
    domain === focusMode.focusDomain ||
    focusMode.allowedSites.includes(domain) ||
    focusMode.allowedSites.includes(focusMode.focusDomain)
  );

  // Check if focus mode is active and site is not allowed
  if (focusMode.enabled && !isAllowedInFocusMode) {
    chrome.tabs.sendMessage(tabId, {
      type: "SHOW_OVERLAY",
      payload: {
        message: `Focus mode is active. You're focusing on ${focusMode.focusDomain}. Return to your focus site?`,
        actionType: "focusMode",
        focusSite: focusMode.focusSite,
      },
    });
  }
}

/**
 * Handle alarms (timer completion)
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const timerId = alarm.name.replace("timer_", "");
  const activeTimer = ACTIVE_TIMERS.get(timerId);

  if (activeTimer) {
    const timers = await getActiveTimers();
    const timer = timers.find((t) => t.id === timerId);

    if (timer) {
      const breakMessage = timer.message || "Time for a break! Step away and recharge.";

      // Show notification
      chrome.notifications.create(`break_${timerId}`, {
        type: "basic",
        iconUrl: "public/icons/icon-128.png",
        title: "Break Time!",
        message: breakMessage,
      });

      // Show a modal in the current active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, {
          type: "SHOW_OVERLAY",
          payload: {
            message: breakMessage,
            actionType: "timer",
          },
        }).catch(() => {
          // Ignore if the tab does not have the content script loaded
        });
      }

      // Broadcast to all tabs
      broadcastToAllTabs({
        type: "TIMER_COMPLETED",
        payload: { timerId, message: breakMessage },
      });
    }

    ACTIVE_TIMERS.delete(timerId);
  }
});

/**
 * Track visited sites
 */
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId === 0) {
    // Only track main frames
    const domain = extractDomain(details.url);
    SITE_TRACKER.set(`tab_${details.tabId}`, {
      domain,
      startTime: Date.now(),
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Content script will handle page loaded event
  }
});

/**
 * Track time spent on sites when tab changes
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Record previous tab's usage
  const key = `tab_${activeInfo.tabId}`;
  const tracker = SITE_TRACKER.get(key);

  if (tracker) {
    const duration = Date.now() - tracker.startTime;
    if (duration > 1000) {
      // Only record if more than 1 second
      await recordSiteUsage(tracker.domain, duration);
    }
  }

  // Start tracking new tab
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    const domain = extractDomain(tab.url);
    SITE_TRACKER.set(key, {
      domain,
      startTime: Date.now(),
    });
  }
});

/**
 * Utilities
 */

function broadcastToAllTabs(message: any) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab might not have content script loaded
        });
      }
    });
  });
}

async function getHoursSpent(): Promise<number> {
  const settings = await getSettings();
  const totalTime = Object.values(settings.usageStats).reduce((sum: number, site: any) => {
    return sum + (site.totalTime || 0);
  }, 0);
  return totalTime / (1000 * 60 * 60); // Convert ms to hours
}

function getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}
