// Store the actual secret key temporarily for display
let currentSecretKey = "";
let isCurrentKeyVisible = false;

document.addEventListener("DOMContentLoaded", () => {
  // Set current date as default
  const today = "2025-06-22";
  document.getElementById("date-filter").value = today;

  // Set today's date as default group name
  document.getElementById("new-group-name").value = today;
  document.getElementById(
    "new-group-name"
  ).placeholder = `Enter new group name (default: ${today})`;
  updateCurrentGroupDisplay();

  // Initialize tab navigation
  initializeTabNavigation();

  // Load stored data from storage
  loadStoredData();

  // Event listeners
  setupEventListeners();
});

// Tab Navigation Functions
function initializeTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
      
      // Load data for specific tabs when they become active
      if (targetTab === 'scheduled-tasks') {
        loadScheduledTasks();
        loadTaskResults();
      }
    });
  });
}

function loadStoredData() {
  // Check if we're running in a Chrome extension context
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(
      ["mongodbUri", "hasSecretKey", "secretKeyDisplay"],
      (result) => {
        if (result.mongodbUri) {
          document.getElementById("mongodb-uri").value = result.mongodbUri;
          updateConnectionStatus("Connection saved", "success");
        }

        if (result.hasSecretKey && result.secretKeyDisplay) {
          currentSecretKey = result.secretKeyDisplay;
          showCurrentKeySection();
          updateCurrentKeyDisplay();
          updateEncryptionStatus(
            "Secret key is set - data will be encrypted",
            "success"
          );
          loadExistingGroups();
          loadSavedTabs();
        } else {
          hideCurrentKeySection();
          updateEncryptionStatus(
            "No secret key set - data will be stored unencrypted",
            "warning"
          );
        }
      }
    );
  } else {
    // Running as web application - use localStorage instead
    const mongodbUri = localStorage.getItem('mongodbUri');
    const hasSecretKey = localStorage.getItem('hasSecretKey');
    const secretKeyDisplay = localStorage.getItem('secretKeyDisplay');
    
    if (mongodbUri) {
      document.getElementById("mongodb-uri").value = mongodbUri;
      updateConnectionStatus("Connection saved", "success");
    }

    if (hasSecretKey && secretKeyDisplay) {
      currentSecretKey = secretKeyDisplay;
      showCurrentKeySection();
      updateCurrentKeyDisplay();
      updateEncryptionStatus(
        "Secret key is set - data will be encrypted",
        "success"
      );
      loadExistingGroups();
      loadSavedTabs();
    } else {
      hideCurrentKeySection();
      updateEncryptionStatus(
        "No secret key set - data will be stored unencrypted",
        "warning"
      );
    }
  }
}

function setupEventListeners() {
  document
    .getElementById("save-connection")
    .addEventListener("click", handleSaveConnection);
  document
    .getElementById("save-secret-key")
    .addEventListener("click", handleSaveSecretKey);
  document
    .getElementById("update-secret-key")
    .addEventListener("click", handleUpdateSecretKey);
  document
    .getElementById("clear-secret-key")
    .addEventListener("click", handleClearSecretKey);
  document
    .getElementById("toggle-key-visibility")
    .addEventListener("click", toggleKeyVisibility);
  document
    .getElementById("toggle-current-key-visibility")
    .addEventListener("click", toggleCurrentKeyVisibility);
  document
    .getElementById("copy-current-key")
    .addEventListener("click", copyCurrentKey);
  document
    .getElementById("toggle-gemini-key-visibility")
    .addEventListener("click", toggleGeminiKeyVisibility);
  document
    .getElementById("analyze-webpage")
    .addEventListener("click", handleAnalyzeWebpage);
  
  // Scheduled tasks event listeners
  document
    .getElementById("schedule-preset")
    .addEventListener("change", handleSchedulePresetChange);
  document
    .getElementById("toggle-task-gemini-key-visibility")
    .addEventListener("click", toggleTaskGeminiKeyVisibility);
  document
    .getElementById("check-robots")
    .addEventListener("click", handleCheckRobots);
  document
    .getElementById("create-task")
    .addEventListener("click", handleCreateTask);
  document
    .getElementById("refresh-tasks")
    .addEventListener("click", loadScheduledTasks);
  document
    .getElementById("refresh-results")
    .addEventListener("click", loadTaskResults);
  document
    .getElementById("task-filter")
    .addEventListener("change", loadTaskResults);
    
  // Tab management event listeners
  document
    .getElementById("save-current-tab")
    .addEventListener("click", handleSaveCurrentTab);
  document
    .getElementById("save-all-tabs")
    .addEventListener("click", handleSaveAllTabs);
  document
    .getElementById("refresh-tabs")
    .addEventListener("click", handleRefreshTabs);
  document
    .getElementById("group-filter")
    .addEventListener("change", handleRefreshTabs);

  // Group selection event listeners
  document
    .getElementById("new-group-radio")
    .addEventListener("click", handleGroupMethodChange);
  document
    .getElementById("existing-group-radio")
    .addEventListener("click", handleGroupMethodChange);
  document
    .getElementById("new-group-name")
    .addEventListener("input", updateCurrentGroupDisplay);
  document
    .getElementById("existing-groups-select")
    .addEventListener("change", updateCurrentGroupDisplay);

  // Also listen for change events
  document
    .getElementById("new-group-radio")
    .addEventListener("change", handleGroupMethodChange);
  document
    .getElementById("existing-group-radio")
    .addEventListener("change", handleGroupMethodChange);

  // Add event listener for search bar
  document
    .getElementById("search-bar")
    .addEventListener("input", handleSearch);
}

// Encryption Functions
async function encryptData(data, secretKey) {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    const keyBuffer = encoder.encode(
      secretKey.padEnd(32, "0").substring(0, 32)
    ); // Ensure 32 bytes

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes IV for AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt data");
  }
}

async function decryptData(encryptedData, secretKey) {
  try {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const combined = new Uint8Array(
      atob(encryptedData)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const keyBuffer = encoder.encode(
      secretKey.padEnd(32, "0").substring(0, 32)
    );

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      encrypted
    );

    return JSON.parse(decoder.decode(decrypted));
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error(
      "Failed to decrypt data - wrong secret key or corrupted data"
    );
  }
}

function getStoredSecretKey() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(["secretKey"], (result) => {
        resolve(result.secretKey || null);
      });
    } else {
      resolve(localStorage.getItem('secretKey') || null);
    }
  });
}

function setStorageData(data) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  } else {
    Object.keys(data).forEach(key => {
      localStorage.setItem(key, data[key]);
    });
    return Promise.resolve();
  }
}

function getStorageData(keys) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(keys, resolve);
    } else {
      const result = {};
      keys.forEach(key => {
        result[key] = localStorage.getItem(key);
      });
      resolve(result);
    }
  });
}

function removeStorageData(keys) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(keys, resolve);
    } else {
      keys.forEach(key => {
        localStorage.removeItem(key);
      });
      resolve();
    }
  });
}

function showCurrentKeySection() {
  document.getElementById("current-key-section").classList.remove("hidden");
  document.getElementById("save-secret-key").classList.add("hidden");
  document.getElementById("update-secret-key").classList.remove("hidden");
}

function hideCurrentKeySection() {
  document.getElementById("current-key-section").classList.add("hidden");
  document.getElementById("save-secret-key").classList.remove("hidden");
  document.getElementById("update-secret-key").classList.add("hidden");
}

function updateCurrentKeyDisplay() {
  const currentKeyEl = document.getElementById("current-key-display");
  const toggleIcon = document
    .getElementById("toggle-current-key-visibility")
    .querySelector("i");

  if (isCurrentKeyVisible && currentSecretKey) {
    currentKeyEl.textContent = currentSecretKey;
    currentKeyEl.className = "visible-key pr-12";
    toggleIcon.className = "fas fa-eye-slash";
    document.getElementById("toggle-current-key-visibility").title = "Hide Key";
  } else if (currentSecretKey) {
    currentKeyEl.textContent = "•".repeat(currentSecretKey.length);
    currentKeyEl.className = "masked-key pr-12";
    toggleIcon.className = "fas fa-eye";
    document.getElementById("toggle-current-key-visibility").title = "Show Key";
  }
}

function toggleKeyVisibility() {
  const keyInput = document.getElementById("secret-key");
  const toggleIcon = document.getElementById("toggle-key-visibility");

  if (keyInput.type === "password") {
    keyInput.type = "text";
    toggleIcon.className = "fas fa-eye-slash password-toggle";
    toggleIcon.title = "Hide secret key";
  } else {
    keyInput.type = "password";
    toggleIcon.className = "fas fa-eye password-toggle";
    toggleIcon.title = "Show secret key";
  }
}

function toggleCurrentKeyVisibility() {
  isCurrentKeyVisible = !isCurrentKeyVisible;
  updateCurrentKeyDisplay();
}

function copyCurrentKey() {
  if (currentSecretKey) {
    navigator.clipboard
      .writeText(currentSecretKey)
      .then(() => {
        showNotification("Secret key copied to clipboard!", "success");
      })
      .catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = currentSecretKey;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        showNotification("Secret key copied to clipboard!", "success");
      });
  }
}

function handleSaveSecretKey() {
  const secretKey = document.getElementById("secret-key").value.trim();

  if (!secretKey) {
    showNotification("Please enter a secret key", "error");
    return;
  }

  if (secretKey.length < 8) {
    showNotification("Secret key must be at least 8 characters long", "error");
    return;
  }

  // Store both hashed and display versions
  const hashedKey = btoa(secretKey + "tab-saver-salt"); // Simple hash with salt
  currentSecretKey = secretKey;

  setStorageData({
    secretKey: hashedKey,
    secretKeyDisplay: secretKey, // Store for display purposes
    hasSecretKey: true,
  }).then(() => {
    showCurrentKeySection();
    updateCurrentKeyDisplay();
    updateEncryptionStatus(
      "Secret key saved - data will be encrypted",
      "success"
    );
    showNotification("Secret key saved successfully!", "success");

    loadExistingGroups();
    loadSavedTabs();
  });
}

function handleUpdateSecretKey() {
  const secretKey = document.getElementById("secret-key").value.trim();

  if (!secretKey) {
    showNotification("Please enter a new secret key", "error");
    return;
  }

  if (secretKey.length < 8) {
    showNotification("Secret key must be at least 8 characters long", "error");
    return;
  }

  // Store both hashed and display versions
  const hashedKey = btoa(secretKey + "tab-saver-salt");
  currentSecretKey = secretKey;

  setStorageData({
    secretKey: hashedKey,
    secretKeyDisplay: secretKey,
    hasSecretKey: true,
  }).then(() => {
    updateCurrentKeyDisplay();
    updateEncryptionStatus(
      "Secret key updated - data will be encrypted with new key",
      "success"
    );
    showNotification("Secret key updated successfully!", "success");

    loadExistingGroups();
    loadSavedTabs();
  });
}

function handleClearSecretKey() {
  removeStorageData([
    "secretKey",
    "secretKeyDisplay", 
    "hasSecretKey"
  ]).then(() => {
    currentSecretKey = "";
    hideCurrentKeySection();
    updateEncryptionStatus(
      "No secret key set - data will be stored unencrypted",
      "warning"
    );
    showNotification("Secret key cleared", "info");
    document.getElementById("secret-key").value = "";
    loadExistingGroups();
    loadSavedTabs();
  });
}

function updateEncryptionStatus(message, type) {
  const statusEl = document.getElementById("encryption-status");
  statusEl.textContent = message;

  if (type === "success") {
    statusEl.style.color = "var(--accent-green)";
  } else if (type === "warning") {
    statusEl.style.color = "var(--accent-yellow)";
  } else {
    statusEl.style.color = "var(--text-muted)";
  }
}

function handleGroupMethodChange() {
  const isNewGroup = document.getElementById("new-group-radio").checked;
  const isExistingGroup = document.getElementById(
    "existing-group-radio"
  ).checked;

  const newGroupSection = document.getElementById("new-group-section");
  const existingGroupSection = document.getElementById(
    "existing-group-section"
  );

  if (isNewGroup) {
    newGroupSection.classList.remove("hidden");
    existingGroupSection.classList.add("hidden");
  } else if (isExistingGroup) {
    newGroupSection.classList.add("hidden");
    existingGroupSection.classList.remove("hidden");
  }

  updateCurrentGroupDisplay();
}

function getCurrentGroupName() {
  const isNewGroup = document.getElementById("new-group-radio").checked;

  if (isNewGroup) {
    const newGroupName = document.getElementById("new-group-name").value.trim();
    return newGroupName || "2025-06-22";
  } else {
    const existingGroupName = document.getElementById(
      "existing-groups-select"
    ).value;
    if (!existingGroupName) {
      return "Please select a group";
    }
    return existingGroupName;
  }
}

function getCurrentNotes() {
  return document.getElementById("tab-notes").value.trim();
}

function updateCurrentGroupDisplay() {
  const currentGroup = getCurrentGroupName();
  const displayEl = document.getElementById("current-group-display");
  displayEl.textContent = currentGroup;

  if (currentGroup === "Please select a group") {
    displayEl.style.color = "var(--accent-red)";
  } else {
    displayEl.style.color = "var(--text-primary)";
  }
}

function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification ${
    type === "success"
      ? "bg-green-500 text-white"
      : type === "error"
      ? "bg-red-500 text-white"
      : type === "warning"
      ? "bg-yellow-500 text-white"
      : "bg-blue-500 text-white"
  }`;
  notification.innerHTML = `<i class="fas ${
    type === "success"
      ? "fa-check-circle"
      : type === "error"
      ? "fa-exclamation-circle"
      : type === "warning"
      ? "fa-exclamation-triangle"
      : "fa-info-circle"
  } fa-icon"></i>${message}`;

  // Add to document
  document.body.appendChild(notification);

  // Auto remove after 4 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

function updateConnectionStatus(message, type) {
  const statusEl = document.getElementById("connection-status");
  statusEl.innerHTML = `<i class="fas ${
    type === "success"
      ? "fa-check-circle"
      : type === "error"
      ? "fa-times-circle"
      : "fa-info-circle"
  } fa-icon"></i>${message}`;

  if (type === "success") {
    statusEl.style.color = "var(--accent-green)";
  } else if (type === "error") {
    statusEl.style.color = "var(--accent-red)";
  } else {
    statusEl.style.color = "var(--text-muted)";
  }
}

function handleSaveConnection() {
  const mongodbUri = document.getElementById("mongodb-uri").value.trim();
  if (!mongodbUri) {
    updateConnectionStatus("Please enter a valid MongoDB URI", "error");
    showNotification("Please enter a valid MongoDB URI", "error");
    return;
  }

  updateConnectionStatus("Testing connection...", "");

  // Try Chrome extension context first, fallback to direct API call
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage(
      { action: "testMongoDBConnection", mongodbUri },
      (response) => {
        if (response && response.success) {
          setStorageData({ mongodbUri }).then(() => {
            updateConnectionStatus("Connection successful and saved", "success");
            showNotification("MongoDB connection successful!", "success");
            loadExistingGroups();
            loadSavedTabs();
          });
        } else {
          const errorMsg = `Connection failed: ${
            response ? response.error : "Unknown error"
          }`;
          updateConnectionStatus(errorMsg, "error");
          showNotification(errorMsg, "error");
        }
      }
    );
  } else {
    // Web application mode - make direct API call
    makeAPICall('/test-connection', { mongodbUri })
      .then(response => {
        if (response.success) {
          setStorageData({ mongodbUri }).then(() => {
            updateConnectionStatus("Connection successful and saved", "success");
            showNotification("MongoDB connection successful!", "success");
            loadExistingGroups();
            loadSavedTabs();
          });
        } else {
          throw new Error(response.error);
        }
      })
      .catch(error => {
        const errorMsg = `Connection failed: ${error.message}`;
        updateConnectionStatus(errorMsg, "error");
        showNotification(errorMsg, "error");
      });
  }
}

function handleSaveCurrentTab() {
  const groupName = getCurrentGroupName();
  if (!groupName || groupName === "Please select a group") {
    showNotification("Please select or enter a group name", "error");
    return;
  }

  // Show loading state
  const button = document.getElementById("save-current-tab");
  const originalHTML = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin fa-icon"></i>Saving...';
  button.disabled = true;

  // Check if we're in Chrome extension context
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const notes = getCurrentNotes();
        saveTab(tabs[0], groupName, notes, () => {
          // Reset button state
          button.innerHTML = originalHTML;
          button.disabled = false;
        });
      } else {
        button.innerHTML = originalHTML;
        button.disabled = false;
        showNotification("No active tab found", "error");
      }
    });
  } else {
    // Web application mode - create a mock tab for the current page
    const mockTab = {
      title: document.title,
      url: window.location.href,
      favIconUrl: document.querySelector('link[rel="icon"]')?.href || ""
    };
    
    const notes = getCurrentNotes();
    saveTab(mockTab, groupName, notes, () => {
      // Reset button state
      button.innerHTML = originalHTML;
      button.disabled = false;
    });
  }
}

function handleSaveAllTabs() {
  const groupName = getCurrentGroupName();
  if (!groupName || groupName === "Please select a group") {
    showNotification("Please select or enter a group name", "error");
    return;
  }

  // Show loading state
  const button = document.getElementById("save-all-tabs");
  const originalHTML = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin fa-icon"></i>Saving...';
  button.disabled = true;

  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const notes = getCurrentNotes();
      saveAllTabs(tabs, groupName, notes, () => {
        // Reset button state
        button.innerHTML = originalHTML;
        button.disabled = false;
      });
    } else {
      button.innerHTML = originalHTML;
      button.disabled = false;
      showNotification("No tabs found", "error");
    }
  });
}

function handleRefreshTabs() {
  loadSavedTabs();
}

async function saveTab(tab, groupName, notes, callback) {
  try {
    const result = await new Promise((resolve) =>
      chrome.storage.local.get(["mongodbUri", "secretKey"], resolve)
    );

    if (!result.mongodbUri) {
      showNotification("Please set up MongoDB connection first", "error");
      if (callback) callback();
      return;
    }

    let tabData = {
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl || "",
      groupName: groupName,
      notes: notes,
      date: "2025-06-22",
      createdAt: "2025-06-22 06:40:09",
      createdBy: "mohitahlawat2001",
    };

    // Encrypt data if secret key is available
    let finalTabData = tabData;
    let isEncrypted = false;

    if (result.secretKey && currentSecretKey) {
      try {
        const encryptedData = await encryptData(tabData, currentSecretKey);
        finalTabData = {
          encryptedData: encryptedData,
          isEncrypted: true,
          groupName: groupName, // Keep groupName unencrypted for filtering
          date: tabData.date,
          createdAt: tabData.createdAt,
          createdBy: tabData.createdBy,
        };
        isEncrypted = true;
      } catch (error) {
        showNotification("Encryption failed: " + error.message, "error");
        if (callback) callback();
        return;
      }
    }

    chrome.runtime.sendMessage(
      {
        action: "saveTab",
        mongodbUri: result.mongodbUri,
        tabData: finalTabData,
      },
      (response) => {
        if (response && response.success) {
          loadExistingGroups();
          loadSavedTabs();
          // Clear notes after successful save
          document.getElementById("tab-notes").value = "";
          const encryptionMsg = isEncrypted ? " (encrypted)" : " (unencrypted)";
          showNotification(
            `Tab saved to group: "${groupName}"${encryptionMsg}`,
            "success"
          );
        } else {
          const errorMsg = `Failed to save tab: ${
            response ? response.error : "Unknown error"
          }`;
          showNotification(errorMsg, "error");
        }
        if (callback) callback();
      }
    );
  } catch (error) {
    showNotification("Error saving tab: " + error.message, "error");
    if (callback) callback();
  }
}

async function saveAllTabs(tabs, groupName, notes, callback) {
  try {
    const result = await new Promise((resolve) =>
      chrome.storage.local.get(["mongodbUri", "secretKey"], resolve)
    );

    if (!result.mongodbUri) {
      showNotification("Please set up MongoDB connection first", "error");
      if (callback) callback();
      return;
    }

    let tabsData = tabs.map((tab) => ({
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl || "",
      groupName: groupName,
      notes: notes,
      date: "2025-06-22",
      createdAt: "2025-06-22 06:40:09",
      createdBy: "mohitahlawat2001",
    }));

    // Encrypt data if secret key is available
    let finalTabsData = tabsData;
    let isEncrypted = false;

    if (result.secretKey && currentSecretKey) {
      try {
        finalTabsData = [];

        for (const tabData of tabsData) {
          const encryptedData = await encryptData(tabData, currentSecretKey);
          finalTabsData.push({
            encryptedData: encryptedData,
            isEncrypted: true,
            groupName: groupName,
            date: tabData.date,
            createdAt: tabData.createdAt,
            createdBy: tabData.createdBy,
          });
        }
        isEncrypted = true;
      } catch (error) {
        showNotification("Encryption failed: " + error.message, "error");
        if (callback) callback();
        return;
      }
    }

    chrome.runtime.sendMessage(
      {
        action: "saveAllTabs",
        mongodbUri: result.mongodbUri,
        tabsData: finalTabsData,
      },
      (response) => {
        if (response && response.success) {
          loadExistingGroups();
          loadSavedTabs();
          // Clear notes after successful save
          document.getElementById("tab-notes").value = "";
          const encryptionMsg = isEncrypted ? " (encrypted)" : " (unencrypted)";
          showNotification(
            `${tabsData.length} tabs saved to group: "${groupName}"${encryptionMsg}`,
            "success"
          );
        } else {
          const errorMsg = `Failed to save tabs: ${
            response ? response.error : "Unknown error"
          }`;
          showNotification(errorMsg, "error");
        }
        if (callback) callback();
      }
    );
  } catch (error) {
    showNotification("Error saving tabs: " + error.message, "error");
    if (callback) callback();
  }
}

function loadExistingGroups() {
  getStorageData(["mongodbUri"]).then(result => {
    if (!result.mongodbUri) {
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        { action: "loadGroups", mongodbUri: result.mongodbUri },
        (response) => {
          if (response && response.success) {
            populateGroupDropdowns(response.groups);
          }
        }
      );
    } else {
      // Web application mode
      makeAPICall('/load-groups', { mongodbUri: result.mongodbUri })
        .then(response => {
          if (response.success) {
            populateGroupDropdowns(response.groups);
          }
        })
        .catch(error => {
          console.error("Failed to load groups:", error);
        });
    }
  });
}

function populateGroupDropdowns(groups) {
  const existingGroupsSelect = document.getElementById(
    "existing-groups-select"
  );
  const groupFilterSelect = document.getElementById("group-filter");

  existingGroupsSelect.innerHTML =
    '<option value="">Select an existing group</option>';
  groupFilterSelect.innerHTML = '<option value="">All groups</option>';

  groups.forEach((group) => {
    const option1 = document.createElement("option");
    option1.value = group;
    option1.textContent = group;
    existingGroupsSelect.appendChild(option1);

    const option2 = document.createElement("option");
    option2.value = group;
    option2.textContent = group;
    groupFilterSelect.appendChild(option2);
  });

  const existingGroupRadio = document.getElementById("existing-group-radio");
  const existingGroupLabel = existingGroupRadio.parentElement;

  if (groups.length === 0) {
    existingGroupRadio.disabled = true;
    existingGroupLabel.classList.add("opacity-50", "cursor-not-allowed");
    existingGroupLabel.title =
      "No existing groups found. Save some tabs first.";

    if (existingGroupRadio.checked) {
      document.getElementById("new-group-radio").checked = true;
      handleGroupMethodChange();
    }
  } else {
    existingGroupRadio.disabled = false;
    existingGroupLabel.classList.remove("opacity-50", "cursor-not-allowed");
    existingGroupLabel.title = "";
  }

  updateCurrentGroupDisplay();
}

async function loadSavedTabs() {
  try {
    const result = await new Promise((resolve) =>
      chrome.storage.local.get(["mongodbUri", "secretKey"], resolve)
    );

    if (!result.mongodbUri) {
      return;
    }

    const dateFilter = document.getElementById("date-filter").value;
    const groupFilter = document.getElementById("group-filter").value;

    chrome.runtime.sendMessage(
      {
        action: "loadTabs",
        mongodbUri: result.mongodbUri,
        date: dateFilter,
        groupName: groupFilter,
      },
      async (response) => {
        if (response && response.success) {
          let tabs = response.tabs;

          // Decrypt encrypted tabs if secret key is available
          if (result.secretKey && currentSecretKey) {
            try {
              const decryptedTabs = [];

              for (const tab of tabs) {
                if (tab.isEncrypted && tab.encryptedData) {
                  try {
                    const decryptedData = await decryptData(
                      tab.encryptedData,
                      currentSecretKey
                    );
                    // Merge decrypted data with metadata
                    decryptedTabs.push({
                      ...decryptedData,
                      _id: tab._id,
                      isEncrypted: true,
                    });
                  } catch (decryptError) {
                    console.error("Failed to decrypt tab:", decryptError);
                    // Show encrypted tab with error message
                    decryptedTabs.push({
                      title: "[Encrypted - Cannot Decrypt]",
                      url: "Error: Wrong secret key or corrupted data",
                      favicon: "",
                      notes: "Cannot decrypt this tab",
                      groupName: tab.groupName,
                      date: tab.date,
                      createdAt: tab.createdAt,
                      createdBy: tab.createdBy,
                      _id: tab._id,
                      isEncrypted: true,
                      decryptionError: true,
                    });
                  }
                } else {
                  // Unencrypted tab
                  decryptedTabs.push(tab);
                }
              }

              tabs = decryptedTabs;
            } catch (error) {
              showNotification(
                "Error decrypting tabs: " + error.message,
                "error"
              );
            }
          }

          displayTabs(tabs);
        } else {
          document.getElementById("tabs-list").innerHTML = `
            <div class="text-center py-6" style="color: var(--text-muted);">
              <i class="fas fa-exclamation-triangle fa-2x mb-2" style="color: var(--accent-red);"></i>
              <div>Failed to load tabs</div>
            </div>
          `;
        }
      }
    );
  } catch (error) {
    showNotification("Error loading tabs: " + error.message, "error");
  }
}

function toggleGroup(groupName) {
  const groupContent = document.getElementById(`group-content-${groupName}`);
  const toggleIcon = document
    .getElementById(`toggle-icon-${groupName}`)
    .querySelector("i");

  if (groupContent.classList.contains("hidden")) {
    groupContent.classList.remove("hidden");
    toggleIcon.className = "fas fa-chevron-down";
    document.getElementById(`toggle-icon-${groupName}`).title =
      "Collapse group";
  } else {
    groupContent.classList.add("hidden");
    toggleIcon.className = "fas fa-chevron-right";
    document.getElementById(`toggle-icon-${groupName}`).title = "Expand group";
  }
}

function displayTabs(tabs) {
  const tabsList = document.getElementById("tabs-list");

  if (!tabs || tabs.length === 0) {
    tabsList.innerHTML = `
      <div class="text-center py-6" style="color: var(--text-muted);">
        <i class="fas fa-inbox fa-2x mb-2"></i>
        <div>No saved tabs found</div>
      </div>
    `;
    return;
  }

  // Group tabs by group name
  const groupedTabs = tabs.reduce((groups, tab) => {
    const groupName = tab.groupName || "Ungrouped";
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
    return groups;
  }, {});

  let html = "";

  Object.keys(groupedTabs)
    .sort()
    .forEach((groupName) => {
      const groupTabs = groupedTabs[groupName];
      const safeGroupName = groupName.replace(/[^a-zA-Z0-9]/g, "_");

      html += `
      <div class="group-container">
        <div class="group-header px-4 py-3 rounded-t-md border-b" style="border-color: var(--border-color);">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-3" style="max-width: 250px;">
              <button class="toggle-group-btn focus:outline-none flex-shrink-0" 
                      id="toggle-icon-${safeGroupName}" 
                      title="Collapse group"
                      data-group="${safeGroupName}"
                      style="color: var(--text-primary);">
                <i class="fas fa-chevron-down"></i>
              </button>
              <h3 class="font-semibold text-sm group-title" style="color: var(--text-primary);">
                <i class="fas fa-folder fa-icon" style="color: var(--accent-blue);"></i>${escapeHTML(
                  groupName
                )} 
                <span style="color: var(--accent-blue);">(${
                  groupTabs.length
                })</span>
              </h3>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button class="open-all-group-btn text-xs font-medium px-2 py-1 rounded transition-colors" 
                      data-group="${escapeHTML(groupName)}"
                      title="Open all tabs in this group"
                      style="color: var(--accent-blue); border: 1px solid var(--accent-blue);"
                      onmouseover="this.style.backgroundColor='var(--accent-blue)'; this.style.color='white';"
                      onmouseout="this.style.backgroundColor='transparent'; this.style.color='var(--accent-blue)';">
                <i class="fas fa-external-link-alt fa-icon"></i>Open All
              </button>
              <button class="delete-group-btn text-xs font-medium px-2 py-1 rounded transition-colors" 
                      data-group="${escapeHTML(groupName)}"
                      title="Delete this group and all its tabs"
                      style="color: var(--accent-red); border: 1px solid var(--accent-red);"
                      onmouseover="this.style.backgroundColor='var(--accent-red)'; this.style.color='white';"
                      onmouseout="this.style.backgroundColor='transparent'; this.style.color='var(--accent-red)';">
                <i class="fas fa-trash fa-icon"></i>Delete
              </button>
            </div>
          </div>
        </div>
        <div class="border-l border-r border-b rounded-b-md" 
             style="border-color: var(--border-color); background-color: var(--bg-secondary);" 
             id="group-content-${safeGroupName}">
      `;

      groupTabs.forEach((tab, index) => {
        const isLast = index === groupTabs.length - 1;
        const createdDate = formatDate(tab.createdAt || tab.date);
        const hasNotes = tab.notes && tab.notes.trim();
        const isEncrypted = tab.isEncrypted;
        const hasDecryptionError = tab.decryptionError;

        // Add encryption indicator
        const encryptionIcon = isEncrypted
          ? '<i class="fas fa-lock mr-1" style="color: var(--accent-green);"></i>'
          : "";
        const errorStyle = hasDecryptionError ? "border-l-2" : "";
        const errorBorderColor = hasDecryptionError
          ? "style='border-left-color: var(--accent-red); background-color: rgba(239, 68, 68, 0.1);'"
          : "";

        html += `
        <div class="tab-item ${
          !isLast ? "border-b" : ""
        } hover:bg-opacity-20 transition-colors ${errorStyle}" 
             ${errorBorderColor}
             data-tab-id="${tab._id}" 
             data-tab-url="${escapeHTML(tab.url)}" 
             data-url="${escapeHTML(tab.url)}"
             data-has-error="${hasDecryptionError}"
             style="border-color: var(--border-color);"
             onmouseover="this.style.backgroundColor='var(--hover-bg)';"
             onmouseout="this.style.backgroundColor='transparent';">
          <img class="w-4 h-4 mr-3 flex-shrink-0" 
               src="${
                 tab.favicon ||
                 "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>"
               }" 
               alt="favicon">
          <div class="tab-content-item">
            <div class="tab-title font-medium" title="${escapeHTML(
              tab.title
            )}" style="color: var(--text-primary);">
              ${encryptionIcon}${escapeHTML(tab.title)}
            </div>
            <div class="tab-url" title="${escapeHTML(
              tab.url
            )}" style="color: var(--text-secondary);">${escapeHTML(
          tab.url
        )}</div>
            ${
              hasNotes
                ? `<div class="tab-notes mt-1" title="${escapeHTML(
                    tab.notes
                  )}" style="color: var(--accent-green);">
              <i class="fas fa-sticky-note fa-icon"></i>${escapeHTML(tab.notes)}
            </div>`
                : ""
            }
            <div class="mt-1" style="font-size: 11px; color: var(--text-muted);">
              <i class="fas fa-save fa-icon"></i>${createdDate} • 
              <i class="fas fa-user fa-icon"></i>mohitahlawat2001 
              ${
                isEncrypted
                  ? '• <i class="fas fa-shield-alt fa-icon"></i>Encrypted'
                  : ""
              }
            </div>
          </div>
          <div class="tab-actions">
            <button class="open-btn text-white px-2 py-1 rounded transition-colors text-xs" 
                    style="background-color: var(--accent-blue);"
                    onmouseover="this.style.backgroundColor='#2563eb';"
                    onmouseout="this.style.backgroundColor='var(--accent-blue)';"
                    ${
                      hasDecryptionError
                        ? 'disabled title="Cannot open encrypted tab" style="opacity: 0.5; cursor: not-allowed;"'
                        : ""
                    }>
              <i class="fas fa-external-link-alt fa-icon"></i>
            </button>
            <button class="delete-btn text-white px-2 py-1 rounded transition-colors text-xs" 
                    style="background-color: var(--accent-red);"
                    onmouseover="this.style.backgroundColor='#dc2626';"
                    onmouseout="this.style.backgroundColor='var(--accent-red)';">
              <i class="fas fa-trash fa-icon"></i>
            </button>
          </div>
        </div>
      `;
      });

      html += `
        </div>
      </div>
    `;
    });

  tabsList.innerHTML = html;

  // Add event listeners for tabs
  document.querySelectorAll("[data-tab-id]").forEach((tabItem) => {
    const openBtn = tabItem.querySelector(".open-btn");
    const deleteBtn = tabItem.querySelector(".delete-btn");
    const hasError = tabItem.getAttribute("data-has-error") === "true";

    if (openBtn && !hasError) {
      openBtn.addEventListener("click", function () {
        const url = tabItem.getAttribute("data-tab-url");
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.create({ url: url });
        } else {
          window.open(url, '_blank');
        }
        showNotification("Tab opened successfully", "success");
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        const tabId = tabItem.getAttribute("data-tab-id");
        deleteTab(tabId);
      });
    }
  });

  // Add event listeners for group actions
  document.querySelectorAll(".delete-group-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const groupName = btn.getAttribute("data-group");
      deleteGroup(groupName);
    });
  });

  document.querySelectorAll(".open-all-group-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const groupName = btn.getAttribute("data-group");
      openAllTabsInGroup(groupName, groupedTabs[groupName]);
    });
  });

  // Add event listeners for toggle buttons
  document.querySelectorAll(".toggle-group-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const safeGroupName = btn.getAttribute("data-group");
      toggleGroup(safeGroupName);
    });
  });
}

function openAllTabsInGroup(groupName, tabs) {
  const validTabs = tabs.filter((tab) => !tab.decryptionError);

  if (validTabs.length === 0) {
    showNotification("No valid tabs to open in this group", "warning");
    return;
  }

  showNotification(
    `Opening ${validTabs.length} tabs from group "${groupName}"`,
    "info"
  );

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    // Chrome extension mode
    validTabs.forEach((tab, index) => {
      setTimeout(() => {
        chrome.tabs.create({ url: tab.url, active: index === 0 });
      }, index * 100);
    });
  } else {
    // Web application mode - open in new windows/tabs
    validTabs.forEach((tab, index) => {
      setTimeout(() => {
        window.open(tab.url, '_blank');
      }, index * 100);
    });
  }
}

function deleteTab(id) {
  chrome.storage.local.get(["mongodbUri"], (result) => {
    if (!result.mongodbUri) return;

    chrome.runtime.sendMessage(
      { action: "deleteTab", mongodbUri: result.mongodbUri, tabId: id },
      (response) => {
        if (response && response.success) {
          loadSavedTabs();
          showNotification("Tab deleted successfully", "success");
        } else {
          const errorMsg = `Failed to delete tab: ${
            response ? response.error : "Unknown error"
          }`;
          showNotification(errorMsg, "error");
        }
      }
    );
  });
}

function deleteGroup(groupName) {
  chrome.storage.local.get(["mongodbUri"], (result) => {
    if (!result.mongodbUri) return;

    chrome.runtime.sendMessage(
      {
        action: "deleteGroup",
        mongodbUri: result.mongodbUri,
        groupName: groupName,
      },
      (response) => {
        if (response && response.success) {
          loadExistingGroups();
          loadSavedTabs();
          showNotification(
            `Group "${groupName}" deleted (${response.deletedCount} tabs removed)`,
            "success"
          );
        } else {
          const errorMsg = `Failed to delete group: ${
            response ? response.error : "Unknown error"
          }`;
          showNotification(errorMsg, "error");
        }
      }
    );
  });
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function handleSearch(event) {
  const query = event.target.value.toLowerCase();
  const tabsList = document.getElementById("tabs-list");
  const items = tabsList.getElementsByClassName("tab-item");

  for (let item of items) {
    const titleElement = item.querySelector('.tab-title');
    const url = item.dataset.url;
    
    if (titleElement && url) {
      const title = titleElement.textContent.toLowerCase();
      const urlLower = url.toLowerCase();

      if (title.includes(query) || urlLower.includes(query)) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    }
  }

  // Handle group visibility based on whether any tabs in the group are visible
  const groupContainers = tabsList.getElementsByClassName("group-container");
  for (let groupContainer of groupContainers) {
    const groupTabItems = groupContainer.getElementsByClassName("tab-item");
    let hasVisibleTabs = false;
    
    for (let tabItem of groupTabItems) {
      if (tabItem.style.display !== "none") {
        hasVisibleTabs = true;
        break;
      }
    }
    
    if (hasVisibleTabs || query === "") {
      groupContainer.style.display = "block";
    } else {
      groupContainer.style.display = "none";
    }
  }
}

// Web Analysis Functions
function toggleGeminiKeyVisibility() {
  const keyInput = document.getElementById("gemini-api-key");
  const toggleIcon = document.getElementById("toggle-gemini-key-visibility");

  if (keyInput.type === "password") {
    keyInput.type = "text";
    toggleIcon.className = "fas fa-eye-slash password-toggle";
    toggleIcon.title = "Hide API key";
  } else {
    keyInput.type = "password";
    toggleIcon.className = "fas fa-eye password-toggle";
    toggleIcon.title = "Show API key";
  }
}

function handleAnalyzeWebpage() {
  const apiKey = document.getElementById("gemini-api-key").value.trim();
  const url = document.getElementById("analysis-url").value.trim();
  const query = document.getElementById("analysis-query").value.trim();

  // Validation
  if (!apiKey) {
    showNotification("Please enter your Gemini API key", "error");
    return;
  }

  if (!url) {
    showNotification("Please enter a URL to analyze", "error");
    return;
  }

  if (!query) {
    showNotification("Please enter a question about the webpage", "error");
    return;
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    showNotification("Please enter a valid URL (e.g., https://example.com)", "error");
    return;
  }

  // Show loading state
  const button = document.getElementById("analyze-webpage");
  const originalHTML = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin fa-icon"></i>Analyzing...';
  button.disabled = true;

  updateAnalysisStatus("Fetching and analyzing webpage content...", "");
  hideAnalysisResults();

  // Call the background script to perform analysis
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage(
      {
        action: "webAnalysis",
        url: url,
        query: query,
        geminiApiKey: apiKey,
      },
      (response) => {
        // Reset button state
        button.innerHTML = originalHTML;
        button.disabled = false;

        if (response && response.success) {
          updateAnalysisStatus("Analysis completed successfully", "success");
          showAnalysisResults(response);
          showNotification("Web page analysis completed!", "success");
        } else {
          const errorMsg = `Analysis failed: ${
            response ? response.error : "Unknown error"
          }`;
          updateAnalysisStatus(errorMsg, "error");
          showNotification(errorMsg, "error");
        }
      }
    );
  } else {
    // Web application mode - make direct API call
    makeAPICall('/web-analysis', { url, query, geminiApiKey: apiKey })
      .then(response => {
        // Reset button state
        button.innerHTML = originalHTML;
        button.disabled = false;

        if (response.success) {
          updateAnalysisStatus("Analysis completed successfully", "success");
          showAnalysisResults(response);
          showNotification("Web page analysis completed!", "success");
        } else {
          throw new Error(response.error);
        }
      })
      .catch(error => {
        // Reset button state
        button.innerHTML = originalHTML;
        button.disabled = false;
        
        const errorMsg = `Analysis failed: ${error.message}`;
        updateAnalysisStatus(errorMsg, "error");
        showNotification(errorMsg, "error");
      });
  }
}

function updateAnalysisStatus(message, type) {
  const statusEl = document.getElementById("analysis-status");
  statusEl.innerHTML = `<i class="fas ${
    type === "success"
      ? "fa-check-circle"
      : type === "error"
      ? "fa-times-circle"
      : "fa-info-circle"
  } fa-icon"></i>${message}`;

  if (type === "success") {
    statusEl.style.color = "var(--accent-green)";
  } else if (type === "error") {
    statusEl.style.color = "var(--accent-red)";
  } else {
    statusEl.style.color = "var(--text-muted)";
  }
}

function showAnalysisResults(response) {
  const resultsDiv = document.getElementById("analysis-results");
  const contentDiv = document.getElementById("analysis-content");
  const pageInfoDiv = document.getElementById("analysis-page-info");

  contentDiv.textContent = response.analysis;
  pageInfoDiv.innerHTML = `
    <i class="fas fa-globe fa-icon"></i>Page: ${escapeHTML(response.pageInfo.title)} 
    • <i class="fas fa-clock fa-icon"></i>Analyzed: ${formatDate(response.timestamp)}
  `;

  resultsDiv.classList.remove("hidden");
}

function hideAnalysisResults() {
  const resultsDiv = document.getElementById("analysis-results");
  resultsDiv.classList.add("hidden");
}

// API calling helper functions
function makeAPICall(endpoint, data = {}) {
  const API_BASE_URL = window.location.origin; // Use current origin for web app
  
  return fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  });
}

// Scheduled Tasks Functions
function handleSchedulePresetChange() {
  const preset = document.getElementById("schedule-preset").value;
  const customInput = document.getElementById("cron-expression");
  
  if (preset === "custom") {
    customInput.classList.remove("hidden");
    customInput.focus();
  } else {
    customInput.classList.add("hidden");
    customInput.value = preset;
  }
}

function toggleTaskGeminiKeyVisibility() {
  const keyInput = document.getElementById("task-gemini-api-key");
  const toggleIcon = document.getElementById("toggle-task-gemini-key-visibility");

  if (keyInput.type === "password") {
    keyInput.type = "text";
    toggleIcon.className = "fas fa-eye-slash password-toggle";
    toggleIcon.title = "Hide API key";
  } else {
    keyInput.type = "password";
    toggleIcon.className = "fas fa-eye password-toggle";
    toggleIcon.title = "Show API key";
  }
}

async function handleCheckRobots() {
  const url = document.getElementById("task-url").value.trim();
  
  if (!url) {
    showNotification("Please enter a URL first", "error");
    return;
  }

  try {
    new URL(url); // Validate URL format
  } catch (error) {
    showNotification("Please enter a valid URL", "error");
    return;
  }

  const button = document.getElementById("check-robots");
  const originalHTML = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin fa-icon"></i>Checking...';
  button.disabled = true;

  try {
    const response = await makeAPICall('/check-robots', { url });
    
    if (response.success) {
      const statusEl = document.getElementById("robots-status");
      if (response.scrapingAllowed) {
        statusEl.innerHTML = `<i class="fas fa-check-circle fa-icon" style="color: var(--accent-green);"></i>${response.message}`;
        statusEl.style.color = "var(--accent-green)";
        document.getElementById("create-task").disabled = false;
      } else {
        statusEl.innerHTML = `<i class="fas fa-times-circle fa-icon" style="color: var(--accent-red);"></i>${response.message}`;
        statusEl.style.color = "var(--accent-red)";
        document.getElementById("create-task").disabled = true;
      }
      showNotification(`Robots.txt check: ${response.message}`, response.scrapingAllowed ? "success" : "warning");
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    const statusEl = document.getElementById("robots-status");
    statusEl.innerHTML = `<i class="fas fa-exclamation-triangle fa-icon" style="color: var(--accent-yellow);"></i>Check failed: ${error.message}`;
    statusEl.style.color = "var(--accent-yellow)";
    showNotification("Robots.txt check failed: " + error.message, "error");
  } finally {
    button.innerHTML = originalHTML;
    button.disabled = false;
  }
}

async function handleCreateTask() {
  const url = document.getElementById("task-url").value.trim();
  const taskDescription = document.getElementById("task-description").value.trim();
  const schedulePreset = document.getElementById("schedule-preset").value;
  const cronExpression = document.getElementById("cron-expression").value.trim();
  const geminiApiKey = document.getElementById("task-gemini-api-key").value.trim();

  // Validation
  if (!url || !taskDescription || !geminiApiKey) {
    showNotification("Please fill in all required fields", "error");
    return;
  }

  const finalCronExpression = schedulePreset === "custom" ? cronExpression : schedulePreset;
  if (!finalCronExpression) {
    showNotification("Please select a schedule or enter a custom cron expression", "error");
    return;
  }

  try {
    new URL(url);
  } catch (error) {
    showNotification("Please enter a valid URL", "error");
    return;
  }

  const button = document.getElementById("create-task");
  const originalHTML = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin fa-icon"></i>Creating...';
  button.disabled = true;

  try {
    const mongodbUri = document.getElementById("mongodb-uri").value.trim();
    if (!mongodbUri) {
      showNotification("Please set up MongoDB connection first", "error");
      return;
    }

    const taskData = {
      url,
      taskDescription,
      cronExpression: finalCronExpression,
      geminiApiKey,
      name: `Task for ${new URL(url).hostname}`,
      mongodbUri
    };

    const response = await makeAPICall('/create-scheduled-task', { mongodbUri, taskData });
    
    if (response.success) {
      showNotification("Scheduled task created successfully!", "success");
      
      // Clear form
      document.getElementById("task-url").value = "";
      document.getElementById("task-description").value = "";
      document.getElementById("task-gemini-api-key").value = "";
      document.getElementById("schedule-preset").value = "";
      document.getElementById("cron-expression").value = "";
      document.getElementById("cron-expression").classList.add("hidden");
      document.getElementById("robots-status").innerHTML = "";
      document.getElementById("create-task").disabled = true;
      
      // Refresh tasks list
      loadScheduledTasks();
      updateTaskOverview();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showNotification("Failed to create task: " + error.message, "error");
  } finally {
    button.innerHTML = originalHTML;
    button.disabled = false;
  }
}

async function loadScheduledTasks() {
  try {
    const mongodbUri = document.getElementById("mongodb-uri").value.trim();
    if (!mongodbUri) {
      return;
    }

    const response = await makeAPICall('/load-scheduled-tasks', { mongodbUri });
    
    if (response.success) {
      displayScheduledTasks(response.tasks);
      updateTaskOverview(response.tasks);
      populateTaskFilter(response.tasks);
    }
  } catch (error) {
    console.error("Failed to load scheduled tasks:", error);
  }
}

function displayScheduledTasks(tasks) {
  const tasksListEl = document.getElementById("scheduled-tasks-list");
  
  if (!tasks || tasks.length === 0) {
    tasksListEl.innerHTML = `
      <div class="text-center py-6" style="color: var(--text-muted);">
        <i class="fas fa-clock fa-2x mb-2"></i>
        <div>No scheduled tasks found</div>
      </div>
    `;
    return;
  }

  let html = "";
  tasks.forEach((task) => {
    const statusColor = task.status === 'active' ? 'var(--accent-green)' : 
                       task.status === 'paused' ? 'var(--accent-yellow)' : 'var(--accent-red)';
    
    const nextExecution = task.nextExecution ? new Date(task.nextExecution).toLocaleString() : 'N/A';
    const lastExecuted = task.lastExecuted ? new Date(task.lastExecuted).toLocaleString() : 'Never';
    
    html += `
      <div class="border rounded-md p-4 mb-3" style="border-color: var(--border-color); background-color: var(--bg-secondary);">
        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <h4 class="font-semibold text-sm mb-1" style="color: var(--text-primary);">
              <i class="fas fa-globe fa-icon"></i>${escapeHTML(new URL(task.url).hostname)}
            </h4>
            <p class="text-xs mb-2" style="color: var(--text-secondary);">${escapeHTML(task.taskDescription)}</p>
            <div class="text-xs" style="color: var(--text-muted);">
              <i class="fas fa-clock fa-icon"></i>Schedule: ${escapeHTML(task.cronExpression)} | 
              <i class="fas fa-circle fa-icon" style="color: ${statusColor};"></i>Status: ${task.status} | 
              Executions: ${task.executionCount || 0} (${task.successCount || 0} success, ${task.errorCount || 0} errors)
            </div>
          </div>
          <div class="flex gap-2 ml-4">
            ${task.status === 'active' ? 
              `<button class="pause-task-btn text-xs px-2 py-1 rounded" 
                       style="background-color: var(--accent-yellow); color: white;"
                       data-task-id="${task._id}">
                 <i class="fas fa-pause fa-icon"></i>Pause
               </button>` :
              `<button class="resume-task-btn text-xs px-2 py-1 rounded" 
                       style="background-color: var(--accent-green); color: white;"
                       data-task-id="${task._id}">
                 <i class="fas fa-play fa-icon"></i>Resume
               </button>`
            }
            <button class="delete-task-btn text-xs px-2 py-1 rounded" 
                    style="background-color: var(--accent-red); color: white;"
                    data-task-id="${task._id}">
              <i class="fas fa-trash fa-icon"></i>Delete
            </button>
          </div>
        </div>
        <div class="text-xs pt-2 border-t" style="border-color: var(--border-color); color: var(--text-muted);">
          Next: ${nextExecution} | Last: ${lastExecuted}
        </div>
      </div>
    `;
  });

  tasksListEl.innerHTML = html;

  // Add event listeners
  document.querySelectorAll('.pause-task-btn').forEach(btn => {
    btn.addEventListener('click', () => pauseTask(btn.dataset.taskId));
  });
  
  document.querySelectorAll('.resume-task-btn').forEach(btn => {
    btn.addEventListener('click', () => resumeTask(btn.dataset.taskId));
  });
  
  document.querySelectorAll('.delete-task-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteScheduledTask(btn.dataset.taskId));
  });
}

async function pauseTask(taskId) {
  try {
    const mongodbUri = document.getElementById("mongodb-uri").value.trim();
    const response = await makeAPICall('/pause-scheduled-task', { mongodbUri, taskId });
    
    if (response.success) {
      showNotification("Task paused successfully", "success");
      loadScheduledTasks();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showNotification("Failed to pause task: " + error.message, "error");
  }
}

async function resumeTask(taskId) {
  try {
    const mongodbUri = document.getElementById("mongodb-uri").value.trim();
    const response = await makeAPICall('/resume-scheduled-task', { mongodbUri, taskId });
    
    if (response.success) {
      showNotification("Task resumed successfully", "success");
      loadScheduledTasks();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showNotification("Failed to resume task: " + error.message, "error");
  }
}

async function deleteScheduledTask(taskId) {
  if (!confirm("Are you sure you want to delete this task? This will also delete all related results.")) {
    return;
  }
  
  try {
    const mongodbUri = document.getElementById("mongodb-uri").value.trim();
    const response = await makeAPICall('/delete-scheduled-task', { mongodbUri, taskId });
    
    if (response.success) {
      showNotification("Task deleted successfully", "success");
      loadScheduledTasks();
      loadTaskResults();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showNotification("Failed to delete task: " + error.message, "error");
  }
}

function updateTaskOverview(tasks = []) {
  const overviewEl = document.getElementById("task-overview");
  
  if (tasks.length === 0) {
    overviewEl.innerHTML = `
      <div class="text-center py-4" style="color: var(--text-muted);">
        <i class="fas fa-tasks fa-2x mb-2"></i>
        <div>No scheduled tasks yet</div>
      </div>
    `;
    return;
  }

  const active = tasks.filter(t => t.status === 'active').length;
  const paused = tasks.filter(t => t.status === 'paused').length;
  const totalExecutions = tasks.reduce((sum, t) => sum + (t.executionCount || 0), 0);
  const totalSuccesses = tasks.reduce((sum, t) => sum + (t.successCount || 0), 0);

  overviewEl.innerHTML = `
    <div class="space-y-2">
      <div class="flex justify-between">
        <span style="color: var(--text-secondary);">Total Tasks:</span>
        <span style="color: var(--text-primary); font-weight: 500;">${tasks.length}</span>
      </div>
      <div class="flex justify-between">
        <span style="color: var(--text-secondary);">Active:</span>
        <span style="color: var(--accent-green); font-weight: 500;">${active}</span>
      </div>
      <div class="flex justify-between">
        <span style="color: var(--text-secondary);">Paused:</span>
        <span style="color: var(--accent-yellow); font-weight: 500;">${paused}</span>
      </div>
      <div class="flex justify-between">
        <span style="color: var(--text-secondary);">Total Executions:</span>
        <span style="color: var(--text-primary); font-weight: 500;">${totalExecutions}</span>
      </div>
      <div class="flex justify-between">
        <span style="color: var(--text-secondary);">Success Rate:</span>
        <span style="color: var(--accent-green); font-weight: 500;">${totalExecutions > 0 ? Math.round((totalSuccesses / totalExecutions) * 100) : 0}%</span>
      </div>
    </div>
  `;
}

function populateTaskFilter(tasks) {
  const filterEl = document.getElementById("task-filter");
  const currentValue = filterEl.value;
  
  filterEl.innerHTML = '<option value="">All tasks</option>';
  
  tasks.forEach(task => {
    const option = document.createElement("option");
    option.value = task._id;
    option.textContent = `${new URL(task.url).hostname} - ${task.taskDescription.substring(0, 30)}...`;
    filterEl.appendChild(option);
  });
  
  if (currentValue) {
    filterEl.value = currentValue;
  }
}

async function loadTaskResults() {
  try {
    const mongodbUri = document.getElementById("mongodb-uri").value.trim();
    const taskId = document.getElementById("task-filter").value;
    
    if (!mongodbUri) {
      return;
    }

    const response = await makeAPICall('/load-task-results', { mongodbUri, taskId });
    
    if (response.success) {
      displayTaskResults(response.results);
    }
  } catch (error) {
    console.error("Failed to load task results:", error);
  }
}

function displayTaskResults(results) {
  const resultsListEl = document.getElementById("task-results-list");
  
  if (!results || results.length === 0) {
    resultsListEl.innerHTML = `
      <div class="text-center py-6" style="color: var(--text-muted);">
        <i class="fas fa-chart-line fa-2x mb-2"></i>
        <div>No task results found</div>
      </div>
    `;
    return;
  }

  let html = "";
  results.forEach((result) => {
    const statusColor = result.status === 'success' ? 'var(--accent-green)' : 'var(--accent-red)';
    const executedAt = new Date(result.executedAt).toLocaleString();
    
    html += `
      <div class="border rounded-md p-4 mb-3" style="border-color: var(--border-color); background-color: var(--bg-secondary);">
        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <h4 class="font-semibold text-sm mb-1" style="color: var(--text-primary);">
              <i class="fas fa-globe fa-icon"></i>${escapeHTML(new URL(result.url).hostname)}
            </h4>
            <p class="text-xs mb-2" style="color: var(--text-secondary);">${escapeHTML(result.taskDescription)}</p>
            <div class="text-xs mb-2" style="color: var(--text-muted);">
              <i class="fas fa-clock fa-icon"></i>Executed: ${executedAt} | 
              <i class="fas fa-circle fa-icon" style="color: ${statusColor};"></i>Status: ${result.status}
            </div>
          </div>
        </div>
        ${result.status === 'success' && result.result ? `
          <div class="bg-tertiary border rounded p-3 mt-3" style="background-color: var(--bg-tertiary); border-color: var(--border-color);">
            <h5 class="font-semibold text-xs mb-2" style="color: var(--text-primary);">
              <i class="fas fa-lightbulb fa-icon"></i>Analysis Result:
            </h5>
            <div class="text-xs" style="color: var(--text-secondary); white-space: pre-wrap; max-height: 200px; overflow-y: auto;">
              ${escapeHTML(result.result.analysis)}
            </div>
          </div>
        ` : ''}
        ${result.status === 'error' ? `
          <div class="bg-red-100 border border-red-300 rounded p-3 mt-3" style="background-color: rgba(239, 68, 68, 0.1); border-color: var(--accent-red);">
            <h5 class="font-semibold text-xs mb-2" style="color: var(--accent-red);">
              <i class="fas fa-exclamation-triangle fa-icon"></i>Error:
            </h5>
            <div class="text-xs" style="color: var(--accent-red);">
              ${escapeHTML(result.error)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  });

  resultsListEl.innerHTML = html;
}
