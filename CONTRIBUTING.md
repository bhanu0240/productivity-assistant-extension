# Contributing Guide

We'd love your contributions! This guide explains how to develop, test, and contribute improvements to Productivity Assistant.

## 🤝 Code of Conduct

- Be respectful and inclusive
- Focus on the code, not the person
- Help others learn
- Report issues constructively

## 🚀 Getting Started

### 1. Fork & Clone
```bash
git clone https://github.com/yourusername/productivity-assistant.git
cd productivity-assistant
npm install
```

### 2. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 3. Build & Test
```bash
npm run dev           # Continuous build
# Load /dist in chrome://extensions/ (DevTools for debugging)
```

## 📋 Development Workflow

### Adding a New Feature

1. **Plan**: Update README.md and type definitions first
2. **Implement**: 
   - Service worker logic in `src/background/service-worker.ts`
   - UI in `src/popup/Popup.tsx` or `src/options/Options.tsx`
   - Storage in `src/utils/storage.ts`
3. **Test**: Try all edge cases
4. **Document**: Update ARCHITECTURE.md
5. **Commit**: Clear, descriptive messages

### File Organization

```
src/
├── background/           # Service worker only
├── content/              # Content scripts only
├── popup/                # Popup React component only
├── options/              # Options React component only
├── utils/                # Shared utilities
└── types/                # Shared types
```

**Rule**: Keep concerns separate. Don't put UI logic in service worker or vice versa.

## ✅ Code Standards

### TypeScript
```typescript
// ✅ DO: Type everything
function recordUsage(domain: string, duration: number): Promise<void>

// ❌ DON'T: Use any
function recordUsage(domain: any, duration: any): any
```

### React Components
```typescript
// ✅ DO: Functional components with hooks
const MyComponent: React.FC = () => {
  const [state, setState] = useState(initialValue)
  return <div>{state}</div>
}

// ❌ DON'T: Class components
class MyComponent extends React.Component { ... }
```

### Comments
```typescript
// ✅ DO: Explain WHY
// We use chrome.alarms because they persist across browser sleep
chrome.alarms.create(name, { delayInMinutes })

// ❌ DON'T: State the obvious
// Create an alarm
chrome.alarms.create(name, { delayInMinutes })
```

### Naming
```typescript
// ✅ DO: Clear, descriptive names
const activeTimers: Map<string, TimerConfig> = new Map()

// ❌ DON'T: Abbreviated or unclear
const at: Map<string, any> = new Map()
```

## 🧪 Testing

### Manual Testing Checklist
Before submitting a PR:

- [ ] Feature works as designed
- [ ] No console errors
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Tested on real Chrome browser
- [ ] Service worker appears in DevTools
- [ ] Content scripts injected correctly
- [ ] UI is responsive and styled

### Testing Different Scenarios

**Timer Features:**
- [ ] Create timer with AI message
- [ ] Create timer with custom message
- [ ] Timer completes and notifies
- [ ] Stop timer before completion
- [ ] Multiple timers run concurrently

**Site Tracking:**
- [ ] Switch between tabs, usage increases
- [ ] Domain names extracted correctly
- [ ] Stats update in real-time
- [ ] Stats persist after reload

**Focus Mode:**
- [ ] Can't navigate away to other domains
- [ ] Can navigate within allowed domains
- [ ] Overlay appears with warnings
- [ ] Can dismiss and return to focus site
- [ ] Focus mode expires after duration

**Blocking:**
- [ ] Blocked sites show warning overlay
- [ ] Overlay has clear dismiss button
- [ ] Multiple sites can be blocked
- [ ] Can remove blocked sites

**Settings:**
- [ ] AI settings save correctly
- [ ] API key test works (if configured)
- [ ] Privacy policy displays
- [ ] Data export creates JSON file
- [ ] Data clear warning appears

## 🔧 Debugging Tips

### Service Worker Logs
```javascript
// In service-worker.ts
console.log("Debug info:", data)

// View in: Extension → Details → Inspect views → service worker
```

### Content Script Logs
```javascript
// In content-script.ts
console.log("Content script:", info)

// View in: Page → Right-click → Inspect → Console
```

### Chrome Storage
```javascript
// In DevTools console (service worker or popup):
chrome.storage.local.get(null, (data) => {
  console.log("All storage:", data)
})
```

### Breakpoint Debugging
1. Open DevTools for service worker/popup
2. Click line number to set breakpoint
3. Trigger the code
4. DevTools pauses at breakpoint
5. Step through with debugger

## 📝 Commit Message Format

```
feat(feature): Brief description (50 chars max)

Longer explanation of what changed and why.
Wrap at 72 characters.

Fixes #123
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring (no behavior change)
- `docs`: Documentation update
- `test`: Test addition/update
- `style`: Code formatting
- `perf`: Performance improvement

## 🔄 Pull Request Process

1. **Create PR** with clear title and description
2. **Link issue**: "Fixes #123" in description
3. **Describe changes**: What changed? Why?
4. **Checklist**:
   - [ ] Code passes TypeScript check
   - [ ] Manually tested in Chrome
   - [ ] Console has no errors
   - [ ] Documentation updated
   - [ ] Commit messages are clear

5. **Wait for review**
6. **Address feedback** in additional commits
7. **Merge when approved**

## 🐛 Reporting Bugs

When reporting a bug, include:

```
Title: [Bug] Brief description

Steps to reproduce:
1. Click X
2. Wait Y seconds
3. Observe Z

Expected: Should do A
Actual: Does B

Environment:
- Chrome version: X.Y.Z
- OS: Windows/Mac/Linux
- Extension version: 1.0.0

Logs/Screenshots:
[Paste any console errors or screenshots]
```

## 💡 Feature Requests

When suggesting features:

```
Title: [Feature] Brief description

Problem: What need does this solve?

Proposed solution: How should it work?

Alternatives: Other approaches?

Example/Mockup: [If applicable]
```

## 🏗️ Architecture Improvements

Before proposing architectural changes:

1. **Discuss first**: Open an issue
2. **Document**: How would it work?
3. **Impact**: What changes are needed?
4. **Migration**: How to migrate existing code?
5. **Performance**: Will it affect performance?

## 📚 Learning Resources

- [Chrome Extension V3 API](https://developer.chrome.com/docs/extensions/)
- [React Hooks Documentation](https://react.dev/reference/react)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Webpack Documentation](https://webpack.js.org/concepts/)

## 🎓 Good PRs to Start With

Ideal first contributions:
- [ ] Add feature documentation
- [ ] Fix typos in comments
- [ ] Improve error messages
- [ ] Add type safety
- [ ] Optimize performance
- [ ] Add new test cases

## 🚫 What Won't Be Accepted

- PRs without description
- Changes that break privacy guarantees
- Code without type safety
- Features requiring external tracking
- Changes to manifest.json permissions without security review
- Unformatted or unclear code

## ✨ Recognition

Contributors are:
- Listed in README.md
- Thanked in commit messages
- Featured in releases

## 📞 Get Help

- **Questions?** Open a discussion
- **Stuck?** Comment on the issue
- **Need guidance?** DM or email

## 🔐 Security Reporting

**⚠️ For security issues, DO NOT open a public issue**

Instead:
1. Email security details privately
2. Allow time for fix before disclosure
3. We'll credit you appropriately

## 🎯 Project Goals

Keep in mind our core principles:
1. **Privacy First**: No user tracking
2. **Simple & Fast**: Minimal overhead
3. **Well-Documented**: Easy to understand
4. **TypeScript**: Full type safety
5. **React**: Modern, maintainable UI

## 📖 Additional Resources

- [File Manifest](FILE_MANIFEST.md) - Complete file reference
- [Architecture](ARCHITECTURE.md) - Deep technical dive
- [Privacy Policy](PRIVACY.md) - Data handling details
- [Quick Start](QUICK_START.md) - Developer setup

---

## 🎉 Thank You!

Your contributions make Productivity Assistant better for everyone. We appreciate your time and effort!

**Happy coding! 🚀**
