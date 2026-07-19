# Architecture & Technical Deep Dive

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │   Popup.tsx      │  │  Options.tsx     │               │
│  │  (Dashboard)     │  │  (Settings)      │               │
│  │  - Timers        │  │  - AI Config     │               │
│  │  - Stats         │  │  - Privacy Info  │               │
│  │  - Focus Mode    │  │  - Data Mgmt     │               │
│  │  - Blocking      │  │  - Testing       │               │
│  └────────┬─────────┘  └────────┬─────────┘               │
│           │                      │                         │
│           └──────────┬───────────┘                         │
│                      │                                     │
└──────────────────────┼─────────────────────────────────────┘
                       │
        ┌──────────────────────────────────────────────────────┐
        │         Chrome Runtime Message Bridge              │
        └────────┬─────────────────────────┬──────────────────┘
                 │                         │
    ┌────────────▼──────────┐    ┌────────▼──────────┐
    │  Service Worker       │    │  Content Script   │
    │  (background.ts)      │    │ (content-script.ts)
    ├───────────────────────┤    ├───────────────────┤
    │ • Alarm Management    │    │ • Page Injection  │
    │ • Timer Logic         │    │ • Overlay Display │
    │ • AI Integration      │    │ • Link Blocking   │
    │ • Site Tracking       │    │ • Time Recording  │
    │ • Focus Mode Logic    │    │ • User Feedback   │
    │ • Notifications       │    │                   │
    │ • Storage Queries     │    │ (All tabs)        │
    └────┬──────────────────┘    └───────────────────┘
         │
         │
    ┌────▼──────────────────────────────────────┐
    │  Utilities & Services Layer               │
    ├──────────────────────────────────────────┤
    │                                          │
    │  ┌──────────────┐  ┌──────────────┐    │
    │  │ storage.ts   │  │ aiHelper.ts  │    │
    │  │              │  │              │    │
    │  │ • CRUD ops   │  │ • OpenAI API │    │
    │  │ • Domain     │  │ • Azure API  │    │
    │  │   helpers    │  │ • Prompts    │    │
    │  │ • Defaults   │  │ • Testing    │    │
    │  └──────────────┘  └──────────────┘    │
    │                                          │
    └────┬─────────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────────┐
    │  Data Persistence Layer                  │
    ├──────────────────────────────────────────┤
    │                                          │
    │   chrome.storage.local                   │
    │   (Encrypted by OS)                      │
    │                                          │
    │  • User Settings                         │
    │  • Active Timers                         │
    │  • Usage Statistics                      │
    │  • Restricted Sites                      │
    │  • Focus Mode Config                     │
    │  • AI Credentials                        │
    │                                          │
    └──────────────────────────────────────────┘
```

## Execution Flow

### Timer Creation Flow
```
User clicks "Start Timer"
    ↓
Popup.tsx calls chrome.runtime.sendMessage()
    ↓
Service Worker receives START_TIMER
    ↓
handleStartTimer() called
    ↓
Is AI enabled? → Yes → Generate prompt
              ↓
        Call generateMotivationalMessage()
              ↓
        openAI API / Azure API call
              ↓
        Get AI message
    ↓
Create TimerConfig object
    ↓
Save to chrome.storage.local
    ↓
Create chrome.alarm
    ↓
ACTIVE_TIMERS.set(timerId)
    ↓
Return response to Popup
    ↓
UI Updates with new timer
    ↓
(Wait for alarm...)
    ↓
chrome.alarms.onAlarm fires
    ↓
Create notification
    ↓
Broadcast to all tabs
    ↓
Content scripts show overlay (optional)
```

### Focus Mode Activation Flow
```
User enables Focus Mode
    ↓
Popup sends TOGGLE_FOCUS_MODE message
    ↓
Service Worker updates settings
    ↓
focusMode.enabled = true
focusMode.focusSite = "github.com"
    ↓
Save to storage
    ↓
Broadcast ENABLE_FOCUS_MODE to all tabs
    ↓
Content scripts:
  1. Listen for clicks
  2. Check if link domain is allowed
  3. If not: prevent click + show overlay
    ↓
User navigates away:
  1. chrome.webNavigation fires
  2. Service worker checks focusMode
  3. If not allowed domain: inject overlay
```

### Site Tracking Flow
```
User navigates to new page
    ↓
chrome.webNavigation.onCommitted fires
    ↓
Service Worker extracts domain
    ↓
SITE_TRACKER.set(tabId, {domain, startTime})
    ↓
(User browses...)
    ↓
User switches tabs OR closes tab
    ↓
chrome.tabs.onActivated fires
    ↓
Calculate time spent = now - startTime
    ↓
recordSiteUsage(domain, duration)
    ↓
Update storage.usageStats[domain]
    ↓
  totalTime += duration
    ↓
New tab starts tracking
```

## Data Flow Diagrams

### Focus Mode Enforcement
```
User clicks link to blocked domain
    ↓
Content script intercepts click
    ↓
Extract link domain
    ↓
Check if in focusMode.allowedSites
    ↓
     YES → Allow navigation
     ↓
     NO → Prevent default
         → Show overlay
         → "Return to Focus Site?"
         → User chooses:
            - Return → window.location = focusSite
            - Dismiss → Hide overlay
```

### Site Restriction Blocking
```
User navigates to facebook.com
    ↓
Content script fires PAGE_LOADED
    ↓
Service worker checks isRestrictedDomain(domain)
    ↓
   YES → Send SHOW_OVERLAY to tab
         → Display warning:
           "This site is restricted..."
         → User sees warning
         → Can dismiss or go back
    ↓
   NO → Allow page normally
```

### AI Insight Generation
```
User clicks "Get AI Insights"
    ↓
Popup calls generateUsageInsights()
    ↓
Pass usageStats to aiHelper.ts
    ↓
Build prompt with top sites
    ↓
Call appropriate AI:
  • OpenAI: POST to api.openai.com
  • Azure: POST to your-endpoint.openai.azure.com
    ↓
Send API key in headers
    ↓
Receive response
    ↓
Extract content
    ↓
Display in popup
```

## Chrome API Usage

### chrome.storage.local
```typescript
// Store data
chrome.storage.local.set({ key: value })

// Retrieve data
chrome.storage.local.get(keys, (result) => {})

// Clear all
chrome.storage.local.clear()
```
**Why**: Persistent, per-extension storage; encrypted by OS

### chrome.alarms
```typescript
// Create alarm
chrome.alarms.create(name, { delayInMinutes: 25 })

// Listen
chrome.alarms.onAlarm.addListener((alarm) => {})

// Clear
chrome.alarms.clear(name)
```
**Why**: Wake service worker on schedule; survives browser sleep

### chrome.runtime.sendMessage
```typescript
// Send from content script/popup to service worker
chrome.runtime.sendMessage({ type: "ACTION", payload: {...} })

// Listen in service worker
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {})
```
**Why**: Only API for service worker ↔ content script communication

### chrome.tabs
```typescript
// Query tabs
chrome.tabs.query({ active: true }, (tabs) => {})

// Send message to tab
chrome.tabs.sendMessage(tabId, { message })

// Get current tab
chrome.tabs.getCurrent()
```
**Why**: Interaction with user's tabs; tab tracking

### chrome.webNavigation
```typescript
// Monitor page navigation
chrome.webNavigation.onCommitted.addListener(({ url, tabId }) => {})
```
**Why**: Track when users navigate to detect focus mode violations

### chrome.notifications
```typescript
// Create notification
chrome.notifications.create(id, {
  type: "basic",
  title: "...",
  message: "...",
  iconUrl: "..."
})
```
**Why**: Display break reminders to user

### chrome.declarativeNetRequest
```json
// rules.json - Block/redirect requests
[
  {
    "id": 1,
    "action": { "type": "redirect", "redirect": { "url": "about:blank" } },
    "condition": { "urlFilter": "facebook.com" }
  }
]
```
**Why**: Network-level blocking (though we use overlay for better UX)

## Type System

### Core Types
```typescript
interface TimerConfig {
  id: string              // Unique ID
  duration: number        // Minutes
  message: string         // Reminder text
  isAIGenerated: boolean  // AI or user-provided
  context?: string        // Activity type (coding, reading, etc)
  createdAt: number       // Unix timestamp
}

interface SiteUsage {
  domain: string          // Domain name only
  totalTime: number       // Milliseconds spent
  lastVisited: number     // Unix timestamp
  sessionCount: number    // How many times visited
}

interface FocusModeConfig {
  enabled: boolean        // Is focus mode active?
  focusSite: string       // URL of focus site
  focusDomain: string     // Domain extracted
  startTime: number       // When focus started
  duration: number        // Minutes allocated
  allowedSites: string[]  // Whitelisted domains
}

interface AISettings {
  provider: "openai" | "azure" | "none"
  apiKey: string          // Stored locally only
  model: string           // Model name
  enabled: boolean        // User opted in
}
```

## Message Protocol

### Service Worker → All Content Scripts
```typescript
{
  type: "ENABLE_FOCUS_MODE" | "DISABLE_FOCUS_MODE" | 
        "SHOW_OVERLAY" | "HIDE_OVERLAY" | "TIMER_COMPLETED",
  payload: {
    message?: string
    focusSite?: string
    actionType?: "focusMode" | "blocked"
  }
}
```

### Popup/Content Script → Service Worker
```typescript
{
  type: "START_TIMER" | "STOP_TIMER" | "TOGGLE_FOCUS_MODE" |
        "ADD_RESTRICTED_SITE" | "GET_RESTRICTED_SITES" |
        "RECORD_USAGE" | "PAGE_LOADED" | "GET_TIMERS",
  payload: {
    // Varies by type
  }
}
```

## Performance Considerations

1. **Service Worker Wake-up**
   - Chrome keeps service worker dormant
   - Wakes on messages, alarms, tab events
   - Efficiency: messages are minimal, alarms are batched

2. **Storage Access**
   - Synchronous API (callbacks)
   - ~1-5ms per operation typically
   - Used sparingly in hot paths

3. **Content Script Injection**
   - All frames matching `<all_urls>`
   - Script injected at `document_start`
   - Memory footprint: ~200KB per tab

4. **UI Rendering**
   - React with local state management
   - No external HTTP requests (except AI)
   - Popup opens instantly

## Security Considerations

1. **Content Security Policy (CSP)**
   - Manifest V3 enforces strict CSP
   - Inline scripts not allowed
   - All JavaScript from trusted source files

2. **API Key Storage**
   - Stored in chrome.storage.local
   - Chrome encrypts with OS credentials
   - Not transmitted unless to API provider

3. **Input Validation**
   - All user inputs sanitized
   - Domain extraction uses URL API
   - Message truncation (150 char limit)

4. **Origin Checking**
   - Content scripts check tab origin
   - Messages only to legitimate sources
   - No cross-extension communication

## Error Handling

```typescript
// Try-catch in message handlers
chrome.runtime.onMessage.addListener((req, sender, respond) => {
  try {
    // Handle message
  } catch (error) {
    console.error("Error:", error)
    respond({ success: false, error: error.message })
  }
})

// API error handling
try {
  const response = await fetch(API_URL, options)
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
} catch (error) {
  return { success: false, error: error.message }
}
```

## Testing Strategy

1. **Unit Tests**: Storage functions, AI helpers
2. **Integration Tests**: Message passing, timer flow
3. **Manual Testing**: Feature verification in Chrome
4. **Privacy Audit**: No data leaks, local-only storage
5. **Performance: Profiling with DevTools

---

This architecture prioritizes:
- ✅ **Privacy**: No external tracking
- ✅ **Performance**: Minimal overhead
- ✅ **Maintainability**: Clear separation of concerns
- ✅ **Extensibility**: Easy to add features
