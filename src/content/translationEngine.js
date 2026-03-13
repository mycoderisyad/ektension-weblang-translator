// Translation Engine — Upgraded with Batch API + sessionStorage Cache
// Inspired by XTranslate's page-translator.ts architecture
import { TextSelector } from './textSelector.js';
import { UI } from './ui.js';
import { Tooltip } from './tooltip.js';

export const TranslationEngine = (() => {
  
  // Translation state
  let isTranslatingFlag = false;
  let shouldStop = false;
  let translationData = {
    originalTexts: [],
    translatedTexts: [],
    sourceLang: 'auto',
    targetLang: 'id',
    mode: 'paragraph'
  };
  
  // Cache constants
  const CACHE_PREFIX = 'wl_';
  const BATCH_CHAR_LIMIT = 4500; // Stay under 5000 for safety
  
  // --- Cache Functions (sessionStorage, like XTranslate's MD5 approach) ---
  
  function getCacheKey(text, from, to) {
    // Simple hash instead of MD5 (no dependency needed)
    let hash = 0;
    const str = `${from}_${to}_${text}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `${CACHE_PREFIX}${Math.abs(hash).toString(36)}`;
  }
  
  function getCached(text, from, to) {
    try {
      const key = getCacheKey(text, from, to);
      return sessionStorage.getItem(key);
    } catch { return null; }
  }
  
  function setCache(text, from, to, translation) {
    try {
      const key = getCacheKey(text, from, to);
      sessionStorage.setItem(key, translation);
    } catch { /* sessionStorage full, ignore */ }
  }
  
  function setCacheBatch(texts, translations, from, to) {
    queueMicrotask(() => {
      texts.forEach((text, i) => {
        if (text && translations[i]) {
          setCache(text, from, to, translations[i]);
        }
      });
    });
  }
  
  // --- Smart Text Splitting (using Intl.Segmenter where available) ---
  
  function splitTextSmart(text, maxLen = BATCH_CHAR_LIMIT) {
    if (!text || text.length <= maxLen) return [text];
    
    // Try Intl.Segmenter for sentence-level splitting (like XTranslate)
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
        const segments = Array.from(segmenter.segment(text), ({ segment }) => segment).filter(Boolean);
        
        if (segments.length > 1) {
          const chunks = [];
          let buffer = '';
          
          for (const segment of segments) {
            if (segment.length > maxLen) {
              if (buffer) { chunks.push(buffer); buffer = ''; }
              // Split oversized segment by words
              chunks.push(...splitByWords(segment, maxLen));
              continue;
            }
            if ((buffer + segment).length > maxLen) {
              if (buffer) chunks.push(buffer);
              buffer = '';
            }
            buffer += segment;
          }
          if (buffer) chunks.push(buffer);
          
          return chunks.filter(c => c.trim().length > 0);
        }
      } catch { /* Intl.Segmenter not supported, fallback */ }
    }
    
    // Fallback: split by sentence regex
    const sentences = text.split(/([.!?]+\s+)/);
    const chunks = [];
    let current = '';
    
    for (const sentence of sentences) {
      if ((current + sentence).length <= maxLen) {
        current += sentence;
      } else {
        if (current) chunks.push(current.trim());
        if (sentence.length > maxLen) {
          chunks.push(...splitByWords(sentence, maxLen));
          current = '';
        } else {
          current = sentence;
        }
      }
    }
    if (current) chunks.push(current.trim());
    return chunks.filter(c => c.length > 0);
  }
  
  function splitByWords(text, maxLen) {
    const words = text.split(' ');
    const chunks = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).length <= maxLen) {
        current += (current ? ' ' : '') + word;
      } else {
        if (current) chunks.push(current);
        current = word;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }
  
  // --- Batch Translation ---
  
  // Pack multiple texts into batches respecting char limit
  function packIntoBatches(texts, maxChars = BATCH_CHAR_LIMIT) {
    const batches = [];
    let currentBatch = [];
    let currentLen = 0;
    
    for (const text of texts) {
      if (text.length > maxChars) {
        // Text too long — split it first, then add pieces
        if (currentBatch.length) {
          batches.push(currentBatch);
          currentBatch = [];
          currentLen = 0;
        }
        batches.push([text]); // Let the API handle it
        continue;
      }
      
      if (currentLen + text.length > maxChars) {
        if (currentBatch.length) batches.push(currentBatch);
        currentBatch = [];
        currentLen = 0;
      }
      
      currentBatch.push(text);
      currentLen += text.length;
    }
    
    if (currentBatch.length) batches.push(currentBatch);
    return batches;
  }
  
  // Send batch translation request to background
  async function translateBatch(texts, fromLang, toLang) {
    if (!texts || texts.length === 0) return [];
    
    // Separator for joining/splitting texts in batch
    const SEPARATOR = '\n\u200B\n'; // Use zero-width space as unique separator
    const joinedText = texts.join(SEPARATOR);
    
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'TRANSLATE_BATCH',
            text: joinedText,
            from: fromLang,
            to: toLang,
            count: texts.length
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(resp || { success: false, error: 'No response' });
            }
          }
        );
      });
      
      if (response.success && response.translations) {
        const translated = response.translations;
        // Split the joined translation back
        const parts = translated.split(SEPARATOR);
        
        // If split gives us the same count, we're good
        if (parts.length === texts.length) {
          return parts;
        }
        
        // Fallback: try to match by rough proportion
        if (parts.length === 1) {
          // Single translation returned, try splitting by line
          const lines = translated.split('\n').filter(l => l.trim());
          if (lines.length === texts.length) return lines;
          // Give up, return single translation for first text
          return [translated, ...Array(texts.length - 1).fill(null)];
        }
        
        return parts;
      }
    } catch (err) {
      console.error('[TranslationEngine] Batch translation failed:', err);
    }
    
    return Array(texts.length).fill(null);
  }
  
  // Single text translation (fallback)
  async function translateSingle(text, fromLang, toLang) {
    if (!text || text.trim().length < 2) return null;
    
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'TRANSLATE_TEXT', text: text.trim(), from: fromLang, to: toLang },
          (resp) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false });
            } else {
              resolve(resp || { success: false });
            }
          }
        );
      });
      
      if (response.success && response.translation &&
          response.translation !== text && response.translation.length > 0) {
        return response.translation;
      }
    } catch (err) {
      console.error('[TranslationEngine] Single translation failed:', err);
    }
    return null;
  }
  
  // --- Full Page Translation (Upgraded) ---
  
  async function translateFullPageMode(sourceLang, targetLang, onProgress) {
    console.log('🚀 Starting upgraded full page translation...');
    
    // Collect all text nodes
    const allNodes = TextSelector.collectAndImport();
    if (allNodes.length === 0) {
      console.log('No text nodes found');
      return { success: true, message: 'No content to translate' };
    }
    
    isTranslatingFlag = true;
    shouldStop = false;
    translationData = {
      originalTexts: [],
      translatedTexts: [],
      sourceLang,
      targetLang,
      mode: 'fullpage'
    };
    
    console.log(`[TranslationEngine] Collected ${allNodes.length} text nodes`);
    
    // Start viewport observer for progressive translation
    TextSelector.startViewportObserver(allNodes);
    
    // Start mutation observer for dynamic content
    TextSelector.startMutationObserver();
    TextSelector.setOnNewNodes(async (newNodes) => {
      if (!isTranslatingFlag || shouldStop) return;
      console.log(`[TranslationEngine] Auto-translating ${newNodes.length} new dynamic nodes`);
      await translateNodeBatch(newNodes, sourceLang, targetLang);
    });
    
    // Translate all nodes in batches
    await translateNodeBatch(allNodes, sourceLang, targetLang, onProgress);
    
    // Enable mouseover tooltip
    const tooltipEnabled = await getTooltipSetting();
    if (tooltipEnabled) {
      Tooltip.enable();
    }
    
    isTranslatingFlag = false;
    console.log(`✅ Full page translation complete: ${translationData.translatedTexts.length} nodes translated`);
    
    return {
      success: true,
      message: `Translated ${translationData.translatedTexts.length} text nodes`
    };
  }
  
  // Core batch translation logic for nodes
  async function translateNodeBatch(nodes, sourceLang, targetLang, onProgress) {
    // Separate cached vs uncached
    const textsToTranslate = [];
    const nodeTextMap = []; // { node, text, cached }
    
    for (const node of nodes) {
      if (shouldStop) break;
      
      const origData = TextSelector.originalTexts.get(node);
      const text = origData ? origData.trimmed : (node.textContent || '').trim();
      if (!text || text.length < 2) continue;
      
      // Check cache first
      const cached = getCached(text, sourceLang, targetLang);
      if (cached) {
        nodeTextMap.push({ node, text, translation: cached, cached: true });
      } else {
        nodeTextMap.push({ node, text, translation: null, cached: false });
        textsToTranslate.push(text);
      }
    }
    
    // Apply cached translations immediately
    let translated = 0;
    const total = nodeTextMap.length;
    
    for (const item of nodeTextMap) {
      if (item.cached && item.translation) {
        applyTranslation(item.node, item.translation, item.text);
        translated++;
      }
    }
    
    if (onProgress && translated > 0) {
      onProgress(translated, total, `Applied ${translated} cached translations`);
    }
    
    console.log(`[TranslationEngine] Cache hits: ${translated}, to translate: ${textsToTranslate.length}`);
    
    // Batch translate uncached texts
    if (textsToTranslate.length > 0) {
      const batches = packIntoBatches(textsToTranslate);
      let batchIdx = 0;
      
      for (const batch of batches) {
        if (shouldStop) break;
        
        batchIdx++;
        if (onProgress) {
          onProgress(translated, total, `Translating batch ${batchIdx}/${batches.length}`);
        }
        
        const translations = await translateBatch(batch, sourceLang, targetLang);
        
        // If batch failed, try individual translations
        let results;
        if (!translations || translations.every(t => !t)) {
          results = [];
          for (const text of batch) {
            if (shouldStop) break;
            const result = await translateSingle(text, sourceLang, targetLang);
            results.push(result);
          }
        } else {
          results = translations;
        }
        
        // Cache the results
        setCacheBatch(batch, results, sourceLang, targetLang);
        
        // Apply translations
        for (let i = 0; i < batch.length; i++) {
          const translation = results[i];
          if (!translation || !translation.trim()) continue;
          
          // Find matching node
          const entry = nodeTextMap.find(item => !item.cached && item.text === batch[i] && !item.translation);
          if (entry) {
            entry.translation = translation;
            applyTranslation(entry.node, translation, entry.text);
            translated++;
          }
        }
        
        if (onProgress) {
          onProgress(translated, total, `Translated ${translated}/${total}`);
        }
      }
    }
  }
  
  // Apply translation to a DOM node
  function applyTranslation(node, translation, originalText) {
    if (!node || !translation) return;
    
    if (node instanceof Text) {
      // Preserve leading/trailing whitespace
      const raw = TextSelector.originalTexts.get(node)?.raw || node.textContent || '';
      const trimmed = raw.trim();
      const leadingSpaces = raw.slice(0, raw.indexOf(trimmed));
      const trailingSpaces = raw.slice(leadingSpaces.length + trimmed.length);
      
      node.textContent = `${leadingSpaces}${translation}${trailingSpaces}`;
      
      // Set tooltip attributes on parent
      const parent = node.parentElement;
      if (parent) {
        parent.setAttribute('data-weblang-tooltip', '');
        parent.setAttribute('data-weblang-original', originalText);
        parent.setAttribute('data-weblang-processed', 'true');
        
        translationData.originalTexts.push(originalText);
        translationData.translatedTexts.push(translation);
      }
    }
  }
  
  // --- Paragraph Mode Translation ---
  
  async function translateParagraphMode(sourceLang, targetLang, onProgress) {
    console.log('🔄 Starting paragraph mode translation...');
    
    const paragraphs = TextSelector.getVisibleParagraphs();
    if (paragraphs.length === 0) {
      return { success: true, message: 'No content to translate' };
    }
    
    isTranslatingFlag = true;
    shouldStop = false;
    translationData = {
      originalTexts: [],
      translatedTexts: [],
      sourceLang,
      targetLang,
      mode: 'paragraph'
    };
    
    let translated = 0;
    const total = paragraphs.length;
    
    // Collect all paragraph texts and check cache
    const paraTexts = paragraphs.map(p => p.textContent?.trim() || '');
    const uncachedIndices = [];
    const uncachedTexts = [];
    const cachedResults = new Array(paraTexts.length).fill(null);
    
    for (let i = 0; i < paraTexts.length; i++) {
      const text = paraTexts[i];
      if (!text) continue;
      
      const cached = getCached(text, sourceLang, targetLang);
      if (cached) {
        cachedResults[i] = cached;
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(text);
      }
    }
    
    // Apply cached paragraphs immediately
    for (let i = 0; i < paraTexts.length; i++) {
      if (shouldStop) break;
      if (cachedResults[i]) {
        await UI.injectTranslation(paragraphs[i], cachedResults[i], 'after');
        TextSelector.markAsProcessed(paragraphs[i], paraTexts[i]);
        translationData.originalTexts.push(paraTexts[i]);
        translationData.translatedTexts.push(cachedResults[i]);
        translated++;
      }
    }
    
    if (onProgress && translated > 0) {
      onProgress(translated, total, `Applied ${translated} cached translations`);
    }
    
    // Translate uncached paragraphs in batches
    if (uncachedTexts.length > 0) {
      const batches = packIntoBatches(uncachedTexts);
      let textIdx = 0;
      
      for (const batch of batches) {
        if (shouldStop) break;
        
        if (onProgress) {
          onProgress(translated, total, `Translating paragraphs...`);
        }
        
        const translations = await translateBatch(batch, sourceLang, targetLang);
        
        let results;
        if (!translations || translations.every(t => !t)) {
          results = [];
          for (const text of batch) {
            if (shouldStop) break;
            const result = await translateSingle(text, sourceLang, targetLang);
            results.push(result);
          }
        } else {
          results = translations;
        }
        
        // Cache and apply
        setCacheBatch(batch, results, sourceLang, targetLang);
        
        for (let i = 0; i < batch.length; i++) {
          const globalIdx = uncachedIndices[textIdx + i];
          const translation = results[i];
          
          if (translation && translation !== batch[i]) {
            await UI.injectTranslation(paragraphs[globalIdx], translation, 'after');
            TextSelector.markAsProcessed(paragraphs[globalIdx], batch[i]);
            translationData.originalTexts.push(batch[i]);
            translationData.translatedTexts.push(translation);
            translated++;
          }
        }
        
        textIdx += batch.length;
        
        if (onProgress) {
          onProgress(translated, total, `Translated ${translated}/${total} paragraphs`);
        }
      }
    }
    
    isTranslatingFlag = false;
    console.log(`✅ Paragraph translation complete: ${translated}/${total}`);
    
    return {
      success: true,
      message: `Translated ${translated} of ${total} paragraphs`
    };
  }
  
  // --- Restore Original Text ---
  
  function restoreOriginalText() {
    // Restore text nodes using stored original texts
    TextSelector.nodesAll.forEach(node => {
      const origData = TextSelector.originalTexts.get(node);
      if (origData && node instanceof Text) {
        node.textContent = origData.raw;
      }
    });
    
    // Remove translation highlights (paragraph mode)
    const translationElements = document.querySelectorAll('.weblang-translation');
    translationElements.forEach(el => el.remove());
    
    // Remove processed attributes
    const processedElements = document.querySelectorAll('[data-weblang-processed]');
    processedElements.forEach(el => {
      const original = el.getAttribute('data-weblang-original');
      if (original && !TextSelector.nodesAll.has(el)) {
        // Only restore if we haven't handled it via nodesAll
        el.textContent = original;
      }
      el.removeAttribute('data-weblang-processed');
      el.removeAttribute('data-weblang-original');
      el.removeAttribute('data-weblang-tooltip');
    });
    
    // Disable tooltip
    Tooltip.disable();
    
    // Stop observers
    TextSelector.stopAllObservers();
    TextSelector.clearAll();
    
    // Clear translation data
    translationData = {
      originalTexts: [],
      translatedTexts: [],
      sourceLang: 'auto',
      targetLang: 'id',
      mode: 'paragraph'
    };
    
    console.log('✅ Original text restored');
  }
  
  // --- Tooltip Setting ---
  
  async function getTooltipSetting() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(['showOriginalOnHover'], (data) => {
          if (chrome.runtime.lastError) {
            resolve(true); // Default to enabled
          } else {
            resolve(data.showOriginalOnHover !== false); // Default to enabled
          }
        });
      } catch {
        resolve(true);
      }
    });
  }
  
  // --- Language Detection (kept for compatibility) ---
  
  function detectLanguage(text) {
    if (text.length < 5) return 'en';
    const patterns = {
      id: /\b(dan|yang|ini|itu|adalah|akan|untuk|dari|dengan|tidak|belum|sudah|juga|harus|karena|jika|saya|kita|mereka|pada|dalam|atau|sebagai|dapat|bisa|sangat|lebih|sama|lain|baru|baik|besar|kecil|hari|tahun|bulan|minggu)\b/gi,
      en: /\b(the|and|that|this|is|will|for|from|with|not|can|should|when|why|how|because|if|while|you|we|they|have|has|been|are|was|were|would|could|might|may|do|does|did)\b/gi,
      ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g,
      zh: /[\u4E00-\u9FAF]/g,
      ko: /[\uAC00-\uD7AF]/g,
      ar: /[\u0600-\u06FF\u0750-\u077F]/g,
      ru: /[а-яё]/gi,
    };
    const scores = {};
    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      scores[lang] = matches ? matches.length : 0;
    }
    if (scores.ar > 2) return 'ar';
    if (scores.ja > 0) return 'ja';
    if (scores.ko > 0) return 'ko';
    if (scores.zh > 3) return 'zh';
    if (scores.ru >= 2) return 'ru';
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return 'en';
    return Object.keys(scores).find(lang => scores[lang] === maxScore) || 'en';
  }
  
  // Public API
  return {
    translateParagraphMode,
    translateFullPageMode,
    restoreOriginalText,
    
    isTranslating: () => isTranslatingFlag,
    stopTranslation: () => { shouldStop = true; },
    getTranslationData: () => translationData,
    
    detectLanguage,
    splitTextSmart
  };
})();
