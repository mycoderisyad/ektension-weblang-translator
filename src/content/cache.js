// Translation cache with in-memory Map and sessionStorage persistence
export const TranslationCache = (() => {
  const cache = new Map();
  const MAX_CACHE_SIZE = 500;

  function generateKey(text, from, to) {
    const hash = text.substring(0, 50).replace(/\s+/g, '_');
    return `${from}_${to}_${hash}`;
  }

  function set(text, from, to, translation) {
    const key = generateKey(text, from, to);
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    const record = { translation, timestamp: Date.now() };
    cache.set(key, record);
    try {
      sessionStorage.setItem(`wl_cache_${key}`, JSON.stringify(record));
    } catch {
      clearOldCacheEntries();
    }
  }

  function get(text, from, to) {
    const key = generateKey(text, from, to);
    if (cache.has(key)) {
      const data = cache.get(key);
      if (Date.now() - data.timestamp < 3600000) return data.translation;
      cache.delete(key);
    }
    try {
      const raw = sessionStorage.getItem(`wl_cache_${key}`);
      if (raw) {
        const data = JSON.parse(raw);
        if (Date.now() - data.timestamp < 3600000) {
          cache.set(key, data);
          return data.translation;
        }
        sessionStorage.removeItem(`wl_cache_${key}`);
      }
    } catch {}
    return null;
  }

  function clearOldCacheEntries() {
    const now = Date.now();
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('wl_cache_'))
      .forEach((k) => {
        try {
          const data = JSON.parse(sessionStorage.getItem(k));
          if (now - data.timestamp > 3600000) sessionStorage.removeItem(k);
        } catch {
          sessionStorage.removeItem(k);
        }
      });
  }

  function clear() {
    cache.clear();
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('wl_cache_'))
      .forEach((k) => sessionStorage.removeItem(k));
  }

  function getStats() {
    return {
      memorySize: cache.size,
      storageSize: Object.keys(sessionStorage).filter((k) => k.startsWith('wl_cache_')).length,
    };
  }

  return { set, get, clear, getStats };
})();


