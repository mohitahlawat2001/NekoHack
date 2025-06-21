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

### Notes

- The `.env` file should not be committed to version control
- Always run `npm run build:config` after updating your `.env` file
- The Chrome extension uses the generated `config.js` file, not the `.env` file directly
