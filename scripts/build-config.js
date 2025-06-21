const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Read environment variables
const API_BASE_URL =
  process.env.API_BASE_URL || "https://your-serverless-api.com";

// Generate config.js content
const configContent = `// Configuration for the Chrome Extension
// This file is auto-generated from environment variables

const config = {
  // API Base URL from environment
  API_BASE_URL: '${API_BASE_URL}',
  
  // API endpoints
  endpoints: {
    testConnection: '/test-connection',
    saveTab: '/save-tab',
    saveAllTabs: '/save-all-tabs',
    loadTabs: '/load-tabs',
    deleteTab: '/delete-tab'
  }
};

// Function to get the full API URL
function getApiUrl(endpoint) {
  return config.API_BASE_URL + config.endpoints[endpoint];
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { config, getApiUrl };
}`;

// Write the config.js file
const configPath = path.join(__dirname, "..", "config.js");
fs.writeFileSync(configPath, configContent);

console.log(`✅ Configuration file generated successfully!`);
console.log(`📝 API Base URL: ${API_BASE_URL}`);
console.log(`📁 Config file: ${configPath}`);
