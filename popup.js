document.addEventListener('DOMContentLoaded', () => {
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date-filter').value = today;

  // Load MongoDB connection from storage
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (result.mongodbUri) {
      document.getElementById('mongodb-uri').value = result.mongodbUri;
      updateConnectionStatus('Connection saved', 'success');
      loadSavedTabs(today);
    }
  });

  // Event listeners
  document.getElementById('save-connection').addEventListener('click', handleSaveConnection);
  document.getElementById('save-current-tab').addEventListener('click', handleSaveCurrentTab);
  document.getElementById('save-all-tabs').addEventListener('click', handleSaveAllTabs);
  document.getElementById('refresh-tabs').addEventListener('click', handleRefreshTabs);
});

function updateConnectionStatus(message, type) {
  const statusEl = document.getElementById('connection-status');
  statusEl.textContent = message;
  
  // Use Tailwind classes for status styling
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
          const today = new Date().toISOString().split('T')[0];
          loadSavedTabs(today);
        });
      } else {
        updateConnectionStatus(`Connection failed: ${response ? response.error : 'Unknown error'}`, 'error');
      }
    }
  );
}

function handleSaveCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      saveTab(tabs[0], today);
    }
  });
}

function handleSaveAllTabs() {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    const today = new Date().toISOString().split('T')[0];
    saveAllTabs(tabs, today);
  });
}

function handleRefreshTabs() {
  const dateFilter = document.getElementById('date-filter').value;
  loadSavedTabs(dateFilter);
}

function saveTab(tab, date) {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) {
      alert('Please set up MongoDB connection first');
      return;
    }

    const tabData = {
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl || '',
      date: date
    };

    chrome.runtime.sendMessage(
      { action: 'saveTab', mongodbUri: result.mongodbUri, tabData },
      (response) => {
        if (response && response.success) {
          loadSavedTabs(date);
          alert('Tab saved successfully!');
        } else {
          alert(`Failed to save tab: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  });
}

function saveAllTabs(tabs, date) {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) {
      alert('Please set up MongoDB connection first');
      return;
    }

    const tabsData = tabs.map(tab => ({
      title: tab.title,
      url: tab.url,
      favicon: tab.favIconUrl || '',
      date: date
    }));

    chrome.runtime.sendMessage(
      { action: 'saveAllTabs', mongodbUri: result.mongodbUri, tabsData },
      (response) => {
        if (response && response.success) {
          loadSavedTabs(date);
          alert(`${tabsData.length} tabs saved successfully!`);
        } else {
          alert(`Failed to save tabs: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  });
}

function loadSavedTabs(date) {
  chrome.storage.local.get(['mongodbUri'], (result) => {
    if (!result.mongodbUri) {
      return;
    }

    chrome.runtime.sendMessage(
      { action: 'loadTabs', mongodbUri: result.mongodbUri, date },
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

  let html = '';
  tabs.forEach(tab => {
    html += `
      <div class="flex items-center p-2 border-b border-gray-200 last:border-0" data-tab-id="${tab._id}" data-tab-url="${escapeHTML(tab.url)}">
        <img class="w-4 h-4 mr-2" src="${tab.favicon || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'">
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate text-sm">${escapeHTML(tab.title)}</div>
          <div class="text-xs text-gray-500 truncate">${escapeHTML(tab.url)}</div>
        </div>
        <div class="flex gap-1 ml-2">
          <button class="open-btn bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors" data-action="open">Open</button>
          <button class="delete-btn bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs transition-colors" data-action="delete">Delete</button>
        </div>
      </div>
    `;
  });

  tabsList.innerHTML = html;

  // Add event listeners to all buttons (no inline event handlers)
  document.querySelectorAll('.tab-item, [data-tab-id]').forEach(tabItem => {
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
          const dateFilter = document.getElementById('date-filter').value;
          loadSavedTabs(dateFilter);
          alert('Tab deleted successfully!');
        } else {
          alert(`Failed to delete tab: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  });
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}