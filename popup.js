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

  // Load stored data from storage
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

  // Event listeners
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
});

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
    chrome.storage.local.get(["secretKey"], (result) => {
      resolve(result.secretKey || null);
    });
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

  chrome.storage.local.set(
    {
      secretKey: hashedKey,
      secretKeyDisplay: secretKey, // Store for display purposes
      hasSecretKey: true,
    },
    () => {
      showCurrentKeySection();
      updateCurrentKeyDisplay();
      updateEncryptionStatus(
        "Secret key saved - data will be encrypted",
        "success"
      );
      showNotification("Secret key saved successfully!", "success");

      loadExistingGroups();
      loadSavedTabs();
    }
  );
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

  chrome.storage.local.set(
    {
      secretKey: hashedKey,
      secretKeyDisplay: secretKey,
      hasSecretKey: true,
    },
    () => {
      updateCurrentKeyDisplay();
      updateEncryptionStatus(
        "Secret key updated - data will be encrypted with new key",
        "success"
      );
      showNotification("Secret key updated successfully!", "success");

      loadExistingGroups();
      loadSavedTabs();
    }
  );
}

function handleClearSecretKey() {
  chrome.storage.local.remove(
    ["secretKey", "secretKeyDisplay", "hasSecretKey"],
    () => {
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
    }
  );
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

  chrome.runtime.sendMessage(
    { action: "testMongoDBConnection", mongodbUri },
    (response) => {
      if (response && response.success) {
        chrome.storage.local.set({ mongodbUri }, () => {
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
  chrome.storage.local.get(["mongodbUri"], (result) => {
    if (!result.mongodbUri) {
      return;
    }

    chrome.runtime.sendMessage(
      { action: "loadGroups", mongodbUri: result.mongodbUri },
      (response) => {
        if (response && response.success) {
          populateGroupDropdowns(response.groups);
        }
      }
    );
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
          <div class="tab-content">
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
        chrome.tabs.create({ url: url });
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

  validTabs.forEach((tab, index) => {
    setTimeout(() => {
      chrome.tabs.create({ url: tab.url, active: index === 0 });
    }, index * 100);
  });
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
