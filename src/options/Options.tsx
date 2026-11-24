/**
 * Options Page Component - Settings and configuration
 */

import React, { useEffect, useState } from "react";
import { getSettings, saveSettings, clearAllData, getAISettings, updateAISettings } from "../utils/storage";
import { testAIConnection } from "../utils/aiHelper";
import { AISettings, ExtensionSettings } from "../types/index";

const AI_CONSENT_TEXT = [
  "Turn on AI features?",
  "",
  "The extension will send data to the AI provider you choose (OpenAI or Azure OpenAI), using your API key:",
  "- Break messages: hours spent browsing, the time of day, and your timer label",
  "- Insights (when you click the button): your top 5 domains and the minutes spent on each",
  "",
  "Full URLs, page titles and page content are never sent. The provider's privacy policy applies to this data.",
  "",
  "Click OK to agree and turn on AI features.",
].join("\n");

export const OptionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"ai" | "privacy" | "data">("ai");
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: "none",
    apiKey: "",
    model: "gpt-3.5-turbo",
    enabled: false,
  });
  const [testResult, setTestResult] = useState("");
  const [showAPIKey, setShowAPIKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await getAISettings();
    setAiSettings(settings);
  };

  const handleSaveAISettings = async () => {
    await updateAISettings(aiSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setTestResult("Testing...");
    const result = await testAIConnection(aiSettings);
    setTestResult(result.success ? "✅ Connection successful!" : `❌ ${result.error}`);
  };

  const handleClearAllData = async () => {
    if (confirm("Are you sure you want to clear all extension data? This cannot be undone.")) {
      await clearAllData();
      alert("All data cleared successfully.");
      window.location.reload();
    }
  };

  const handleExportData = async () => {
    const settings = await getSettings();
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `productivity-assistant-backup-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>⚙️ Productivity Assistant Settings</h1>
      </div>

      <div style={styles.tabsContainer}>
        {(["ai", "privacy", "data"] as const).map((tab) => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "ai" && "🤖 AI Settings"}
            {tab === "privacy" && "🔒 Privacy"}
            {tab === "data" && "💾 Data"}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {/* AI Settings Tab */}
        {activeTab === "ai" && (
          <div>
            <h2 style={styles.sectionTitle}>AI Configuration</h2>

            <div style={styles.section}>
              <p style={styles.description}>
                AI features are optional and off by default. When you turn them on, the extension sends data to the provider you choose (OpenAI or Azure OpenAI), using your own API key:
              </p>
              <ul style={styles.privacyList}>
                <li><strong>When you start a break timer with no message:</strong> hours spent browsing today, the time of day, and the timer label you typed (if any).</li>
                <li><strong>When you click "Generate insights" in the popup:</strong> your top 5 website domains and the minutes spent on each.</li>
                <li>Full URLs, page titles and page content are never sent. Your API key is stored only in this browser and sent only to the provider you choose. The provider's own privacy policy applies to the data it receives.</li>
              </ul>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  <input
                    type="checkbox"
                    checked={aiSettings.enabled}
                    onChange={(e) => {
                      if (e.target.checked && !confirm(AI_CONSENT_TEXT)) return;
                      setAiSettings({ ...aiSettings, enabled: e.target.checked });
                    }}
                  />
                  Enable AI Features
                </label>
              </div>

              {aiSettings.enabled && (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>AI Provider:</label>
                    <select
                      value={aiSettings.provider}
                      onChange={(e) => setAiSettings({ ...aiSettings, provider: e.target.value as any })}
                      style={styles.select}
                    >
                      <option value="none">None</option>
                      <option value="openai">OpenAI</option>
                      <option value="azure">Azure AI</option>
                    </select>
                  </div>

                  {aiSettings.provider !== "none" && (
                    <>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>API Key:</label>
                        <input
                          type={showAPIKey ? "text" : "password"}
                          value={aiSettings.apiKey}
                          onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                          placeholder="sk-... (for OpenAI) or endpoint|key (for Azure)"
                          style={styles.input}
                        />
                        <button
                          style={styles.toggleBtn}
                          onClick={() => setShowAPIKey(!showAPIKey)}
                        >
                          {showAPIKey ? "Hide" : "Show"}
                        </button>
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Model:</label>
                        <input
                          type="text"
                          value={aiSettings.model}
                          onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                          placeholder="e.g., gpt-3.5-turbo or gpt-4"
                          style={styles.input}
                        />
                      </div>

                      <button style={styles.secondaryBtn} onClick={handleTestConnection}>
                        🔗 Test Connection
                      </button>

                      {testResult && (
                        <div style={{
                          ...styles.message,
                          background: testResult.includes("✅") ? "#e8f5e9" : "#ffebee"
                        }}>
                          {testResult}
                        </div>
                      )}
                    </>
                  )}

                  <button style={styles.primaryBtn} onClick={handleSaveAISettings}>
                    {saved ? "✅ Saved" : "Save AI Settings"}
                  </button>
                </>
              )}
            </div>

            <div style={styles.infoBox}>
              <p style={styles.infoTitle}>How AI is used:</p>
              <ul style={styles.infoList}>
                <li>🎯 Generate personalized break reminders based on your work time</li>
                <li>📊 Analyze browsing patterns to provide productivity insights</li>
                <li>⏰ Context-aware messages (morning/afternoon/evening)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Privacy Tab */}
        {activeTab === "privacy" && (
          <div>
            <h2 style={styles.sectionTitle}>Privacy & Security</h2>

            <div style={styles.section}>
              <h3 style={styles.subtitle}>Data Storage</h3>
              <p style={styles.description}>
                All your data is stored locally on your device using Chrome's storage API. No data is sent to external servers unless you enable AI features and provide API credentials.
              </p>

              <h3 style={styles.subtitle}>Data Collected</h3>
              <ul style={styles.privacyList}>
                <li><strong>Website Usage:</strong> Domains you visit and time spent (local only)</li>
                <li><strong>Timer Settings:</strong> Break durations and custom messages (local only)</li>
                <li><strong>Focus Mode:</strong> Your focus site preferences (local only)</li>
                <li><strong>Restricted Sites:</strong> Sites you choose to block (local only)</li>
              </ul>

              <h3 style={styles.subtitle}>AI Integration</h3>
              <p style={styles.description}>
                Only if you turn on AI features and agree to the prompt, the extension sends limited data to the provider you choose (OpenAI or Azure OpenAI): hours spent browsing, the time of day and your timer label for break messages, and your top 5 domains with minutes spent when you ask for insights. Full URLs, page titles and page content are never sent.
              </p>

              <h3 style={styles.subtitle}>Permissions Explained</h3>
              <ul style={styles.privacyList}>
                <li><strong>storage:</strong> Save your settings locally</li>
                <li><strong>alarms:</strong> Manage break timers</li>
                <li><strong>tabs:</strong> Detect the active tab's site to record time spent, and manage your focus tab</li>
                <li><strong>webNavigation:</strong> Enforce focus mode</li>
                <li><strong>declarativeNetRequest:</strong> Block restricted sites</li>
                <li><strong>notifications:</strong> Show break reminders</li>
                <li><strong>Access to all websites:</strong> Detect the active site to record time spent, and show focus-mode and blocking screens</li>
              </ul>
            </div>

            <div style={styles.warningBox}>
              <p style={styles.warningTitle}>🔒 Privacy Commitment</p>
              <p style={styles.description}>
                We do not sell your data, use it for advertising, or send it to the developer. The extension has no analytics or telemetry. Data leaves your device only through the optional AI features described above.
              </p>
            </div>
          </div>
        )}

        {/* Data Tab */}
        {activeTab === "data" && (
          <div>
            <h2 style={styles.sectionTitle}>Data Management</h2>

            <div style={styles.section}>
              <h3 style={styles.subtitle}>Backup & Export</h3>
              <p style={styles.description}>
                Export your settings, timers, usage statistics, and preferences as a JSON file for backup or transfer.
              </p>
              <button style={styles.secondaryBtn} onClick={handleExportData}>
                💾 Export Data
              </button>
            </div>

            <div style={styles.section}>
              <h3 style={styles.subtitle}>Clear All Data</h3>
              <p style={styles.description}>
                Permanently delete all extension data including timers, statistics, settings, and preferences. This action cannot be undone.
              </p>
              <button style={styles.dangerBtn} onClick={handleClearAllData}>
                🗑️ Clear All Data
              </button>
            </div>

            <div style={styles.infoBox}>
              <p style={styles.infoTitle}>Note:</p>
              <p style={styles.description}>
                Clearing data will not affect your browser history or cache. It only removes data stored by this extension.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    background: "#f5f5f5",
    minHeight: "100vh",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "24px",
    textAlign: "center" as const,
  },
  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "600",
  },
  tabsContainer: {
    display: "flex",
    borderBottom: "1px solid #ddd",
    background: "white",
    padding: "0 24px",
  },
  tab: {
    padding: "16px 24px",
    border: "none",
    background: "white",
    cursor: "pointer",
    fontSize: "14px",
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
    padding: "24px",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: "600",
    margin: "0 0 16px 0",
    color: "#333",
  },
  subtitle: {
    fontSize: "14px",
    fontWeight: "600",
    margin: "16px 0 8px 0",
    color: "#555",
  },
  section: {
    background: "white",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  description: {
    fontSize: "13px",
    color: "#666",
    lineHeight: "1.6",
    margin: "0 0 12px 0",
  },
  formGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "500",
    marginBottom: "6px",
    color: "#555",
    cursor: "pointer",
  },
  input: {
    width: "100%",
    padding: "10px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "13px",
    boxSizing: "border-box" as const,
    marginBottom: "8px",
  },
  select: {
    width: "100%",
    padding: "10px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "13px",
    boxSizing: "border-box" as const,
  },
  toggleBtn: {
    padding: "8px 12px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    marginBottom: "8px",
  },
  primaryBtn: {
    width: "100%",
    padding: "12px",
    background: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  secondaryBtn: {
    width: "100%",
    padding: "12px",
    background: "white",
    color: "#667eea",
    border: "1px solid #667eea",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    marginBottom: "12px",
  },
  dangerBtn: {
    width: "100%",
    padding: "12px",
    background: "#f44336",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  message: {
    padding: "12px",
    borderRadius: "4px",
    marginTop: "12px",
    fontSize: "13px",
    fontWeight: "600",
  },
  infoBox: {
    background: "#e3f2fd",
    borderLeft: "4px solid #667eea",
    borderRadius: "4px",
    padding: "16px",
    marginTop: "16px",
  },
  warningBox: {
    background: "#fff3e0",
    borderLeft: "4px solid #ff9800",
    borderRadius: "4px",
    padding: "16px",
    marginTop: "16px",
  },
  infoTitle: {
    margin: "0 0 8px 0",
    fontSize: "14px",
    fontWeight: "600",
    color: "#1976d2",
  },
  warningTitle: {
    margin: "0 0 8px 0",
    fontSize: "14px",
    fontWeight: "600",
    color: "#e65100",
  },
  infoList: {
    margin: "8px 0 0 0",
    paddingLeft: "20px",
    fontSize: "13px",
    color: "#555",
  },
  privacyList: {
    margin: "8px 0",
    paddingLeft: "20px",
    fontSize: "13px",
    color: "#666",
    lineHeight: "1.8",
  },
};
