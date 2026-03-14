import { UI } from './ui.js';
import { TTS } from './tts.js';

// Helper function to check if extension context is valid
function isExtensionContextValid() {
  try {
    return chrome && chrome.runtime && chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Global flag to track if quick translate is currently enabled
let isQuickTranslateEnabled = false;

export function initQuickTranslate() {
  // Prevent double binding of listeners
  // @ts-ignore
  if (window.__WEBLANG_QT_INIT) {
    return;
  }

  isQuickTranslateEnabled = true;
  // @ts-ignore
  window.__WEBLANG_QT_INIT = true;
  let quickTranslateButton = null;
  let popupEl = null;
  let selectionTimeout = null;

  function removeUI() {
    // Remove any existing quick translate popup
    document.querySelectorAll('.weblang-quick-popup').forEach(el => el.remove());
    quickTranslateButton?.remove();
    quickTranslateButton = null;
    popupEl?.remove();
    popupEl = null;
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
      selectionTimeout = null;
    }
  }

  function createPopup(x, y, text, theme = 'default') {
    const { color, bg, border } = (function getScheme(c){
      const s = {
        default: { color: '#2C3E50', bg: '#DCD7C9', border: '#BDB7AA' },
        red:     { color: '#2C3E50', bg: '#BF9264', border: '#A67D55' },
        blue:    { color: '#2C3E50', bg: '#AEC6CF', border: '#92A8B0' },
        green:   { color: '#2C3E50', bg: '#A8BBA3', border: '#8A9A86' },
        yellow:  { color: '#2C3E50', bg: '#F6EFBD', border: '#D0CA9F' },
      };
      return s[c] || s.default;
    })(theme);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'weblang-quick-popup';
    wrapper.setAttribute('data-weblang-quick', 'true'); // Unique identifier
    
    // Better positioning - ensure popup stays in viewport
    const maxX = window.innerWidth - 450; // popup max width + margin
    const maxY = window.innerHeight - 200; // popup estimated height + margin
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
      border:2px dashed ${border} !important;
      backdrop-filter:blur(8px) !important;
      animation:fadeInUp 0.3s ease-out !important;
      overflow:hidden !important;
      display:block !important;
      visibility:visible !important;
      opacity:1 !important;
    `;
    
    wrapper.innerHTML = `
      <div class="weblang-quick-header" style="background:rgba(255,255,255,0.2);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${border};cursor:move;user-select:none">
        <strong style="font-weight:600;color:${color};font-size:13px">Translation</strong>
        <button data-action="close" style="background:none;border:none;color:${color};opacity:0.6;cursor:pointer;padding:2px;border-radius:4px;display:flex;align-items:center;justify-content:center" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
        </button>
      </div>
      <div style="padding:14px">
        <div class="weblang-quick-content" style="white-space:pre-wrap;word-break:break-word;margin-bottom:12px;color:${color};font-size:14px;line-height:1.5">${text}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;align-items:center">
          <button data-action="speak" title="Text-to-Speech" style="background:none;color:${color};border:none;padding:4px;border-radius:4px;cursor:pointer;display:flex;align-items:center;opacity:0.8">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
          <button data-action="copy" title="Copy Text" style="background:none;color:${color};border:none;padding:4px;border-radius:4px;cursor:pointer;display:flex;align-items:center;opacity:0.8">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      </div>
    `;

    // Add animation CSS if not exists
    if (!document.getElementById('weblang-quick-animations')) {
      const style = document.createElement('style');
      style.id = 'weblang-quick-animations';
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
    // Only close popup if clicking outside of it and not on other extension elements
    if (popupEl && !popupEl.contains(e.target) && 
        !e.target.closest('.weblang-popup, .weblang-translate-btn, .weblang-ui, .weblang-quick-popup[data-weblang-quick]')) {
      removeUI();
    }
  };
  document.addEventListener('mousedown', __wl_down);

  const __wl_up = async function (e) {
    try {
      // Check global flag first (fastest check)
      if (!isQuickTranslateEnabled) {
        return;
      }

      // Check if extension context is still valid
      if (!isExtensionContextValid()) {
        return;
      }

      // Check if quick translate is enabled first
      const isEnabled = await new Promise((resolve) => {
        try {
          chrome.storage.sync.get(['quickTranslateEnabled'], (data) => {
            if (chrome.runtime.lastError) {
              resolve(false);
            } else {
              resolve(data.quickTranslateEnabled !== false);
            }
          });
        } catch (e) {
          resolve(false);
        }
      });
      
      if (!isEnabled || !isQuickTranslateEnabled) {
        return;
      }
      
      // Skip if clicking on existing popup or other extension UI elements
      if (popupEl && popupEl.contains(e.target)) return;
      if (e.target.closest('.weblang-popup, .weblang-translate-btn, .weblang-ui, .weblang-quick-popup[data-weblang-quick]')) return;
      
      // Remove any existing popup first to prevent overlap
      if (popupEl) {
        removeUI();
        // Small delay to prevent immediate re-triggering
        await new Promise(r => setTimeout(r, 150));
      }
      
      // Get selection immediately like the working version
      let selected = window.getSelection().toString().trim();

      if (selected.length > 0) {
        
        // Show translate button immediately like the working version
        await showQuickTranslateButton(e, selected);
      } else {
        // Remove UI if no selection
        removeUI();
      }
    } catch (error) {
      console.error('Error in mouseup handler:', error);
    }
  };

  async function showQuickTranslateButton(e, selected) {
    try {
      // Check global flag at start of function
      if (!isQuickTranslateEnabled) {
        return;
      }

      // Check extension context before proceeding
      if (!isExtensionContextValid()) {
        return;
      }

      // Get user preferences
      const prefs = await UI.getUserPreferences().catch(() => ({ sourceLang: 'auto', targetLang: 'id' }));
      let sourceLang = prefs.sourceLang || 'auto';
      let targetLang = prefs.targetLang || 'id';

      // Handle auto detection properly like the working version
      if (sourceLang === 'auto') {
        // Simple language detection based on text characteristics
        if (/[\u0600-\u06FF]/.test(selected)) sourceLang = 'ar';
        else if (/[\u4e00-\u9fff]/.test(selected)) sourceLang = 'zh';
        else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(selected)) sourceLang = 'ja';
        else if (/[а-я]/.test(selected.toLowerCase())) sourceLang = 'ru';
        else if (/[à-ÿ]/.test(selected.toLowerCase())) sourceLang = 'fr';
        else sourceLang = 'en';
      }

      // Ensure we have valid language codes (not "auto")
      if (sourceLang === 'auto') {
        sourceLang = 'en';
      }
      if (targetLang === 'auto') {
        targetLang = 'id';
      }

      // If source and target are the same, switch target language automatically
      if (sourceLang === targetLang) {
        // Auto switch target language based on source
        if (sourceLang === 'id') targetLang = 'en';
        else if (sourceLang === 'en') targetLang = 'id';
        else if (sourceLang === 'ar') targetLang = 'en';
        else if (sourceLang === 'ja') targetLang = 'en';
        else if (sourceLang === 'zh') targetLang = 'en';
        else if (sourceLang === 'fr') targetLang = 'en';
        else if (sourceLang === 'de') targetLang = 'en';
        else if (sourceLang === 'es') targetLang = 'en';
        else if (sourceLang === 'ru') targetLang = 'en';
        else targetLang = 'en';
      }

      // Show popup with "Translating..." immediately
      const theme = prefs?.translationColor || 'default';
      popupEl = createPopup(e.pageX, e.pageY, 'Translating...', theme);
      document.body.appendChild(popupEl);

      // Make popup draggable
      const header = popupEl.querySelector('.weblang-quick-header');
      let drag = false; let sx=0, sy=0, ox=0, oy=0;
      const onMove = (ev) => {
        if (!drag) return;
        const dx = ev.clientX - sx;
        const dy = ev.clientY - sy;
        popupEl.style.left = `${Math.max(0, ox + dx)}px`;
        popupEl.style.top  = `${Math.max(0, oy + dy)}px`;
      };
      header.addEventListener('mousedown', (ev)=>{
        drag = true;
        sx = ev.clientX; sy = ev.clientY;
        const rect = popupEl.getBoundingClientRect();
        ox = rect.left; oy = rect.top;
        document.addEventListener('mousemove', onMove);
        const up = ()=>{ drag=false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', up); };
        document.addEventListener('mouseup', up);
      });

      // Get content node for updating
      const contentNode = popupEl.querySelector('.weblang-quick-content');

      // Request translation with retries like the working version
      let translation = await requestTranslation(selected, sourceLang, targetLang);

      // Check if still enabled after first request
      if (!isQuickTranslateEnabled) {
        removeUI();
        return;
      }

      if (!translation || translation === selected) {
        // Retry after short delay
        await new Promise(r => setTimeout(r, 500));
        
        if (!isQuickTranslateEnabled) {
          removeUI();
          return;
        }
        
        translation = await requestTranslation(selected, sourceLang, targetLang);
      }

      if (!isQuickTranslateEnabled) {
        removeUI();
        return;
      }

      if (!translation || translation === selected) {
        // Second retry after longer delay
        await new Promise(r => setTimeout(r, 800));
        
        if (!isQuickTranslateEnabled) {
          removeUI();
          return;
        }
        
        translation = await requestTranslation(selected, sourceLang, targetLang);
      }

      if (!isQuickTranslateEnabled) {
        removeUI();
        return;
      }

      if (translation && translation !== selected) {
        contentNode.textContent = translation;
      } else {
        contentNode.textContent = 'Translation failed after 3 attempts';
      }

      // Add click handlers for popup actions
      popupEl.addEventListener('click', async (clickEvent) => {
        const target = clickEvent.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.getAttribute('data-action');
        if (action === 'close') { 
          TTS.stop();
          removeUI(); 
          return; 
        }
        if (action === 'speak') {
          try {
            if (TTS.isSpeaking()) {
              TTS.stop();
              target.textContent = '🔊';
            } else {
              target.textContent = '⏹️';
              await TTS.speak(contentNode.textContent || '', targetLang);
              target.textContent = '🔊';
            }
          } catch {
            target.textContent = '🔊';
          }
        }
        if (action === 'copy') {
          try { 
            await navigator.clipboard.writeText(contentNode.textContent || ''); 
            if (isExtensionContextValid()) {
              UI.showNotification('Copied to clipboard', 'success'); 
            }
          } catch { 
            if (isExtensionContextValid()) {
              UI.showNotification('Copy failed', 'error'); 
            }
          }
        }
      });

    } catch (error) {
      console.error('Error in showQuickTranslateButton:', error);
      // Only show error if quick translate is still enabled
      if (isQuickTranslateEnabled && popupEl) {
        const contentNode = popupEl.querySelector('.weblang-quick-content');
        if (contentNode) contentNode.textContent = 'Translation error occurred';
      } else {
        // Remove UI if disabled
        removeUI();
      }
    }
  }

  async function requestTranslation(text, from, to) {
    return new Promise((resolve) => {
      try {
        // Check extension context before making request
        if (!isExtensionContextValid()) {
          resolve(null);
          return;
        }

        chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXT', text, from, to }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(resp?.translation || null);
          }
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  document.addEventListener('mouseup', __wl_up);
  // expose handles for disable
  // @ts-ignore
  window.__WL_QT_DOWN = __wl_down;
  // @ts-ignore
  window.__WL_QT_UP = __wl_up;
}

export function disableQuickTranslate() {
  isQuickTranslateEnabled = false;

  // Remove all existing quick translate UI
  try {
    document.querySelectorAll('.weblang-quick-popup').forEach(el => el.remove());
    document.querySelectorAll('.weblang-translate-btn').forEach(el => el.remove());
  } catch (e) {
    console.error('Error removing quick translate UI:', e);
  }
  
  // Remove event listeners
  try { if (window.__WL_QT_DOWN) document.removeEventListener('mousedown', window.__WL_QT_DOWN); } catch{}
  try { if (window.__WL_QT_UP) document.removeEventListener('mouseup', window.__WL_QT_UP); } catch{}
  
  // @ts-ignore
  window.__WL_QT_DOWN = null;
  // @ts-ignore
  window.__WL_QT_UP = null;
  // @ts-ignore
  window.__WEBLANG_QT_INIT = false;
}


