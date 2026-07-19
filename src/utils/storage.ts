/**
 * Storage utilities for managing extension settings and data
 */

import { ExtensionSettings, StorageData, TimerConfig, RestrictedSite, FocusModeConfig, AISettings, UsageStatistics, SiteUsage } from "../types/index";

const DEFAULT_SETTINGS: ExtensionSettings = {
  timers: [],
  restrictedSites: [],
  focusMode: {
    enabled: false,
    focusSite: "",
    focusDomain: "",
    startTime: 0,
    duration: 25,
    allowedSites: [],
  },
  aiSettings: {
    provider: "none",
    apiKey: "",
    model: "gpt-3.5-turbo",
    enabled: false,
  },
  usageStats: {
    lastUpdated: Date.now() as any,
  } as any as UsageStatistics,
  notifications: [],
};

/**
 * Get all extension settings
 */
export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get("settings", (result) => {
      if (result.settings) {
        resolve({ ...DEFAULT_SETTINGS, ...result.settings });
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    });
  });
}

/**
 * Save extension settings
 */
export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, () => {
      resolve();
    });
  });
}

/**
 * Add a new timer
 */
export async function addTimer(timer: TimerConfig): Promise<void> {
  const settings = await getSettings();
  settings.timers.push(timer);
  await saveSettings(settings);
}

/**
 * Remove a timer by ID
 */
export async function removeTimer(timerId: string): Promise<void> {
  const settings = await getSettings();
  settings.timers = settings.timers.filter((t) => t.id !== timerId);
  await saveSettings(settings);
}

/**
 * Get all active timers
 */
export async function getActiveTimers(): Promise<TimerConfig[]> {
  const settings = await getSettings();
  return settings.timers;
}

/**
 * Add a restricted site
 */
export async function addRestrictedSite(site: RestrictedSite): Promise<void> {
  const settings = await getSettings();
  settings.restrictedSites.push(site);
  await saveSettings(settings);
}

/**
 * Remove a restricted site by URL
 */
export async function removeRestrictedSite(url: string): Promise<void> {
  const settings = await getSettings();
  settings.restrictedSites = settings.restrictedSites.filter((s) => s.url !== url);
  await saveSettings(settings);
}

/**
 * Get all restricted sites
 */
export async function getRestrictedSites(): Promise<RestrictedSite[]> {
  const settings = await getSettings();
  return settings.restrictedSites;
}

/**
 * Check if a domain is restricted
 */
export async function isRestrictedDomain(domain: string): Promise<boolean> {
  const restrictedSites = await getRestrictedSites();
  return restrictedSites.some((site) => site.domain === domain || site.url.includes(domain));
}

/**
 * Enable focus mode
 */
export async function enableFocusMode(focusSite: string, duration: number, allowedSites: string[] = []): Promise<void> {
  const settings = await getSettings();
  const focusDomain = extractDomain(focusSite);
  settings.focusMode = {
    enabled: true,
    focusSite,
    focusDomain,
    startTime: Date.now(),
    duration,
    allowedSites: [focusDomain, ...allowedSites],
  };
  await saveSettings(settings);
}

/**
 * Disable focus mode
 */
export async function disableFocusMode(): Promise<void> {
  const settings = await getSettings();
  settings.focusMode.enabled = false;
  await saveSettings(settings);
}

/**
 * Get focus mode configuration
 */
export async function getFocusMode(): Promise<FocusModeConfig> {
  const settings = await getSettings();
  return settings.focusMode;
}

/**
 * Update AI settings
 */
export async function updateAISettings(aiSettings: AISettings): Promise<void> {
  const settings = await getSettings();
  settings.aiSettings = aiSettings;
  await saveSettings(settings);
}

/**
 * Get AI settings
 */
export async function getAISettings(): Promise<AISettings> {
  const settings = await getSettings();
  return settings.aiSettings;
}

/**
 * Record site usage
 */
export async function recordSiteUsage(domain: string, duration: number): Promise<void> {
  const settings = await getSettings();
  const siteUsage = settings.usageStats[domain] as SiteUsage | undefined;
  if (!siteUsage || typeof siteUsage === "number") {
    (settings.usageStats as any)[domain] = {
      domain,
      totalTime: 0,
      lastVisited: 0,
      sessionCount: 0,
    };
  }
  const updated = settings.usageStats[domain] as SiteUsage;
  updated.totalTime += duration;
  updated.lastVisited = Date.now();
  updated.sessionCount += 1;
  (settings.usageStats as any).lastUpdated = Date.now();
  await saveSettings(settings);
}

/**
 * Get usage statistics
 */
export async function getUsageStats(): Promise<{ [domain: string]: any }> {
  const settings = await getSettings();
  return settings.usageStats;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

/**
 * Clear all data
 */
export async function clearAllData(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      resolve();
    });
  });
}
