#!/usr/bin/env node

/**
 * Setup script to prepare the extension for development
 * Creates placeholder icons and verifies setup
 */

const fs = require("fs");
const path = require("path");

const ICON_DIR = path.join(__dirname, "public", "icons");

console.log("🚀 Setting up Productivity Assistant...\n");

// Create icons directory if it doesn't exist
if (!fs.existsSync(ICON_DIR)) {
  fs.mkdirSync(ICON_DIR, { recursive: true });
  console.log("✅ Created icons directory");
}

// Create placeholder icons (1x1 transparent PNG as placeholder)
const PLACEHOLDER_ICON = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const icons = ["icon-16.png", "icon-48.png", "icon-128.png"];

icons.forEach((icon) => {
  const filePath = path.join(ICON_DIR, icon);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, PLACEHOLDER_ICON);
    console.log(`✅ Created placeholder ${icon}`);
  }
});

console.log("\n📝 Setup checklist:");
console.log("  ✅ Directories created");
console.log("  ✅ Placeholder icons generated");
console.log("  ⏭️  Next: npm install");
console.log("  ⏭️  Then: npm run build");
console.log("  ⏭️  Finally: Load /dist folder in chrome://extensions/\n");

console.log("🎯 To set up AI (optional):");
console.log("  1. Go to chrome-extension://[ID]/options.html");
console.log("  2. Enable AI features");
console.log("  3. Enter your OpenAI or Azure API key\n");

console.log("Ready to go! 🚀\n");
