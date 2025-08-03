// popup/popup.js

window.addEventListener("DOMContentLoaded", function () {
  // Chrome storage check
  if (!chrome?.storage) {
    document.getElementById("modeText").textContent = "Extension Error";
    return;
  }

  chrome.storage.sync.get(
    ["useFreeMode", "googleKey", "azureKey", "geminiKey", "translationColor"],
    (data) => {
      if (chrome.runtime.lastError) {
        const modeTextEl = document.getElementById("modeText");
        if (modeTextEl) modeTextEl.textContent = "Storage Error";
        return;
      }
      const modeIndicator = document.getElementById("modeIndicator");
      const modeText = document.getElementById("modeText");
      let modeDescription = "",
        modeClass = "";
      if (data.useFreeMode) {
        modeDescription = "Free Mode Active";
        modeClass = "mode-status free-mode";
      } else if (data.googleKey && data.azureKey) {
        chrome.storage.sync.get(["provider"], (providerData) => {
          const provider = providerData.provider || "google";
          if (provider === "azure") {
            modeText.textContent = "AZURE Priority (Google backup)";
          } else {
            modeText.textContent = "GOOGLE Priority (Azure backup)";
          }
        });
        modeClass = "mode-status dual-mode";
      } else if (data.azureKey) {
        modeDescription = "AZURE Translator Active";
        modeClass = "mode-status azure-mode";
      } else if (data.googleKey) {
        modeDescription = "GOOGLE Translate Active";
        modeClass = "mode-status google-mode";
      } else {
        modeDescription = "Free Mode (Auto)";
        modeClass = "mode-status auto-mode";
      }
      if (modeDescription) modeText.textContent = modeDescription;
      modeIndicator.className = modeClass;

      // Load translation color
      const colorValue = data.translationColor || "default";
      const colorRadio = document.querySelector(
        `input[name="translationColor"][value="${colorValue}"]`
      );
      if (colorRadio) colorRadio.checked = true;
    }
  );

  // Load settings and setup periodic status check
  loadLanguageSettings();
  setStatus("Ready");

  // Check translation status every 2 seconds
  setInterval(() => {
    sendToContent({ type: "GET_TRANSLATION_STATUS" }, (statusResp) => {
      if (statusResp && statusResp.isTranslating !== undefined) {
        updateTranslateButton(statusResp.isTranslating);
        if (statusResp.isTranslating) {
          setStatus("Translating... (click to stop)");
        }
      }
    });
  }, 2000);

  // Translation color
  document.addEventListener("change", function (e) {
    if (e.target.name === "translationColor") {
      const selectedColor = e.target.value;
      chrome.storage.sync.set({ translationColor: selectedColor }, () => {
        if (!chrome.runtime.lastError) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "updateTranslationColor",
                color: selectedColor,
              });
            }
          });
        }
      });
    }
  });

  // Listen for service status from background
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "translationServiceUsed") {
        updateAPIMonitor(message);
        const serviceStatusEl = document.getElementById("serviceStatus");
        if (serviceStatusEl) {
          if (message.success) {
            serviceStatusEl.textContent = `Using: ${message.service}`;
            serviceStatusEl.className = "service-status success";
          } else {
            serviceStatusEl.textContent = `${message.service} failed`;
            serviceStatusEl.className = "service-status error";
          }
          setTimeout(() => {
            serviceStatusEl.textContent = "";
            serviceStatusEl.className = "service-status";
          }, 5000);
        }
      }
    });
  }
});

// Helper: send message to content script
function sendToContent(msg, callback) {
  if (!chrome?.tabs) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError || !tabs?.length) return;
    const tab = tabs[0];
    if (
      !tab.url ||
      !(tab.url.startsWith("http://") || tab.url.startsWith("https://"))
    ) {
      if (callback)
        callback({
          success: false,
          error:
            "Content script hanya bisa diinject ke halaman web (http/https).",
        });
      return;
    }
    chrome.tabs.sendMessage(tab.id, msg, (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || "Unknown error";
        if (errorMsg.includes("Could not establish connection")) {
          chrome.scripting
            .executeScript({
              target: { tabId: tab.id },
              files: ["content.js"],
            })
            .then(() => {
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, msg, callback);
              }, 100);
            })
            .catch(() => {
              if (callback)
                callback({
                  success: false,
                  error: "Content script injection failed",
                });
            });
          return;
        }
      }
      if (callback) callback(response);
    });
  });
}
// Helper: send message to background
function sendToBg(msg, callback) {
  if (!chrome?.runtime) return;
  chrome.runtime.sendMessage(msg, (response) => {
    if (chrome.runtime.lastError) {
      if (callback)
        callback({
          success: false,
          error: chrome.runtime.lastError.message || "Error",
        });
      return;
    }
    if (callback) callback(response);
  });
}

// Translate handler dengan start/stop functionality
document.getElementById("translateBtn").onclick = () => {
  // Check if currently translating
  sendToContent({ type: "GET_TRANSLATION_STATUS" }, (statusResp) => {
    if (statusResp && statusResp.isTranslating) {
      // Currently translating - STOP it
      setStatus("Stopping translation...");
      sendToContent({ type: "STOP_TRANSLATION" }, (resp) => {
        setStatus(resp && resp.success ? resp.message : "Translation stopped");
        updateTranslateButton(false);
      });
    } else {
      // Not translating - START translation
      setStatus("Translating...");
      updateTranslateButton(true);

      const mode = document.getElementById("mode").value;
      const sourceLang = document.getElementById("sourceLang").value;
      const targetLang = document.getElementById("targetLang").value;

      chrome.storage.sync.set({
        sourceLang,
        targetLang,
        translationMode: mode,
      });

      sendToContent(
        { type: "TRANSLATE_PAGE", mode, sourceLang, targetLang },
        (resp) => {
          setStatus(
            resp && resp.success ? resp.message : "Translation completed"
          );
          updateTranslateButton(false);
        }
      );
    }
  });
};

// Update translate button text and style
function updateTranslateButton(isTranslating) {
  const btn = document.getElementById("translateBtn");
  if (isTranslating) {
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
      Stop Translation
    `;
    btn.style.background = "#ef4444";
    btn.classList.add("translating");
  } else {
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
      Translate
    `;
    btn.style.background = "";
    btn.classList.remove("translating");
  }
}

// Cleanup duplicate translations handler
document.getElementById("cleanupBtn").onclick = () => {
  setStatus("Cleaning duplicates...");
  sendToContent({ type: "CLEANUP_DUPLICATES" }, (resp) => {
    setStatus(
      resp && resp.success ? "Cleanup completed!" : "Cleanup completed."
    );
  });
};

// Restore original text handler
document.getElementById("restoreBtn").onclick = () => {
  setStatus("Restoring original text...");
  sendToContent({ type: "RESTORE_ORIGINAL" }, (resp) => {
    setStatus(resp && resp.success ? "Text restored!" : "Restore completed.");
  });
};
// AI
document.getElementById("summarizeBtn").onclick = () => {
  setStatus("Summarizing...");
  sendToContent({ type: "AI_SUMMARIZE" }, (resp) => {
    showResult(resp?.summary || resp?.error || "[Failed!]");
    setStatus("");
  });
};
document.getElementById("analyzeBtn").onclick = () => {
  setStatus("Analyzing...");
  sendToContent({ type: "ANALYZE_PAGE" }, (resp) => {
    showResult(resp?.analysis || resp?.error || "[Failed!]");
    setStatus("");
  });
};
document.getElementById("keywordsBtn").onclick = () => {
  setStatus("Extracting...");
  sendToContent({ type: "EXTRACT_KEYWORDS" }, (resp) => {
    showResult(resp?.keywords || resp?.error || "[Failed!]");
    setStatus("");
  });
};
// Export AI - hanya TXT dan PDF
document.getElementById("exportTxtBtn").onclick = () => exportContent("txt");
document.getElementById("exportPdfBtn").onclick = () => exportContent("pdf");
// Export translation - hanya TXT dan PDF
document.getElementById("exportTransTxtBtn").onclick = () =>
  exportTranslation("txt");
document.getElementById("exportTransPdfBtn").onclick = () =>
  exportTranslation("pdf");

// Export translation helper
function exportTranslation(type) {
  setStatus("Exporting translation...");
  const exportMode = document.getElementById("exportMode").value;
  sendToContent({ type: "GET_TRANSLATION_DATA" }, (response) => {
    if (!response?.success) {
      setStatus("Failed to get translation data!");
      return;
    }
    const data = response.data;
    if (!data?.originalTexts?.length) {
      setStatus("Please translate the page first!");
      return;
    }
    if (data.originalTexts.length !== data.translatedTexts.length) {
      setStatus("Translation data mismatch!");
      return;
    }
    let originalTexts = [],
      translatedTexts = [];
    if (exportMode === "Original + Translation") {
      originalTexts = data.originalTexts;
      translatedTexts = data.translatedTexts;
    } else if (exportMode === "Translation Only") {
      translatedTexts = data.translatedTexts;
    } else {
      originalTexts = data.originalTexts;
      translatedTexts = data.translatedTexts;
    }
    sendToBg(
      {
        type: "EXPORT_TRANSLATION",
        originalTexts,
        translatedTexts,
        sourceLang: data.sourceLang || "en",
        targetLang: data.targetLang || "id",
        mode: exportMode,
        fileType: type,
      },
      (resp) => {
        setStatus(
          resp && resp.success
            ? `Translation exported as ${type.toUpperCase()}!`
            : "Export failed!"
        );
      }
    );
  });
}
// Export helper (AI results)
function exportContent(fileType) {
  setStatus("Exporting...");
  
  // Use currentAIResult if available, otherwise fallback to result element
  let content = currentAIResult || (document.getElementById("result")?.textContent) || "";
  
  if (!content) {
    setStatus("No AI results to export");
    return;
  }
  
  // Export the AI result content directly
  sendToBg({ type: "EXPORT_CONTENT", content, fileType }, (resp) => {
    setStatus(resp.success ? "Exported!" : "Export failed!");
  });
}

// Open options/settings
document.getElementById("openOptions").onclick = () => {
  chrome.runtime.openOptionsPage();
};

// Status helper with auto-clear
let lastStatusTimeout;
function setStatus(msg) {
  document.getElementById("status").textContent = msg;
  if (lastStatusTimeout) clearTimeout(lastStatusTimeout);
  if (msg)
    lastStatusTimeout = setTimeout(() => {
      document.getElementById("status").textContent = "";
    }, 2500);
}
// Show AI/result in popup modal
let currentAIResult = "";

function showResult(msg) {
  currentAIResult = msg; // Store for export
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'ai-result-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.8); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    padding: 20px; opacity: 0; transition: opacity 0.3s;
  `;
  
  // Create modal content
  const content = document.createElement('div');
  content.style.cssText = `
    background: #1a1a1a; border-radius: 12px; padding: 24px;
    max-width: 500px; max-height: 70vh; overflow-y: auto;
    border: 1px solid #333; position: relative;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #333;
  `;
  
  const title = document.createElement('h3');
  title.textContent = '🤖 AI Analysis Result';
  title.style.cssText = `
    margin: 0; color: #fff; font-size: 16px; font-weight: 600;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    background: none; border: none; color: #999; cursor: pointer;
    font-size: 18px; padding: 4px 8px; border-radius: 4px;
  `;
  closeBtn.onmouseover = () => closeBtn.style.background = '#333';
  closeBtn.onmouseout = () => closeBtn.style.background = 'none';
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Result text
  const resultText = document.createElement('div');
  resultText.textContent = msg;
  resultText.style.cssText = `
    color: #e5e5e5; line-height: 1.6; font-size: 14px;
    white-space: pre-wrap; word-break: break-word;
    margin-bottom: 20px;
  `;
  
  // Export buttons
  const exportRow = document.createElement('div');
  exportRow.style.cssText = `
    display: flex; gap: 8px; justify-content: flex-end;
    padding-top: 12px; border-top: 1px solid #333;
  `;
  
  // Export buttons - hanya TXT dan PDF
  ['TXT', 'PDF'].forEach(format => {
    const btn = document.createElement('button');
    btn.textContent = format;
    btn.style.cssText = `
      background: #2563eb; color: white; border: none;
      padding: 6px 12px; border-radius: 6px; cursor: pointer;
      font-size: 12px; font-weight: 500;
    `;
    btn.onmouseover = () => btn.style.background = '#1d4ed8';
    btn.onmouseout = () => btn.style.background = '#2563eb';
    btn.onclick = () => {
      exportContent(format.toLowerCase());
      modal.remove();
    };
    exportRow.appendChild(btn);
  });
  
  // Assemble modal
  content.appendChild(header);
  content.appendChild(resultText);
  content.appendChild(exportRow);
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Show with animation
  setTimeout(() => modal.style.opacity = '1', 10);
  
  // Close handlers
  closeBtn.onclick = () => {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 300);
  };
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 300);
    }
  };
  
  // ESC key to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 300);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// Update API Monitor with detailed information
function updateAPIMonitor(data) {
  const monitor = document.getElementById("apiMonitor");
  const apiName = document.getElementById("currentApi");
  const apiDetails = document.getElementById("apiDetails");

  if (!monitor || !apiName || !apiDetails) return;

  // Show the monitor
  monitor.classList.add("show");

  // Update API name with appropriate styling and paid indicator
  let displayName = data.service || "Unknown";
  if (data.isPaid) {
    displayName += " (PAID)";
  } else if (
    data.service &&
    !data.service.includes("GOOGLE") &&
    !data.service.includes("AZURE")
  ) {
    displayName += " (FREE)";
  }

  apiName.textContent = displayName;
  apiName.className = "api-name";

  if (data.service && data.service.includes("GOOGLE")) {
    apiName.classList.add("google");
  } else if (data.service && data.service.includes("AZURE")) {
    apiName.classList.add("azure");
  } else {
    apiName.classList.add("free");
  }

  // Update details with comprehensive info
  let details = "";
  if (data.success) {
    details = `Success`;
    if (data.responseTime) {
      details += ` • ${data.responseTime}ms`;
    }
    if (data.fromLang && data.toLang) {
      details += ` • ${data.fromLang}→${data.toLang}`;
    }
    if (data.textLength) {
      details += ` • ${data.textLength} chars`;
    }
    if (data.timestamp) {
      details += ` • ${data.timestamp}`;
    }
  } else {
    details = `Failed • ${data.error || "Translation unsuccessful"}`;
  }

  apiDetails.textContent = details;

  // Auto-hide after 15 seconds for paid APIs, 8 seconds for free
  const hideDelay = data.isPaid ? 15000 : 8000;
  setTimeout(() => {
    monitor.classList.remove("show");
  }, hideDelay);
}

// Load saved language settings when popup opens
function loadLanguageSettings() {
  chrome.storage.sync.get(
    ["sourceLang", "targetLang", "translationMode", "defaultSourceLang", "defaultTargetLang"],
    (data) => {
      if (chrome.runtime.lastError) return;
      const sourceLangEl = document.getElementById("sourceLang");
      const targetLangEl = document.getElementById("targetLang");
      const modeEl = document.getElementById("mode");
      
      // Use current settings or fall back to defaults from options page
      if (sourceLangEl) {
        sourceLangEl.value = data.sourceLang || data.defaultSourceLang || "auto";
      }
      if (targetLangEl) {
        targetLangEl.value = data.targetLang || data.defaultTargetLang || "id";
      }
      if (modeEl) {
        modeEl.value = data.translationMode || "paragraph";
      }
    }
  );
}
function saveLanguageSettings() {
  const sourceLang = document.getElementById("sourceLang").value;
  const targetLang = document.getElementById("targetLang").value;
  const mode = document.getElementById("mode").value;
  chrome.storage.sync.set({
    sourceLang,
    targetLang,
    translationMode: mode,
  });
}
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(loadLanguageSettings, 100);
  const sourceLangEl = document.getElementById("sourceLang");
  const targetLangEl = document.getElementById("targetLang");
  const modeEl = document.getElementById("mode");
  if (sourceLangEl)
    sourceLangEl.addEventListener("change", saveLanguageSettings);
  if (targetLangEl)
    targetLangEl.addEventListener("change", saveLanguageSettings);
  if (modeEl) modeEl.addEventListener("change", saveLanguageSettings);

  // API Logs viewer
  const viewApiLogsBtn = document.getElementById("viewApiLogs");
  if (viewApiLogsBtn) {
    viewApiLogsBtn.onclick = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: showAPILogs,
        });
      });
    };
  }
});

// Function to inject into page for showing API logs
function showAPILogs() {
  // Get stored API logs from localStorage
  const logs = JSON.parse(localStorage.getItem("weblang_api_logs") || "[]");

  if (logs.length === 0) {
    alert("No API logs found. Try translating some text first.");
    return;
  }

  // Create logs display
  const logsWindow = window.open("", "_blank", "width=800,height=600");
  logsWindow.document.write(`
    <html>
      <head>
        <title>WebLang API Usage Logs</title>
        <style>
          body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #e5e5e5; }
          .log-entry { margin: 10px 0; padding: 10px; border-left: 3px solid #22c55e; background: #232323; }
          .log-entry.failed { border-left-color: #ef4444; }
          .log-timestamp { color: #999; font-size: 12px; }
          .log-api { color: #4285f4; font-weight: bold; }
          .log-api.azure { color: #0078d4; }
          .log-api.free { color: #f59e0b; }
          .log-details { margin-top: 5px; font-size: 14px; }
          .clear-btn { background: #ef4444; color: white; border: none; padding: 5px 10px; margin-bottom: 20px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>WebLang API Usage Logs</h2>
        <button class="clear-btn" onclick="clearLogs()">Clear All Logs</button>
        <div id="logs">${logs
          .map(
            (log) => `
          <div class="log-entry ${log.success ? "" : "failed"}">
            <div class="log-timestamp">${log.timestamp}</div>
            <div class="log-api ${
              log.service && log.service.includes("GOOGLE")
                ? "google"
                : log.service && log.service.includes("AZURE")
                ? "azure"
                : "free"
            }">${log.service}${log.isPaid ? " (PAID)" : " (FREE)"}</div>
            <div class="log-details">
              ${log.success ? "[OK]" : "[FAIL]"} ${log.fromLang}→${log.toLang} • ${
              log.textLength
            } chars • ${log.responseTime}ms<br>
              Text: "${log.text.substring(0, 100)}${
              log.text.length > 100 ? "..." : ""
            }"<br>
              Result: "${log.result.substring(0, 100)}${
              log.result.length > 100 ? "..." : ""
            }"
            </div>
          </div>
        `
          )
          .join("")}</div>
        <script>
          function clearLogs() {
            if (confirm('Clear all API logs?')) {
              localStorage.removeItem('weblang_api_logs');
              document.getElementById('logs').innerHTML = '<p>Logs cleared.</p>';
            }
          }
        </script>
      </body>
    </html>
  `);
}
