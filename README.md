# Tab Saver Pro - Chrome Extension

A Chrome extension for saving and restoring tabs using MongoDB.

## Environment Configuration

The extension now uses environment variables for configuration. This makes it easy to switch between development and production environments.

### Setup

1. **Create/Update your `.env` file:**

   ```env
   # API Base URL for the serverless functions
   API_BASE_URL=https://your-production-api.com

   # For local development:
   # API_BASE_URL=http://localhost:3000
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Generate configuration file:**

   ```bash
   npm run build:config
   ```

   This will read your `.env` file and generate the `config.js` file that the Chrome extension uses.

### Development vs Production

#### For Development:

1. Update your `.env` file:
   ```env
   API_BASE_URL=http://localhost:3000
   ```
2. Run: `npm run build:config`
3. Start your local server: `npm run dev`

#### For Production:

1. Update your `.env` file:
   ```env
   API_BASE_URL=https://your-production-api.com
   ```
2. Run: `npm run build:config`
3. Load the extension in Chrome

### File Structure

- `.env` - Environment variables (not committed to git)
- `config.js` - Generated configuration file (used by the extension)
- `scripts/build-config.js` - Script to generate config from .env
- `background.js` - Chrome extension background script
- `server.js` - Express server for API endpoints

### API Endpoints

The following endpoints are configured:

- `/test-connection` - Test MongoDB connection
- `/save-tab` - Save a single tab
- `/save-all-tabs` - Save all open tabs
- `/load-tabs` - Load saved tabs for a specific date
- `/delete-tab` - Delete a specific tab
- `/web-analysis` - Analyze webpage content with AI (NEW)

### Notes

- The `.env` file should not be committed to version control
- Always run `npm run build:config` after updating your `.env` file
- The Chrome extension uses the generated `config.js` file, not the `.env` file directly

## Installation for Users

### Quick Start (Recommended)

1. **Download the extension:**
   - Go to [Releases](../../releases) and download the latest `nekohack-extension.zip`
   - Or clone this repository: `git clone https://github.com/yourusername/nekohack.git`

2. **Install in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the downloaded/cloned folder
   - The extension icon should appear in your Chrome toolbar

3. **Start using:**
   - Click the extension icon to open the popup
   - Use "Save Current Tab" or "Save All Tabs" to store your tabs
   - Use "Load Saved Tabs" to restore them later

### Features

- 🔖 **Save individual tabs** - Preserve important pages for later
- 📚 **Save all open tabs** - Backup your entire browsing session
- 📅 **Date-organized storage** - Easily find tabs saved on specific dates
- 🗑️ **Delete saved tabs** - Remove tabs you no longer need
- ☁️ **Cloud storage** - Your tabs are saved to MongoDB (persistent across devices)
- 🤖 **AI Web Analysis** - Analyze any webpage with AI-powered insights using Google Gemini

### How to Use

1. **Saving Tabs:**
   - Click the extension icon in your toolbar
   - Choose "Save Current Tab" to save the active tab
   - Choose "Save All Tabs" to save every open tab in the current window

2. **Loading Tabs:**
   - Click "Load Saved Tabs" in the popup
   - Select a date from the dropdown to see tabs saved on that day
   - Click any tab title to open it, or "Load All" to open all tabs from that date

3. **Managing Tabs:**
   - Use the delete button (🗑️) next to any saved tab to remove it
   - Tabs are automatically organized by the date they were saved

4. **AI Web Analysis:** (NEW)
   - Enter your Google Gemini API key in the "Web Page Analysis" section
   - Provide any website URL you want to analyze
   - Ask specific questions about the webpage content
   - Get AI-powered insights, summaries, and answers to your questions
   - Examples: "Summarize the main points", "What is this article about?", "Extract key insights"

### Troubleshooting

If the extension isn't working:
- Make sure you have an internet connection (for cloud storage)
- Check that the extension is enabled in `chrome://extensions/`
- Try refreshing the page and using the extension again

### For Developers

If you want to set up your own backend or contribute to development, see the [Development Setup](#setup) section above.