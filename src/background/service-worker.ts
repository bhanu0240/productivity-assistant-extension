/**
 * Background Service Worker for Productivity Assistant
 * Handles timers, notifications, site tracking, and focus mode enforcement.
 *
 * NOTE: MV3 service workers are terminated when idle, so NO state may live in
 * module-level variables. Everything that must survive is kept in
 * chrome.storage + chrome.alarms (alarm names encode the timer id).
 */

import {
  getSettings,
  saveSettings,
  addTimer,
  removeTimer,
  getActiveTimers,
  getFocusMode,
  getRestrictedSites,
  recordSiteUsage,
  extractDomain,
  getAISettings,
} from "../utils/storage";
import { generateMotivationalMessage } from "../utils/aiHelper";
import { FocusModeConfig, TimerConfig } from "../types/index";

const TIMER_ALARM_PREFIX = "breaktimer:";
const FOCUS_END_ALARM = "focus:end";
const FOCUS_TICK_ALARM = "focus:tick";
const MIN_DURATION_SECONDS = 30; // Chrome's minimum alarm delay for packed extensions
const MAX_DURATION_SECONDS = 12 * 3600;

const SITE_TRACKER: Map<string, { domain: string; startTime: number }> = new Map();

/**
 * Initialize service worker
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Productivity Assistant installed");
  await cleanupLegacyAlarms();
  await syncFocusAfterRestart();
});

chrome.runtime.onStartup.addListener(() => {
  syncFocusAfterRestart();
});

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.type) {
        case "START_TIMER":
          sendResponse(await handleStartTimer(request.payload));
          break;
        case "STOP_TIMER":
          await handleStopTimer(request.payload.timerId);
          sendResponse({ success: true });
          break;
        case "PAUSE_TIMER":
          await handlePauseTimer(request.payload.timerId);
          sendResponse({ success: true });
          break;
        case "RESUME_TIMER":
          await handleResumeTimer(request.payload.timerId);
          sendResponse({ success: true });
          break;
        case "GET_TIMERS":
          sendResponse({ success: true, data: await getActiveTimers() });
          break;
        case "START_FOCUS":
          await startFocusSession(request.payload);
          sendResponse({ success: true });
          break;
        case "END_FOCUS":
          await endFocusSession(false);
          sendResponse({ success: true });
          break;
        case "FOCUS_NAVIGATE_ATTEMPT":
          sendResponse({ success: true, prompted: await handleNavigateAttempt(request.payload, sender) });
          break;
        case "GET_LEAVE_PROMPT":
          sendResponse({ success: true, data: await getLeavePromptFor(sender) });
          break;
        case "FOCUS_LEAVE_RESPONSE":
          await handleLeaveResponse(!!request.payload?.leave);
          sendResponse({ success: true });
          break;
        case "GET_FOCUS_MODE":
          sendResponse({ success: true, data: await getFocusMode() });
          break;
        case "ADD_RESTRICTED_SITE":
          await handleAddRestrictedSite(request.payload);
          sendResponse({ success: true });
          break;
        case "GET_RESTRICTED_SITES":
          sendResponse({ success: true, data: await getRestrictedSites() });
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

/* ------------------------------------------------------------------ */
/* Break timer                                                         */
/* ------------------------------------------------------------------ */

function clampDuration(seconds: unknown): number {
  const n = Math.round(Number(seconds));
  if (!Number.isFinite(n) || n < MIN_DURATION_SECONDS) {
    throw new Error(`Duration must be at least ${MIN_DURATION_SECONDS} seconds.`);
  }
  return Math.min(n, MAX_DURATION_SECONDS);
}

async function handleStartTimer(payload: {
  durationSeconds: number;
  message?: string;
  context?: string;
  tabId?: number;
}) {
  const durationSeconds = clampDuration(payload.durationSeconds);
  const timerId = `timer_${Date.now()}`;
  const now = Date.now();

  const timerConfig: TimerConfig = {
    id: timerId,
    duration: Math.ceil(durationSeconds / 60),
    durationSeconds,
    endsAt: now + durationSeconds * 1000,
    message: (payload.message || "").trim(),
    isAIGenerated: false,
    context: payload.context,
    tabId: payload.tabId,
    createdAt: now,
  };

  // If no message provided, try to generate one with AI
  if (!timerConfig.message) {
    const aiSettings = await getAISettings();
    if (aiSettings.enabled) {
      const aiResponse = await generateMotivationalMessage(
        { hoursSpent: await getHoursSpent(), currentTask: payload.context, timeOfDay: getTimeOfDay() },
        aiSettings
      );
      if (aiResponse.success && aiResponse.message) {
        timerConfig.message = aiResponse.message;
        timerConfig.isAIGenerated = true;
      }
    }
    // AI generation can take a few seconds; start counting from now.
    timerConfig.endsAt = Date.now() + durationSeconds * 1000;
  }

  await addTimer(timerConfig);
  await chrome.alarms.create(TIMER_ALARM_PREFIX + timerId, { when: timerConfig.endsAt });

  return { success: true, timerId, message: timerConfig.message };
}

async function handleStopTimer(timerId: string) {
  await chrome.alarms.clear(TIMER_ALARM_PREFIX + timerId);
  await removeTimer(timerId);
}

async function updateTimer(timerId: string, update: (t: TimerConfig) => void) {
  const settings = await getSettings();
  const timer = settings.timers.find((t) => t.id === timerId);
  if (!timer) throw new Error("Timer not found");
  update(timer);
  await saveSettings(settings);
  return timer;
}

async function handlePauseTimer(timerId: string) {
  await chrome.alarms.clear(TIMER_ALARM_PREFIX + timerId);
  await updateTimer(timerId, (t) => {
    if (t.pausedRemainingMs === undefined) {
      t.pausedRemainingMs = Math.max(0, t.endsAt - Date.now());
    }
  });
}

async function handleResumeTimer(timerId: string) {
  const timer = await updateTimer(timerId, (t) => {
    if (t.pausedRemainingMs !== undefined) {
      // Respect Chrome's alarm minimum so the alarm fires when the clock says it will.
      t.endsAt = Date.now() + Math.max(t.pausedRemainingMs, MIN_DURATION_SECONDS * 1000);
      delete t.pausedRemainingMs;
    }
  });
  await chrome.alarms.create(TIMER_ALARM_PREFIX + timerId, { when: timer.endsAt });
}

async function completeTimer(timerId: string) {
  const timers = await getActiveTimers();
  const timer = timers.find((t) => t.id === timerId);
  if (!timer || timer.pausedRemainingMs !== undefined) return;

  await removeTimer(timerId);

  const breakMessage = timer.message || "Time for a break! Step away and recharge.";

  chrome.notifications.create(`break_${timerId}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("public/icons/icon-128.png"),
    title: "Break Time!",
    message: breakMessage,
    priority: 2,
    requireInteraction: true,
  });

  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab?.id) {
    chrome.tabs
      .sendMessage(activeTab.id, { type: "SHOW_OVERLAY", payload: { message: breakMessage, actionType: "timer" } })
      .catch(() => {
        /* Tab has no content script (e.g. chrome:// pages) — the notification still shows */
      });
  }
}

/* ------------------------------------------------------------------ */
/* Focus mode: lock the user to one tab until the timer completes     */
/* ------------------------------------------------------------------ */

/** Strip a leading "www." so example.com and www.example.com are treated alike. */
function baseDomain(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isUrlAllowedInFocus(url: string | undefined, focus: FocusModeConfig): boolean {
  if (!url) return true;
  if (!/^https?:/i.test(url)) return false;
  const host = baseDomain(extractDomain(url));
  return focus.allowedSites.some((site) => {
    const allowed = baseDomain(site);
    return host === allowed || host.endsWith("." + allowed);
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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(" ") || "0s";
}

/**
 * Returns the focus config if a session is running. Sessions whose end time has
 * passed (e.g. the alarm fired while the browser was closed) are ended here.
 */
async function getActiveFocus(): Promise<FocusModeConfig | null> {
  const focus = await getFocusMode();
  if (!focus.enabled) return null;
  if (!focus.endsAt || Date.now() >= focus.endsAt) {
    await endFocusSession(true);
    return null;
  }
  return focus;
}

async function startFocusSession(payload: { tabId: number; durationSeconds: number }) {
  const durationSeconds = clampDuration(payload.durationSeconds);
  const tab = await chrome.tabs.get(payload.tabId);
  if (!tab.url || !/^https?:/i.test(tab.url)) {
    throw new Error("Focus mode works on regular web pages. Open the page you want to focus on, then try again.");
  }

  const domain = baseDomain(extractDomain(tab.url));
  const now = Date.now();
  const settings = await getSettings();
  settings.focusMode = {
    enabled: true,
    focusSite: tab.url,
    focusDomain: domain,
    startTime: now,
    duration: Math.ceil(durationSeconds / 60),
    durationSeconds,
    endsAt: now + durationSeconds * 1000,
    tabId: tab.id,
    windowId: tab.windowId,
    tabTitle: tab.title || domain,
    allowedSites: [domain],
  };
  await saveSettings(settings);

  await chrome.alarms.create(FOCUS_END_ALARM, { when: settings.focusMode.endsAt });
  await chrome.alarms.create(FOCUS_TICK_ALARM, { periodInMinutes: 0.5 });
  await updateFocusBadge(settings.focusMode);

  sendToast(tab.id!, `Focus session started — this tab is locked for ${formatDuration(durationSeconds)}.`);
}

let endingPromise: Promise<void> | null = null;

function endFocusSession(completed: boolean): Promise<void> {
  if (!endingPromise) {
    endingPromise = doEndFocusSession(completed).finally(() => {
      endingPromise = null;
    });
  }
  return endingPromise;
}

async function doEndFocusSession(completed: boolean) {
  const settings = await getSettings();
  const focus = settings.focusMode;
  const wasEnabled = focus.enabled;

  focus.enabled = false;
  focus.endsAt = 0;
  await saveSettings(settings);

  await chrome.alarms.clear(FOCUS_END_ALARM);
  await chrome.alarms.clear(FOCUS_TICK_ALARM);
  await chrome.action.setBadgeText({ text: "" });
  await chrome.storage.session.remove(LEAVE_PROMPT_KEY);

  if (!wasEnabled) return;
  if (focus.tabId !== undefined) {
    chrome.tabs.sendMessage(focus.tabId, { type: "FOCUS_LEAVE_PROMPT_CLOSE" }).catch(() => {});
  }

  if (completed) {
    chrome.notifications.create(`focus_done_${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("public/icons/icon-128.png"),
      title: "Focus session complete 🎉",
      message: `You stayed focused for ${formatDuration(focus.durationSeconds)}. Other tabs are unlocked.`,
      priority: 2,
    });
  }
  if (focus.tabId !== undefined) {
    sendToast(focus.tabId, completed ? "Focus session complete — tabs are unlocked. 🎉" : "Focus session ended early.");
  }
}

async function updateFocusBadge(focus?: FocusModeConfig | null) {
  const active = focus ?? (await getActiveFocus());
  if (!active) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  const remainingMin = Math.ceil((active.endsAt - Date.now()) / 60000);
  const text = remainingMin >= 60 ? `${Math.floor(remainingMin / 60)}h` : `${remainingMin}m`;
  await chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  await chrome.action.setBadgeText({ text });
}

function sendToast(tabId: number, message: string) {
  chrome.tabs.sendMessage(tabId, { type: "FOCUS_TOAST", payload: { message } }).catch(() => {
    /* content script not ready yet */
  });
}

/** Chrome rejects tab edits while the user is dragging a tab; retry briefly. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T | undefined> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) {
        console.warn("Focus mode: giving up after retries", error);
        return undefined;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

// Ignore tab-created events for the tab we open ourselves when restoring the focus tab.
let restoringFocusTabUntil = 0;
let restorePromise: Promise<chrome.tabs.Tab | undefined> | null = null;

/** Make sure the locked tab still exists; reopen it if the user closed it. */
async function ensureFocusTab(focus: FocusModeConfig): Promise<chrome.tabs.Tab | undefined> {
  if (focus.tabId !== undefined) {
    try {
      return await chrome.tabs.get(focus.tabId);
    } catch {
      /* tab is gone — recreate below */
    }
  }

  if (!restorePromise) {
    restorePromise = (async () => {
      restoringFocusTabUntil = Date.now() + 2000;
      let tab: chrome.tabs.Tab | undefined;
      try {
        tab = await chrome.tabs.create({ url: focus.focusSite, active: true, windowId: focus.windowId });
      } catch {
        const win = await chrome.windows.create({ url: focus.focusSite, focused: true });
        tab = win?.tabs?.[0];
      }
      if (tab?.id !== undefined) {
        const settings = await getSettings();
        settings.focusMode.tabId = tab.id;
        settings.focusMode.windowId = tab.windowId;
        await saveSettings(settings);
      }
      return tab;
    })().finally(() => {
      restorePromise = null;
    });
  }
  return restorePromise;
}

async function returnToFocusTab(focus: FocusModeConfig, toast = true): Promise<chrome.tabs.Tab | undefined> {
  const tab = await ensureFocusTab(focus);
  if (tab?.id === undefined) return undefined;
  await withRetry(() => chrome.tabs.update(tab.id!, { active: true }));
  await withRetry(() => chrome.windows.update(tab.windowId, { focused: true }));
  if (toast) {
    sendToast(
      tab.id,
      `🎯 Stay focused — ${formatRemaining(focus.endsAt - Date.now())} left. Other tabs unlock when the timer completes.`
    );
  }
  return tab;
}

/* ---------------------- "Leave focus?" confirmation ---------------------- */

/** Where the user was trying to go when focus mode stopped them. */
type LeaveTarget =
  | { kind: "url"; url: string; newTab?: boolean }
  | { kind: "tab"; tabId: number; windowId: number; label: string }
  | { kind: "newtab" }
  | { kind: "close" };

const LEAVE_PROMPT_KEY = "focusLeavePrompt";

function leaveTargetLabel(target: LeaveTarget): string {
  switch (target.kind) {
    case "url":
      return /^https?:/i.test(target.url) ? baseDomain(extractDomain(target.url)) : target.url;
    case "tab":
      return target.label;
    case "newtab":
      return "a new tab";
    case "close":
      return "close this tab";
  }
}

function leavePromptPayload(target: LeaveTarget, focus: FocusModeConfig) {
  return {
    targetLabel: leaveTargetLabel(target),
    targetKind: target.kind,
    endsAt: focus.endsAt,
    focusDomain: focus.focusDomain,
  };
}

/**
 * Keep the user on the focus tab and ask whether they really want to leave.
 * The pending target is stored so the prompt survives a page load in the focus tab.
 * `deliverNow: false` is used when the focus tab is mid-navigation — its content
 * script asks for the prompt (GET_LEAVE_PROMPT) once the focus page has loaded.
 */
async function promptLeave(focus: FocusModeConfig, target: LeaveTarget, deliverNow = true) {
  await chrome.storage.session.set({ [LEAVE_PROMPT_KEY]: target });
  const tab = await returnToFocusTab(focus, false);
  if (!deliverNow || tab?.id === undefined) return;
  chrome.tabs
    .sendMessage(tab.id, { type: "FOCUS_LEAVE_PROMPT", payload: leavePromptPayload(target, focus) })
    .catch(() => {
      /* content script not ready — it will ask for the prompt when it loads */
    });
}

async function getPendingLeave(): Promise<LeaveTarget | undefined> {
  const result = await chrome.storage.session.get(LEAVE_PROMPT_KEY);
  return result[LEAVE_PROMPT_KEY];
}

async function getLeavePromptFor(sender: chrome.runtime.MessageSender) {
  const focus = await getActiveFocus();
  if (!focus || sender.tab?.id !== focus.tabId || !isUrlAllowedInFocus(sender.tab?.url, focus)) return null;
  const target = await getPendingLeave();
  return target ? leavePromptPayload(target, focus) : null;
}

/** A link click inside the focus tab, caught by the content script before it navigates. */
async function handleNavigateAttempt(
  payload: { url: string; newTab?: boolean },
  sender: chrome.runtime.MessageSender
): Promise<boolean> {
  const focus = await getActiveFocus();
  if (!focus || sender.tab?.id !== focus.tabId) return false;
  if (isUrlAllowedInFocus(payload.url, focus) && !payload.newTab) return false;
  await promptLeave(focus, { kind: "url", url: payload.url, newTab: payload.newTab });
  return true;
}

async function handleLeaveResponse(leave: boolean) {
  const target = await getPendingLeave();
  await chrome.storage.session.remove(LEAVE_PROMPT_KEY);
  if (!leave || !target) return;

  const focus = await getFocusMode();
  const focusTabId = focus.tabId;
  await endFocusSession(false);

  try {
    switch (target.kind) {
      case "url":
        if (target.newTab || focusTabId === undefined) {
          await chrome.tabs.create({ url: target.url, active: true });
        } else {
          await chrome.tabs.update(focusTabId, { url: target.url });
        }
        break;
      case "tab":
        await chrome.tabs.update(target.tabId, { active: true });
        await chrome.windows.update(target.windowId, { focused: true });
        break;
      case "newtab":
        await chrome.tabs.create({ active: true });
        break;
      case "close":
        if (focusTabId !== undefined) await chrome.tabs.remove(focusTabId);
        break;
    }
  } catch (error) {
    console.warn("Focus mode: couldn't complete the requested navigation", error);
  }
}

async function syncFocusAfterRestart() {
  const focus = await getActiveFocus(); // also ends expired sessions
  if (!focus) return;
  await chrome.alarms.create(FOCUS_END_ALARM, { when: focus.endsAt });
  await chrome.alarms.create(FOCUS_TICK_ALARM, { periodInMinutes: 0.5 });
  await updateFocusBadge(focus);
  await returnToFocusTab(focus); // tab ids change after a browser restart
}

// New tabs are handled by onCreated; ignore their activation so the prompt keeps the right target.
const recentlyCreatedTabs = new Set<number>();

function tabLabel(tab: chrome.tabs.Tab, fallback: string): string {
  return tab.title || (tab.url ? baseDomain(extractDomain(tab.url)) : fallback);
}

// Switching to another tab → stay on the locked tab and ask before leaving.
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  if (recentlyCreatedTabs.has(tabId)) return;
  const focus = await getActiveFocus();
  if (!focus || tabId === focus.tabId) return;
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return; // tab already closed
  }
  await promptLeave(focus, { kind: "tab", tabId, windowId, label: tabLabel(tab, "another tab") });
});

// Switching to another browser window → stay and ask.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return; // user switched to another app
  const focus = await getActiveFocus();
  if (!focus || windowId === focus.windowId) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab?.id === undefined || tab.id === focus.tabId || recentlyCreatedTabs.has(tab.id)) {
    await returnToFocusTab(focus);
    return;
  }
  await promptLeave(focus, { kind: "tab", tabId: tab.id, windowId, label: tabLabel(tab, "another window") });
});

// New tabs/windows are closed and the user is asked whether to end focus and open them.
// Links from the locked tab to the focus site open in the locked tab instead.
chrome.tabs.onCreated.addListener(async (tab) => {
  if (Date.now() < restoringFocusTabUntil || tab.id === undefined) return;
  const newTabId = tab.id;
  recentlyCreatedTabs.add(newTabId);
  setTimeout(() => recentlyCreatedTabs.delete(newTabId), 2000);

  const focus = await getActiveFocus();
  if (!focus || newTabId === focus.tabId) return;

  const targetUrl = tab.pendingUrl || tab.url || "";
  await withRetry(() => chrome.tabs.remove(newTabId));

  if (tab.openerTabId === focus.tabId && targetUrl && isUrlAllowedInFocus(targetUrl, focus) && focus.tabId !== undefined) {
    await withRetry(() => chrome.tabs.update(focus.tabId!, { url: targetUrl }));
    await returnToFocusTab(focus, false);
    return;
  }

  const isBlankTab = !targetUrl || targetUrl === "about:blank" || /^[a-z]+:\/\/newtab\/?$/i.test(targetUrl);
  await promptLeave(focus, isBlankTab ? { kind: "newtab" } : { kind: "url", url: targetUrl, newTab: true });
});

// Closing the locked tab reopens it and asks whether to end the session.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const focus = await getActiveFocus();
  if (!focus || tabId !== focus.tabId) return;
  await promptLeave({ ...focus, tabId: undefined }, { kind: "close" }, false);
});

// Leaving the focus site in a way the content script couldn't intercept (typed URL,
// redirect, script…): load the focus page again and ask there.
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const focus = await getActiveFocus();
  if (!focus || details.tabId !== focus.tabId) return;
  if (!isUrlAllowedInFocus(details.url, focus)) {
    await withRetry(() => chrome.tabs.update(details.tabId, { url: focus.focusSite }));
    await promptLeave(focus, { kind: "url", url: details.url }, false);
  }
});

/* ------------------------------------------------------------------ */
/* Alarms                                                              */
/* ------------------------------------------------------------------ */

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith(TIMER_ALARM_PREFIX)) {
    await completeTimer(alarm.name.slice(TIMER_ALARM_PREFIX.length));
  } else if (alarm.name === FOCUS_END_ALARM) {
    await endFocusSession(true);
  } else if (alarm.name === FOCUS_TICK_ALARM) {
    await updateFocusBadge(); // ends the session too if it has expired
  }
});

/** Alarms created by older versions used an in-memory map and can never complete. */
async function cleanupLegacyAlarms() {
  const alarms = await chrome.alarms.getAll();
  const timers = await getActiveTimers();
  for (const alarm of alarms) {
    if (alarm.name.startsWith("timer_")) await chrome.alarms.clear(alarm.name);
  }
  const settings = await getSettings();
  settings.timers = timers.filter((t) => typeof t.endsAt === "number" && t.endsAt > 0);
  await saveSettings(settings);
}

/* ------------------------------------------------------------------ */
/* Restricted sites                                                    */
/* ------------------------------------------------------------------ */

async function handleAddRestrictedSite(payload: { url: string; reason?: string }) {
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
}

/** Blocked-domain list as normalised hostnames ("www.facebook.com" → "facebook.com"). */
function blockedDomains(sites: { domain: string }[]): string[] {
  const domains = sites
    .map((s) => baseDomain(s.domain || "").trim())
    .filter((d) => /^[a-z0-9.-]+\.[a-z0-9-]+$/i.test(d));
  return [...new Set(domains)];
}

function isUrlBlocked(url: string | undefined, domains: string[]): boolean {
  if (!url || !/^https?:/i.test(url)) return false;
  const host = baseDomain(extractDomain(url));
  return domains.some((d) => host === d || host.endsWith("." + d));
}

function blockedPageUrl(originalUrl: string): string {
  return `${chrome.runtime.getURL("blocked.html")}?url=${encodeURIComponent(originalUrl)}`;
}

/**
 * Mirror the blocked-site list into declarativeNetRequest rules, so blocked sites are
 * redirected to blocked.html before any of their content loads. Open tabs on a newly
 * blocked site are sent to the blocked page as well.
 */
async function syncBlockRules() {
  const domains = blockedDomains(await getRestrictedSites());
  const existing = await chrome.declarativeNetRequest.getDynamicRules();

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: domains.map((domain, i) => ({
      id: i + 1,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: { regexSubstitution: `${chrome.runtime.getURL("blocked.html")}?url=\\0` },
      },
      condition: {
        regexFilter: "^https?://.*",
        requestDomains: [domain],
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
      },
    })),
  });

  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (tab.id !== undefined && isUrlBlocked(tab.url, domains)) {
      chrome.tabs.update(tab.id, { url: blockedPageUrl(tab.url!) }).catch(() => {});
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  syncBlockRules().catch((e) => console.warn("Couldn't sync block rules", e));
});
chrome.runtime.onStartup.addListener(() => {
  syncBlockRules().catch((e) => console.warn("Couldn't sync block rules", e));
});

// The popup and options page edit the list directly in storage — resync whenever it changes.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.settings) return;
  const before = JSON.stringify(blockedDomains(changes.settings.oldValue?.restrictedSites || []));
  const after = JSON.stringify(blockedDomains(changes.settings.newValue?.restrictedSites || []));
  if (before !== after) syncBlockRules().catch((e) => console.warn("Couldn't sync block rules", e));
});

/**
 * Fallback for pages the network rule can't catch (e.g. restored from the back/forward
 * cache): replace the page with the blocked page instead of overlaying it.
 */
async function handlePageLoaded(pageUrl: string | undefined, tabId: number | undefined) {
  if (!pageUrl || !tabId) return;
  const domains = blockedDomains(await getRestrictedSites());
  if (isUrlBlocked(pageUrl, domains)) {
    await chrome.tabs.update(tabId, { url: blockedPageUrl(pageUrl) });
  }
}

/* ------------------------------------------------------------------ */
/* Usage tracking                                                      */
/* ------------------------------------------------------------------ */

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    SITE_TRACKER.set(`tab_${details.tabId}`, {
      domain: extractDomain(details.url),
      startTime: Date.now(),
    });
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const key = `tab_${activeInfo.tabId}`;
  const tracker = SITE_TRACKER.get(key);

  if (tracker) {
    const duration = Date.now() - tracker.startTime;
    if (duration > 1000) {
      await recordSiteUsage(tracker.domain, duration);
    }
  }

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      SITE_TRACKER.set(key, { domain: extractDomain(tab.url), startTime: Date.now() });
    }
  } catch {
    /* tab was closed immediately (e.g. blocked by focus mode) */
  }
});

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

async function getHoursSpent(): Promise<number> {
  const settings = await getSettings();
  const totalTime = Object.values(settings.usageStats).reduce((sum: number, site: any) => {
    return sum + (site?.totalTime || 0);
  }, 0);
  return totalTime / (1000 * 60 * 60);
}

function getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}
