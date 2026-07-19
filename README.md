# Productivity Assistant - Chrome Extension (Manifest V3)

A powerful productivity extension that helps users focus, take breaks, and gain AI-powered insights into their browsing habits.

## Features

### 🎯 Break Timer
- Set customizable break timers
- Display reminders with either user-defined text or AI-generated motivational messages
- Context-aware reminders that understand your work patterns (e.g., "You've coded for 2 hours straight — great progress! Take 5 minutes to recharge.")
- Track multiple concurrent timers

### 📊 Usage Statistics
- Automatically track time spent on each website
- Beautiful dashboard showing site-wise usage statistics
- AI-powered insights that analyze your browsing patterns (e.g., "Your peak productivity is between 9–11 AM. Try scheduling deep work then.")
- Export statistics for external analysis

### 🚫 Site Restrictions
- Configure a list of restricted/blocked sites
- Blocked sites are automatically redirected or show a warning overlay
- Add custom reasons for blocking sites
- Flexible management of blocked sites

### 🎯 Focus Mode
- Enable focus mode to restrict access to all sites except your chosen focus site
- Perfect for deep work sessions and eliminating distractions
- Warning overlay appears when trying to navigate away from focus site
- Customizable focus duration (25 minutes to 8 hours)

### 🤖 AI Integration
- **Optional AI features** that enhance productivity insights
- Choose between OpenAI (GPT-3.5, GPT-4) or Azure AI
- Personalized break reminders based on work time and time of day
- Automatic summarization of browsing patterns into actionable insights
- All API keys stored locally - never shared

## Privacy & Security

✅ **Privacy-First Design**
- All user data is stored **locally on your device** using Chrome's storage API
- No telemetry, tracking, or analytics enabled by default
- No data collection without explicit consent
- AI features are optional - work perfectly without them

✅ **Permission Transparency**
- `storage` - Save your settings locally
- `alarms` - Manage break timers
- `tabs` - Track which sites you visit
- `webNavigation` - Enforce focus mode
- `declarativeNetRequest` - Block restricted sites
- `scripting` - Show overlay warnings

✅ **Data Control**
- Export all your data as JSON anytime
- Clear all data with one click
- No third-party trackers or ads
- Open-source and auditable

## Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- Google Chrome/Chromium browser
- (Optional) OpenAI or Azure AI API key for AI features

### Local Development

1. **Clone/Download the extension**
   ```bash
   cd productivity-assistant
   npm install
   ```

2. **Build the extension**
   ```bash
   npm run build
   ```

3. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

4. **Develop with watch mode**
   ```bash
   npm run dev
   ```

## Usage Guide

### Setting Up Break Timers

1. Click the extension icon in your toolbar
2. Go to the "Timer" tab
3. Set duration (1-120 minutes)
4. (Optional) Enter a custom break message or leave blank for AI-generated
5. Click "Start Timer"

**AI-Generated Messages Example:**
- "You've coded for 2 hours straight — great progress! Take 5 minutes to recharge."
- "It's 3 PM – your energy usually dips. Grab some water and stretch for 10 minutes!"

### Viewing Usage Statistics

1. Go to the "Stats" tab in the popup
2. See your top sites by time spent
3. (If AI enabled) Click "Get AI Insights" for actionable recommendations

**Example Insights:**
- "Your peak productivity is between 9–11 AM. Try scheduling deep work then."
- "You spent 4 hours on social media this week. Consider blocking these during work hours."

### Blocking Sites

1. Go to the "Blocked" tab
2. Enter a domain (e.g., `facebook.com`, `youtube.com`)
3. Click "Block Site"
4. Users will see a warning overlay when visiting blocked sites

### Enabling Focus Mode

1. Go to the "Focus" tab
2. Enter your focus site (e.g., `github.com`)
3. Set duration (25 minutes to 8 hours)
4. Click "Enable Focus Mode"
5. All other sites will show a warning overlay with a return button

### Configuring AI (Optional)

1. Click the extension icon → ⚙️ Settings
2. Go to "AI Settings" tab
3. Enable AI features
4. Choose provider: OpenAI or Azure AI
5. Enter your API key and model name
6. Click "Test Connection"
7. Save settings

**API Key Formats:**
- **OpenAI**: `sk-...` (get from https://platform.openai.com/api-keys)
- **Azure**: `https://endpoint.openai.azure.com/|key` (endpoint and key separated by `|`)

## File Structure

```
productivity-assistant/
├── manifest.json                 # Chrome Extension manifest (V3)
├── popup.html                    # Popup UI HTML
├── options.html                  # Settings page HTML
├── rules.json                    # Declarative NetRequest rules
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── webpack.config.js             # Build config
├── src/
│   ├── background/
│   │   └── service-worker.ts     # Background service worker
│   ├── content/
│   │   └── content-script.ts     # Content script (injected in pages)
│   ├── popup/
│   │   ├── Popup.tsx             # Popup React component
│   │   └── index.tsx             # Popup entry point
│   ├── options/
│   │   ├── Options.tsx           # Settings React component
│   │   └── index.tsx             # Options entry point
│   ├── utils/
│   │   ├── storage.ts            # Chrome storage API wrapper
│   │   └── aiHelper.ts           # AI API integration
│   └── types/
│       └── index.ts              # TypeScript type definitions
├── public/
│   └── icons/                    # Extension icons (16, 48, 128 px)
└── dist/                         # Build output (generated)
```

## Component Architecture

### Service Worker (`service-worker.ts`)
**Responsibilities:**
- ⏱️ Manage break timers using `chrome.alarms`
- 🔔 Display notifications when timers complete
- 📊 Track site usage and time spent
- 🚫 Enforce focus mode and site restrictions
- 🤖 Call AI API for motivational messages and insights
- 💬 Handle messages from content scripts and popup

**Key Functions:**
```typescript
- handleStartTimer() → Create and start a break timer
- handleStopTimer() → Stop and remove a timer
- handleFocusMode() → Enable/disable focus mode
- handleAddRestrictedSite() → Add site to blocklist
- trackPageLoaded() → Check restrictions on page load
```

### Content Script (`content-script.ts`)
**Responsibilities:**
- 🎨 Inject overlay warnings/notifications into pages
- 🔗 Prevent navigation to restricted sites
- ⏹️ Enforce focus mode navigation restrictions
- ⏱️ Track time spent on each page
- 📡 Communicate with service worker via messages

**Key Features:**
- Responsive warning overlays with custom styling
- Click-blocking on non-allowed links during focus mode
- Time tracking on page unload

### Popup Component (`Popup.tsx`)
**Responsibilities:**
- 📱 Display dashboard with quick access to all features
- ⏱️ Create and manage timers
- 🎯 Configure and toggle focus mode
- 🚫 Manage blocked sites
- 📊 View usage statistics and AI insights
- Settings quick access

**Tabs:**
- **Timer**: Start/stop timers, view active timers
- **Stats**: Top sites, usage insights, AI analysis
- **Restrictions**: Add/remove blocked sites
- **Focus**: Enable/disable focus mode

### Options Page (`Options.tsx`)
**Responsibilities:**
- 🤖 Configure AI settings (provider, API key, model)
- 🔒 Display privacy information and permissions
- 💾 Export and clear all data
- Test AI connection

**Tabs:**
- **AI Settings**: Enable AI, configure OpenAI/Azure
- **Privacy**: Data collection, permissions, privacy policy
- **Data**: Export data, clear data, backup

### Storage Utilities (`storage.ts`)
**Provides:**
- Type-safe access to Chrome storage API
- Full CRUD operations for all data types
- Domain extraction helpers
- Default settings initialization

**Key Functions:**
```typescript
- getSettings() / saveSettings()
- addTimer() / removeTimer() / getActiveTimers()
- addRestrictedSite() / getRestrictedSites()
- enableFocusMode() / disableFocusMode()
- recordSiteUsage() / getUsageStats()
- getAISettings() / updateAISettings()
```

### AI Helper (`aiHelper.ts`)
**Provides:**
- OpenAI API integration
- Azure AI API integration
- Prompt engineering for motivational messages
- Statistics analysis prompts
- AI connection testing

**Key Functions:**
```typescript
- generateMotivationalMessage() → AI-generated break reminder
- generateUsageInsights() → AI analysis of browsing patterns
- testAIConnection() → Verify API credentials
```

## Data Storage Schema

### ExtensionSettings (stored in `chrome.storage.local.settings`)
```typescript
{
  timers: [
    {
      id: "timer_1234567890",
      duration: 25,
      message: "Take a break!",
      isAIGenerated: true,
      context: "coding",
      createdAt: 1234567890
    }
  ],
  restrictedSites: [
    {
      url: "facebook.com",
      domain: "facebook.com",
      addedAt: 1234567890,
      reason: "Distraction"
    }
  ],
  focusMode: {
    enabled: true,
    focusSite: "github.com",
    focusDomain: "github.com",
    startTime: 1234567890,
    duration: 25,
    allowedSites: ["github.com"]
  },
  aiSettings: {
    provider: "openai", // or "azure" or "none"
    apiKey: "sk-...",
    model: "gpt-3.5-turbo",
    enabled: true
  },
  usageStats: {
    "github.com": {
      domain: "github.com",
      totalTime: 3600000, // milliseconds
      lastVisited: 1234567890,
      sessionCount: 5
    }
  },
  notifications: [
    {
      id: "notif_1234",
      timerId: "timer_1234567890",
      message: "Break time!",
      timestamp: 1234567890,
      read: false
    }
  ]
}
```

## Building & Deployment

### Build for Production
```bash
npm run build
```
Output: `/dist/` folder ready to load as unpacked extension

### Test Before Publishing
1. Load from `/dist/` folder in developer mode
2. Test all features:
   - Start/stop timers
   - Enable/disable focus mode
   - Add/remove restricted sites
   - View statistics
   - (If AI enabled) Generate insights
3. Check permissions in Chrome
4. Verify no errors in service worker logs

### Chrome Web Store Submission
When submitting to Chrome Web Store:
1. Update `manifest.json` version number
2. Prepare 128x128 icon
3. Write compelling description highlighting privacy benefits
4. Include screenshots showing main features
5. Note all permissions and why they're needed
6. Clearly state that data is stored locally
7. If using AI: disclose that aggregate stats may be sent to AI provider

## Testing & Debugging

### Service Worker Logs
1. Extension icon → Details
2. Scroll to "Inspect views"
3. Click "service worker" link
4. View console for logs

### Content Script Logs
1. Right-click on webpage → Inspect
2. Console tab shows content script logs
3. Check for overlay injection and navigation blocking

### Storage Inspection
1. Extension icon → Details
2. Scroll to "Inspect views" → "service worker"
3. In DevTools, run: `chrome.storage.local.get(null, console.log)`

## Troubleshooting

### Timer not firing?
- Check service worker is running (gray/red circle in DevTools)
- Verify `chrome.alarms` permission in manifest
- Check browser console for errors

### Overlay not showing?
- Verify content script is injected (`<all_urls>` matches)
- Check if site uses CSP restrictions
- Look for console errors on the page

### AI not working?
- Test connection in Settings page first
- Verify API key format is correct
- Check for rate limiting errors
- Ensure internet connection

### Focus mode not blocking navigation?
- Verify domain extraction is correct
- Check if site prevents JavaScript execution
- Try disabling browser extensions that might interfere

## Privacy Policy

This extension is **privacy-first and data-respecting**:

- ✅ All data stored locally on your device
- ✅ No server-side tracking or analytics
- ✅ No third-party data sharing
- ✅ No ads or advertising networks
- ✅ Permissions clearly explained and justified
- ✅ Open source and auditable
- ✅ AI features are opt-in

**Data Usage:**
- If you enable AI features and provide an API key, aggregated browsing statistics are sent to your chosen AI provider (OpenAI or Azure) **only to generate insights**. No raw browsing history is shared.
- All API keys are stored locally and never sent anywhere except to your chosen AI provider.
- You can disable AI features anytime to keep all data completely local.

## License

MIT License - Use and modify freely!

## Support & Feedback

- Found a bug? Check the console for error messages
- Have feature suggestions? File an issue
- Want to contribute? Pull requests welcome!

---

**Built with ❤️ for focused developers everywhere.**
