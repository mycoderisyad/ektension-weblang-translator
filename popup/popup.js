(() => {
  // src/popup/main.js
  function sendToContent(msg, timeout = 5e3) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, error: "Timeout waiting for content script response" });
      }, timeout);
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            clearTimeout(timer);
            console.log("Tabs query error:", chrome.runtime.lastError);
            return resolve({ success: false, error: chrome.runtime.lastError.message });
          }
          if (!tabs || !tabs[0]) {
            clearTimeout(timer);
            console.log("No active tab found");
            return resolve({ success: false, error: "No active tab" });
          }
          chrome.tabs.sendMessage(tabs[0].id, msg, (resp) => {
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
              console.log("Send message error:", chrome.runtime.lastError);
              return resolve({ success: false, error: chrome.runtime.lastError.message });
            }
            resolve(resp || { success: false, error: "No response" });
          });
        });
      } catch (e) {
        clearTimeout(timer);
        console.log("Exception in sendToContent:", e);
        resolve({ success: false, error: e.message });
      }
    });
  }
  function sendToBg(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) {
            console.log("Background message error:", chrome.runtime.lastError);
            return resolve({ success: false, error: chrome.runtime.lastError.message });
          }
          resolve(resp || { success: false, error: "No response" });
        });
      } catch (e) {
        console.log("Exception in sendToBg:", e);
        resolve({ success: false, error: e.message });
      }
    });
  }
  function setStatus(text) {
    const el = document.getElementById("status");
    if (el) {
      el.textContent = text || "";
      console.log("Status updated:", text);
    }
  }
  function updateTranslateButton(isTranslating) {
    const btn = document.getElementById("translateBtn");
    if (btn) {
      if (isTranslating) {
        btn.textContent = "\u23F9 Stop";
        btn.classList.add("stop-mode");
        btn.style.backgroundColor = "#dc3545";
        btn.style.borderColor = "#dc3545";
      } else {
        btn.textContent = "Translate";
        btn.classList.remove("stop-mode");
        btn.style.backgroundColor = "";
        btn.style.borderColor = "";
      }
    }
  }
  async function checkTranslationStatus() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs.length) return;
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: "getTranslationStatus"
      });
      updateTranslateButton(response && response.isTranslating);
    } catch (error) {
      updateTranslateButton(false);
    }
  }
  async function handleAIRequest(aiType, statusMessage) {
    try {
      setStatus(statusMessage);
      const contentData = await sendToContent({ type: "GET_TRANSLATION_DATA" });
      if (!contentData || !contentData.success || !contentData.data || !contentData.data.translatedTexts.length) {
        setStatus("No translated content found. Please translate the page first.");
        setTimeout(() => setStatus(""), 3e3);
        return;
      }
      const targetLang = document.getElementById("targetLang")?.value || "id";
      const text = contentData.data.translatedTexts.join("\n\n");
      const response = await sendToBg({
        type: aiType,
        text,
        targetLang
      });
      if (response && response.success) {
        const showPopupResponse = await sendToContent({
          type: "SHOW_AI_POPUP",
          result: response.result,
          aiType,
          targetLang
        });
        if (showPopupResponse && showPopupResponse.success) {
          const actionName = aiType.replace("AI_", "").toLowerCase();
          setStatus(`${actionName.charAt(0).toUpperCase() + actionName.slice(1)} complete!`);
        } else {
          const actionName = aiType.replace("AI_", "").toLowerCase();
          alert(`${actionName.charAt(0).toUpperCase() + actionName.slice(1)} Result:

${response.result}`);
          setStatus(`${actionName.charAt(0).toUpperCase() + actionName.slice(1)} complete!`);
        }
      } else {
        setStatus(`AI ${aiType.replace("AI_", "").toLowerCase()} failed: ` + (response?.error || "Unknown error"));
      }
      setTimeout(() => setStatus(""), 3e3);
    } catch (error) {
      setStatus("AI request error: " + error.message);
      setTimeout(() => setStatus(""), 3e3);
    }
  }
  async function loadPrefsIntoUI() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["sourceLang", "targetLang", "translationMode", "quickTranslateEnabled", "translationColor", "provider", "useFreeMode", "googleKey", "azureKey"], (d) => {
        try {
          const s = document.getElementById("sourceLang");
          if (s) s.value = d.sourceLang || "auto";
          const t = document.getElementById("targetLang");
          if (t) t.value = d.targetLang || "id";
          const m = document.getElementById("mode");
          if (m) m.value = d.translationMode || "paragraph";
          const sw = document.getElementById("qtSwitch");
          if (sw) sw.checked = d.quickTranslateEnabled !== false;
          const color = d.translationColor || "default";
          const radio = document.querySelector(`input[name="translationColor"][value="${color}"]`);
          if (radio) radio.checked = true;
          updateModeIndicator(d);
        } catch {
        }
        resolve();
      });
    });
  }
  function updateModeIndicator(prefs) {
    const modeText = document.getElementById("modeText");
    if (!modeText) return;
    const provider = prefs.provider || "google";
    const useFreeMode = prefs.useFreeMode !== false;
    const hasGoogleKey = !!(prefs.googleKey && prefs.googleKey.trim());
    const hasAzureKey = !!(prefs.azureKey && prefs.azureKey.trim());
    let status;
    if (useFreeMode) {
      status = "Free Mode";
    } else if (provider === "google" && hasGoogleKey) {
      status = "Google Paid";
    } else if (provider === "azure" && hasAzureKey) {
      status = "Azure Paid";
    } else {
      status = "Free Fallback";
    }
    modeText.textContent = status;
  }
  async function ensureContentScript() {
    try {
      const testResponse = await sendToContent({ type: "PING" }, 2e3);
      if (testResponse.success) {
        console.log("Content script is ready");
        return true;
      }
      console.log("Content script not responding, attempting injection...");
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      if (tabs && tabs[0]) {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ["content.js"]
        });
        await new Promise((r) => setTimeout(r, 1e3));
        const testAgain = await sendToContent({ type: "PING" }, 2e3);
        if (testAgain.success) {
          console.log("Content script injected successfully");
          return true;
        }
      }
      console.log("Failed to ensure content script");
      return false;
    } catch (e) {
      console.log("Error ensuring content script:", e);
      return false;
    }
  }
  async function init() {
    console.log("Popup initializing...");
    await ensureContentScript();
    await loadPrefsIntoUI();
    checkTranslationStatus();
    setInterval(checkTranslationStatus, 500);
    document.addEventListener("change", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const name = target.getAttribute("name");
      if (name === "translationColor") {
        const val = (
          /** @type {HTMLInputElement} */
          target.value
        );
        chrome.storage.sync.set({ translationColor: val }, () => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "updateTranslationColor", color: val });
          });
        });
      }
    });
    const qt = document.getElementById("qtSwitch");
    if (qt) qt.addEventListener("change", async (ev) => {
      const enabled = ev.target.checked;
      chrome.storage.sync.set({ quickTranslateEnabled: enabled }, async () => {
        try {
          const response = await sendToContent({ type: "SET_QUICK_TRANSLATE", enabled });
          console.log("Quick translate toggle response:", response);
          if (!response.success) {
            console.log("Quick translate toggle failed:", response.error);
          }
        } catch (e) {
          console.log("Quick translate toggle error:", e);
        }
      });
    });
    const btn = document.getElementById("translateBtn");
    if (btn) btn.addEventListener("click", async () => {
      try {
        setStatus("Checking status...");
        const status = await sendToContent({ type: "GET_TRANSLATION_STATUS" });
        if (status && status.isTranslating) {
          setStatus("Stopping translation...");
          updateTranslateButton(false);
          await sendToContent({ type: "STOP_TRANSLATION" });
          setStatus("Translation stopped");
          setTimeout(() => setStatus(""), 2e3);
          return;
        }
        const mode = document.getElementById("mode")?.value || "paragraph";
        const sourceLang = document.getElementById("sourceLang")?.value || "auto";
        const targetLang = document.getElementById("targetLang")?.value || "id";
        chrome.storage.sync.set({ sourceLang, targetLang, translationMode: mode });
        updateTranslateButton(true);
        setStatus("Starting translation...");
        const result = await sendToContent({ type: "TRANSLATE_PAGE", mode, sourceLang, targetLang });
        updateTranslateButton(false);
        if (result && result.success) {
          setStatus("Translation complete!");
          setTimeout(() => setStatus(""), 2e3);
        } else {
          setStatus("Translation failed: " + (result?.error || "Unknown error"));
          setTimeout(() => setStatus(""), 3e3);
        }
      } catch (e) {
        updateTranslateButton(false);
        setStatus("Error: " + e.message);
        setTimeout(() => setStatus(""), 3e3);
      }
    });
    const openOpt = document.getElementById("openOptions");
    if (openOpt) openOpt.addEventListener("click", () => chrome.runtime.openOptionsPage());
    const summarizeBtn = document.getElementById("summarizeBtn");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const keywordsBtn = document.getElementById("keywordsBtn");
    if (summarizeBtn) {
      summarizeBtn.addEventListener("click", async () => {
        await handleAIRequest("AI_SUMMARIZE", "Summarizing content...");
      });
    }
    if (analyzeBtn) {
      analyzeBtn.addEventListener("click", async () => {
        await handleAIRequest("AI_ANALYZE", "Analyzing content...");
      });
    }
    if (keywordsBtn) {
      keywordsBtn.addEventListener("click", async () => {
        await handleAIRequest("AI_KEYWORDS", "Extracting keywords...");
      });
    }
    const sourceLangSelect = document.getElementById("sourceLang");
    const targetLangSelect = document.getElementById("targetLang");
    const modeSelect = document.getElementById("mode");
    if (sourceLangSelect) {
      sourceLangSelect.addEventListener("change", async () => {
        const sourceLang = sourceLangSelect.value;
        const targetLang = targetLangSelect?.value || "id";
        const mode = modeSelect?.value || "paragraph";
        chrome.storage.sync.set({ sourceLang, targetLang, translationMode: mode }, () => {
          console.log("Auto-saved source language:", sourceLang);
        });
      });
    }
    if (targetLangSelect) {
      targetLangSelect.addEventListener("change", async () => {
        const targetLang = targetLangSelect.value;
        const sourceLang = sourceLangSelect?.value || "auto";
        const mode = modeSelect?.value || "paragraph";
        chrome.storage.sync.set({ sourceLang, targetLang, translationMode: mode }, () => {
          console.log("Auto-saved target language:", targetLang);
        });
      });
    }
    if (modeSelect) {
      modeSelect.addEventListener("change", async () => {
        const mode = modeSelect.value;
        const sourceLang = sourceLangSelect?.value || "auto";
        const targetLang = targetLangSelect?.value || "id";
        chrome.storage.sync.set({ sourceLang, targetLang, translationMode: mode }, () => {
          console.log("Auto-saved translation mode:", mode);
        });
      });
    }
    const restoreBtn = document.getElementById("restoreBtn");
    if (restoreBtn) restoreBtn.addEventListener("click", async () => {
      setStatus("Restoring original text...");
      try {
        const response = await sendToContent({ type: "RESTORE_ORIGINAL" });
        if (response && response.success) {
          setStatus("Text restored!");
          setTimeout(() => setStatus(""), 2e3);
        } else {
          setStatus("Restore failed");
          setTimeout(() => setStatus(""), 2e3);
        }
      } catch (e) {
        setStatus("Restore error");
        setTimeout(() => setStatus(""), 2e3);
      }
    });
    const exportTransTxtBtn = document.getElementById("exportTransTxtBtn");
    if (exportTransTxtBtn) exportTransTxtBtn.addEventListener("click", async () => {
      setStatus("Exporting...");
      try {
        const data = await sendToContent({ type: "GET_TRANSLATION_DATA" });
        if (data && data.success && data.data && data.data.originalTexts.length > 0) {
          const mode = document.getElementById("exportMode")?.value || "bilingual";
          const response = await sendToBg({
            type: "EXPORT_TRANSLATION",
            fileType: "txt",
            originalTexts: data.data.originalTexts,
            translatedTexts: data.data.translatedTexts,
            mode,
            sourceLang: data.data.sourceLang,
            targetLang: data.data.targetLang
          });
          if (response && response.success) {
            setStatus("Export complete!");
            setTimeout(() => setStatus(""), 2e3);
          } else {
            setStatus("Export failed");
            setTimeout(() => setStatus(""), 2e3);
          }
        } else {
          setStatus("No translation data found");
          setTimeout(() => setStatus(""), 2e3);
        }
      } catch (e) {
        setStatus("Export error");
        setTimeout(() => setStatus(""), 2e3);
      }
    });
    const exportTransPdfBtn = document.getElementById("exportTransPdfBtn");
    if (exportTransPdfBtn) exportTransPdfBtn.addEventListener("click", async () => {
      setStatus("Exporting PDF...");
      try {
        const data = await sendToContent({ type: "GET_TRANSLATION_DATA" });
        if (data && data.success && data.data && data.data.originalTexts.length > 0) {
          const mode = document.getElementById("exportMode")?.value || "bilingual";
          const response = await sendToBg({
            type: "EXPORT_TRANSLATION",
            fileType: "pdf",
            originalTexts: data.data.originalTexts,
            translatedTexts: data.data.translatedTexts,
            mode,
            sourceLang: data.data.sourceLang,
            targetLang: data.data.targetLang
          });
          if (response && response.success) {
            setStatus("PDF export complete!");
            setTimeout(() => setStatus(""), 2e3);
          } else {
            setStatus("PDF export failed");
            setTimeout(() => setStatus(""), 2e3);
          }
        } else {
          setStatus("No translation data found");
          setTimeout(() => setStatus(""), 2e3);
        }
      } catch (e) {
        setStatus("PDF export error");
        setTimeout(() => setStatus(""), 2e3);
      }
    });
  }
  window.addEventListener("DOMContentLoaded", init);
})();
//# sourceMappingURL=popup.js.map
