import { UI } from './ui.js';
import { TranslationEngine } from './translationEngine.js';
import { initQuickTranslate, disableQuickTranslate } from './quickTranslate.js';
import { DomUtils } from './domUtils.js';
import { AIPopup } from './aiPopup.js';
import { TTS } from './tts.js';
import { Tooltip } from './tooltip.js';

// Global guard flags (works in pages and frames)
const __g = typeof window !== 'undefined' ? window : globalThis;

// Message bridge
// Avoid duplicate listener registration
if (!__g.__WEBLANG_CS_INIT) {
  __g.__WEBLANG_CS_INIT = true;
  console.log('WebLang content script initializing...');

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('Content script received message:', msg);
    
    if (msg.type === 'PING') {
      sendResponse({ success: true, message: 'Content script is alive' });
      return;
    }
    
    if (msg.type === 'TRANSLATE_PAGE') {
      (async () => {
        try {
          let result;
          const onProgress = (current, total, message) => {
            console.log(`Progress: ${current}/${total} - ${message}`);
          };
          
          if (msg.mode === 'paragraph') {
            result = await TranslationEngine.translateParagraphMode(
              msg.sourceLang || 'auto', 
              msg.targetLang || 'id', 
              onProgress
            );
          } else if (msg.mode === 'fullpage') {
            result = await TranslationEngine.translateFullPageMode(
              msg.sourceLang || 'auto', 
              msg.targetLang || 'id', 
              onProgress
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
            console.log('Quick translate toggle error:', e);
          }
          sendResponse({ success: true });
        });
      } catch (e) {
        console.log('Quick translate setup error:', e);
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
      const stats = {
        totalOriginal: data.originalTexts.length,
        totalTranslated: data.translatedTexts.length,
        mode: data.mode,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang
      };
      sendResponse({ success: true, stats });
      return;
    }
    if (msg.type === 'SHOW_AI_POPUP') {
      (async () => {
        try {
          if (!__g.__WEBLANG_AI_CSS_READY) {
            const cssInjectResult = await new Promise((resolve) => {
              chrome.runtime.sendMessage({
                type: 'INJECT_CONTENT_CSS',
                file: 'styles/content/aiPopup.css'
              }, (response) => {
                if (chrome.runtime.lastError) {
                  resolve({ success: false, error: chrome.runtime.lastError.message });
                  return;
                }
                resolve(response || { success: false, error: 'No response' });
              });
            });

            if (!cssInjectResult.success) {
              throw new Error(cssInjectResult.error || 'Failed to inject AI popup CSS');
            }

            __g.__WEBLANG_AI_CSS_READY = true;
          }
          
          const aiPopup = new AIPopup();
          aiPopup.show(msg.result, msg.aiType, msg.targetLang);
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
        console.log('✅ Restored original text and reset all translation state');
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
        if (msg.enabled) {
          Tooltip.enable();
        } else {
          Tooltip.disable();
        }
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return;
    }
    
    // Handle unknown message types
    sendResponse({ success: false, error: 'Unknown message type' });
  });

  // Initialize UI and quick-translate if enabled
  const initializeFeatures = () => {
    UI.updateTranslationColor();
    try {
      chrome.storage.sync.get(['quickTranslateEnabled'], (d) => {
        try {
          if (chrome.runtime.lastError) {
            console.log('Storage access error during init:', chrome.runtime.lastError);
            return;
          }
          if (d.quickTranslateEnabled !== false) {
            console.log('Initializing quick translate from main.js');
            initQuickTranslate();
          }
        } catch (e) {
          console.log('Quick translate initialization error:', e);
        }
      });
    } catch (e) {
      console.log('Error accessing storage during initialization:', e);
    }
  };

  // Wait for DOM if needed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFeatures);
  } else {
    initializeFeatures();
  }

  // Listen for storage changes to update quick translate state
  let toggleTimeout = null;
  try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.quickTranslateEnabled) {
        // Clear previous timeout to debounce rapid toggles
        if (toggleTimeout) {
          clearTimeout(toggleTimeout);
        }
        
        toggleTimeout = setTimeout(() => {
          const enabled = changes.quickTranslateEnabled.newValue !== false;
          console.log('Quick translate setting changed:', enabled);
          try {
            if (enabled) {
              initQuickTranslate();
            } else {
              disableQuickTranslate();
            }
          } catch (e) {
            console.log('Quick translate storage change error:', e);
          }
        }, 100); // 100ms debounce
      }
    });
  } catch (e) {
    console.log('Error setting up storage listener:', e);
  }

  console.log('WebLang content script fully initialized');
}



