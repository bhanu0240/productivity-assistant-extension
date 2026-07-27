/**
 * Popup Component - Main dashboard for quick access to timer, stats, and focus mode
 */

import React, { useEffect, useState } from "react";
import { ExtensionSettings, TimerConfig } from "../types/index";
import {
  getSettings,
  saveSettings,
  addTimer,
  removeTimer,
  getActiveTimers,
  enableFocusMode,
  disableFocusMode,
  getFocusMode,
  getUsageStats,
  getRestrictedSites,
} from "../utils/storage";
import { generateMotivationalMessage, generateUsageInsights } from "../utils/aiHelper";

export const Popup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"timer" | "stats" | "restrictions" | "focus">("timer");
  const [timers, setTimers] = useState<TimerConfig[]>([]);
  const [focusModeActive, setFocusModeActive] = useState(false);
  const [focusSite, setFocusSite] = useState("");
  const [focusSiteDraft, setFocusSiteDraft] = useState("");
  const [duration, setDuration] = useState(25);
  const [customMessage, setCustomMessage] = useState("");
  const [usageStats, setUsageStats] = useState<any>({});
  const [insights, setInsights] = useState("");
  const [restrictedSites, setRestrictedSites] = useState<any[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [newRestrictedSite, setNewRestrictedSite] = useState("");

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const settings = await getSettings();
    const activeTimers = await getActiveTimers();
    const focusMode = await getFocusMode();
    const stats = await getUsageStats();
    const sites = await getRestrictedSites();

    setTimers(activeTimers);
    setFocusModeActive(focusMode.enabled);
    setFocusSite(focusMode.focusSite);
    setFocusSiteDraft((currentDraft) => {
      if (!focusMode.focusSite) {
        return currentDraft || "";
      }
      return currentDraft && currentDraft !== focusMode.focusSite ? currentDraft : focusMode.focusSite;
    });
    setUsageStats(stats);
    setRestrictedSites(sites);
    setAiEnabled(settings.aiSettings.enabled);
  };

  const handleStartTimer = async () => {
    chrome.runtime.sendMessage(
      {
        type: "START_TIMER",
        payload: {
          duration,
          message: customMessage,
          context: "general",
        },
      },
      (response) => {
        if (response.success) {
          setCustomMessage("");
          setDuration(25);
          loadData();
        }
      }
    );
  };

  const handleStopTimer = async (timerId: string) => {
    chrome.runtime.sendMessage(
      {
        type: "STOP_TIMER",
        payload: { timerId },
      },
      () => loadData()
    );
  };

  const handleToggleFocusMode = async () => {
    const nextFocusSite = focusSiteDraft.trim();

    if (focusModeActive) {
      await disableFocusMode();
      chrome.runtime.sendMessage({ type: "TOGGLE_FOCUS_MODE", payload: { enabled: false } });
    } else if (nextFocusSite) {
      await enableFocusMode(nextFocusSite, duration);
      setFocusSite(nextFocusSite);
      setFocusSiteDraft(nextFocusSite);
      chrome.runtime.sendMessage({
        type: "TOGGLE_FOCUS_MODE",
        payload: { enabled: true, focusSite: nextFocusSite, duration },
      });
    }
    loadData();
  };

  const handleAddRestrictedSite = async () => {
    if (newRestrictedSite.trim()) {
      chrome.runtime.sendMessage(
        {
          type: "ADD_RESTRICTED_SITE",
          payload: { url: newRestrictedSite },
        },
        () => {
          setNewRestrictedSite("");
          loadData();
        }
      );
    }
  };

  const handleGenerateInsights = async () => {
    const settings = await getSettings();
    if (settings.aiSettings.enabled) {
      const response = await generateUsageInsights(usageStats, settings.aiSettings);
      if (response.success) {
        setInsights(response.insights || "");
      }
    }
  };

  const topSites = Object.entries(usageStats)
    .filter(([key, value]) => key !== "lastUpdated" && typeof value === "object" && value !== null)
    .sort((a, b) => ((b[1] as any).totalTime || 0) - ((a[1] as any).totalTime || 0))
    .slice(0, 5);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>⚡ Productivity Assistant</h1>
      </div>

      <div style={styles.tabs}>
        {(["timer", "stats", "restrictions", "focus"] as const).map((tab) => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "timer" && "⏱️ Timer"}
            {tab === "stats" && "📊 Stats"}
            {tab === "restrictions" && "🚫 Blocked"}
            {tab === "focus" && "🎯 Focus"}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {/* Timer Tab */}
        {activeTab === "timer" && (
          <div>
            <h2 style={styles.sectionTitle}>Break Timer</h2>

            {/* Active Timers */}
            {timers.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.subtitle}>Active Timers</h3>
                {timers.map((timer) => (
                  <div key={timer.id} style={styles.timerItem}>
                    <div>
                      <p style={styles.timerMessage}>{timer.message}</p>
                      <p style={styles.timerDuration}>{timer.duration} minutes</p>
                      {timer.isAIGenerated && <p style={styles.aiTag}>✨ AI Generated</p>}
                    </div>
                    <button style={styles.removeBtn} onClick={() => handleStopTimer(timer.id)}>
                      Stop
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New Timer */}
            <div style={styles.section}>
              <h3 style={styles.subtitle}>New Timer</h3>
              <div style={styles.formGroup}>
                <label style={styles.label}>Duration (minutes):</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  min="1"
                  max="120"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Break Message:</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder={aiEnabled ? "Leave blank for AI-generated message" : "Enter a message for your break"}
                  style={styles.textarea}
                />
              </div>

              <button style={styles.primaryBtn} onClick={handleStartTimer}>
                {aiEnabled ? "✨ Start Timer (AI Message)" : "Start Timer"}
              </button>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <div>
            <h2 style={styles.sectionTitle}>Usage Statistics</h2>

            {topSites.length > 0 ? (
              <div style={styles.section}>
                <h3 style={styles.subtitle}>Top Sites</h3>
                {topSites.map(([domain, data]: any) => (
                  <div key={domain} style={styles.statItem}>
                    <div>
                      <p style={styles.statDomain}>{domain}</p>
                      <p style={styles.statTime}>{Math.round((data.totalTime || 0) / 1000 / 60)} minutes</p>
                    </div>
                  </div>
                ))}

                {aiEnabled && (
                  <>
                    <button style={styles.primaryBtn} onClick={handleGenerateInsights}>
                      🤖 Get AI Insights
                    </button>
                    {insights && (
                      <div style={styles.insightBox}>
                        <p style={styles.insightText}>{insights}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p style={styles.emptyText}>No usage data yet. Start browsing to see statistics.</p>
            )}
          </div>
        )}

        {/* Restrictions Tab */}
        {activeTab === "restrictions" && (
          <div>
            <h2 style={styles.sectionTitle}>Blocked Sites</h2>

            <div style={styles.section}>
              <h3 style={styles.subtitle}>Add Site</h3>
              <div style={styles.formGroup}>
                <input
                  type="text"
                  value={newRestrictedSite}
                  onChange={(e) => setNewRestrictedSite(e.target.value)}
                  placeholder="Enter domain (e.g., facebook.com)"
                  style={styles.input}
                />
              </div>
              <button style={styles.primaryBtn} onClick={handleAddRestrictedSite}>
                Block Site
              </button>
            </div>

            {restrictedSites.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.subtitle}>Restricted Sites</h3>
                {restrictedSites.map((site) => (
                  <div key={site.url} style={styles.restrictedItem}>
                    <div>
                      <p style={styles.restrictedDomain}>{site.domain}</p>
                      {site.reason && <p style={styles.restrictedReason}>{site.reason}</p>}
                    </div>
                    <button
                      style={styles.removeBtn}
                      onClick={() => {
                        const settings = getSettings();
                        settings.then((s) => {
                          s.restrictedSites = s.restrictedSites.filter((r) => r.url !== site.url);
                          saveSettings(s).then(() => loadData());
                        });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Focus Mode Tab */}
        {activeTab === "focus" && (
          <div>
            <h2 style={styles.sectionTitle}>Focus Mode</h2>

            <div style={styles.section}>
              <p style={styles.focusDescription}>
                Focus mode restricts access to all sites except your chosen focus site. Perfect for deep work sessions.
              </p>

              <div style={styles.formGroup}>
                <label style={styles.label}>Focus Site URL:</label>
                <input
                  type="text"
                  value={focusSiteDraft}
                  onChange={(e) => setFocusSiteDraft(e.target.value)}
                  placeholder="e.g., github.com"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Duration (minutes):</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 25)}
                  min="1"
                  max="480"
                  style={styles.input}
                />
              </div>

              <button
                style={{
                  ...styles.primaryBtn,
                  background: focusModeActive ? "#f44336" : "#4CAF50",
                }}
                onClick={handleToggleFocusMode}
              >
                {focusModeActive ? "🚫 Disable Focus Mode" : "🎯 Enable Focus Mode"}
              </button>

              {focusModeActive && (
                <div style={styles.activeIndicator}>
                  <p>✅ Focus mode is active</p>
                  <p style={styles.focusingSite}>Focusing on: {focusSite || focusSiteDraft}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={styles.footer}>
        <button
          style={styles.settingsBtn}
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: "500px",
    maxHeight: "600px",
    overflowY: "auto" as const,
    background: "#f5f5f5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "16px",
    textAlign: "center" as const,
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #ddd",
    background: "white",
  },
  tab: {
    flex: 1,
    padding: "12px",
    border: "none",
    background: "white",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
    color: "#666",
    borderBottom: "3px solid transparent",
    transition: "all 0.2s",
  },
  activeTab: {
    color: "#667eea",
    borderBottomColor: "#667eea",
  },
  content: {
    padding: "16px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "600",
    margin: "0 0 12px 0",
    color: "#333",
  },
  section: {
    background: "white",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  subtitle: {
    fontSize: "14px",
    fontWeight: "600",
    margin: "0 0 12px 0",
    color: "#555",
  },
  formGroup: {
    marginBottom: "12px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: "500",
    marginBottom: "4px",
    color: "#666",
  },
  input: {
    width: "100%",
    padding: "8px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "12px",
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%",
    padding: "8px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "12px",
    minHeight: "60px",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  primaryBtn: {
    width: "100%",
    padding: "10px",
    background: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  removeBtn: {
    padding: "6px 12px",
    background: "#f44336",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
  },
  settingsBtn: {
    width: "100%",
    padding: "10px",
    background: "white",
    color: "#667eea",
    border: "1px solid #667eea",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  footer: {
    padding: "12px 16px",
    borderTop: "1px solid #ddd",
    background: "white",
  },
  timerItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    background: "#f9f9f9",
    borderRadius: "6px",
    marginBottom: "8px",
  },
  timerMessage: {
    margin: "0 0 4px 0",
    fontSize: "13px",
    fontWeight: "500",
    color: "#333",
  },
  timerDuration: {
    margin: "0",
    fontSize: "12px",
    color: "#999",
  },
  aiTag: {
    margin: "4px 0 0 0",
    fontSize: "11px",
    color: "#667eea",
    fontWeight: "600",
  },
  statItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px",
    borderBottom: "1px solid #eee",
  },
  statDomain: {
    margin: "0 0 4px 0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#333",
  },
  statTime: {
    margin: "0",
    fontSize: "12px",
    color: "#999",
  },
  emptyText: {
    textAlign: "center" as const,
    color: "#999",
    fontSize: "12px",
    margin: "20px 0",
  },
  insightBox: {
    background: "#e3f2fd",
    borderLeft: "4px solid #667eea",
    padding: "12px",
    borderRadius: "4px",
    marginTop: "12px",
  },
  insightText: {
    margin: "0",
    fontSize: "12px",
    color: "#333",
    lineHeight: "1.6",
  },
  restrictedItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    borderBottom: "1px solid #eee",
  },
  restrictedDomain: {
    margin: "0 0 4px 0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#333",
  },
  restrictedReason: {
    margin: "0",
    fontSize: "12px",
    color: "#999",
  },
  focusDescription: {
    fontSize: "12px",
    color: "#666",
    lineHeight: "1.6",
    margin: "0 0 12px 0",
  },
  activeIndicator: {
    marginTop: "12px",
    padding: "12px",
    background: "#e8f5e9",
    borderRadius: "4px",
    borderLeft: "4px solid #4CAF50",
  },
  focusingSite: {
    margin: "4px 0 0 0",
    fontSize: "12px",
    color: "#2e7d32",
    fontWeight: "600",
  },
};
