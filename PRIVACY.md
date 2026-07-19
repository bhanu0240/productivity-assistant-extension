# Privacy Policy - Productivity Assistant

**Version 1.0** | Last Updated: 2024

## Our Privacy Commitment

The Productivity Assistant extension is built with **privacy as a core principle**. We believe that productivity tools should not require surveillance in return. This extension respects your data and your right to privacy.

## Key Privacy Principles

### 1. **Local-First Architecture**
- ✅ All user data is stored **exclusively on your device** using Chrome's `storage.local` API
- ✅ No data is sent to external servers without your explicit consent
- ✅ The extension does not transmit any data to its developers
- ✅ Your browsing habits stay on your machine

### 2. **No Tracking or Analytics**
- ✅ No telemetry collection (we don't track how you use the extension)
- ✅ No Google Analytics or third-party tracking
- ✅ No event logging that leaves your device
- ✅ No behavioral profiling

### 3. **Optional AI Features**
- ✅ AI integration is **completely optional**
- ✅ If you don't enable AI, nothing leaves your device
- ✅ When enabled, only **aggregated browsing statistics** (e.g., "spent 2 hours on GitHub") are sent to your chosen AI provider
- ✅ Raw URLs and detailed browsing history are **never sent** to AI providers
- ✅ API keys are stored locally and sent directly to the API provider (OpenAI or Azure)

### 4. **Data You Control**
- ✅ Export all your data anytime as a JSON file
- ✅ Delete all data with one click (irreversible)
- ✅ Pause data collection anytime (disable the extension)
- ✅ Configure exactly what data is collected

## Data Collection Details

### What Data is Collected Locally

**Site Usage Tracking:**
```
{
  domain: "github.com",
  totalTime: 7200000,  // milliseconds
  lastVisited: 1234567890,
  sessionCount: 5
}
```
- Only the domain name (not URLs)
- Time spent in milliseconds
- Last visit timestamp
- Session count

**Timer Settings:**
```
{
  duration: 25,
  message: "Take a break!",
  context: "coding"
}
```
- Duration and custom messages you set
- Work context you provide
- No data about what you were working on

**Extension Settings:**
- Blocked sites list (domains only)
- Focus mode preferences
- AI provider settings
- Notification preferences

### What Data is NOT Collected

❌ Page URLs or titles (only domain names)
❌ Search queries or form submissions
❌ Passwords or sensitive information
❌ Email addresses or personal identifiers
❌ Location data
❌ Device identifiers (unless you enable AI and choose to send)
❌ Browsing history
❌ Cache or cookies

## AI Data Sharing (Optional, Opt-In)

**IF and ONLY IF you enable AI features:**

1. **What gets sent:**
   - Aggregated domain statistics (e.g., "5 hours on github.com")
   - Context you provide (e.g., "I was coding")
   - Time-of-day information (for personalization)

2. **What does NOT get sent:**
   - Specific URLs you visited
   - Full browsing history
   - Personal identifiers
   - Location or device info

3. **Where it goes:**
   - OpenAI API (if you choose OpenAI): https://platform.openai.com/privacy
   - Azure AI API (if you choose Azure): https://azure.microsoft.com/en-us/support/legal/

4. **Your API Key:**
   - Stored **only** in your browser's local storage
   - Sent **only** to the API provider you chose
   - Never shared with extension developers

## Permissions Explained

### Why We Request Each Permission

| Permission | Why We Need It | Privacy Impact |
|-----------|---|---|
| `storage` | Save your settings locally | ✅ Stays on your device |
| `alarms` | Manage break timers | ✅ Timing data stays local |
| `tabs` | Track which sites you visit | ✅ Only domain names tracked |
| `webNavigation` | Enforce focus mode & restrictions | ✅ Enforcement is local |
| `scripting` | Show overlay warnings | ✅ UI injected locally |
| `declarativeNetRequest` | Block restricted sites | ✅ Blocking happens locally |
| `notifications` | Show break reminders | ✅ Notifications are local |

## How Your Data is Protected

1. **Encryption**: Chrome's storage API uses your operating system's encrypted storage
2. **Local-Only**: Data never leaves your device unless you explicitly send it to AI providers
3. **Clear Permissions**: Browser permissions are specific and necessary
4. **No Hidden Behavior**: Code is transparent and can be reviewed
5. **User Control**: You can export, backup, or delete data anytime

## Compliance

- ✅ **GDPR**: No personal data collection; data stored locally
- ✅ **CCPA**: Your data belongs to you; you can export/delete anytime
- ✅ **Chrome Web Store**: Compliant with all policies; transparent about data usage

## Open Source & Transparency

This extension is open-source. You can:
- ✅ Review all source code
- ✅ Audit for privacy leaks
- ✅ Build from source yourself
- ✅ Contribute improvements
- ✅ Fork for personal use

## Data Retention

- **While Extension is Active**: Data is stored in Chrome local storage
- **When Extension is Disabled/Removed**: Data remains in storage until you clear it
- **AI Data**: Sent only when you request insights; retention depends on your AI provider's policy

## Third-Party Services

This extension may use:
- **OpenAI API** (if you choose OpenAI for AI features)
- **Azure OpenAI API** (if you choose Azure for AI features)

These are optional. Review their privacy policies:
- OpenAI: https://openai.com/privacy-policy
- Azure: https://azure.microsoft.com/en-us/support/legal/

## Manifest V3 Safety

Chrome Extension Manifest V3 provides:
- ✅ Restricted background script capabilities
- ✅ Content Security Policy (CSP) enforcement
- ✅ Permission-based access to Chrome APIs
- ✅ User-controlled notifications

## Reporting Privacy Issues

If you find a privacy concern:
1. Don't share privately on GitHub/social media
2. Email security report with details
3. We'll address and credit you appropriately

## Changes to This Policy

We may update this policy to reflect:
- New features that involve data handling
- Changes in Chrome's privacy model
- Legal requirements

We will notify users of material changes before they take effect.

## FAQ

**Q: Is my browsing data sold?**
A: No. We don't sell, trade, or share any data.

**Q: Can you see my browsing history?**
A: No. We're a browser extension - we only see what you allow. No telemetry connects to us.

**Q: What if I enable AI features?**
A: Only aggregated statistics are sent to your AI provider. Raw URLs and sensitive data stay local.

**Q: Can I trust the extension?**
A: Yes! The code is open-source and reviewable. Anyone can audit it.

**Q: What happens when I uninstall?**
A: Your data stays in Chrome's storage. Reinstall anytime to access it, or manually clear it.

**Q: Does the extension work without internet?**
A: Yes, fully! AI features require internet, but core features (timers, focus mode, blocking) work offline.

---

**Last updated**: 2024
**Contact**: For privacy concerns, check the extension's support channels

We believe privacy is not a feature - it's a fundamental right. 🔒
