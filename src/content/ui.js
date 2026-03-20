export const UI = (() => {
  let progressElement = null;

  function getColorScheme(theme) {
    // Soft pastel colors to reduce eye strain
    const schemes = {
      default: { color: '#2C3E50', bg: '#DCD7C9', border: '#BDB7AA' },
      red:     { color: '#2C3E50', bg: '#BF9264', border: '#A67D55' },
      blue:    { color: '#2C3E50', bg: '#AEC6CF', border: '#92A8B0' },
      green:   { color: '#2C3E50', bg: '#A8BBA3', border: '#8A9A86' },
      yellow:  { color: '#2C3E50', bg: '#F6EFBD', border: '#D0CA9F' },
    };
    return schemes[theme] || schemes.default;
  }

  function updateTranslationColor(theme) {
    const colorScheme = getColorScheme(theme || 'default');
    // Inline style update with !important via CSS rule for stronger override
    const styleId = 'weblang-translation-color-override';
    let styleTag = document.getElementById(styleId);
    const css = `.weblang-translation{color:${colorScheme.color} !important;background:${colorScheme.bg} !important;border:2px dashed ${colorScheme.border} !important;border-radius:6px !important;box-shadow:0 2px 4px rgba(0,0,0,.05) !important;}`;
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
      div.style.cssText = `margin:6px 0 10px 0;padding:8px 12px;color:${colorScheme.color};background:${colorScheme.bg};border:2px dashed ${colorScheme.border};border-radius:8px;display:block;line-height:1.55;box-shadow:0 2px 4px rgba(0,0,0,.05);`;
      div.textContent = translation;
      try {
        const parent = element.parentNode || element.closest('p, div, section, article') || document.body;
        element.nextSibling ? parent.insertBefore(div, element.nextSibling) : parent.appendChild(div);
      } catch { element.textContent = translation; }
    } else {
      // ⚡ FULL PAGE MODE: HANYA ganti text, TANPA background/highlight seperti Chrome
      
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

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function showProgress(current, total, message = 'Translating') {
    if (progressElement) progressElement.remove();
    if (current >= total) { progressElement?.remove(); progressElement = null; return; }
    progressElement = document.createElement('div');
    progressElement.id = 'weblang-progress';
    progressElement.style.cssText = `position:fixed;top:20px;right:20px;background:#111827;color:#e5e7eb;padding:14px 20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.5);z-index:2147483647;display:flex;gap:12px;`;
    const percentage = Math.round((current / total) * 100);
    const safeMessage = escapeHtml(message);
    const safeCount = `${Number(current)}/${Number(total)} (${percentage}%)`;
    progressElement.innerHTML = `
      <div style="width:24px;height:24px;border:3px solid #374151;border-top-color:#9ca3af;border-radius:50%;animation:spin 1s linear infinite"></div>
      <div><div style="font-weight:600">${safeMessage}</div><div style="font-size:12px;opacity:.9">${safeCount}</div></div>
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

  return { injectTranslation, replaceTextPreservingStructure, updateTranslationColor, showProgress, showNotification, getUserPreferences, getColorScheme };
})();


