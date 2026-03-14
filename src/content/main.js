import { UI } from './ui.js';
import { TranslationEngine } from './translationEngine.js';
import { initQuickTranslate, disableQuickTranslate } from './quickTranslate.js';
import { DomUtils } from './domUtils.js';
import { AIPopup } from './aiPopup.js';
import { TTS } from './tts.js';
import { Tooltip } from './tooltip.js';

// Guard against duplicate listener registration across frames
const __g = typeof window !== 'undefined' ? window : globalThis;

if (!__g.__WEBLANG_CS_INIT) {
  __g.__WEBLANG_CS_INIT = true;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ success: true, message: 'Content script is alive' });
      return;
    }

    if (msg.type === 'TRANSLATE_PAGE') {
      (async () => {
        try {
          let result;
          if (msg.mode === 'paragraph') {
            result = await TranslationEngine.translateParagraphMode(
              msg.sourceLang || 'auto',
              msg.targetLang || 'id'
            );
          } else if (msg.mode === 'fullpage') {
            result = await TranslationEngine.translateFullPageMode(
              msg.sourceLang || 'auto',
              msg.targetLang || 'id'
            );
          } else {
            result = { success: false, error: 'Invalid translation mode' };
          }
          sendResponse(result);
        } catch (error) {
          console.error('Translation error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
    }

    if (msg.type === 'STOP_TRANSLATION') {
      TranslationEngine.stopTranslation();
      sendResponse({ success: true, message: 'Translation stopped' });
      return;
    }

    if (msg.type === 'GET_TRANSLATION_STATUS' || msg.action === 'getTranslationStatus') {
      sendResponse({
        success: true,
        isTranslating: TranslationEngine.isTranslating(),
        data: TranslationEngine.getTranslationData()
      });
      return;
    }

    if (msg.type === 'SET_QUICK_TRANSLATE') {
      try {
        const enabled = !!msg.enabled;
        chrome.storage.sync.set({ quickTranslateEnabled: enabled }, () => {
          try {
            if (enabled) initQuickTranslate();
            else disableQuickTranslate();
          } catch (e) {
            console.error('Quick translate toggle error:', e);
          }
          sendResponse({ success: true });
        });
      } catch (e) {
        console.error('Quick translate setup error:', e);
        sendResponse({ success: false });
      }
      return true;
    }

    if (msg.action === 'updateTranslationColor' && msg.color) {
      UI.updateTranslationColor(msg.color);
      sendResponse({ success: true });
      return;
    }

    if (msg.type === 'GET_TRANSLATION_DATA') {
      sendResponse({ success: true, data: TranslationEngine.getTranslationData() });
      return;
    }

    if (msg.type === 'GET_TRANSLATION_STATS') {
      const data = TranslationEngine.getTranslationData();
      sendResponse({
        success: true,
        stats: {
          totalOriginal: data.originalTexts.length,
          totalTranslated: data.translatedTexts.length,
          mode: data.mode,
          sourceLang: data.sourceLang,
          targetLang: data.targetLang
        }
      });
      return;
    }

    if (msg.type === 'SHOW_AI_POPUP') {
      (async () => {
        try {
          if (!__g.__WEBLANG_AI_CSS_READY) {
            const cssInjectResult = await new Promise((resolve) => {
              chrome.runtime.sendMessage(
                { type: 'INJECT_CONTENT_CSS', file: 'styles/content/aiPopup.css' },
                (response) => {
                  if (chrome.runtime.lastError) {
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                    return;
                  }
                  resolve(response || { success: false, error: 'No response' });
                }
              );
            });

            if (!cssInjectResult.success) {
              throw new Error(cssInjectResult.error || 'Failed to inject AI popup CSS');
            }

            __g.__WEBLANG_AI_CSS_READY = true;
          }

          const aiPopup = new AIPopup();
          await aiPopup.show(msg.result, msg.aiType, msg.targetLang);
          sendResponse({ success: true });
        } catch (e) {
          console.error('AI popup error:', e);
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;
    }

    if (msg.type === 'RESTORE_ORIGINAL') {
      try {
        TranslationEngine.restoreOriginalText();
        DomUtils.resetProcessedElements();
        UI.updateTranslationColor();
        TTS.stop();
        Tooltip.disable();
        sendResponse({ success: true, message: 'Original text restored' });
      } catch (e) {
        console.error('Restore error:', e);
        sendResponse({ success: false, error: e.message });
      }
      return;
    }

    if (msg.type === 'SPEAK_TEXT') {
      (async () => {
        try {
          await TTS.speak(msg.text, msg.lang || 'en');
          sendResponse({ success: true });
        } catch (e) {
          console.error('TTS error:', e);
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;
    }

    if (msg.type === 'STOP_TTS') {
      TTS.stop();
      sendResponse({ success: true });
      return;
    }

    if (msg.type === 'SET_TOOLTIP_MODE') {
      try {
        if (msg.enabled) Tooltip.enable();
        else Tooltip.disable();
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return;
    }

    sendResponse({ success: false, error: 'Unknown message type' });
  });

  // Initialize UI and quick-translate on startup
  const initializeFeatures = () => {
    UI.updateTranslationColor();
    try {
      chrome.storage.sync.get(['quickTranslateEnabled'], (d) => {
        try {
          if (chrome.runtime.lastError) return;
          if (d.quickTranslateEnabled !== false) {
            initQuickTranslate();
          }
        } catch (e) {
          console.error('Quick translate initialization error:', e);
        }
      });
    } catch (e) {
      console.error('Error accessing storage during initialization:', e);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFeatures);
  } else {
    initializeFeatures();
  }

  // Reactively toggle quick-translate when the setting changes in another context
  let toggleTimeout = null;
  try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.quickTranslateEnabled) {
        clearTimeout(toggleTimeout);
        toggleTimeout = setTimeout(() => {
          const enabled = changes.quickTranslateEnabled.newValue !== false;
          try {
            if (enabled) initQuickTranslate();
            else disableQuickTranslate();
          } catch (e) {
            console.error('Quick translate storage change error:', e);
          }
        }, 100);
      }
    });
  } catch (e) {
    console.error('Error setting up storage listener:', e);
  }
}
