export const StorageUtils = (() => {
  async function get(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(keys, (data) => {
          if (chrome.runtime.lastError) resolve({});
          else resolve(data);
        });
      } catch {
        resolve({});
      }
    });
  }

  async function set(obj) {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.set(obj, () => resolve(!chrome.runtime.lastError));
      } catch {
        resolve(false);
      }
    });
  }

  async function getLocal(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (data) => {
          if (chrome.runtime.lastError) resolve({});
          else resolve(data);
        });
      } catch {
        resolve({});
      }
    });
  }

  async function setLocal(obj) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(obj, () => resolve(!chrome.runtime.lastError));
      } catch {
        resolve(false);
      }
    });
  }

  return { get, set, getLocal, setLocal };
})();


