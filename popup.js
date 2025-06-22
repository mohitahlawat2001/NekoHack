document.addEventListener('DOMContentLoaded', () => {
  // Set current date as default
  const today = '2025-06-22';
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
  document.getElementById('new-group-radio').addEventListener('click', handleGroupMethodChange);
  document.getElementById('existing-group-radio').addEventListener('click', handleGroupMethodChange);
  document.getElementById('new-group-name').addEventListener('input', updateCurrentGroupDisplay);
  document.getElementById('existing-groups-select').addEventListener('change', updateCurrentGroupDisplay);
  
  // Also listen for change events
  document.getElementById('new-group-radio').addEventListener('change', handleGroupMethodChange);
  document.getElementById('existing-group-radio').addEventListener('change', handleGroupMethodChange);
});

function handleGroupMethodChange() {
  const isNewGroup = document.getElementById('new-group-radio').checked;
  const isExistingGroup = document.getElementById('existing-group-radio').checked;
  
  const newGroupSection = document.getElementById('new-group-section');
  const existingGroupSection = document.getElementById('existing-group-section');
  
  if (isNewGroup) {
    newGroupSection.classList.remove('hidden');
    existingGroupSection.classList.add('hidden');
  } else if (isExistingGroup) {
    newGroupSection.classList.add('hidden');
    existingGroupSection.classList.remove('hidden');
  }
  
  updateCurrentGroupDisplay();
}

function getCurrentGroupName() {
  const isNewGroup = document.getElementById('new-group-radio').checked;
  
  if (isNewGroup) {
    const newGroupName = document.getElementById('new-group-name').value.trim();
    return newGroupName || '2025-06-22';
  } else {
    const existingGroupName = document.getElementById('existing-groups-select').value;
    if (!existingGroupName) {
      return 'Please select a group';
    }
    return existingGroupName;
  }
}

function getCurrentNotes() {
  return document.getElementById('tab-notes').value.trim();
}

function updateCurrentGroupDisplay() {
  const currentGroup = getCurrentGroupName();
  const displayEl = document.getElementById('current-group-display');
  displayEl.textContent = currentGroup;
  
  if (currentGroup === 'Please select a group') {
    displayEl.className = 'text-sm font-semibold text-red-600 truncate';
  } else {
    displayEl.className = 'text-sm font-semibold text-blue-800 truncate';
  }
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${
    type === 'success' ? 'bg-green-500 text-white' :
    type === 'error' ? 'bg-red-500 text-white' :
    'bg-blue-500 text-white'
  }`;
  notification.textContent = message;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
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
    showNotification('Please enter a valid MongoDB URI', 'error');
    return;
  }

  updateConnectionStatus('Testing connection...', '');
  
  chrome.runtime.sendMessage(
    { action: 'testMongoDBConnection', mongodbUri },
    (response) => {
      if (response && response.success) {
        chrome.storage.local.set({ mongodbUri }, () => {
          updateConnectionStatus('Connection successful and saved', 'success');
          showNotification('MongoDB connection successful!', 'success');
          loadExistingGroups();
          loadSavedTabs();
        });
      } else {
        const errorMsg = `Connection failed: ${response ? response.error : 'Unknown error'}`;
        updateConnectionStatus(errorMsg, 'error');
        showNotification(errorMsg, 'error');
      }
    }
  );
}

function handleSaveCurrentTab() {
  const groupName = getCurrentGroupName();
  if (!groupName || groupName === 'Please select a group') {
    showNotification('Please select or enter a group name', 'error');
    return;
  }
  
  // Show loading state
  const button = document.getElementById('save-current-tab');
  const originalText = button.textContent;
  button.textContent = 'Saving...';
  button.disabled = true;
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const notes = getCurrentNotes();
      saveTab(tabs[0], groupName, notes, () => {
        // Reset button state
        button.textContent = originalText;
        button.disabled = false;
      });
    } else {
      button.textContent = originalText;
      button.disabled = false;
      showNotification('No active tab found', 'error');
    }
  });
}

function handleSaveAllTabs() {
  const groupName = getCurrentGroupName();
  if (!groupName || groupName === 'Please select a group') {
    showNotification('Please select or enter a group name', 'error');
    return;
  }
  
  // Show loading state
  const button = document.getElementById('save-all-tabs');
  const originalText = button.textContent;
  button.textContent = 'Saving...';
  button.disabled = true;
  
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const notes = getCurrentNotes();
      saveAllTabs(tabs, groupName, notes, () => {
        // Reset button state
        button.textContent = originalText;
        button.disabled = false;
      });
    } else {
      button.textContent = originalText;
      button.disabled = false;
      showNotification('No tabs found', 'error');
    }
  });
}

function handleRefreshTabs() {
  loadSavedTabs();
}

function saveTab(tab, groupName, notes, callback) {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) {
      showNotification('Please set up MongoDB connection first', 'error');
      if (callback) callback();
      return;
    }

    const tabData = {
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl || '',
      groupName: groupName,
      notes: notes,
      date: '2025-06-22',
      createdAt: '2025-06-22 04:55:44',
      createdBy: 'mohitahlawat2001'
    };

    chrome.runtime.sendMessage(
      { action: 'saveTab', mongodbUri: result.mongodbUri, tabData },
      (response) => {
        if (response && response.success) {
          loadExistingGroups();
          loadSavedTabs();
          // Clear notes after successful save
          document.getElementById('tab-notes').value = '';
          showNotification(`Tab saved to group: "${groupName}"`, 'success');
        } else {
          const errorMsg = `Failed to save tab: ${response ? response.error : 'Unknown error'}`;
          showNotification(errorMsg, 'error');
        }
        if (callback) callback();
      }
    );
  });
}

function saveAllTabs(tabs, groupName, notes, callback) {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) {
      showNotification('Please set up MongoDB connection first', 'error');
      if (callback) callback();
      return;
    }

    const tabsData = tabs.map(tab => ({
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl || '',
      groupName: groupName,
      notes: notes,
      date: '2025-06-22',
      createdAt: '2025-06-22 04:55:44',
      createdBy: 'mohitahlawat2001'
    }));

    chrome.runtime.sendMessage(
      { action: 'saveAllTabs', mongodbUri: result.mongodbUri, tabsData },
      (response) => {
        if (response && response.success) {
          loadExistingGroups();
          loadSavedTabs();
          // Clear notes after successful save
          document.getElementById('tab-notes').value = '';
          showNotification(`${tabsData.length} tabs saved to group: "${groupName}"`, 'success');
        } else {
          const errorMsg = `Failed to save tabs: ${response ? response.error : 'Unknown error'}`;
          showNotification(errorMsg, 'error');
        }
        if (callback) callback();
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
  
  existingGroupsSelect.innerHTML = '<option value="">Select an existing group</option>';
  groupFilterSelect.innerHTML = '<option value="">All groups</option>';
  
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

  const existingGroupRadio = document.getElementById('existing-group-radio');
  const existingGroupLabel = existingGroupRadio.parentElement;
  
  if (groups.length === 0) {
    existingGroupRadio.disabled = true;
    existingGroupLabel.classList.add('opacity-50', 'cursor-not-allowed');
    existingGroupLabel.title = 'No existing groups found. Save some tabs first.';
    
    if (existingGroupRadio.checked) {
      document.getElementById('new-group-radio').checked = true;
      handleGroupMethodChange();
    }
  } else {
    existingGroupRadio.disabled = false;
    existingGroupLabel.classList.remove('opacity-50', 'cursor-not-allowed');
    existingGroupLabel.title = '';
  }
  
  updateCurrentGroupDisplay();
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

function toggleGroup(groupName) {
  const groupContent = document.getElementById(`group-content-${groupName}`);
  const toggleIcon = document.getElementById(`toggle-icon-${groupName}`);
  
  if (groupContent.classList.contains('hidden')) {
    groupContent.classList.remove('hidden');
    toggleIcon.textContent = '🔽';
    toggleIcon.title = 'Collapse group';
  } else {
    groupContent.classList.add('hidden');
    toggleIcon.textContent = '▶️';
    toggleIcon.title = 'Expand group';
  }
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
    const safeGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_'); // Safe ID
    
    html += `
      <div class="group-container">
        <div class="bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-2 rounded-t-md border-b border-blue-200 group-header">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2" style="max-width: 180px;">
              <button class="toggle-group-btn text-blue-800 hover:text-blue-900 focus:outline-none flex-shrink-0" 
                      id="toggle-icon-${safeGroupName}" 
                      title="Collapse group"
                      data-group="${safeGroupName}">🔽</button>
              <h3 class="font-semibold text-sm text-blue-800 group-title">📁 ${escapeHTML(groupName)} <span class="text-blue-600">(${groupTabs.length})</span></h3>
            </div>
            <div class="flex gap-1 flex-shrink-0">
              <button class="open-all-group-btn text-blue-600 hover:text-blue-800 text-xs font-medium" data-group="${escapeHTML(groupName)}">Open All</button>
              <button class="delete-group-btn text-red-500 hover:text-red-700 text-xs font-medium" data-group="${escapeHTML(groupName)}">Delete</button>
            </div>
          </div>
        </div>
        <div class="border-l border-r border-b border-gray-200 rounded-b-md bg-white" id="group-content-${safeGroupName}">
    `;
    
    groupTabs.forEach((tab, index) => {
      const isLast = index === groupTabs.length - 1;
      const createdDate = formatDate(tab.createdAt || tab.date);
      const hasNotes = tab.notes && tab.notes.trim();
      
      html += `
        <div class="tab-item ${!isLast ? 'border-b border-gray-100' : ''} hover:bg-gray-50 transition-colors" 
             data-tab-id="${tab._id}" data-tab-url="${escapeHTML(tab.url)}">
          <img class="w-4 h-4 mr-2 flex-shrink-0" 
               src="${tab.favicon || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'}" 
               alt="favicon">
          <div class="tab-content">
            <div class="tab-title font-medium text-gray-900" title="${escapeHTML(tab.title)}">${escapeHTML(tab.title)}</div>
            <div class="tab-url text-gray-500" title="${escapeHTML(tab.url)}">${escapeHTML(tab.url)}</div>
            ${hasNotes ? `<div class="tab-notes text-green-600 mt-1" title="${escapeHTML(tab.notes)}">📝 ${escapeHTML(tab.notes)}</div>` : ''}
            <div class="text-gray-400 mt-1" style="font-size: 11px;">💾 ${createdDate}</div>
          </div>
          <div class="tab-actions">
            <button class="open-btn bg-blue-500 hover:bg-blue-600 text-white">Open</button>
            <button class="delete-btn bg-red-500 hover:bg-red-600 text-white">Del</button>
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

  // Add event listeners for tabs (NO INLINE HANDLERS)
  document.querySelectorAll('[data-tab-id]').forEach(tabItem => {
    const openBtn = tabItem.querySelector('.open-btn');
    const deleteBtn = tabItem.querySelector('.delete-btn');
    
    if (openBtn) {
      openBtn.addEventListener('click', function() {
        const url = tabItem.getAttribute('data-tab-url');
        chrome.tabs.create({ url: url });
        showNotification('Tab opened successfully', 'success');
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function() {
        const tabId = tabItem.getAttribute('data-tab-id');
        deleteTab(tabId);
      });
    }
  });

  // Add event listeners for group actions (NO INLINE HANDLERS)
  document.querySelectorAll('.delete-group-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const groupName = btn.getAttribute('data-group');
      deleteGroup(groupName);
    });
  });

  document.querySelectorAll('.open-all-group-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const groupName = btn.getAttribute('data-group');
      openAllTabsInGroup(groupName, groupedTabs[groupName]);
    });
  });

  // Add event listeners for toggle buttons (NO INLINE HANDLERS)
  document.querySelectorAll('.toggle-group-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const safeGroupName = btn.getAttribute('data-group');
      toggleGroup(safeGroupName);
    });
  });
}

function openAllTabsInGroup(groupName, tabs) {
  showNotification(`Opening ${tabs.length} tabs from group "${groupName}"`, 'info');
  
  tabs.forEach((tab, index) => {
    setTimeout(() => {
      chrome.tabs.create({ url: tab.url, active: index === 0 });
    }, index * 100);
  });
}

function deleteTab(id) {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) return;

    chrome.runtime.sendMessage(
      { action: 'deleteTab', mongodbUri: result.mongodbUri, tabId: id },
      (response) => {
        if (response && response.success) {
          loadSavedTabs();
          showNotification('Tab deleted successfully', 'success');
        } else {
          const errorMsg = `Failed to delete tab: ${response ? response.error : 'Unknown error'}`;
          showNotification(errorMsg, 'error');
        }
      }
    );
  });
}

function deleteGroup(groupName) {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) return;

    chrome.runtime.sendMessage(
      { action: 'deleteGroup', mongodbUri: result.mongodbUri, groupName: groupName },
      (response) => {
        if (response && response.success) {
          loadExistingGroups();
          loadSavedTabs();
          showNotification(`Group "${groupName}" deleted (${response.deletedCount} tabs removed)`, 'success');
        } else {
          const errorMsg = `Failed to delete group: ${response ? response.error : 'Unknown error'}`;
          showNotification(errorMsg, 'error');
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