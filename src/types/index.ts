/**
 * Type definitions for the Productivity Assistant extension
 */

export interface TimerConfig {
  id: string;
  duration: number; // in minutes
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
  duration: number; // in minutes
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
  type: "SHOW_OVERLAY" | "HIDE_OVERLAY" | "ENABLE_FOCUS_MODE" | "DISABLE_FOCUS_MODE";
  payload?: any;
}
