document.addEventListener('DOMContentLoaded', () => {
  // Set today's date as default
  const today = '2025-06-21'; // Current date from your info
  document.getElementById('date-filter').value = today;
  
  // Set today's date as default group name
  document.getElementById('new-group-name').value = today;
  document.getElementById('new-group-name').placeholder = `Enter new group name (default: ${today})`;
  updateCurrentGroupDisplay();

  // Load MongoDB connection from storage
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (result.mongodbUri) {
      document.getElementById('mongodb-uri').value = result.mongodbUri;
      updateConnectionStatus('Connection saved', 'success');
      loadExistingGroups();
      loadSavedTabs();
    }
  });

  // Event listeners
  document.getElementById('save-connection').addEventListener('click', handleSaveConnection);
  document.getElementById('save-current-tab').addEventListener('click', handleSaveCurrentTab);
  document.getElementById('save-all-tabs').addEventListener('click', handleSaveAllTabs);
  document.getElementById('refresh-tabs').addEventListener('click', handleRefreshTabs);
  document.getElementById('group-filter').addEventListener('change', handleRefreshTabs);
  
  // Group selection event listeners
  document.getElementById('new-group-radio').addEventListener('change', handleGroupMethodChange);
  document.getElementById('existing-group-radio').addEventListener('change', handleGroupMethodChange);
  document.getElementById('new-group-name').addEventListener('input', updateCurrentGroupDisplay);
  document.getElementById('existing-groups-select').addEventListener('change', updateCurrentGroupDisplay);
});

function handleGroupMethodChange() {
  const isNewGroup = document.getElementById('new-group-radio').checked;
  const newGroupSection = document.getElementById('new-group-section');
  const existingGroupSection = document.getElementById('existing-group-section');
  
  if (isNewGroup) {
    newGroupSection.classList.remove('hidden');
    existingGroupSection.classList.add('hidden');
  } else {
    newGroupSection.classList.add('hidden');
    existingGroupSection.classList.remove('hidden');
  }
  
  updateCurrentGroupDisplay();
}

function getCurrentGroupName() {
  const isNewGroup = document.getElementById('new-group-radio').checked;
  
  if (isNewGroup) {
    const newGroupName = document.getElementById('new-group-name').value.trim();
    return newGroupName || '2025-06-21'; // Default to today's date
  } else {
    const existingGroupName = document.getElementById('existing-groups-select').value;
    if (!existingGroupName) {
      // If no existing group selected, fall back to new group method
      document.getElementById('new-group-radio').checked = true;
      handleGroupMethodChange();
      return '2025-06-21';
    }
    return existingGroupName;
  }
}

function updateCurrentGroupDisplay() {
  const currentGroup = getCurrentGroupName();
  document.getElementById('current-group-display').textContent = currentGroup;
}

function updateConnectionStatus(message, type) {
  const statusEl = document.getElementById('connection-status');
  statusEl.textContent = message;
  
  if (type === 'success') {
    statusEl.className = 'text-sm text-green-500';
  } else if (type === 'error') {
    statusEl.className = 'text-sm text-red-500';
  } else {
    statusEl.className = 'text-sm text-gray-500';
  }
}

function handleSaveConnection() {
  const mongodbUri = document.getElementById('mongodb-uri').value.trim();
  if (!mongodbUri) {
    updateConnectionStatus('Please enter a valid MongoDB URI', 'error');
    return;
  }

  updateConnectionStatus('Testing connection...', '');
  
  chrome.runtime.sendMessage(
    { action: 'testMongoDBConnection', mongodbUri },
    (response) => {
      console.log('Connection test response:', response);
      if (response && response.success) {
        chrome.storage.local.set({ mongodbUri }, () => {
          updateConnectionStatus('Connection successful and saved', 'success');
          loadExistingGroups();
          loadSavedTabs();
        });
      } else {
        updateConnectionStatus(`Connection failed: ${response ? response.error : 'Unknown error'}`, 'error');
      }
    }
  );
}

function handleSaveCurrentTab() {
  const groupName = getCurrentGroupName();
  if (!groupName) {
    alert('Please select or enter a group name');
    return;
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      saveTab(tabs[0], groupName);
    }
  });
}

function handleSaveAllTabs() {
  const groupName = getCurrentGroupName();
  if (!groupName) {
    alert('Please select or enter a group name');
    return;
  }
  
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    saveAllTabs(tabs, groupName);
  });
}

function handleRefreshTabs() {
  loadSavedTabs();
}

function saveTab(tab, groupName) {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) {
      alert('Please set up MongoDB connection first');
      return;
    }

    const tabData = {
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl || '',
      groupName: groupName,
      date: '2025-06-21', // Current date
      createdAt: new Date().toISOString(),
      createdBy: 'mohitahlawat2001' // Your username
    };

    chrome.runtime.sendMessage(
      { action: 'saveTab', mongodbUri: result.mongodbUri, tabData },
      (response) => {
        if (response && response.success) {
          loadExistingGroups();
          loadSavedTabs();
          alert(`Tab saved successfully to group: "${groupName}"`);
        } else {
          alert(`Failed to save tab: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  });
}

function saveAllTabs(tabs, groupName) {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) {
      alert('Please set up MongoDB connection first');
      return;
    }

    const tabsData = tabs.map(tab => ({
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl || '',
      groupName: groupName,
      date: '2025-06-21', // Current date
      createdAt: new Date().toISOString(),
      createdBy: 'mohitahlawat2001' // Your username
    }));

    chrome.runtime.sendMessage(
      { action: 'saveAllTabs', mongodbUri: result.mongodbUri, tabsData },
      (response) => {
        if (response && response.success) {
          loadExistingGroups();
          loadSavedTabs();
          alert(`${tabsData.length} tabs saved successfully to group: "${groupName}"`);
        } else {
          alert(`Failed to save tabs: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  });
}

function loadExistingGroups() {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) {
      return;
    }

    chrome.runtime.sendMessage(
      { action: 'loadGroups', mongodbUri: result.mongodbUri },
      (response) => {
        if (response && response.success) {
          populateGroupDropdowns(response.groups);
        }
      }
    );
  });
}

function populateGroupDropdowns(groups) {
  const existingGroupsSelect = document.getElementById('existing-groups-select');
  const groupFilterSelect = document.getElementById('group-filter');
  
  // Clear existing options (except first option)
  existingGroupsSelect.innerHTML = '<option value="">Select an existing group</option>';
  groupFilterSelect.innerHTML = '<option value="">All groups</option>';
  
  // Add groups to dropdowns
  groups.forEach(group => {
    const option1 = document.createElement('option');
    option1.value = group;
    option1.textContent = group;
    existingGroupsSelect.appendChild(option1);
    
    const option2 = document.createElement('option');
    option2.value = group;
    option2.textContent = group;
    groupFilterSelect.appendChild(option2);
  });

  // Update the existing groups section visibility based on available groups
  const existingGroupRadio = document.getElementById('existing-group-radio');
  if (groups.length === 0) {
    existingGroupRadio.disabled = true;
    existingGroupRadio.parentElement.classList.add('opacity-50');
    document.getElementById('new-group-radio').checked = true;
    handleGroupMethodChange();
  } else {
    existingGroupRadio.disabled = false;
    existingGroupRadio.parentElement.classList.remove('opacity-50');
  }
}

function loadSavedTabs() {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) {
      return;
    }

    const dateFilter = document.getElementById('date-filter').value;
    const groupFilter = document.getElementById('group-filter').value;

    chrome.runtime.sendMessage(
      { 
        action: 'loadTabs', 
        mongodbUri: result.mongodbUri, 
        date: dateFilter,
        groupName: groupFilter 
      },
      (response) => {
        if (response && response.success) {
          displayTabs(response.tabs);
        } else {
          document.getElementById('tabs-list').innerHTML = '<div class="text-center text-gray-500 py-4">Failed to load tabs</div>';
        }
      }
    );
  });
}

function displayTabs(tabs) {
  const tabsList = document.getElementById('tabs-list');
  
  if (!tabs || tabs.length === 0) {
    tabsList.innerHTML = '<div class="text-center text-gray-500 py-4">No saved tabs found</div>';
    return;
  }

  // Group tabs by group name
  const groupedTabs = tabs.reduce((groups, tab) => {
    const groupName = tab.groupName || 'Ungrouped';
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(tab);
    return groups;
  }, {});

  let html = '';
  
  Object.keys(groupedTabs).sort().forEach(groupName => {
    const groupTabs = groupedTabs[groupName];
    
    html += `
      <div class="mb-4">
        <div class="bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-2 rounded-t-md border-b border-blue-200">
          <div class="flex justify-between items-center">
            <h3 class="font-semibold text-sm text-blue-800">📁 ${escapeHTML(groupName)} <span class="text-blue-600">(${groupTabs.length} tabs)</span></h3>
            <div class="flex gap-2">
              <button class="open-all-group-btn text-blue-600 hover:text-blue-800 text-xs font-medium" data-group="${escapeHTML(groupName)}">Open All</button>
              <button class="delete-group-btn text-red-500 hover:text-red-700 text-xs font-medium" data-group="${escapeHTML(groupName)}">Delete Group</button>
            </div>
          </div>
        </div>
        <div class="border-l border-r border-b border-gray-200 rounded-b-md bg-white">
    `;
    
    groupTabs.forEach((tab, index) => {
      const isLast = index === groupTabs.length - 1;
      const createdDate = formatDate(tab.createdAt || tab.date);
      html += `
        <div class="flex items-center p-3 ${!isLast ? 'border-b border-gray-100' : ''} hover:bg-gray-50 transition-colors" data-tab-id="${tab._id}" data-tab-url="${escapeHTML(tab.url)}">
          <img class="w-4 h-4 mr-3 flex-shrink-0" src="${tab.favicon || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'">
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate text-sm text-gray-900">${escapeHTML(tab.title)}</div>
            <div class="text-xs text-gray-500 truncate">${escapeHTML(tab.url)}</div>
            <div class="text-xs text-gray-400 mt-1">💾 ${createdDate}</div>
          </div>
          <div class="flex gap-1 ml-2 flex-shrink-0">
            <button class="open-btn bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors" data-action="open">Open</button>
            <button class="delete-btn bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs transition-colors" data-action="delete">Delete</button>
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

  // Add event listeners
  document.querySelectorAll('[data-tab-id]').forEach(tabItem => {
    const openBtn = tabItem.querySelector('.open-btn');
    const deleteBtn = tabItem.querySelector('.delete-btn');
    
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        const url = tabItem.getAttribute('data-tab-url');
        chrome.tabs.create({ url: url });
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        const tabId = tabItem.getAttribute('data-tab-id');
        deleteTab(tabId);
      });
    }
  });

  // Add event listeners for group actions
  document.querySelectorAll('.delete-group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const groupName = btn.getAttribute('data-group');
      deleteGroup(groupName);
    });
  });

  document.querySelectorAll('.open-all-group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const groupName = btn.getAttribute('data-group');
      openAllTabsInGroup(groupName, groupedTabs[groupName]);
    });
  });
}

function openAllTabsInGroup(groupName, tabs) {
  if (!confirm(`Open all ${tabs.length} tabs from group "${groupName}"?`)) {
    return;
  }

  tabs.forEach((tab, index) => {
    setTimeout(() => {
      chrome.tabs.create({ url: tab.url, active: index === 0 });
    }, index * 100); // Small delay to prevent overwhelming the browser
  });
}

function deleteTab(id) {
  if (!confirm('Are you sure you want to delete this tab?')) {
    return;
  }

  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) return;

    chrome.runtime.sendMessage(
      { action: 'deleteTab', mongodbUri: result.mongodbUri, tabId: id },
      (response) => {
        if (response && response.success) {
          loadSavedTabs();
          alert('Tab deleted successfully!');
        } else {
          alert(`Failed to delete tab: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  });
}

function deleteGroup(groupName) {
  if (!confirm(`Are you sure you want to delete the entire group "${groupName}" and all its tabs?`)) {
    return;
  }

  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) return;

    chrome.runtime.sendMessage(
      { action: 'deleteGroup', mongodbUri: result.mongodbUri, groupName: groupName },
      (response) => {
        if (response && response.success) {
          loadExistingGroups();
          loadSavedTabs();
          alert(`Group "${groupName}" deleted successfully! (${response.deletedCount} tabs removed)`);
        } else {
          alert(`Failed to delete group: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  });
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}