(() => {
  // src/options/app.js
  (() => {
    (() => {
      (() => {
        (() => {
          (() => {
            (() => {
              (() => {
                (() => {
                  (() => {
                    (() => {
                      (() => {
                        (() => {
                          (() => {
                            (() => {
                              (() => {
                                (() => {
                                  (() => {
                                    (() => {
                                      (() => {
                                        (() => {
                                          (() => {
                                            (() => {
                                              var googleKeyInput = document.getElementById("googleKey");
                                              var azureKeyInput = document.getElementById("azureKey");
                                              var geminiKeyInput = document.getElementById("geminiKey");
                                              var providerSelect = document.getElementById("provider");
                                              var useFreeMode = document.getElementById("useFreeMode");
                                              var apiSection = document.getElementById("apiSection");
                                              var savedMsg = document.getElementById("savedMsg");
                                              function toggleApiSection() {
                                                if (useFreeMode.checked) {
                                                  apiSection.style.opacity = "0.5";
                                                  apiSection.style.pointerEvents = "none";
                                                } else {
                                                  apiSection.style.opacity = "1";
                                                  apiSection.style.pointerEvents = "auto";
                                                }
                                              }
                                              window.onload = function() {
                                                if (!chrome?.storage) {
                                                  showMsg("Chrome storage API not available", "error");
                                                  return;
                                                }
                                                chrome.storage.sync.get(
                                                  [
                                                    "googleKey",
                                                    "azureKey",
                                                    "geminiKey",
                                                    "provider",
                                                    "useFreeMode",
                                                    "translationColor",
                                                    "defaultSourceLang",
                                                    "defaultTargetLang"
                                                  ],
                                                  (data) => {
                                                    if (chrome.runtime.lastError) {
                                                      showMsg("Storage load error!", "error");
                                                      return;
                                                    }
                                                    googleKeyInput.value = data.googleKey || "";
                                                    azureKeyInput.value = data.azureKey || "";
                                                    geminiKeyInput.value = data.geminiKey || "";
                                                    providerSelect.value = data.provider || "google";
                                                    useFreeMode.checked = data.useFreeMode || false;
                                                    const colorValue = data.translationColor || "default";
                                                    const colorRadio = document.querySelector(
                                                      `input[name="translationColor"][value="${colorValue}"]`
                                                    );
                                                    if (colorRadio) colorRadio.checked = true;
                                                    const defaultSourceLang = document.getElementById("defaultSourceLang");
                                                    const defaultTargetLang = document.getElementById("defaultTargetLang");
                                                    if (defaultSourceLang) defaultSourceLang.value = data.defaultSourceLang || "auto";
                                                    if (defaultTargetLang) defaultTargetLang.value = data.defaultTargetLang || "id";
                                                    toggleApiSection();
                                                  }
                                                );
                                              };
                                              useFreeMode.addEventListener("change", toggleApiSection);
                                              document.querySelectorAll(".toggle-password").forEach((button) => {
                                                button.addEventListener("click", function() {
                                                  const targetId = this.getAttribute("data-target");
                                                  const input = document.getElementById(targetId);
                                                  if (!input) return;
                                                  if (input.type === "password") {
                                                    input.type = "text";
                                                    this.innerHTML = '<svg class="eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
                                                  } else {
                                                    input.type = "password";
                                                    this.innerHTML = '<svg class="eye-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
                                                  }
                                                });
                                              });
                                              function saveSettings(e) {
                                                e.preventDefault();
                                                const defaultSourceLang = document.getElementById("defaultSourceLang")?.value || "auto";
                                                const defaultTargetLang = document.getElementById("defaultTargetLang")?.value || "id";
                                                const settings = {
                                                  googleKey: googleKeyInput.value.trim(),
                                                  azureKey: azureKeyInput.value.trim(),
                                                  geminiKey: geminiKeyInput.value.trim(),
                                                  provider: providerSelect.value,
                                                  useFreeMode: useFreeMode.checked,
                                                  translationColor: document.querySelector('input[name="translationColor"]:checked')?.value || "default",
                                                  defaultSourceLang,
                                                  defaultTargetLang,
                                                  // Also save to popup compatibility keys
                                                  sourceLang: defaultSourceLang,
                                                  targetLang: defaultTargetLang
                                                };
                                                if (!chrome?.storage) {
                                                  showMsg("Chrome storage API not available", "error");
                                                  return;
                                                }
                                                chrome.storage.sync.set(settings, () => {
                                                  if (chrome.runtime.lastError) {
                                                    showMsg(
                                                      "Error saving settings: " + chrome.runtime.lastError.message,
                                                      "error"
                                                    );
                                                  } else {
                                                    showMsg("Settings saved successfully!", "success");
                                                    try {
                                                      chrome.runtime.sendMessage({ action: "settingsUpdated", settings });
                                                      chrome.runtime.sendMessage({ type: "SET_QUICK_TRANSLATE", enabled: settings.quickTranslateEnabled });
                                                    } catch {
                                                    }
                                                  }
                                                });
                                              }
                                              function showMsg(message, type = "success") {
                                                savedMsg.textContent = message;
                                                savedMsg.className = type;
                                                savedMsg.style.display = "block";
                                                setTimeout(() => {
                                                  savedMsg.style.display = "none";
                                                }, 3e3);
                                              }
                                              function testAPI(apiType) {
                                                let apiKey = "", serviceName = "";
                                                if (apiType === "azure") {
                                                  apiKey = azureKeyInput.value.trim();
                                                  serviceName = "Azure Translator";
                                                } else if (apiType === "google") {
                                                  apiKey = googleKeyInput.value.trim();
                                                  serviceName = "Google Translate";
                                                }
                                                if (!apiKey) {
                                                  showMsg(`Please enter ${serviceName} API key first`, "error");
                                                  return;
                                                }
                                                showMsg(`Testing ${serviceName}...`, "info");
                                                chrome.runtime.sendMessage(
                                                  {
                                                    action: "testAPI",
                                                    apiType,
                                                    apiKey
                                                  },
                                                  (response) => {
                                                    if (response && response.success) {
                                                      showMsg(
                                                        `${serviceName} API works! Result: "${response.result}"`,
                                                        "success"
                                                      );
                                                    } else {
                                                      showMsg(
                                                        `${serviceName} API failed: ${response?.error || "Unknown error"}`,
                                                        "error"
                                                      );
                                                    }
                                                  }
                                                );
                                              }
                                              document.getElementById("apiForm").addEventListener("submit", saveSettings);
                                              document.getElementById("testGoogleBtn").addEventListener("click", () => testAPI("google"));
                                              document.getElementById("testAzureBtn").addEventListener("click", () => testAPI("azure"));
                                            })();
                                          })();
                                        })();
                                      })();
                                    })();
                                  })();
                                })();
                              })();
                            })();
                          })();
                        })();
                      })();
                    })();
                  })();
                })();
              })();
            })();
          })();
        })();
      })();
    })();
  })();
})();
//# sourceMappingURL=options.js.map
