/**
 * Popup Component - Main dashboard for quick access to timer, stats, and focus mode
 */

import React, { useEffect, useRef, useState } from "react";
import { FocusModeConfig, TimerConfig } from "../types/index";
import { getSettings, saveSettings, getUsageStats, getRestrictedSites } from "../utils/storage";
import { generateUsageInsights } from "../utils/aiHelper";
import { ClockDial, splitSeconds } from "./ClockDial";

type TabName = "timer" | "stats" | "restrictions" | "focus";

const MIN_SECONDS = 30; // Chrome alarms can't fire sooner than 30s in published extensions
const PRESETS = [
  { label: "5m", seconds: 5 * 60 },
  { label: "15m", seconds: 15 * 60 },
  { label: "25m", seconds: 25 * 60 },
  { label: "45m", seconds: 45 * 60 },
  { label: "1h", seconds: 60 * 60 },
];

interface CurrentTab {
  id?: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

/** Promise wrapper around runtime messaging that never throws. */
function send(type: string, payload?: any): Promise<{ success: boolean; error?: string; [k: string]: any }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response ?? { success: false, error: "No response from background" });
      }
    });
  });
}

function formatDurationLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(" ") || "0s";
}

const USAGE_UNITS = [
  { name: "year", seconds: 365 * 86400 },
  { name: "month", seconds: 30 * 86400 },
  { name: "day", seconds: 86400 },
  { name: "hour", seconds: 3600 },
  { name: "minute", seconds: 60 },
  { name: "second", seconds: 1 },
];

/**
 * Human-friendly usage time, using the largest units that fit:
 * 1542 min → "1 day 1 hour 42 minutes", 45 days → "1 month 15 days".
 * Shows at most the three largest non-zero units so long totals stay readable.
 */
function formatUsageTime(ms: number): string {
  let remaining = Math.floor(ms / 1000);
  if (remaining <= 0) return "0 seconds";
  const parts: string[] = [];
  for (const unit of USAGE_UNITS) {
    const count = Math.floor(remaining / unit.seconds);
    remaining %= unit.seconds;
    if (count > 0) parts.push(`${count} ${unit.name}${count === 1 ? "" : "s"}`);
    else if (parts.length > 0) parts.push(""); // a skipped unit still counts toward the limit
    if (parts.length === 3) break;
  }
  return parts.filter(Boolean).join(" ");
}

function formatClockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const Popup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>("timer");
  const [timers, setTimers] = useState<TimerConfig[]>([]);
  const [focus, setFocus] = useState<FocusModeConfig | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);

  // One duration shared by the Timer and Focus tabs
  const [draftSeconds, setDraftSeconds] = useState(25 * 60);
  const [customMessage, setCustomMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [currentTab, setCurrentTab] = useState<CurrentTab | null>(null);
  const [usageStats, setUsageStats] = useState<any>({});
  const [insights, setInsights] = useState("");
  const [restrictedSites, setRestrictedSites] = useState<any[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [newRestrictedSite, setNewRestrictedSite] = useState("");

  const initialTabChosen = useRef(false);

  const loadData = async () => {
    const settings = await getSettings();
    const stats = await getUsageStats();
    const sites = await getRestrictedSites();

    const focusMode = settings.focusMode;
    const isFocusActive = focusMode.enabled && focusMode.endsAt > Date.now();

    setTimers(settings.timers.filter((t) => typeof t.endsAt === "number" && t.endsAt > 0));
    setFocus(isFocusActive ? focusMode : null);
    setUsageStats(stats);
    setRestrictedSites(sites);
    setAiEnabled(settings.aiSettings.enabled);
    setLoaded(true);

    // Open the popup on whatever is currently running
    if (!initialTabChosen.current) {
      initialTabChosen.current = true;
      if (isFocusActive) setActiveTab("focus");
    }
  };

  useEffect(() => {
    loadData();
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab) setCurrentTab({ id: tab.id, title: tab.title || "", url: tab.url || "", favIconUrl: tab.favIconUrl });
    });

    // React to changes made by the background (timer finished, session ended…)
    const onStorageChanged = (_changes: any, area: string) => {
      if (area === "local") loadData();
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
    const tick = setInterval(() => setNow(Date.now()), 250);

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => setError(""), [activeTab]);

  /* ---------------------------- Timer actions ---------------------------- */

  const runningTimer = timers[0];
  const otherTimers = timers.slice(1);
  const handleStartTimer = async () => {
    setBusy(true);
    setError("");
    const res = await send("START_TIMER", {
      durationSeconds: draftSeconds,
      message: customMessage,
      context: "general",
      tabId: currentTab?.id,
    });
    setBusy(false);
    if (res.success) {
      setCustomMessage("");
      loadData();
    } else {
      setError(res.error || "Couldn't start the timer.");
    }
  };

  const timerAction = async (type: "STOP_TIMER" | "PAUSE_TIMER" | "RESUME_TIMER", timerId: string) => {
    const res = await send(type, { timerId });
    if (!res.success) setError(res.error || "Something went wrong.");
    loadData();
  };

  /* ---------------------------- Focus actions ---------------------------- */

  const canFocusCurrentTab = !!currentTab?.id && /^https?:/i.test(currentTab.url);

  const handleStartFocus = async () => {
    if (!currentTab?.id) return;
    setBusy(true);
    setError("");
    const res = await send("START_FOCUS", { tabId: currentTab.id, durationSeconds: draftSeconds });
    setBusy(false);
    if (res.success) loadData();
    else setError(res.error || "Couldn't start focus mode.");
  };

  const handleEndFocusEarly = async () => {
    await send("END_FOCUS");
    loadData();
  };

  /* ---------------------------- Other tabs ---------------------------- */

  const handleAddRestrictedSite = async () => {
    if (newRestrictedSite.trim()) {
      await send("ADD_RESTRICTED_SITE", { url: newRestrictedSite.trim() });
      setNewRestrictedSite("");
      loadData();
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

  /* ---------------------------- Render helpers ---------------------------- */

  const tabLabel = (tab: TabName) => {
    const labels: Record<TabName, string> = { timer: "⏱️ Timer", stats: "📊 Stats", restrictions: "🚫 Blocked", focus: "🎯 Focus" };
    let suffix = "";
    if (tab === "focus" && focus) suffix = " •";
    if (tab === "timer" && runningTimer) suffix = " •";
    return labels[tab] + suffix;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>⚡ Productivity Assistant</h1>
      </div>

      <div style={styles.tabs} role="tablist">
        {(["timer", "focus", "stats", "restrictions"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {error && (
          <div style={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        {/* ============================ Timer Tab ============================ */}
        {activeTab === "timer" && loaded && (
          <div>
            {runningTimer ? (
              (() => {
                const paused = runningTimer.pausedRemainingMs !== undefined;
                const remainingMs = paused ? runningTimer.pausedRemainingMs! : Math.max(0, runningTimer.endsAt - now);
                const totalMs = (runningTimer.durationSeconds || runningTimer.duration * 60) * 1000;
                return (
                  <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Break timer</h2>
                    <ClockDial
                      mode="run"
                      seconds={Math.ceil(remainingMs / 1000)}
                      progress={remainingMs / totalMs}
                      accent="#667eea"
                      caption={paused ? "Paused" : remainingMs === 0 ? "Finishing…" : `Ends at ${formatClockTime(runningTimer.endsAt)}`}
                    />
                    {runningTimer.message && (
                      <p style={styles.timerMessage}>
                        “{runningTimer.message}”{runningTimer.isAIGenerated && <span style={styles.aiTag}> ✨ AI</span>}
                      </p>
                    )}
                    <div style={styles.buttonRow}>
                      <button
                        style={styles.primaryBtn}
                        onClick={() => timerAction(paused ? "RESUME_TIMER" : "PAUSE_TIMER", runningTimer.id)}
                      >
                        {paused ? "▶ Resume" : "⏸ Pause"}
                      </button>
                      <button style={styles.dangerOutlineBtn} onClick={() => timerAction("STOP_TIMER", runningTimer.id)}>
                        Cancel timer
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Set a break timer</h2>
                <DurationPicker seconds={draftSeconds} onChange={setDraftSeconds} />

                <div style={styles.formGroup}>
                  <label style={styles.label} htmlFor="break-message">
                    Break message <span style={styles.optional}>(optional)</span>
                  </label>
                  <textarea
                    id="break-message"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder={aiEnabled ? "Leave blank for an AI-generated message" : "e.g. Stand up and stretch!"}
                    style={styles.textarea}
                  />
                </div>

                <button
                  style={{ ...styles.primaryBtn, ...(busy || draftSeconds < MIN_SECONDS ? styles.disabledBtn : {}) }}
                  disabled={busy || draftSeconds < MIN_SECONDS}
                  onClick={handleStartTimer}
                >
                  {busy ? "Starting…" : `Start ${formatDurationLabel(draftSeconds)} timer${aiEnabled && !customMessage ? " ✨" : ""}`}
                </button>
              </div>
            )}

            {otherTimers.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.subtitle}>Other timers</h3>
                {otherTimers.map((t) => (
                  <div key={t.id} style={styles.timerItem}>
                    <span style={styles.timerDuration}>
                      {t.pausedRemainingMs !== undefined ? "Paused" : `Ends at ${formatClockTime(t.endsAt)}`}
                    </span>
                    <button style={styles.removeBtn} onClick={() => timerAction("STOP_TIMER", t.id)}>
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================ Focus Tab ============================ */}
        {activeTab === "focus" && loaded && (
          <div>
            {focus ? (
              (() => {
                const remainingMs = Math.max(0, focus.endsAt - now);
                const totalMs = (focus.durationSeconds || focus.duration * 60) * 1000;
                return (
                  <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Focus session in progress</h2>
                    <ClockDial
                      mode="run"
                      seconds={Math.ceil(remainingMs / 1000)}
                      progress={remainingMs / totalMs}
                      accent="#4CAF50"
                      caption={`Unlocks at ${formatClockTime(focus.endsAt)}`}
                    />
                    <div style={styles.lockCard}>
                      <span style={styles.lockIcon} aria-hidden>
                        🔒
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <p style={styles.lockTitle}>{focus.tabTitle || focus.focusDomain}</p>
                        <p style={styles.lockSub}>Locked to this tab on {focus.focusDomain}</p>
                      </div>
                    </div>
                    <p style={styles.focusDescription}>
                      Trying to switch tabs, open a new tab, or leave {focus.focusDomain} asks you first — you only
                      leave if you choose to end the session. Everything unlocks when the timer reaches zero.
                    </p>
                    <HoldToConfirm label="Hold to end session early" onConfirm={handleEndFocusEarly} />
                  </div>
                );
              })()
            ) : (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Focus on this tab</h2>

                <div style={{ ...styles.lockCard, ...(canFocusCurrentTab ? {} : styles.lockCardWarn) }}>
                  {currentTab?.favIconUrl ? (
                    <img src={currentTab.favIconUrl} alt="" width={20} height={20} style={{ flexShrink: 0 }} />
                  ) : (
                    <span style={styles.lockIcon} aria-hidden>
                      🌐
                    </span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={styles.lockTitle}>{currentTab?.title || "Current tab"}</p>
                    <p style={styles.lockSub}>
                      {canFocusCurrentTab
                        ? hostOf(currentTab!.url)
                        : "Open the website you want to focus on — browser pages can't be locked."}
                    </p>
                  </div>
                </div>

                <DurationPicker seconds={draftSeconds} onChange={setDraftSeconds} disabled={!canFocusCurrentTab} />

                <p style={styles.focusDescription}>
                  Until the timer ends this tab stays on{" "}
                  <strong>{canFocusCurrentTab ? hostOf(currentTab!.url) : "this site"}</strong>. Switching tabs or
                  leaving the site asks you to confirm, and leaving ends the session.
                </p>

                <button
                  style={{
                    ...styles.primaryBtn,
                    background: "#4CAF50",
                    ...(busy || !canFocusCurrentTab || draftSeconds < MIN_SECONDS ? styles.disabledBtn : {}),
                  }}
                  disabled={busy || !canFocusCurrentTab || draftSeconds < MIN_SECONDS}
                  onClick={handleStartFocus}
                >
                  {busy ? "Starting…" : `🎯 Lock this tab for ${formatDurationLabel(draftSeconds)}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================ Stats Tab ============================ */}
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
                      <p style={styles.statTime}>{formatUsageTime(data.totalTime || 0)}</p>
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

        {/* ============================ Restrictions Tab ============================ */}
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
                  onKeyDown={(e) => e.key === "Enter" && handleAddRestrictedSite()}
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
                      onClick={async () => {
                        const s = await getSettings();
                        s.restrictedSites = s.restrictedSites.filter((r) => r.url !== site.url);
                        await saveSettings(s);
                        loadData();
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
      </div>

      <div style={styles.footer}>
        <button style={styles.settingsBtn} onClick={() => chrome.runtime.openOptionsPage()}>
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
};

/**
 * Duration editor shared by the Timer and Focus tabs: dial, h/m/s inputs and presets.
 */
const DurationPicker: React.FC<{ seconds: number; onChange: (s: number) => void; disabled?: boolean }> = ({
  seconds,
  onChange,
  disabled = false,
}) => {
  const parts = splitSeconds(seconds);

  const updatePart = (unit: "h" | "m" | "s", rawValue: string) => {
    const parsedValue = rawValue === "" ? 0 : Number(rawValue);
    if (!Number.isFinite(parsedValue)) return;
    const value = Math.max(0, Math.floor(parsedValue));
    const next = { ...parts, [unit]: value };
    onChange(Math.min(next.h * 3600 + next.m * 60 + next.s, 12 * 3600));
  };

  return (
    <>
      <ClockDial mode="edit" seconds={seconds} onChange={onChange} size={220} disabled={disabled} />
      <div style={styles.durationInputs} role="group" aria-label="Duration">
        {([
          { unit: "h", label: "Hours", max: 12, value: parts.h },
          { unit: "m", label: "Minutes", max: 59, value: parts.m },
          { unit: "s", label: "Seconds", max: 59, value: parts.s },
        ] as const).map(({ unit, label, max, value }) => (
          <label key={unit} style={styles.durationInputGroup}>
            <span style={styles.durationInputLabel}>{label}</span>
            <input
              type="number"
              min={0}
              max={max}
              step={1}
              inputMode="numeric"
              aria-label={label}
              value={value}
              disabled={disabled}
              onChange={(e) => updatePart(unit, e.target.value)}
              style={styles.durationInput}
            />
          </label>
        ))}
      </div>
      {seconds < MIN_SECONDS ? (
        <p style={styles.hintWarn}>Set at least {MIN_SECONDS} seconds.</p>
      ) : (
        <p style={styles.hint}>Enter a duration below, or adjust the dial</p>
      )}
      <div style={styles.presets} role="group" aria-label="Quick durations">
        {PRESETS.map((p) => {
          const selected = seconds === p.seconds;
          return (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              style={{ ...styles.chip, ...(selected ? styles.chipSelected : {}), ...(disabled ? styles.disabledBtn : {}) }}
              aria-pressed={selected}
              onClick={() => onChange(p.seconds)}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </>
  );
};

/**
 * A press-and-hold button: deliberate friction for leaving a focus session early,
 * without trapping the user if something urgent comes up.
 */
const HoldToConfirm: React.FC<{ label: string; onConfirm: () => void; holdMs?: number }> = ({
  label,
  onConfirm,
  holdMs = 3000,
}) => {
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | undefined>();
  const startedAt = useRef(0);

  const cancel = () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    setProgress(0);
  };

  const begin = () => {
    if (frame.current !== undefined) return;
    startedAt.current = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - startedAt.current) / holdMs);
      setProgress(p);
      if (p >= 1) {
        frame.current = undefined;
        setProgress(0);
        onConfirm();
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };

  useEffect(() => cancel, []);

  return (
    <button
      type="button"
      style={{
        ...styles.dangerOutlineBtn,
        width: "100%",
        background: `linear-gradient(to right, rgba(244,67,54,0.18) ${progress * 100}%, #fff ${progress * 100}%)`,
      }}
      aria-label={`${label} (press and hold for ${holdMs / 1000} seconds)`}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={(e) => (e.key === " " || e.key === "Enter") && cancel()}
    >
      {progress > 0 ? `Keep holding… ${Math.ceil((1 - progress) * (holdMs / 1000))}s` : label}
    </button>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "420px",
    maxHeight: "600px",
    overflowY: "auto",
    background: "#f5f5f5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "14px 16px",
    textAlign: "center",
  },
  title: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 600,
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #ddd",
    background: "white",
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    padding: "11px 4px",
    border: "none",
    background: "white",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    color: "#666",
    // Longhands (not the `borderBottom` shorthand) so React can toggle the colour cleanly
    borderBottomWidth: "3px",
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    transition: "color 0.2s, border-color 0.2s",
  },
  activeTab: {
    color: "#667eea",
    borderBottomColor: "#667eea",
  },
  content: {
    padding: "12px",
  },
  sectionTitle: {
    fontSize: "15px",
    fontWeight: 600,
    margin: "0 0 10px 0",
    color: "#333",
  },
  section: {
    background: "white",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  subtitle: {
    fontSize: "14px",
    fontWeight: 600,
    margin: "0 0 12px 0",
    color: "#555",
  },
  formGroup: {
    marginBottom: "12px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 500,
    marginBottom: "4px",
    color: "#555",
  },
  optional: {
    color: "#9ca3af",
    fontWeight: 400,
  },
  input: {
    width: "100%",
    padding: "8px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "12px",
    boxSizing: "border-box",
  },
  durationInputs: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    margin: "8px 0 4px",
  },
  durationInputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  durationInputLabel: {
    fontSize: "11px",
    color: "#6b7280",
    textAlign: "center",
  },
  durationInput: {
    width: "100%",
    padding: "8px 6px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "8px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "12px",
    minHeight: "48px",
    fontFamily: "inherit",
    boxSizing: "border-box",
    resize: "vertical",
  },
  hint: {
    textAlign: "center",
    fontSize: "11px",
    color: "#9ca3af",
    margin: "4px 0 8px",
  },
  hintWarn: {
    textAlign: "center",
    fontSize: "11px",
    color: "#d97706",
    fontWeight: 600,
    margin: "6px 0 10px",
  },
  presets: {
    display: "flex",
    gap: "6px",
    justifyContent: "center",
    marginBottom: "14px",
  },
  chip: {
    padding: "5px 12px",
    borderRadius: "999px",
    border: "1px solid #d1d5db",
    background: "white",
    color: "#4b5563",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  chipSelected: {
    background: "#667eea",
    borderColor: "#667eea",
    color: "white",
  },
  buttonRow: {
    display: "flex",
    gap: "8px",
    marginTop: "12px",
  },
  primaryBtn: {
    width: "100%",
    padding: "11px",
    background: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s, opacity 0.2s",
  },
  disabledBtn: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  dangerOutlineBtn: {
    width: "100%",
    padding: "11px",
    background: "white",
    color: "#d32f2f",
    border: "1px solid #f44336",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    userSelect: "none",
  },
  removeBtn: {
    padding: "6px 12px",
    background: "#f44336",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  settingsBtn: {
    width: "100%",
    padding: "10px",
    background: "white",
    color: "#667eea",
    border: "1px solid #667eea",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  footer: {
    padding: "10px 12px",
    borderTop: "1px solid #ddd",
    background: "white",
  },
  errorBox: {
    background: "#fdecea",
    color: "#b71c1c",
    borderLeft: "4px solid #f44336",
    padding: "10px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    marginBottom: "12px",
  },
  timerItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    background: "#f9f9f9",
    borderRadius: "6px",
    marginBottom: "8px",
  },
  timerMessage: {
    margin: "10px 0 0",
    fontSize: "13px",
    color: "#4b5563",
    textAlign: "center",
    fontStyle: "italic",
  },
  timerDuration: {
    margin: "0",
    fontSize: "12px",
    color: "#666",
  },
  aiTag: {
    fontSize: "11px",
    color: "#667eea",
    fontWeight: 600,
    fontStyle: "normal",
  },
  lockCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    background: "#e8f5e9",
    borderRadius: "8px",
    borderLeft: "4px solid #4CAF50",
    margin: "10px 0",
  },
  lockCardWarn: {
    background: "#fff8e1",
    borderLeftColor: "#f59e0b",
  },
  lockIcon: {
    fontSize: "18px",
    flexShrink: 0,
  },
  lockTitle: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: "#1f2937",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  lockSub: {
    margin: "2px 0 0",
    fontSize: "11px",
    color: "#4b5563",
  },
  focusDescription: {
    fontSize: "12px",
    color: "#555",
    lineHeight: 1.5,
    margin: "0 0 12px 0",
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
    fontWeight: 600,
    color: "#333",
  },
  statTime: {
    margin: "0",
    fontSize: "12px",
    color: "#999",
  },
  emptyText: {
    textAlign: "center",
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
    lineHeight: 1.6,
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
    fontWeight: 600,
    color: "#333",
  },
  restrictedReason: {
    margin: "0",
    fontSize: "12px",
    color: "#999",
  },
};
