/**
 * Type definitions for the Productivity Assistant extension
 */

export interface TimerConfig {
  id: string;
  duration: number; // in minutes (kept for backwards compatibility)
  durationSeconds: number; // total length of the timer
  endsAt: number; // epoch ms when the timer fires (meaningless while paused)
  pausedRemainingMs?: number; // set while the timer is paused
  message: string;
  isAIGenerated: boolean;
  customMessage?: string;
  context?: string; // e.g., "coding", "reading"
  tabId?: number;
  createdAt: number;
}

export interface BreakNotification {
  id: string;
  timerId: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface SiteUsage {
  domain: string;
  totalTime: number; // in milliseconds
  lastVisited: number;
  sessionCount: number;
}

export interface UsageStatistics {
  [domain: string]: SiteUsage | number; // SiteUsage for domains, number for lastUpdated
}

export interface RestrictedSite {
  url: string;
  domain: string;
  addedAt: number;
  reason?: string;
}

export interface FocusModeConfig {
  enabled: boolean;
  focusSite: string;
  focusDomain: string;
  startTime: number;
  duration: number; // in minutes (kept for backwards compatibility)
  durationSeconds: number;
  endsAt: number; // epoch ms when the session ends
  tabId?: number; // the tab the user is locked to
  windowId?: number;
  tabTitle?: string;
  allowedSites: string[];
}

export interface AISettings {
  provider: "openai" | "azure" | "none";
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface ExtensionSettings {
  timers: TimerConfig[];
  restrictedSites: RestrictedSite[];
  focusMode: FocusModeConfig;
  aiSettings: AISettings;
  usageStats: UsageStatistics;
  notifications: BreakNotification[];
}

export interface StorageData {
  settings: ExtensionSettings;
  lastSyncTime: number;
}

export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
  insights?: string;
}

export interface ContentScriptMessage {
  type: "SHOW_OVERLAY" | "HIDE_OVERLAY" | "FOCUS_TOAST" | "FOCUS_LEAVE_PROMPT" | "FOCUS_LEAVE_PROMPT_CLOSE";
  payload?: any;
}
