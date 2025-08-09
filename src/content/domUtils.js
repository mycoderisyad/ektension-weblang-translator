export const DomUtils = (() => {
  let processedElements = new WeakSet();

  function queryAllDeep(selector, root = document) {
    const results = [];
    const visited = new WeakSet();
    function search(node) {
      if (!node || visited.has(node)) return;
      visited.add(node);
      try { results.push(...Array.from(node.querySelectorAll(selector))); } catch {}
      try {
        const all = node.querySelectorAll ? node.querySelectorAll('*') : [];
        all.forEach((el) => { if (el.shadowRoot) search(el.shadowRoot); });
      } catch {}
    }
    search(root);
    return results;
  }

  function isValidTextNode(el) {
    if (!el || processedElements.has(el)) return false;
    if (el.classList?.contains('weblang-translation')) return false;
    if (el.hasAttribute?.('data-weblang-translated')) return false;
    const invalidSelectors = 'script, style, noscript, code, pre, .weblang-translation';
    if (el.closest?.(invalidSelectors)) return false;
    const codeSelectors = ".highlight, .code-block, [class*='language-'], .prettyprint";
    if (el.closest?.(codeSelectors)) return false;
    const mediaElements = 'img, video, audio, canvas, svg, iframe, object, embed';
    if (el.matches?.(mediaElements)) return false;
    const formElements = 'input, button, select, textarea';
    if (el.matches?.(formElements)) return false;
    return true;
  }

  function extractTextContent(element) {
    if (!element) return '';
    if (!element.children || element.children.length === 0) return element.textContent?.trim() || '';
    const clone = element.cloneNode(true);
    const toRemove = clone.querySelectorAll('img, video, audio, canvas, svg, iframe, script, style');
    toRemove.forEach((el) => el.remove());
    return clone.textContent?.trim() || '';
  }

  function getTranslatableElements(container = document.body) {
    const selector = [
      'p','h1','h2','h3','h4','h5','h6','li','td','th','blockquote','figcaption',
      'main p','article p','section p','.section p','.content p','.container p','.column p',
      'div p', 'span', 'a', 'strong', 'em', 'b', 'i' // Added more selectors
    ].join(', ');
    
    const elements = queryAllDeep(selector, container === document.body ? document : container);
    console.log(`Found ${elements.length} potential translatable elements`);
    
    const validElements = elements.filter((el) => {
      if (processedElements.has(el)) return false;
      if (el.hasAttribute('data-weblang-translated')) return false;
      if (el.nextElementSibling?.classList.contains('weblang-translation')) return false;
      if (!isValidTextNode(el)) return false;
      
      const text = extractTextContent(el);
      if (!text || text.length < 3) return false; // Reduced from 5 to 3
      
      // More lenient filtering
      if (/^[\d\s\-_=.,:;!?\/\(\)\[\]{}'"@#$%^&*<>]*$/.test(text) && text.length < 10) return false;
      if (text.includes('class=') || text.includes('id=') || text.includes('<div') || text.includes('</')) return false;
      if (el.children.length > 15) return false; // Increased from 12 to 15
      
      return true;
    });
    
    console.log(`Filtered to ${validElements.length} valid translatable elements`);
    
    // Mark elements as processed
    validElements.forEach(el => processedElements.add(el));
    
    return validElements.length ? validElements : fallbackFromTextNodes();
  }

  function fallbackFromTextNodes() {
    try {
      const allowedParents = new Set(['P','H1','H2','H3','H4','H5','H6','LI','TD','TH','BLOCKQUOTE','FIGCAPTION','SPAN']);
      const containers = queryAllDeep('main, article, section, .section, .content, .container, .column');
      const fallbackSet = new Set();
      containers.forEach((rootEl) => {
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const txt = node.nodeValue?.trim();
            if (!txt || txt.length < 5) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent || !allowedParents.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            if (parent.closest('script, style, noscript, code, pre, .weblang-translation')) return NodeFilter.FILTER_REJECT;
            if (/^[\d\s\-_=.,:;!?\/\(\)\[\]{}'"@#$%^&*<>]*$/.test(txt)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        let node;
        while ((node = walker.nextNode())) if (node.parentElement) fallbackSet.add(node.parentElement);
      });
      return Array.from(fallbackSet);
    } catch { return []; }
  }

  function markTranslated(el, originalText) {
    el.setAttribute('data-weblang-translated', 'true');
    if (originalText) el.setAttribute('data-weblang-original', originalText);
    processedElements.add(el);
  }

  function resetProcessedElements() { processedElements = new WeakSet(); }

  return { queryAllDeep, isValidTextNode, extractTextContent, getTranslatableElements, markTranslated, resetProcessedElements };
})();


