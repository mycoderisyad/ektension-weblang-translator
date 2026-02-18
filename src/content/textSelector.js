// Text Selection and Validation - Inspired by XTranslate
export const TextSelector = (() => {
  
  // Only translate text that's currently visible on screen
  function isElementVisible(element) {
    if (!element || !element.getBoundingClientRect) return false;
    
    const rect = element.getBoundingClientRect();
    const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
    const viewWidth = Math.max(document.documentElement.clientWidth, window.innerWidth);
    
    // Element must be within viewport or close to it
    return (
      rect.bottom >= -100 && // Allow some margin above viewport
      rect.top <= viewHeight + 100 && // Allow some margin below viewport
      rect.right >= -100 &&
      rect.left <= viewWidth + 100 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }
  
  // Check if element is valid for translation
  function isValidTextElement(element) {
    if (!element || !element.tagName) return false;
    
    // Skip already processed
    if (element.hasAttribute('data-weblang-processed')) return false;
    if (element.classList?.contains('weblang-translation')) return false;
    
    // Skip non-text elements
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT'];
    if (skipTags.includes(element.tagName)) return false;
    
    // Skip code blocks
    const codeSelectors = [
      '.highlight', '.code-block', '.prettyprint', '.syntax',
      '[class*="language-"]', '[class*="lang-"]', '[class*="hljs"]',
      '.cm-editor', '.CodeMirror'
    ];
    
    for (const selector of codeSelectors) {
      if (element.closest(selector)) return false;
    }
    
    // Must be visible
    if (!isElementVisible(element)) return false;
    
    // Must have meaningful text
    const text = element.textContent?.trim();
    if (!text || text.length < 3) return false;
    
    return true;
  }
  
  // Check if text is translatable
  function isTranslatableText(text) {
    if (!text || typeof text !== 'string') return false;
    
    const trimmed = text.trim();
    if (trimmed.length < 3) return false;
    
    // Skip pure numbers, symbols, URLs
    if (/^[\d\s\-_=.,:;!?\/\(\)\[\]{}'"@#$%^&*<>|\\~`+]*$/.test(trimmed)) return false;
    if (/^(https?:\/\/|www\.|mailto:)/i.test(trimmed)) return false;
    if (/^\w+\.(js|css|html|php|json|xml)$/i.test(trimmed)) return false;
    
    // Must contain letters
    if (!/[a-zA-Z\u00C0-\u017F\u0100-\u024F\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(trimmed)) return false;
    
    return true;
  }
  
  // Get text nodes for full page translation (only visible ones)
  function getVisibleTextNodes(container = document.body) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Skip if parent is not valid
          if (!isValidTextElement(parent)) return NodeFilter.FILTER_REJECT;
          
          const text = node.textContent?.trim();
          if (!isTranslatableText(text)) return NodeFilter.FILTER_REJECT;
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }
    
    console.log(`Found ${textNodes.length} visible text nodes for translation`);
    return textNodes;
  }
  
  // Get paragraph elements for paragraph mode (only visible ones)
  function getVisibleParagraphs(container = document.body) {
    const selectors = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
      'li', 'td', 'th', 'blockquote', 'figcaption',
      'summary', 'dt', 'dd'
    ];
    
    const elements = [];
    
    for (const selector of selectors) {
      const found = container.querySelectorAll(selector);
      for (const element of found) {
        if (isValidTextElement(element) && isTranslatableText(element.textContent)) {
          // Skip if already has translation
          const nextSibling = element.nextElementSibling;
          if (nextSibling?.classList?.contains('weblang-translation')) continue;
          
          elements.push(element);
        }
      }
    }
    
    console.log(`Found ${elements.length} visible paragraphs for translation`);
    return elements;
  }
  
  // Mark element as processed to avoid re-translation
  function markAsProcessed(element, originalText = null) {
    element.setAttribute('data-weblang-processed', 'true');
    if (originalText) {
      element.setAttribute('data-weblang-original', originalText);
    }
  }
  
  return {
    isElementVisible,
    isValidTextElement,
    isTranslatableText,
    getVisibleTextNodes,
    getVisibleParagraphs,
    markAsProcessed
  };
})();
