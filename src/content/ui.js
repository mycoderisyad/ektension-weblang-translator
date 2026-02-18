export const UI = (() => {
  let progressElement = null;

  function getColorScheme(theme) {
    // Brighten backgrounds to make highlight clearer while keeping dark theme
    const schemes = {
      default: { color: '#f3f4f6', bg: '#1f2937', border: '#6b7280' },
      red:     { color: '#fef2f2', bg: '#2b1212', border: '#ef4444' },
      blue:    { color: '#eff6ff', bg: '#13233f', border: '#3b82f6' },
      green:   { color: '#ecfdf5', bg: '#123027', border: '#10b981' },
      yellow:  { color: '#fefce8', bg: '#2b230f', border: '#f59e0b' },
    };
    return schemes[theme] || schemes.default;
  }

  function updateTranslationColor(theme) {
    const colorScheme = getColorScheme(theme || 'default');
    // Inline style update with !important via CSS rule for stronger override
    const styleId = 'weblang-translation-color-override';
    let styleTag = document.getElementById(styleId);
    const css = `.weblang-translation{color:${colorScheme.color} !important;background:${colorScheme.bg} !important;border-left:4px solid ${colorScheme.border} !important;box-shadow:0 1px 0 rgba(0,0,0,.25) inset, 0 1px 6px rgba(0,0,0,.15) !important;}`;
    if (!styleTag) {
      styleTag = document.createElement('style');
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
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['translationColor', 'sourceLang', 'targetLang'], (data) => resolve(data || {}));
        } else {
          resolve({ translationColor: 'default', sourceLang: 'auto', targetLang: 'id' });
        }
      } catch {
        resolve({ translationColor: 'default', sourceLang: 'auto', targetLang: 'id' });
      }
    });
  }

  async function injectTranslation(element, translation, mode = 'after') {
    if (!translation || translation.length < 2) return;
    if (!element || !element.parentNode) return;
    const prefs = await getUserPreferences();
    const colorScheme = getColorScheme(prefs.translationColor || 'default');
    
    if (mode === 'after') {
      // Mode after: inject translation sebagai element terpisah
      if (element.nextElementSibling?.classList.contains('weblang-translation')) {
        element.nextElementSibling.textContent = translation; return;
      }
      const div = document.createElement('div');
      div.className = 'weblang-translation';
      div.style.cssText = `margin:6px 0 10px 0;padding:8px 12px;color:${colorScheme.color};background:${colorScheme.bg};border-left:4px solid ${colorScheme.border};border-radius:6px;display:block;line-height:1.55;box-shadow:0 1px 0 rgba(0,0,0,.25) inset, 0 1px 6px rgba(0,0,0,.15);`;
      div.textContent = translation;
      try {
        const parent = element.parentNode || element.closest('p, div, section, article') || document.body;
        element.nextSibling ? parent.insertBefore(div, element.nextSibling) : parent.appendChild(div);
      } catch { element.textContent = translation; }
    } else {
      // ⚡ FULL PAGE MODE: HANYA ganti text, TANPA background/highlight seperti Chrome
      console.log('🔄 Full page: Direct text replacement, no styling');
      
      if (!element.hasAttribute('data-weblang-original')) {
        element.setAttribute('data-weblang-original', element.textContent);
      }
      replaceTextPreservingStructure(element, translation);
    }
  }
  
  // Helper function untuk preserve HTML structure saat replace
  function replaceTextPreservingStructure(element, translation) {
    // Check untuk hyperlinks
    const links = element.querySelectorAll('a[href]');
    if (links.length > 0) {
      // Ada hyperlink: preserve link functionality, hanya ganti text
      links.forEach(link => {
        const originalHref = link.href;
        const originalTarget = link.target;
        const originalRel = link.rel;
        const originalClass = link.className;
        
        // Ganti text content tapi preserve semua attributes
        link.textContent = translation;
        link.href = originalHref;
        if (originalTarget) link.target = originalTarget;
        if (originalRel) link.rel = originalRel;
        if (originalClass) link.className = originalClass;
      });
    } else {
      // Tidak ada hyperlink: ganti text nodes saja
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Hanya text nodes yang punya content
            return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        },
        false
      );
      
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
      
      // Replace text nodes dengan translation
      if (textNodes.length === 1) {
        textNodes[0].nodeValue = translation;
      } else if (textNodes.length > 1) {
        // Multiple text nodes - distribusi translation
        const words = translation.split(' ');
        const wordsPerNode = Math.ceil(words.length / textNodes.length);
        
        textNodes.forEach((textNode, index) => {
          const startIdx = index * wordsPerNode;
          const endIdx = Math.min(startIdx + wordsPerNode, words.length);
          const nodeText = words.slice(startIdx, endIdx).join(' ');
          textNode.nodeValue = nodeText + (endIdx < words.length ? ' ' : '');
        });
      } else {
        // Fallback: replace entire content
        element.textContent = translation;
      }
    }
  }

  function showProgress(current, total, message = 'Translating') {
    if (progressElement) progressElement.remove();
    if (current >= total) { progressElement?.remove(); progressElement = null; return; }
    progressElement = document.createElement('div');
    progressElement.id = 'weblang-progress';
    progressElement.style.cssText = `position:fixed;top:20px;right:20px;background:#111827;color:#e5e7eb;padding:14px 20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.5);z-index:2147483647;display:flex;gap:12px;`;
    const percentage = Math.round((current / total) * 100);
    progressElement.innerHTML = `
      <div style="width:24px;height:24px;border:3px solid #374151;border-top-color:#9ca3af;border-radius:50%;animation:spin 1s linear infinite"></div>
      <div><div style="font-weight:600">${message}</div><div style="font-size:12px;opacity:.9">${current}/${total} (${percentage}%)</div></div>
      <div style="width:100px;height:4px;background:#1f2937;border-radius:2px;overflow:hidden"><div style="width:${percentage}%;height:100%;background:#9ca3af"></div></div>`;
    if (!document.getElementById('weblang-animations')) {
      const style = document.createElement('style');
      style.id = 'weblang-animations';
      style.textContent = `@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`;
      document.head.appendChild(style);
    }
    document.body.appendChild(progressElement);
  }

  function showNotification(message, type = 'info') {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;bottom:20px;right:20px;background:${type==='success'?'#10b981':type==='error'?'#ef4444':'#3b82f6'};color:#fff;padding:12px 20px;border-radius:8px;z-index:2147483647`;
    el.textContent = message; document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, 3000);
  }

  return { injectTranslation, replaceTextPreservingStructure, updateTranslationColor, showProgress, showNotification, getUserPreferences };
})();


