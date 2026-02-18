export function sendToContent(msg, timeout = 5000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, error: 'Timeout waiting for content script response' });
    }, timeout);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timer);
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      if (!tabs?.[0]?.id) {
        clearTimeout(timer);
        resolve({ success: false, error: 'No active tab' });
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: 'No response' });
      });
    });
  });
}

export function sendToBackground(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { success: false, error: 'No response' });
    });
  });
}

export function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0] || null);
    });
  });
}
