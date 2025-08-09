(() => {
  // src/content/ui.js
  var UI = /* @__PURE__ */ (() => {
    let progressElement = null;
    function getColorScheme(theme) {
      const schemes = {
        default: { color: "#f3f4f6", bg: "#1f2937", border: "#6b7280" },
        red: { color: "#fef2f2", bg: "#2b1212", border: "#ef4444" },
        blue: { color: "#eff6ff", bg: "#13233f", border: "#3b82f6" },
        green: { color: "#ecfdf5", bg: "#123027", border: "#10b981" },
        yellow: { color: "#fefce8", bg: "#2b230f", border: "#f59e0b" }
      };
      return schemes[theme] || schemes.default;
    }
    function updateTranslationColor(theme) {
      const colorScheme = getColorScheme(theme || "default");
      const styleId = "weblang-translation-color-override";
      let styleTag = document.getElementById(styleId);
      const css = `.weblang-translation{color:${colorScheme.color} !important;background:${colorScheme.bg} !important;border-left:4px solid ${colorScheme.border} !important;box-shadow:0 1px 0 rgba(0,0,0,.25) inset, 0 1px 6px rgba(0,0,0,.15) !important;}`;
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = styleId;
        styleTag.textContent = css;
        document.head.appendChild(styleTag);
      } else {
        styleTag.textContent = css;
      }
    }
    function getUserPreferences() {
      return new Promise((resolve) => {
        try {
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(["translationColor", "sourceLang", "targetLang"], (data) => resolve(data || {}));
          } else {
            resolve({ translationColor: "default", sourceLang: "auto", targetLang: "id" });
          }
        } catch {
          resolve({ translationColor: "default", sourceLang: "auto", targetLang: "id" });
        }
      });
    }
    async function injectTranslation(element, translation, mode = "after") {
      if (!translation || translation.length < 2) return;
      if (!element || !element.parentNode) return;
      const prefs = await getUserPreferences();
      const colorScheme = getColorScheme(prefs.translationColor || "default");
      if (mode === "after") {
        if (element.nextElementSibling?.classList.contains("weblang-translation")) {
          element.nextElementSibling.textContent = translation;
          return;
        }
        const div = document.createElement("div");
        div.className = "weblang-translation";
        div.style.cssText = `margin:6px 0 10px 0;padding:8px 12px;color:${colorScheme.color};background:${colorScheme.bg};border-left:4px solid ${colorScheme.border};border-radius:6px;display:block;line-height:1.55;box-shadow:0 1px 0 rgba(0,0,0,.25) inset, 0 1px 6px rgba(0,0,0,.15);`;
        div.textContent = translation;
        try {
          const parent = element.parentNode || element.closest("p, div, section, article") || document.body;
          element.nextSibling ? parent.insertBefore(div, element.nextSibling) : parent.appendChild(div);
        } catch {
          element.textContent = translation;
        }
      } else {
        if (!element.hasAttribute("data-weblang-original")) element.setAttribute("data-weblang-original", element.textContent);
        let replaced = false;
        element.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) {
            if (!replaced) {
              node.nodeValue = translation;
              replaced = true;
            }
          }
        });
        if (!replaced) element.textContent = translation;
      }
    }
    function showProgress(current, total, message = "Translating") {
      if (progressElement) progressElement.remove();
      if (current >= total) {
        progressElement?.remove();
        progressElement = null;
        return;
      }
      progressElement = document.createElement("div");
      progressElement.id = "weblang-progress";
      progressElement.style.cssText = `position:fixed;top:20px;right:20px;background:#111827;color:#e5e7eb;padding:14px 20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.5);z-index:2147483647;display:flex;gap:12px;`;
      const percentage = Math.round(current / total * 100);
      progressElement.innerHTML = `
      <div style="width:24px;height:24px;border:3px solid #374151;border-top-color:#9ca3af;border-radius:50%;animation:spin 1s linear infinite"></div>
      <div><div style="font-weight:600">${message}</div><div style="font-size:12px;opacity:.9">${current}/${total} (${percentage}%)</div></div>
      <div style="width:100px;height:4px;background:#1f2937;border-radius:2px;overflow:hidden"><div style="width:${percentage}%;height:100%;background:#9ca3af"></div></div>`;
      if (!document.getElementById("weblang-animations")) {
        const style = document.createElement("style");
        style.id = "weblang-animations";
        style.textContent = `@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`;
        document.head.appendChild(style);
      }
      document.body.appendChild(progressElement);
    }
    function showNotification(message, type = "info") {
      const el = document.createElement("div");
      el.style.cssText = `position:fixed;bottom:20px;right:20px;background:${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};color:#fff;padding:12px 20px;border-radius:8px;z-index:2147483647`;
      el.textContent = message;
      document.body.appendChild(el);
      setTimeout(() => {
        el.remove();
      }, 3e3);
    }
    return { injectTranslation, updateTranslationColor, showProgress, showNotification, getUserPreferences };
  })();

  // src/content/domUtils.js
  var DomUtils = /* @__PURE__ */ (() => {
    let processedElements = /* @__PURE__ */ new WeakSet();
    function queryAllDeep(selector, root = document) {
      const results = [];
      const visited = /* @__PURE__ */ new WeakSet();
      function search(node) {
        if (!node || visited.has(node)) return;
        visited.add(node);
        try {
          results.push(...Array.from(node.querySelectorAll(selector)));
        } catch {
        }
        try {
          const all = node.querySelectorAll ? node.querySelectorAll("*") : [];
          all.forEach((el) => {
            if (el.shadowRoot) search(el.shadowRoot);
          });
        } catch {
        }
      }
      search(root);
      return results;
    }
    function isValidTextNode(el) {
      if (!el || processedElements.has(el)) return false;
      if (el.classList?.contains("weblang-translation")) return false;
      if (el.hasAttribute?.("data-weblang-translated")) return false;
      const invalidSelectors = "script, style, noscript, code, pre, .weblang-translation";
      if (el.closest?.(invalidSelectors)) return false;
      const codeSelectors = ".highlight, .code-block, [class*='language-'], .prettyprint";
      if (el.closest?.(codeSelectors)) return false;
      const mediaElements = "img, video, audio, canvas, svg, iframe, object, embed";
      if (el.matches?.(mediaElements)) return false;
      const formElements = "input, button, select, textarea";
      if (el.matches?.(formElements)) return false;
      return true;
    }
    function extractTextContent(element) {
      if (!element) return "";
      if (!element.children || element.children.length === 0) return element.textContent?.trim() || "";
      const clone = element.cloneNode(true);
      const toRemove = clone.querySelectorAll("img, video, audio, canvas, svg, iframe, script, style");
      toRemove.forEach((el) => el.remove());
      return clone.textContent?.trim() || "";
    }
    function getTranslatableElements(container = document.body) {
      const selector = [
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "td",
        "th",
        "blockquote",
        "figcaption",
        "main p",
        "article p",
        "section p",
        ".section p",
        ".content p",
        ".container p",
        ".column p",
        "div p",
        "span",
        "a",
        "strong",
        "em",
        "b",
        "i"
        // Added more selectors
      ].join(", ");
      const elements = queryAllDeep(selector, container === document.body ? document : container);
      console.log(`Found ${elements.length} potential translatable elements`);
      const validElements = elements.filter((el) => {
        if (processedElements.has(el)) return false;
        if (el.hasAttribute("data-weblang-translated")) return false;
        if (el.nextElementSibling?.classList.contains("weblang-translation")) return false;
        if (!isValidTextNode(el)) return false;
        const text = extractTextContent(el);
        if (!text || text.length < 3) return false;
        if (/^[\d\s\-_=.,:;!?\/\(\)\[\]{}'"@#$%^&*<>]*$/.test(text) && text.length < 10) return false;
        if (text.includes("class=") || text.includes("id=") || text.includes("<div") || text.includes("</")) return false;
        if (el.children.length > 15) return false;
        return true;
      });
      console.log(`Filtered to ${validElements.length} valid translatable elements`);
      validElements.forEach((el) => processedElements.add(el));
      return validElements.length ? validElements : fallbackFromTextNodes();
    }
    function fallbackFromTextNodes() {
      try {
        const allowedParents = /* @__PURE__ */ new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "TD", "TH", "BLOCKQUOTE", "FIGCAPTION", "SPAN"]);
        const containers = queryAllDeep("main, article, section, .section, .content, .container, .column");
        const fallbackSet = /* @__PURE__ */ new Set();
        containers.forEach((rootEl) => {
          const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
            acceptNode: (node2) => {
              const txt = node2.nodeValue?.trim();
              if (!txt || txt.length < 5) return NodeFilter.FILTER_REJECT;
              const parent = node2.parentElement;
              if (!parent || !allowedParents.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
              if (parent.closest("script, style, noscript, code, pre, .weblang-translation")) return NodeFilter.FILTER_REJECT;
              if (/^[\d\s\-_=.,:;!?\/\(\)\[\]{}'"@#$%^&*<>]*$/.test(txt)) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          });
          let node;
          while (node = walker.nextNode()) if (node.parentElement) fallbackSet.add(node.parentElement);
        });
        return Array.from(fallbackSet);
      } catch {
        return [];
      }
    }
    function markTranslated(el, originalText) {
      el.setAttribute("data-weblang-translated", "true");
      if (originalText) el.setAttribute("data-weblang-original", originalText);
      processedElements.add(el);
    }
    function resetProcessedElements() {
      processedElements = /* @__PURE__ */ new WeakSet();
    }
    return { queryAllDeep, isValidTextNode, extractTextContent, getTranslatableElements, markTranslated, resetProcessedElements };
  })();

  // src/content/cache.js
  var TranslationCache = /* @__PURE__ */ (() => {
    const cache = /* @__PURE__ */ new Map();
    const MAX_CACHE_SIZE = 500;
    function generateKey(text, from, to) {
      const hash = text.substring(0, 50).replace(/\s+/g, "_");
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
        if (Date.now() - data.timestamp < 36e5) return data.translation;
        cache.delete(key);
      }
      try {
        const raw = sessionStorage.getItem(`wl_cache_${key}`);
        if (raw) {
          const data = JSON.parse(raw);
          if (Date.now() - data.timestamp < 36e5) {
            cache.set(key, data);
            return data.translation;
          }
          sessionStorage.removeItem(`wl_cache_${key}`);
        }
      } catch {
      }
      return null;
    }
    function clearOldCacheEntries() {
      const now = Date.now();
      Object.keys(sessionStorage).filter((k) => k.startsWith("wl_cache_")).forEach((k) => {
        try {
          const data = JSON.parse(sessionStorage.getItem(k));
          if (now - data.timestamp > 36e5) sessionStorage.removeItem(k);
        } catch {
          sessionStorage.removeItem(k);
        }
      });
    }
    function clear() {
      cache.clear();
      Object.keys(sessionStorage).filter((k) => k.startsWith("wl_cache_")).forEach((k) => sessionStorage.removeItem(k));
    }
    function getStats() {
      return {
        memorySize: cache.size,
        storageSize: Object.keys(sessionStorage).filter((k) => k.startsWith("wl_cache_")).length
      };
    }
    return { set, get, clear, getStats };
  })();

  // src/content/batch.js
  var MegaBatchTranslator = /* @__PURE__ */ (() => {
    const CONFIG = {
      MEGA_BATCH_SIZE: 25,
      MAX_CHARS_PER_BATCH: 4e3,
      MAX_RETRIES: 3,
      RETRY_DELAY: 500
    };
    async function translateBatch(texts, from, to) {
      if (!texts || texts.length === 0) return [];
      console.log(`Starting batch translation of ${texts.length} texts`);
      const results = new Array(texts.length);
      const toTranslate = [];
      const indices = [];
      for (let i = 0; i < texts.length; i++) {
        const cached = TranslationCache.get(texts[i], from, to);
        if (cached) {
          results[i] = cached;
        } else {
          toTranslate.push(texts[i]);
          indices.push(i);
        }
      }
      console.log(`Found ${texts.length - toTranslate.length} cached, need to translate ${toTranslate.length}`);
      if (toTranslate.length === 0) return results;
      const concurrency = 2;
      for (let start = 0; start < toTranslate.length; start += concurrency) {
        const slice = toTranslate.slice(start, start + concurrency);
        console.log(`Translating batch ${Math.floor(start / concurrency) + 1}/${Math.ceil(toTranslate.length / concurrency)}`);
        if (start > 0) {
          await new Promise((r) => setTimeout(r, 300));
        }
        const translatedSlice = await Promise.all(slice.map((t) => translateSingle(t, from, to)));
        for (let i = 0; i < translatedSlice.length; i++) {
          const translation = translatedSlice[i];
          const originalIndex = indices[start + i];
          if (translation) {
            results[originalIndex] = translation;
            TranslationCache.set(toTranslate[start + i], from, to, translation);
          } else {
            results[originalIndex] = toTranslate[start + i];
          }
        }
      }
      console.log("Batch translation completed");
      return results;
    }
    async function translateSingle(text, from, to, retries = 0) {
      try {
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, CONFIG.RETRY_DELAY * Math.pow(2, retries)));
        }
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "TRANSLATE_TEXT", text: text.trim(), from, to }, (resp) => {
            if (chrome.runtime.lastError) {
              console.log("Chrome runtime error in batch:", chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(resp || { success: false, error: "No response" });
            }
          });
        });
        if (response?.success && response.translation && response.translation.trim().length > 0) {
          console.log(`Translation success for text: ${text.substring(0, 30)}...`);
          return response.translation;
        }
        if (response?.error && response.error.includes("Rate limited")) {
          console.log("Rate limited, waiting longer before retry...");
          if (retries < CONFIG.MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1e3 + retries * 500));
            return translateSingle(text, from, to, retries + 1);
          }
        }
        if (retries < CONFIG.MAX_RETRIES) {
          console.log(`Translation failed, retrying (${retries + 1}/${CONFIG.MAX_RETRIES}):`, response?.error);
          return translateSingle(text, from, to, retries + 1);
        }
        console.log("Translation failed after all retries for text:", text.substring(0, 50), "Response:", response);
        return null;
      } catch (e) {
        console.log("Batch translate error:", e);
        if (retries < CONFIG.MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, CONFIG.RETRY_DELAY * Math.pow(2, retries)));
          return translateSingle(text, from, to, retries + 1);
        }
        return null;
      }
    }
    function createBatches(elements) {
      const batches = [];
      let current = [];
      let chars = 0;
      for (const element of elements) {
        const text = typeof element === "string" ? element : element.textContent?.trim() || "";
        const len = text.length;
        if (current.length >= CONFIG.MEGA_BATCH_SIZE || chars + len > CONFIG.MAX_CHARS_PER_BATCH && current.length > 0) {
          batches.push(current);
          current = [];
          chars = 0;
        }
        current.push({ element: typeof element === "string" ? null : element, text });
        chars += len;
      }
      if (current.length) batches.push(current);
      return batches;
    }
    return { translateBatch, translateSingle, createBatches, CONFIG };
  })();

  // src/content/pipeline.js
  var TranslationPipeline = /* @__PURE__ */ (() => {
    let state = {
      translations: { originalTexts: [], translatedTexts: [], sourceLang: "auto", targetLang: "id", mode: "paragraph" },
      isTranslating: false,
      shouldStop: false,
      stats: { total: 0, translated: 0, cached: 0, failed: 0, startTime: 0, endTime: 0 }
    };
    async function translatePage(mode, sourceLang, targetLang, callback) {
      if (state.isTranslating) {
        callback({ success: false, error: "Translation already in progress" });
        return;
      }
      state.isTranslating = true;
      state.shouldStop = false;
      state.stats = { total: 0, translated: 0, cached: 0, failed: 0, startTime: Date.now(), endTime: 0 };
      state.translations = { originalTexts: [], translatedTexts: [], sourceLang, targetLang, mode };
      try {
        const elements = DomUtils.getTranslatableElements();
        if (elements.length === 0) {
          UI.showNotification("No translatable content found", "info");
          callback({ success: true, message: "No content to translate" });
          return;
        }
        state.stats.total = elements.length;
        const batches = MegaBatchTranslator.createBatches(elements);
        let processed = 0;
        for (let i = 0; i < batches.length; i++) {
          if (state.shouldStop) break;
          const batch = batches[i];
          const texts = batch.map((it) => it.text);
          UI.showProgress(processed, state.stats.total, "Translating page");
          const translations = await MegaBatchTranslator.translateBatch(texts, sourceLang, targetLang);
          for (let j = 0; j < batch.length; j++) {
            const { element, text } = batch[j];
            const translation = translations[j];
            if (translation && translation.trim().length > 0) {
              const modeToUse = mode === "fullpage" ? "replace" : "after";
              await UI.injectTranslation(element, translation, modeToUse);
              DomUtils.markTranslated(element, text);
              state.translations.originalTexts.push(text);
              state.translations.translatedTexts.push(translation);
              state.stats.translated++;
            } else {
              state.stats.failed++;
            }
            processed++;
          }
        }
        state.stats.endTime = Date.now();
        UI.showProgress(state.stats.total, state.stats.total);
        callback({ success: true, stats: state.stats });
      } catch (e) {
        UI.showNotification("Translation failed: " + e.message, "error");
        callback({ success: false, error: e.message });
      } finally {
        state.isTranslating = false;
        state.shouldStop = false;
      }
    }
    function stopTranslation() {
      state.shouldStop = true;
      UI.showNotification("Stopping translation...", "info");
    }
    function getTranslations() {
      return state.translations;
    }
    function getStats() {
      return state.stats;
    }
    function clearCache() {
      TranslationCache.clear();
      UI.showNotification("Translation cache cleared", "info");
    }
    const isTranslating = () => state.isTranslating;
    function resetState() {
      state.translations = { originalTexts: [], translatedTexts: [], sourceLang: "auto", targetLang: "id", mode: "paragraph" };
      state.isTranslating = false;
      state.shouldStop = false;
      state.stats = { total: 0, translated: 0, cached: 0, failed: 0, startTime: 0, endTime: 0 };
      console.log("Translation pipeline state reset");
    }
    return { translatePage, stopTranslation, getTranslations, getStats, clearCache, isTranslating, resetState };
  })();

  // src/content/quickTranslate.js
  function isExtensionContextValid() {
    try {
      return chrome && chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }
  var isQuickTranslateEnabled = false;
  function initQuickTranslate() {
    if (window.__WEBLANG_QT_INIT) {
      console.log("Quick translate already initialized");
      return;
    }
    console.log("Initializing quick translate...");
    isQuickTranslateEnabled = true;
    window.__WEBLANG_QT_INIT = true;
    let quickTranslateButton = null;
    let popupEl = null;
    let selectionTimeout = null;
    function removeUI() {
      document.querySelectorAll(".weblang-quick-popup").forEach((el) => el.remove());
      quickTranslateButton?.remove();
      quickTranslateButton = null;
      popupEl?.remove();
      popupEl = null;
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
        selectionTimeout = null;
      }
    }
    function createPopup(x, y, text) {
      const { color, bg, border } = function getScheme(c) {
        const s = { default: { color: "#e5e7eb", bg: "#111827", border: "#4b5563" } };
        return s[c] || s.default;
      }("default");
      const wrapper = document.createElement("div");
      wrapper.className = "weblang-quick-popup";
      wrapper.setAttribute("data-weblang-quick", "true");
      const maxX = window.innerWidth - 450;
      const maxY = window.innerHeight - 200;
      const finalX = Math.min(Math.max(10, x), maxX);
      const finalY = Math.min(Math.max(10, y + 10), maxY);
      wrapper.style.cssText = `
      position:fixed !important;
      top:${finalY}px !important;
      left:${finalX}px !important;
      z-index:2147483647 !important;
      background:${bg} !important;
      color:${color} !important;
      padding:0 !important;
      border-radius:12px !important;
      box-shadow:0 20px 40px rgba(0,0,0,0.6) !important;
      max-width:420px !important;
      min-width:280px !important;
      font-size:14px !important;
      line-height:1.6 !important;
      border:1px solid ${border} !important;
      backdrop-filter:blur(8px) !important;
      animation:fadeInUp 0.3s ease-out !important;
      overflow:hidden !important;
      display:block !important;
      visibility:visible !important;
      opacity:1 !important;
    `;
      wrapper.innerHTML = `
      <div class="weblang-quick-header" style="background:#1f2937;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${border};cursor:move;user-select:none">
        <strong style="font-weight:600;color:#fff;font-size:13px">Translation</strong>
        <button data-action="close" style="background:none;border:none;color:#999;cursor:pointer;padding:2px 6px;border-radius:4px;font-size:14px;line-height:1">Close</button>
      </div>
      <div style="padding:14px">
        <div class="weblang-quick-content" style="white-space:pre-wrap;word-break:break-word;margin-bottom:12px;color:#e5e7eb;font-size:14px;line-height:1.5">${text}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button data-action="copy" style="background:none;color:#e5e7eb;border:none;padding:0 6px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500">Copy</button>
        </div>
      </div>
    `;
      if (!document.getElementById("weblang-quick-animations")) {
        const style = document.createElement("style");
        style.id = "weblang-quick-animations";
        style.textContent = `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .weblang-quick-popup button:hover {
          transform: translateY(-1px);
        }
        .weblang-quick-popup button[data-action="close"]:hover {
          background: #374151 !important;
          color: #fff !important;
        }
        .weblang-quick-popup button[data-action="copy"]:hover { text-decoration: underline; }
      `;
        document.head.appendChild(style);
      }
      return wrapper;
    }
    const __wl_down = (e) => {
      if (popupEl && !popupEl.contains(e.target) && !e.target.closest(".weblang-popup, .weblang-translate-btn, .weblang-ui, .weblang-quick-popup[data-weblang-quick]")) {
        removeUI();
      }
    };
    document.addEventListener("mousedown", __wl_down);
    const __wl_up = async function(e) {
      try {
        if (!isQuickTranslateEnabled) {
          console.log("Quick translate globally disabled, skipping...");
          return;
        }
        if (!isExtensionContextValid()) {
          console.log("Extension context invalidated, skipping quick translate");
          return;
        }
        const isEnabled = await new Promise((resolve) => {
          try {
            chrome.storage.sync.get(["quickTranslateEnabled"], (data) => {
              if (chrome.runtime.lastError) {
                console.log("Storage access error:", chrome.runtime.lastError);
                resolve(false);
              } else {
                resolve(data.quickTranslateEnabled !== false);
              }
            });
          } catch (e2) {
            console.log("Storage access exception:", e2);
            resolve(false);
          }
        });
        if (!isEnabled || !isQuickTranslateEnabled) {
          console.log("Quick translate is disabled, skipping...");
          return;
        }
        if (popupEl && popupEl.contains(e.target)) return;
        if (e.target.closest(".weblang-popup, .weblang-translate-btn, .weblang-ui, .weblang-quick-popup[data-weblang-quick]")) return;
        if (popupEl) {
          removeUI();
          await new Promise((r) => setTimeout(r, 150));
        }
        let selected = window.getSelection().toString().trim();
        console.log("Quick translate selection check:", {
          text: selected.substring(0, 50) + (selected.length > 50 ? "..." : ""),
          length: selected.length
        });
        if (selected.length > 0) {
          console.log("Valid selection detected, showing translate button...");
          await showQuickTranslateButton(e, selected);
        } else {
          removeUI();
        }
      } catch (error) {
        console.error("Error in mouseup handler:", error);
      }
    };
    async function showQuickTranslateButton(e, selected) {
      try {
        if (!isQuickTranslateEnabled) {
          console.log("Quick translate disabled during showQuickTranslateButton");
          return;
        }
        if (!isExtensionContextValid()) {
          console.log("Extension context invalidated in showQuickTranslateButton");
          return;
        }
        const prefs = await UI.getUserPreferences().catch(() => ({ sourceLang: "auto", targetLang: "id" }));
        let sourceLang = prefs.sourceLang || "auto";
        let targetLang = prefs.targetLang || "id";
        if (sourceLang === "auto") {
          if (/[\u0600-\u06FF]/.test(selected)) sourceLang = "ar";
          else if (/[\u4e00-\u9fff]/.test(selected)) sourceLang = "zh";
          else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(selected)) sourceLang = "ja";
          else if (/[а-я]/.test(selected.toLowerCase())) sourceLang = "ru";
          else if (/[à-ÿ]/.test(selected.toLowerCase())) sourceLang = "fr";
          else sourceLang = "en";
          console.log(`Auto-detected language: ${sourceLang} for text: "${selected.substring(0, 30)}..."`);
        }
        console.log(`Translation settings: ${sourceLang} \u2192 ${targetLang}`);
        if (sourceLang === "auto") {
          console.log("Fallback: sourceLang was still auto, setting to en");
          sourceLang = "en";
        }
        if (targetLang === "auto") {
          console.log("Fallback: targetLang was auto, setting to id");
          targetLang = "id";
        }
        if (sourceLang === targetLang) {
          if (sourceLang === "id") targetLang = "en";
          else if (sourceLang === "en") targetLang = "id";
          else if (sourceLang === "ar") targetLang = "en";
          else if (sourceLang === "ja") targetLang = "en";
          else if (sourceLang === "zh") targetLang = "en";
          else if (sourceLang === "fr") targetLang = "en";
          else if (sourceLang === "de") targetLang = "en";
          else if (sourceLang === "es") targetLang = "en";
          else if (sourceLang === "ru") targetLang = "en";
          else targetLang = "en";
          console.log(`Same language detected, switching target: ${sourceLang} \u2192 ${targetLang}`);
        }
        popupEl = createPopup(e.pageX, e.pageY, "Translating...");
        document.body.appendChild(popupEl);
        console.log(`Translation request: "${selected.substring(0, 30)}..." from ${sourceLang} to ${targetLang}`);
        const header = popupEl.querySelector(".weblang-quick-header");
        let drag = false;
        let sx = 0, sy = 0, ox = 0, oy = 0;
        const onMove = (ev) => {
          if (!drag) return;
          const dx = ev.clientX - sx;
          const dy = ev.clientY - sy;
          popupEl.style.left = `${Math.max(0, ox + dx)}px`;
          popupEl.style.top = `${Math.max(0, oy + dy)}px`;
        };
        header.addEventListener("mousedown", (ev) => {
          drag = true;
          sx = ev.clientX;
          sy = ev.clientY;
          const rect = popupEl.getBoundingClientRect();
          ox = rect.left;
          oy = rect.top;
          document.addEventListener("mousemove", onMove);
          const up = () => {
            drag = false;
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", up);
          };
          document.addEventListener("mouseup", up);
        });
        const contentNode = popupEl.querySelector(".weblang-quick-content");
        let translation = await requestTranslation(selected, sourceLang, targetLang);
        if (!isQuickTranslateEnabled) {
          console.log("Quick translate disabled during translation, stopping...");
          removeUI();
          return;
        }
        if (!translation || translation === selected) {
          console.log("Auto retry for highlight translate");
          await new Promise((r) => setTimeout(r, 500));
          if (!isQuickTranslateEnabled) {
            console.log("Quick translate disabled during retry, stopping...");
            removeUI();
            return;
          }
          translation = await requestTranslation(selected, sourceLang, targetLang);
        }
        if (!isQuickTranslateEnabled) {
          console.log("Quick translate disabled during second retry, stopping...");
          removeUI();
          return;
        }
        if (!translation || translation === selected) {
          console.log("Second retry for highlight translate");
          await new Promise((r) => setTimeout(r, 800));
          if (!isQuickTranslateEnabled) {
            console.log("Quick translate disabled during final retry, stopping...");
            removeUI();
            return;
          }
          translation = await requestTranslation(selected, sourceLang, targetLang);
        }
        if (!isQuickTranslateEnabled) {
          console.log("Quick translate disabled before showing result, stopping...");
          removeUI();
          return;
        }
        if (translation && translation !== selected) {
          contentNode.textContent = translation;
          console.log("Translation successful:", translation.substring(0, 50));
        } else {
          contentNode.textContent = "Translation failed after 3 attempts";
          console.log("Translation failed after retries");
        }
        popupEl.addEventListener("click", async (clickEvent) => {
          const target = clickEvent.target;
          if (!(target instanceof HTMLElement)) return;
          const action = target.getAttribute("data-action");
          if (action === "close") {
            removeUI();
            return;
          }
          if (action === "copy") {
            try {
              await navigator.clipboard.writeText(contentNode.textContent || "");
              if (isExtensionContextValid()) {
                UI.showNotification("Copied to clipboard", "success");
              }
            } catch {
              if (isExtensionContextValid()) {
                UI.showNotification("Copy failed", "error");
              }
            }
          }
        });
      } catch (error) {
        console.error("Error in showQuickTranslateButton:", error);
        if (isQuickTranslateEnabled && popupEl) {
          const contentNode = popupEl.querySelector(".weblang-quick-content");
          if (contentNode) contentNode.textContent = "Translation error occurred";
        } else {
          removeUI();
        }
      }
    }
    async function requestTranslation(text, from, to) {
      return new Promise((resolve) => {
        try {
          if (!isExtensionContextValid()) {
            console.log("Extension context invalidated, cannot make translation request");
            resolve(null);
            return;
          }
          chrome.runtime.sendMessage({ type: "TRANSLATE_TEXT", text, from, to }, (resp) => {
            if (chrome.runtime.lastError) {
              console.log("Chrome runtime error:", chrome.runtime.lastError);
              resolve(null);
            } else {
              resolve(resp?.translation || null);
            }
          });
        } catch (e) {
          console.log("Exception in requestTranslation:", e);
          resolve(null);
        }
      });
    }
    document.addEventListener("mouseup", __wl_up);
    window.__WL_QT_DOWN = __wl_down;
    window.__WL_QT_UP = __wl_up;
  }
  function disableQuickTranslate() {
    console.log("Disabling quick translate...");
    isQuickTranslateEnabled = false;
    try {
      document.querySelectorAll(".weblang-quick-popup").forEach((el) => el.remove());
      document.querySelectorAll(".weblang-translate-btn").forEach((el) => el.remove());
    } catch (e) {
      console.log("Error removing quick translate UI:", e);
    }
    try {
      if (window.__WL_QT_DOWN) document.removeEventListener("mousedown", window.__WL_QT_DOWN);
    } catch {
    }
    try {
      if (window.__WL_QT_UP) document.removeEventListener("mouseup", window.__WL_QT_UP);
    } catch {
    }
    window.__WL_QT_DOWN = null;
    window.__WL_QT_UP = null;
    window.__WEBLANG_QT_INIT = false;
    console.log("Quick translate disabled successfully");
  }

  // src/content/aiPopup.js
  var AIPopup = class {
    constructor() {
      this.popup = null;
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
    }
    show(result, type, targetLang) {
      this.hide();
      this.currentType = type;
      const popup = document.createElement("div");
      popup.className = "weblang-ai-popup";
      popup.innerHTML = this.getPopupHTML(result, type, targetLang);
      document.body.appendChild(popup);
      this.popup = popup;
      const rect = popup.getBoundingClientRect();
      popup.style.left = `${(window.innerWidth - rect.width) / 2}px`;
      popup.style.top = `${(window.innerHeight - rect.height) / 2}px`;
      this.attachEventListeners();
      setTimeout(() => popup.classList.add("weblang-ai-popup-visible"), 10);
    }
    hide() {
      if (this.popup) {
        this.popup.classList.remove("weblang-ai-popup-visible");
        setTimeout(() => {
          if (this.popup && this.popup.parentNode) {
            this.popup.parentNode.removeChild(this.popup);
          }
          this.popup = null;
        }, 200);
      }
    }
    getPopupHTML(result, type, targetLang) {
      const typeNames = {
        "AI_SUMMARIZE": "Summary",
        "AI_ANALYZE": "Analysis",
        "AI_KEYWORDS": "Keywords"
      };
      const typeName = typeNames[type] || "AI Result";
      return `
      <div class="weblang-ai-header">
        <div class="weblang-ai-drag-handle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 9h6v6h-6z"></path>
            <path d="M9 3h6v6h-6z"></path>
            <path d="M9 15h6v6h-6z"></path>
            <path d="M3 9h6v6H3z"></path>
            <path d="M3 3h6v6H3z"></path>
            <path d="M3 15h6v6H3z"></path>
          </svg>
        </div>
        <div class="weblang-ai-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
          AI ${typeName}
        </div>
        <button class="weblang-ai-close" title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="weblang-ai-content">
        <div class="weblang-ai-result">${this.formatResult(result, type)}</div>
      </div>
      
      <div class="weblang-ai-footer">
        <div class="weblang-ai-actions">
          <button class="weblang-ai-btn weblang-ai-btn-secondary" data-action="copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
            </svg>
            Copy
          </button>
          <button class="weblang-ai-btn weblang-ai-btn-secondary" data-action="export-txt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Export TXT
          </button>
          <button class="weblang-ai-btn weblang-ai-btn-primary" data-action="export-pdf">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
              <polyline points="7,10 12,15 17,10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export PDF
          </button>
        </div>
      </div>
    `;
    }
    formatResult(result, type) {
      if (type === "AI_KEYWORDS") {
        const keywords = result.split(",").map((k) => k.trim()).filter((k) => k);
        return keywords.map(
          (keyword) => `<span class="weblang-ai-keyword">${keyword}</span>`
        ).join("");
      }
      if (type === "AI_ANALYZE") {
        return this.formatAnalysisText(result);
      }
      if (type === "AI_SUMMARIZE") {
        return this.formatSummaryText(result);
      }
      return result.replace(/\n/g, "<br>");
    }
    formatAnalysisText(text) {
      let formatted = text;
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="weblang-ai-section-header">$1</strong>').replace(/^\s*[-•]\s*/gm, '<span class="weblang-ai-bullet">\u2022</span> ').replace(/^\s*(\d+)\.\s*/gm, '<span class="weblang-ai-number">$1.</span> ').replace(/\n/g, "<br>").replace(/([A-Z][a-z\s]+):\s*/g, '<span class="weblang-ai-label">$1:</span> ').replace(/\s+/g, " ").trim();
      return formatted;
    }
    formatSummaryText(text) {
      let formatted = text;
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/\n\n/g, '</p><p class="weblang-ai-paragraph">').replace(/\n/g, "<br>").replace(/^(?!<p)/, '<p class="weblang-ai-paragraph">').replace(/(?!<\/p>)$/, "</p>").replace(/\s+/g, " ").trim();
      return formatted;
    }
    attachEventListeners() {
      if (!this.popup) return;
      const closeBtn = this.popup.querySelector(".weblang-ai-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.hide());
      }
      const dragHandle = this.popup.querySelector(".weblang-ai-drag-handle");
      const header = this.popup.querySelector(".weblang-ai-header");
      if (dragHandle && header) {
        header.addEventListener("mousedown", this.startDrag.bind(this));
        document.addEventListener("mousemove", this.drag.bind(this));
        document.addEventListener("mouseup", this.stopDrag.bind(this));
      }
      const actionBtns = this.popup.querySelectorAll("[data-action]");
      actionBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const action = e.currentTarget.getAttribute("data-action");
          this.handleAction(action);
        });
      });
      setTimeout(() => {
        document.addEventListener("click", this.handleOutsideClick.bind(this), true);
      }, 100);
    }
    startDrag(e) {
      this.isDragging = true;
      const rect = this.popup.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      this.popup.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }
    drag(e) {
      if (!this.isDragging || !this.popup) return;
      e.preventDefault();
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;
      const rect = this.popup.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      this.popup.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
      this.popup.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    }
    stopDrag() {
      this.isDragging = false;
      if (this.popup) {
        this.popup.style.cursor = "";
      }
      document.body.style.userSelect = "";
    }
    handleOutsideClick(e) {
      if (this.popup && !this.popup.contains(e.target) && !this.isDragging) {
        this.hide();
        document.removeEventListener("click", this.handleOutsideClick, true);
      }
    }
    async handleAction(action) {
      const contentElement = this.popup.querySelector(".weblang-ai-result");
      const rawContent = contentElement.textContent;
      const cleanContent = this.getCleanExportContent(contentElement, this.currentType);
      switch (action) {
        case "copy":
          try {
            await navigator.clipboard.writeText(cleanContent);
            this.showToast("Copied to clipboard!");
          } catch (e) {
            const textArea = document.createElement("textarea");
            textArea.value = cleanContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            this.showToast("Copied to clipboard!");
          }
          break;
        case "export-txt":
          this.exportAsText(cleanContent);
          break;
        case "export-pdf":
          this.exportAsPDF(cleanContent);
          break;
      }
    }
    getCleanExportContent(element, type) {
      let content = "";
      if (type === "AI_KEYWORDS") {
        const keywords = Array.from(element.querySelectorAll(".weblang-ai-keyword")).map((el) => el.textContent.trim());
        content = `Keywords:
${keywords.join(", ")}`;
      } else {
        content = this.formatForExport(element.innerHTML, type);
      }
      return content;
    }
    formatForExport(html, type) {
      let text = html.replace(/<strong class="weblang-ai-section-header">(.*?)<\/strong>/g, "\n\n** $1 **\n").replace(/<span class="weblang-ai-label">(.*?)<\/span>/g, "$1").replace(/<span class="weblang-ai-bullet">•<\/span>\s*/g, "\u2022 ").replace(/<span class="weblang-ai-number">(.*?)<\/span>\s*/g, "$1 ").replace(/<p class="weblang-ai-paragraph">/g, "\n").replace(/<\/p>/g, "\n").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]*>/g, "").replace(/\n\s*\n\s*\n/g, "\n\n").replace(/^\s+|\s+$/g, "").trim();
      const headers = {
        "AI_ANALYZE": "=== AI ANALYSIS RESULT ===",
        "AI_SUMMARIZE": "=== AI SUMMARY RESULT ===",
        "AI_KEYWORDS": "=== AI KEYWORDS RESULT ==="
      };
      const header = headers[type] || "=== AI RESULT ===";
      const timestamp = (/* @__PURE__ */ new Date()).toLocaleString();
      return `${header}
Generated: ${timestamp}

${text}

--- End of Result ---`;
    }
    exportAsText(content) {
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weblang-ai-result-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast("Text file exported!");
    }
    exportAsPDF(content) {
      chrome.runtime.sendMessage({
        type: "EXPORT_AI_PDF",
        content,
        title: "WebLang AI Result"
      }, (response) => {
        if (response && response.success) {
          this.showToast("PDF exported!");
        } else {
          this.showToast("PDF export failed");
        }
      });
    }
    showToast(message) {
      const toast = document.createElement("div");
      toast.className = "weblang-ai-toast";
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add("weblang-ai-toast-visible"), 10);
      setTimeout(() => {
        toast.classList.remove("weblang-ai-toast-visible");
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 200);
      }, 2e3);
    }
  };

  // src/content/main.js
  var __g = typeof window !== "undefined" ? window : globalThis;
  if (!__g.__WEBLANG_CS_INIT) {
    let restoreOriginalText = function() {
      const translations = document.querySelectorAll(".weblang-translation");
      const translatedElements = document.querySelectorAll("[data-weblang-translated]");
      const coloredElements = document.querySelectorAll("[data-weblang-colored]");
      let count = 0;
      translations.forEach((el) => {
        el.remove();
        count++;
      });
      translatedElements.forEach((el) => {
        const original = el.getAttribute("data-weblang-original");
        if (original) {
          el.textContent = original;
          el.removeAttribute("data-weblang-translated");
          el.removeAttribute("data-weblang-original");
          count++;
        }
      });
      coloredElements.forEach((el) => {
        el.removeAttribute("data-weblang-colored");
        const style = el.getAttribute("style");
        if (style) {
          const cleanStyle = style.replace(/background-color:\s*[^;]*;?/gi, "").replace(/color:\s*[^;]*;?/gi, "").trim();
          if (cleanStyle) {
            el.setAttribute("style", cleanStyle);
          } else {
            el.removeAttribute("style");
          }
        }
        count++;
      });
      document.querySelectorAll('[class*="weblang"], [id*="weblang"]').forEach((el) => {
        if (el.classList.contains("weblang-translation") || el.id.includes("weblang") || el.className.includes("weblang")) {
          el.remove();
        }
      });
      console.log(`Restored ${count} elements to original text`);
      return count;
    };
    __g.__WEBLANG_CS_INIT = true;
    console.log("WebLang content script initializing...");
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      console.log("Content script received message:", msg);
      if (msg.type === "PING") {
        sendResponse({ success: true, message: "Content script is alive" });
        return;
      }
      if (msg.type === "TRANSLATE_PAGE") {
        TranslationPipeline.translatePage(msg.mode || "paragraph", msg.sourceLang || "auto", msg.targetLang || "id", sendResponse);
        return true;
      }
      if (msg.type === "STOP_TRANSLATION") {
        TranslationPipeline.stopTranslation();
        sendResponse({ success: true });
        return;
      }
      if (msg.type === "GET_TRANSLATION_STATUS" || msg.action === "getTranslationStatus") {
        sendResponse({ success: true, isTranslating: TranslationPipeline.isTranslating() });
        return;
      }
      if (msg.type === "SET_QUICK_TRANSLATE") {
        try {
          const enabled = !!msg.enabled;
          chrome.storage.sync.set({ quickTranslateEnabled: enabled }, () => {
            try {
              if (enabled) initQuickTranslate();
              else disableQuickTranslate();
            } catch (e) {
              console.log("Quick translate toggle error:", e);
            }
            sendResponse({ success: true });
          });
        } catch (e) {
          console.log("Quick translate setup error:", e);
          sendResponse({ success: false });
        }
        return true;
      }
      if (msg.action === "updateTranslationColor" && msg.color) {
        UI.updateTranslationColor(msg.color);
        sendResponse({ success: true });
        return;
      }
      if (msg.type === "GET_TRANSLATION_DATA") {
        sendResponse({ success: true, data: TranslationPipeline.getTranslations() });
        return;
      }
      if (msg.type === "GET_TRANSLATION_STATS") {
        sendResponse({ success: true, stats: TranslationPipeline.getStats() });
        return;
      }
      if (msg.type === "CLEAR_CACHE") {
        TranslationPipeline.clearCache();
        sendResponse({ success: true });
        return;
      }
      if (msg.type === "SHOW_AI_POPUP") {
        try {
          if (!document.querySelector("#weblang-ai-popup-styles")) {
            injectAIPopupCSS();
          }
          const aiPopup = new AIPopup();
          aiPopup.show(msg.result, msg.aiType, msg.targetLang);
          sendResponse({ success: true });
        } catch (e) {
          console.error("AI popup error:", e);
          sendResponse({ success: false, error: e.message });
        }
        return;
      }
      if (msg.type === "RESTORE_ORIGINAL") {
        try {
          const restored = restoreOriginalText();
          TranslationPipeline.clearCache();
          TranslationPipeline.resetState();
          DomUtils.resetProcessedElements();
          UI.updateTranslationColor();
          console.log("Restored original text and reset all translation state");
          sendResponse({ success: true, count: restored });
        } catch (e) {
          console.log("Restore error:", e);
          sendResponse({ success: false, error: e.message });
        }
        return;
      }
      sendResponse({ success: false, error: "Unknown message type" });
    });
    const initializeFeatures = () => {
      UI.updateTranslationColor();
      try {
        chrome.storage.sync.get(["quickTranslateEnabled"], (d) => {
          try {
            if (chrome.runtime.lastError) {
              console.log("Storage access error during init:", chrome.runtime.lastError);
              return;
            }
            if (d.quickTranslateEnabled !== false) {
              console.log("Initializing quick translate from main.js");
              initQuickTranslate();
            }
          } catch (e) {
            console.log("Quick translate initialization error:", e);
          }
        });
      } catch (e) {
        console.log("Error accessing storage during initialization:", e);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeFeatures);
    } else {
      initializeFeatures();
    }
    let toggleTimeout = null;
    try {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "sync" && changes.quickTranslateEnabled) {
          if (toggleTimeout) {
            clearTimeout(toggleTimeout);
          }
          toggleTimeout = setTimeout(() => {
            const enabled = changes.quickTranslateEnabled.newValue !== false;
            console.log("Quick translate setting changed:", enabled);
            try {
              if (enabled) {
                initQuickTranslate();
              } else {
                disableQuickTranslate();
              }
            } catch (e) {
              console.log("Quick translate storage change error:", e);
            }
          }, 100);
        }
      });
    } catch (e) {
      console.log("Error setting up storage listener:", e);
    }
    console.log("WebLang content script fully initialized");
  }
  function injectAIPopupCSS() {
    const cssContent = `
/* AI Popup Styles - Similar to Quick Translate */
.weblang-ai-popup {
  position: fixed;
  z-index: 999999;
  background: #1a1a1a;
  border: 1px solid #404040;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #e5e5e5;
  min-width: 400px;
  max-width: 600px;
  max-height: 500px;
  overflow: hidden;
  opacity: 0;
  transform: scale(0.95) translateY(10px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.weblang-ai-popup-visible {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.weblang-ai-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%);
  border-bottom: 1px solid #404040;
  cursor: grab;
  user-select: none;
}

.weblang-ai-header:active {
  cursor: grabbing;
}

.weblang-ai-drag-handle {
  margin-right: 8px;
  color: #666;
  display: flex;
  align-items: center;
}

.weblang-ai-title {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e5e5e5;
}

.weblang-ai-title svg {
  color: #22c55e;
}

.weblang-ai-close {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.weblang-ai-close:hover {
  background: #333;
  color: #fff;
}

.weblang-ai-content {
  padding: 16px;
  max-height: 350px;
  overflow-y: auto;
  overflow-x: hidden;
}

.weblang-ai-content::-webkit-scrollbar {
  width: 6px;
}

.weblang-ai-content::-webkit-scrollbar-track {
  background: #2a2a2a;
}

.weblang-ai-content::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 3px;
}

.weblang-ai-content::-webkit-scrollbar-thumb:hover {
  background: #666;
}

.weblang-ai-result {
  line-height: 1.6;
  color: #e5e5e5;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.weblang-ai-section-header {
  color: #22c55e;
  font-size: 15px;
  display: block;
  margin: 16px 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
}

.weblang-ai-paragraph {
  margin: 12px 0;
  text-align: justify;
}

.weblang-ai-bullet {
  color: #22c55e;
  font-weight: bold;
  margin-right: 8px;
}

.weblang-ai-number {
  color: #3b82f6;
  font-weight: 600;
  margin-right: 8px;
}

.weblang-ai-label {
  color: #f59e0b;
  font-weight: 600;
}

.weblang-ai-keyword {
  display: inline-block;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  margin: 2px 4px 2px 0;
  box-shadow: 0 2px 4px rgba(34, 197, 94, 0.2);
}

.weblang-ai-footer {
  padding: 12px 16px;
  background: #1f1f1f;
  border-top: 1px solid #404040;
}

.weblang-ai-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.weblang-ai-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.weblang-ai-btn-primary {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(34, 197, 94, 0.2);
}

.weblang-ai-btn-primary:hover {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  box-shadow: 0 4px 8px rgba(34, 197, 94, 0.3);
  transform: translateY(-1px);
}

.weblang-ai-btn-secondary {
  background: #333;
  color: #e5e5e5;
  border: 1px solid #555;
}

.weblang-ai-btn-secondary:hover {
  background: #404040;
  border-color: #666;
  transform: translateY(-1px);
}

.weblang-ai-btn:active {
  transform: translateY(0);
}

.weblang-ai-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000000;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  opacity: 0;
  transform: translateX(100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.weblang-ai-toast-visible {
  opacity: 1;
  transform: translateX(0);
}

@media (max-width: 768px) {
  .weblang-ai-popup {
    min-width: 320px;
    max-width: calc(100vw - 20px);
    margin: 10px;
  }
  
  .weblang-ai-actions {
    flex-direction: column;
    gap: 6px;
  }
  
  .weblang-ai-btn {
    justify-content: center;
  }
}
  `;
    const style = document.createElement("style");
    style.id = "weblang-ai-popup-styles";
    style.textContent = cssContent;
    document.head.appendChild(style);
  }
})();
//# sourceMappingURL=content.js.map
