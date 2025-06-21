// API configuration
const API_BASE_URL = "http://localhost:3000";

// Handle messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.action);
  
  switch (request.action) {
    case "testMongoDBConnection":
      testConnection(request.mongodbUri)
        .then((result) => {
          console.log('Test connection result:', result);
          sendResponse(result);
        })
        .catch((error) => {
          console.error('Test connection error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "saveTab":
      saveTabToMongoDB(request.mongodbUri, request.tabData)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case "saveAllTabs":
      saveAllTabsToMongoDB(request.mongodbUri, request.tabsData)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case "loadTabs":
      loadTabsFromMongoDB(request.mongodbUri, request.date, request.groupName)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case "loadGroups":
      loadGroupsFromMongoDB(request.mongodbUri)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case "deleteTab":
      deleteTabFromMongoDB(request.mongodbUri, request.tabId)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case "deleteGroup":
      deleteGroupFromMongoDB(request.mongodbUri, request.groupName)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

// Test MongoDB connection
async function testConnection(mongodbUri) {
  try {
    console.log('Testing connection to:', `${API_BASE_URL}/test-connection`);
    
    const response = await fetch(`${API_BASE_URL}/test-connection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mongodbUri }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Connection test result:', result);
    return result;
  } catch (error) {
    console.error("Connection test failed:", error);
    return { success: false, error: error.message };
  }
}

// Save a tab to MongoDB
async function saveTabToMongoDB(mongodbUri, tabData) {
  try {
    const response = await fetch(`${API_BASE_URL}/save-tab`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mongodbUri, tabData }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Save tab failed:", error);
    return { success: false, error: error.message };
  }
}

// Save all tabs to MongoDB
async function saveAllTabsToMongoDB(mongodbUri, tabsData) {
  try {
    const response = await fetch(`${API_BASE_URL}/save-all-tabs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mongodbUri, tabsData }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Save all tabs failed:", error);
    return { success: false, error: error.message };
  }
}

// Load tabs from MongoDB
async function loadTabsFromMongoDB(mongodbUri, date, groupName) {
  try {
    const response = await fetch(`${API_BASE_URL}/load-tabs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mongodbUri, date, groupName }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Load tabs failed:", error);
    return { success: false, error: error.message };
  }
}

// Load groups from MongoDB
async function loadGroupsFromMongoDB(mongodbUri) {
  try {
    const response = await fetch(`${API_BASE_URL}/load-groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mongodbUri }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Load groups failed:", error);
    return { success: false, error: error.message };
  }
}

// Delete a tab from MongoDB
async function deleteTabFromMongoDB(mongodbUri, tabId) {
  try {
    const response = await fetch(`${API_BASE_URL}/delete-tab`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mongodbUri, tabId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Delete tab failed:", error);
    return { success: false, error: error.message };
  }
}

// Delete a group from MongoDB
async function deleteGroupFromMongoDB(mongodbUri, groupName) {
  try {
    const response = await fetch(`${API_BASE_URL}/delete-group`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mongodbUri, groupName }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Delete group failed:", error);
    return { success: false, error: error.message };
  }
}