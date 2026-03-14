// Text Selection & Node Collection — Upgraded with IntersectionObserver + MutationObserver
// Inspired by XTranslate's page-translator.ts architecture

export const TextSelector = (() => {
  
  // Skip these tags from translation
  const SKIP_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME'];
  
  // Code-related selectors
  const CODE_SELECTORS = [
    '.highlight', '.code-block', '.prettyprint', '.syntax',
    '[class*="language-"]', '[class*="lang-"]', '[class*="hljs"]',
    '.cm-editor', '.CodeMirror'
  ];

  // Must contain at least one letter (Unicode-aware)
  const RX_LETTER = /\p{L}/u;

  // All collected nodes
  const nodesAll = new Set();
  // Nodes currently in viewport (for traffic-save mode)
  const nodesInViewport = new Set();
  // Original text storage
  const originalTexts = new WeakMap();
  // Parent → child text nodes mapping (for tooltip)
  const parentTextNodes = new WeakMap();

  // Track observers
  let intersectionObserver = null;
  let mutationObserver = null;
  let onNewNodesCallback = null;

  // --- Validation Functions ---

  function isElementVisible(element) {
    if (!element || !element.getBoundingClientRect) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  }

  function isValidForTranslation(element) {
    if (!element) return false;
    
    // Skip these tags
    if (SKIP_TAGS.includes(element.tagName)) return false;
    
    // Skip already processed
    if (element.hasAttribute && element.hasAttribute('data-weblang-processed')) return false;
    if (element.classList && element.classList.contains('weblang-translation')) return false;
    if (element.classList && element.classList.contains('weblang-tooltip')) return false;
    if (element.classList && element.classList.contains('weblang-quick-popup')) return false;
    
    // Skip code blocks
    for (const selector of CODE_SELECTORS) {
      try {
        if (element.closest && element.closest(selector)) return false;
      } catch { /* ignore invalid selectors */ }
    }
    
    return true;
  }

  function isTranslatableText(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed.length < 2) return false;
    
    // Skip pure numbers, symbols, URLs
    if (/^[\d\s\-_=.,:;!?\/\(\)\[\]{}'\"@#$%^&*<>|\\~`+]*$/.test(trimmed)) return false;
    if (/^(https?:\/\/|www\.|mailto:)/i.test(trimmed)) return false;
    if (/^\w+\.(js|css|html|php|json|xml)$/i.test(trimmed)) return false;
    
    // Must contain letters (Unicode-aware like XTranslate)
    if (!RX_LETTER.test(trimmed)) return false;
    
    return true;
  }

  // Check if a node (text or element) is translatable
  function isTranslatableNode(node) {
    if (node instanceof Text) {
      const parent = node.parentElement;
      if (!parent || !isValidForTranslation(parent)) return false;
      const text = node.textContent;
      return text && text.trim().length > 0 && RX_LETTER.test(text);
    }
    
    if (node instanceof HTMLImageElement || node instanceof HTMLAreaElement) {
      return Boolean(node.alt && RX_LETTER.test(node.alt));
    }
    
    if (node instanceof HTMLInputElement) {
      if (['submit', 'reset', 'button'].includes(node.type)) {
        return Boolean(node.value && RX_LETTER.test(node.value));
      }
      return Boolean(node.placeholder && RX_LETTER.test(node.placeholder));
    }
    
    return false;
  }

  // --- Node Collection ---

  // Collect all translatable nodes using TreeWalker (like XTranslate)
  function collectNodes(rootElem = document.body) {
    const nodes = new Set();

    const walker = document.createTreeWalker(
      rootElem,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          // Handle shadow DOM
          if (node instanceof HTMLElement && node.shadowRoot) {
            collectNodes(node.shadowRoot).forEach(n => nodes.add(n));
          }

          if (node instanceof Text) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (!isValidForTranslation(parent)) return NodeFilter.FILTER_REJECT;
            
            const text = node.textContent;
            if (!text || text.trim().length === 0 || !RX_LETTER.test(text)) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }

          // Skip non-translatable element tags
          if (node instanceof HTMLElement) {
            if (SKIP_TAGS.includes(node.tagName)) return NodeFilter.FILTER_REJECT;
            if (!isValidForTranslation(node)) return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_SKIP; // Skip element nodes, traverse children
        }
      }
    );

    while (walker.nextNode()) {
      nodes.add(walker.currentNode);
    }

    return Array.from(nodes);
  }

  // Import a node — store its original text and parent mapping
  function importNode(node) {
    if (nodesAll.has(node)) return;
    nodesAll.add(node);

    let text = '';
    if (node instanceof Text) {
      text = node.textContent;
      
      // Map parent → child text nodes (for tooltip grouping)
      const parent = node.parentElement;
      if (parent) {
        const children = parentTextNodes.get(parent) || new Set();
        children.add(node);
        parentTextNodes.set(parent, children);
      }
    }

    if (text) {
      originalTexts.set(node, { trimmed: text.trim(), raw: text });
    }
  }

  // Collect and import all nodes
  function collectAndImport(rootElem = document.body) {
    const nodes = collectNodes(rootElem);
    nodes.forEach(node => importNode(node));
    return nodes;
  }

  // --- IntersectionObserver (Traffic Save Mode) ---

  function startViewportObserver(nodes) {
    if (intersectionObserver) {
      intersectionObserver.disconnect();
    }

    intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const target = entry.target;

          // If the target is a translatable element itself (img, input)
          if (isTranslatableNode(target)) {
            nodesInViewport.add(target);
            intersectionObserver.unobserve(target);
          } else {
            // Get text nodes from this parent
            const textNodes = parentTextNodes.get(target);
            if (textNodes) {
              textNodes.forEach(textNode => nodesInViewport.add(textNode));
              intersectionObserver.unobserve(target);
            }
          }
        }
      }
    }, {
      rootMargin: '0px 0px 50% 0px', // Pre-load 50% below viewport
      threshold: 0,
    });

    // Observe parent elements of text nodes
    const observed = new Set();
    nodes.forEach(node => {
      const elem = node instanceof Text ? node.parentElement : node;
      if (elem && !observed.has(elem)) {
        observed.add(elem);
        intersectionObserver.observe(elem);
      }
    });

    return () => {
      if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
      }
    };
  }

  // --- MutationObserver (Dynamic Content) ---

  function startMutationObserver(rootElem = document.body) {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    mutationObserver = new MutationObserver((mutations) => {
      const freshNodes = [];

      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (isTranslatableNode(node)) {
            freshNodes.push(node);
          }

          // If it's an element, collect its inner text nodes
          if (node.nodeType === Node.ELEMENT_NODE) {
            const innerNodes = collectNodes(node);
            freshNodes.push(...innerNodes);
          }
        });
      }

      if (freshNodes.length > 0) {
        freshNodes.forEach(node => importNode(node));
        
        // Start observing new nodes for viewport
        if (intersectionObserver) {
          const observed = new Set();
          freshNodes.forEach(node => {
            const elem = node instanceof Text ? node.parentElement : node;
            if (elem && !observed.has(elem)) {
              observed.add(elem);
              intersectionObserver.observe(elem);
            }
          });
        }

        // Callback for auto-translation of new nodes
        if (onNewNodesCallback) {
          onNewNodesCallback(freshNodes);
        }
      }
    });

    mutationObserver.observe(rootElem, {
      subtree: true,
      childList: true,
      characterData: false,
    });

    return () => {
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
    };
  }

  // --- Legacy Methods (for paragraph mode) ---

  function getVisibleTextNodes(container = document.body) {
    return collectNodes(container);
  }

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
        if (isValidForTranslation(element) && isTranslatableText(element.textContent)) {
          const nextSibling = element.nextElementSibling;
          if (nextSibling?.classList?.contains('weblang-translation')) continue;
          elements.push(element);
        }
      }
    }
    return elements;
  }

  function markAsProcessed(element, originalText = null) {
    if (!element || !element.setAttribute) return;
    element.setAttribute('data-weblang-processed', 'true');
    if (originalText) {
      element.setAttribute('data-weblang-original', originalText);
    }
  }

  // --- Cleanup ---

  function stopAllObservers() {
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    onNewNodesCallback = null;
  }

  function clearAll() {
    stopAllObservers();
    nodesAll.clear();
    nodesInViewport.clear();
  }

  // Set callback for when new nodes are found by MutationObserver
  function setOnNewNodes(callback) {
    onNewNodesCallback = callback;
  }

  return {
    // Validation
    isElementVisible,
    isValidForTranslation,
    isTranslatableText,
    isTranslatableNode,
    
    // Node collection
    collectNodes,
    collectAndImport,
    getVisibleTextNodes,
    getVisibleParagraphs,
    
    // Node storage
    nodesAll,
    nodesInViewport,
    originalTexts,
    parentTextNodes,
    importNode,
    
    // Observers
    startViewportObserver,
    startMutationObserver,
    stopAllObservers,
    setOnNewNodes,
    
    // Utils
    markAsProcessed,
    clearAll,
  };
})();
