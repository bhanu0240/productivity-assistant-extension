# Quick Start Guide

## 📋 Prerequisites

- Node.js 16+ (check with `node --version`)
- npm 8+ (check with `npm --version`)
- Chrome/Chromium browser
- (Optional) OpenAI or Azure AI account for AI features

## 🚀 Getting Started in 5 Minutes

### 1. Install Dependencies
```bash
cd productivity-assistant
npm install
```

### 2. Build the Extension
```bash
npm run build
```

This creates a `/dist` folder with all compiled files.

### 3. Load in Chrome

**Method 1: Manual Load**
1. Open `chrome://extensions/`
2. Toggle "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `/dist` folder
5. ✅ Extension loaded!

**Method 2: Quick Script (Windows)**
```powershell
# After first build, run:
start chrome://extensions/
```
Then load unpacked → select `/dist`

### 4. Verify It's Working

1. Click the extension icon in toolbar (should show purple/blue icon)
2. You should see the popup with Timer tab active
3. Try clicking "⚙️ Settings" to open options page
4. ✅ Everything working!

## 🛠️ Development Workflow

### Build & Watch
```bash
npm run build    # One-time build
npm run dev      # Continuous build + watch
```

After changes:
1. Edit TypeScript/React files in `src/`
2. `npm run dev` rebuilds automatically
3. In Chrome: Click extension icon → click Settings (gear)
4. Reload chrome extension (in extension options)

### Debug Service Worker
1. Extension icon → Details → "Inspect views"
2. Click "service worker" link
3. Opens DevTools for background script
4. View console logs and use debugger

### Debug Content Script
1. Right-click on any webpage
2. Select "Inspect"
3. Open DevTools → Console tab
4. Content script logs appear here

### Debug Popup
1. Right-click extension icon
2. Select "Inspect popup"
3. DevTools opens for popup React component

## 🤖 Setting Up AI (Optional)

### With OpenAI

1. Get API key: https://platform.openai.com/api-keys
2. Copy your key (`sk-...`)
3. In extension: ⚙️ Settings → AI Settings
4. Enable AI Features
5. Select "OpenAI" provider
6. Paste API key
7. Model: `gpt-3.5-turbo` (or `gpt-4`)
8. Click "Test Connection" ✅
9. Save settings

**First request may take 5-10 seconds** (API response time)

### With Azure OpenAI

1. Get endpoint: Your Azure portal
2. Get API key: Your Azure portal
3. In extension: ⚙️ Settings → AI Settings
4. Enable AI Features
5. Select "Azure" provider
6. Paste: `https://your-resource.openai.azure.com|your-key`
7. Model: Your Azure deployment name
8. Click "Test Connection" ✅
9. Save settings

## 📝 Testing Features

### ⏱️ Timer Feature
1. Popup → Timer tab
2. Set duration (e.g., 25 min)
3. Leave message blank (for AI) or enter custom
4. Click "Start Timer"
5. Timer appears in list
6. Wait... timer fires, shows notification

**To test quickly**: Set duration to 1 minute, close popup, wait

### 📊 Usage Stats
1. Browse several websites naturally
2. Popup → Stats tab
3. Top sites should show with time spent
4. (With AI) Click "Get AI Insights"

### 🚫 Block Sites
1. Popup → Blocked tab
2. Enter `facebook.com` (example)
3. Click "Block Site"
4. Try visiting facebook.com
5. See warning overlay

**Test overlay dismissal**: Can you dismiss it? Can you go back?

### 🎯 Focus Mode
1. Popup → Focus tab
2. Enter `github.com` (focus site)
3. Set 5 minutes (for quick testing)
4. Click "Enable Focus Mode"
5. Try visiting `stackoverflow.com`
6. See focus mode warning
7. Click "Return to Focus Site"
8. Should redirect to github.com

## 🧪 Quick Troubleshooting

### Popup doesn't open?
```bash
# Rebuild
npm run build

# Reload extension in chrome://extensions/
```

### Messages say "undefined"?
- Check service worker is running (details page)
- Console should show no errors
- Try inspecting popup vs service worker DevTools

### Timer doesn't fire?
- Service worker might be asleep
- Click extension icon to wake it
- Try very short duration (0.5 minutes)
- Check browser notifications settings

### Overlay not showing?
- Site might have CSP (Content Security Policy)
- Try on simpler site first (e.g., example.com)
- Check content script injected: DevTools → Sources → Content Scripts

### AI not responding?
1. Check API key format
2. Test connection button first
3. Check Chrome console for 401/403 errors
4. Verify API key has credit (OpenAI)
5. Check rate limits (Azure)

## 📊 Useful Commands

```bash
npm install       # Install dependencies
npm run build     # One-time production build
npm run dev       # Development with watch
npm run type-check # TypeScript validation only
```

## 🔍 File Structure for Reference

```
src/
├── background/service-worker.ts    ← Service worker logic
├── content/content-script.ts       ← Page injection logic
├── popup/
│   ├── Popup.tsx                   ← Main UI component
│   └── index.tsx                   ← Entry point
├── options/
│   ├── Options.tsx                 ← Settings component
│   └── index.tsx                   ← Entry point
└── utils/
    ├── storage.ts                  ← Data management
    └── aiHelper.ts                 ← AI integration
```

## 🎯 Next Steps

1. ✅ Got the extension running?
2. Try each feature (timer, stats, blocking, focus mode)
3. (Optional) Set up AI for enhanced features
4. Explore the code, make modifications!
5. Check ARCHITECTURE.md for deep dive

## 📚 Documentation

- **README.md** - Feature overview & privacy
- **ARCHITECTURE.md** - Technical deep dive
- **PRIVACY.md** - Privacy policy & guarantees
- **CONTRIBUTING.md** - How to contribute (coming soon)

## 🐛 Report Issues

If something isn't working:
1. Check the console (F12)
2. Look for red error messages
3. Try rebuilding: `npm run build`
4. Restart Chrome
5. Reload extension in chrome://extensions/

---

**Happy coding! 🚀**

Need help? Check the files for inline code comments.
