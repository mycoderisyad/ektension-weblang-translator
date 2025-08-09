import { TranslationCache } from './cache.js';

export const MegaBatchTranslator = (() => {
  const CONFIG = {
    MEGA_BATCH_SIZE: 25,
    MAX_CHARS_PER_BATCH: 4000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 500,
  };

  async function translateBatch(texts, from, to) {
    if (!texts || texts.length === 0) return [];
    
    console.log(`Starting batch translation of ${texts.length} texts`);
    const results = new Array(texts.length);
    const toTranslate = [];
    const indices = [];
    
    // Check cache first
    for (let i = 0; i < texts.length; i++) {
      const cached = TranslationCache.get(texts[i], from, to);
      if (cached) {
        results[i] = cached;
      } else { 
        toTranslate.push(texts[i]); 
        indices.push(i); 
      }
    }
    
    console.log(`Found ${texts.length - toTranslate.length} cached, need to translate ${toTranslate.length}`);
    
    if (toTranslate.length === 0) return results;
    
    // Reduced concurrency to avoid rate limiting
    const concurrency = 2; // Reduced from dynamic calculation
    
    for (let start = 0; start < toTranslate.length; start += concurrency) {
      const slice = toTranslate.slice(start, start + concurrency);
      console.log(`Translating batch ${Math.floor(start/concurrency) + 1}/${Math.ceil(toTranslate.length/concurrency)}`);
      
      // Add delay between batches to avoid rate limiting
      if (start > 0) {
        await new Promise(r => setTimeout(r, 300));
      }
      
      const translatedSlice = await Promise.all(slice.map((t) => translateSingle(t, from, to)));
      
      for (let i = 0; i < translatedSlice.length; i++) {
        const translation = translatedSlice[i];
        const originalIndex = indices[start + i];
        if (translation) {
          results[originalIndex] = translation;
          TranslationCache.set(toTranslate[start + i], from, to, translation);
        } else {
          // Fallback to original text if translation failed
          results[originalIndex] = toTranslate[start + i];
        }
      }
    }
    
    console.log('Batch translation completed');
    return results;
  }

  async function translateSingle(text, from, to, retries = 0) {
    try {
      // Add small delay to avoid overwhelming the background script
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, CONFIG.RETRY_DELAY * Math.pow(2, retries)));
      }
      
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXT', text: text.trim(), from, to }, (resp) => {
          if (chrome.runtime.lastError) {
            console.log('Chrome runtime error in batch:', chrome.runtime.lastError);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(resp || { success: false, error: 'No response' });
          }
        });
      });
      
      if (response?.success && response.translation && response.translation.trim().length > 0) {
        console.log(`Translation success for text: ${text.substring(0, 30)}...`);
        return response.translation;
      }
      
      // Handle rate limiting specifically
      if (response?.error && response.error.includes('Rate limited')) {
        console.log('Rate limited, waiting longer before retry...');
        if (retries < CONFIG.MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 + (retries * 500))); // Longer delay for rate limits
          return translateSingle(text, from, to, retries + 1);
        }
      }
      
      if (retries < CONFIG.MAX_RETRIES) {
        console.log(`Translation failed, retrying (${retries + 1}/${CONFIG.MAX_RETRIES}):`, response?.error);
        return translateSingle(text, from, to, retries + 1);
      }
      
      console.log('Translation failed after all retries for text:', text.substring(0, 50), 'Response:', response);
      return null;
    } catch (e) {
      console.log('Batch translate error:', e);
      if (retries < CONFIG.MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, CONFIG.RETRY_DELAY * Math.pow(2, retries)));
        return translateSingle(text, from, to, retries + 1);
      }
      return null;
    }
  }

  function createBatches(elements) {
    const batches = []; let current = []; let chars = 0;
    for (const element of elements) {
      const text = typeof element === 'string' ? element : element.textContent?.trim() || '';
      const len = text.length;
      if (current.length >= CONFIG.MEGA_BATCH_SIZE || (chars + len > CONFIG.MAX_CHARS_PER_BATCH && current.length > 0)) {
        batches.push(current); current = []; chars = 0;
      }
      current.push({ element: typeof element === 'string' ? null : element, text });
      chars += len;
    }
    if (current.length) batches.push(current);
    return batches;
  }

  return { translateBatch, translateSingle, createBatches, CONFIG };
})();


