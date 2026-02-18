// Translation Engine - Inspired by XTranslate Architecture
import { TextSelector } from './textSelector.js';
import { UI } from './ui.js';

export const TranslationEngine = (() => {
  
  // Translation state
  let isTranslating = false;
  let shouldStop = false;
  let translationData = {
    originalTexts: [],
    translatedTexts: [],
    sourceLang: 'auto',
    targetLang: 'id',
    mode: 'paragraph'
  };
  
  // Language detection with comprehensive patterns
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
      fr: /\b(le|la|les|de|du|des|et|est|une|un|dans|pour|avec|sur|par|comme|mais|ce|qui|que|se|ne|pas)\b/gi,
      de: /\b(der|die|das|und|ist|in|zu|den|von|mit|sich|auf|für|als|bei|war|hat|ein|eine|nicht|wird)\b/gi,
      es: /\b(el|la|de|que|y|en|un|es|se|no|te|lo|le|da|su|por|son|con|para|al|del|los|las)\b/gi
    };
    
    const scores = {};
    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      scores[lang] = matches ? matches.length : 0;
    }
    
    // Special handling for character-based languages
    if (scores.ar > 2) return 'ar';
    if (scores.ja > 0) return 'ja';
    if (scores.ko > 0) return 'ko';
    if (scores.zh > 3) return 'zh';
    if (scores.ru >= 2) return 'ru';
    
    // Word-based languages
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return 'en'; // Default fallback
    
    const detectedLang = Object.keys(scores).find(lang => scores[lang] === maxScore);
    return detectedLang || 'en';
  }
  
  // Smart text splitting
  function splitTextSmart(text, maxLen = 400) {
    if (!text || text.length <= maxLen) return [text];
    
    // Split by sentences first
    const sentences = text.split(/([.!?]+\s+)/);
    const chunks = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLen) {
        currentChunk += sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          // Sentence too long, split by words
          const words = sentence.split(' ');
          for (const word of words) {
            if ((currentChunk + ' ' + word).length <= maxLen) {
              currentChunk += (currentChunk ? ' ' : '') + word;
            } else {
              if (currentChunk) chunks.push(currentChunk.trim());
              currentChunk = word;
            }
          }
        }
      }
    }
    
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks.filter(chunk => chunk.length > 0);
  }
  
  // Translation request with retry
  async function translateText(text, fromLang, toLang, retryCount = 0) {
    if (!text || text.trim().length < 2) return null;
    if (fromLang === toLang && fromLang !== 'auto') return text;
    
    // Skip if same language detected
    if (fromLang === 'auto') {
      const detected = detectLanguage(text);
      if (detected === toLang) {
        console.log(`⏭️ Skipping same language: ${detected} → ${toLang}`);
        return null;
      }
      fromLang = detected;
    }
    
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { 
            type: 'TRANSLATE_TEXT', 
            text: text.trim(), 
            from: fromLang, 
            to: toLang 
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
      
      if (response.success && response.translation && 
          response.translation !== text && 
          response.translation.length > 0 &&
          !response.translation.includes('[failed]')) {
        return response.translation;
      }
      
      // Retry logic
      if (retryCount < 2) {
        console.log(`Retrying translation (${retryCount + 1}/2): ${text.substring(0, 30)}...`);
        await new Promise(resolve => setTimeout(resolve, 500 + (retryCount * 300)));
        return translateText(text, fromLang, toLang, retryCount + 1);
      }
      
      console.log(`Translation failed after retries: ${text.substring(0, 30)}...`);
      return null;
      
    } catch (error) {
      console.error('Translation error:', error);
      return null;
    }
  }
  
  // Paragraph mode translation
  async function translateParagraphMode(sourceLang, targetLang, onProgress) {
    console.log('🔄 Starting paragraph mode translation...');
    
    const paragraphs = TextSelector.getVisibleParagraphs();
    if (paragraphs.length === 0) {
      console.log('No paragraphs found for translation');
      return { success: true, message: 'No content to translate' };
    }
    
    isTranslating = true;
    shouldStop = false;
    
    // Reset translation data
    translationData = {
      originalTexts: [],
      translatedTexts: [],
      sourceLang,
      targetLang,
      mode: 'paragraph'
    };
    
    let translated = 0;
    const total = paragraphs.length;
    
    for (const paragraph of paragraphs) {
      if (shouldStop) {
        console.log('Translation stopped by user');
        break;
      }
      
      const text = paragraph.textContent?.trim();
      if (!text) continue;
      
      // Update progress
      if (onProgress) {
        onProgress(translated, total, `Translating paragraph ${translated + 1}/${total}`);
      }
      
      // Split and translate
      const parts = splitTextSmart(text);
      const translations = [];
      
      for (const part of parts) {
        const translated = await translateText(part, sourceLang, targetLang);
        translations.push(translated || part);
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalTranslation = translations.join(' ');
      
      if (finalTranslation && finalTranslation !== text) {
        // Inject translation with highlight
        await UI.injectTranslation(paragraph, finalTranslation, 'after');
        TextSelector.markAsProcessed(paragraph, text);
        
        translationData.originalTexts.push(text);
        translationData.translatedTexts.push(finalTranslation);
        translated++;
        
        console.log(`✅ Translated paragraph: "${text.substring(0, 50)}..."`);
      }
      
      // Delay between paragraphs
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    isTranslating = false;
    console.log(`✅ Paragraph translation complete: ${translated}/${total} paragraphs translated`);
    
    return {
      success: true,
      message: `Translated ${translated} of ${total} paragraphs`
    };
  }
  
  // Full page mode translation
  async function translateFullPageMode(sourceLang, targetLang, onProgress) {
    console.log('🔄 Starting full page mode translation...');
    
    const textNodes = TextSelector.getVisibleTextNodes();
    if (textNodes.length === 0) {
      console.log('No text nodes found for translation');
      return { success: true, message: 'No content to translate' };
    }
    
    isTranslating = true;
    shouldStop = false;
    
    // Reset translation data
    translationData = {
      originalTexts: [],
      translatedTexts: [],
      sourceLang,
      targetLang,
      mode: 'fullpage'
    };
    
    let translated = 0;
    const total = textNodes.length;
    
    for (const textNode of textNodes) {
      if (shouldStop) {
        console.log('Translation stopped by user');
        break;
      }
      
      const text = textNode.textContent?.trim();
      if (!text) continue;
      
      // Update progress
      if (onProgress) {
        onProgress(translated, total, `Translating text ${translated + 1}/${total}`);
      }
      
      // Split and translate
      const parts = splitTextSmart(text);
      const translations = [];
      
      for (const part of parts) {
        const translatedPart = await translateText(part, sourceLang, targetLang);
        translations.push(translatedPart || part);
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const finalTranslation = translations.join(' ');
      
      if (finalTranslation && finalTranslation !== text) {
        // Replace text node content directly (preserves hyperlinks)
        textNode.textContent = finalTranslation;
        TextSelector.markAsProcessed(textNode.parentElement, text);
        
        translationData.originalTexts.push(text);
        translationData.translatedTexts.push(finalTranslation);
        translated++;
        
        console.log(`✅ Translated text: "${text.substring(0, 30)}..."`);
      }
      
      // Delay between nodes
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    
    isTranslating = false;
    console.log(`✅ Full page translation complete: ${translated}/${total} text nodes translated`);
    
    return {
      success: true,
      message: `Translated ${translated} of ${total} text nodes`
    };
  }
  
  // Restore original text
  function restoreOriginalText() {
    const processedElements = document.querySelectorAll('[data-weblang-processed]');
    const translationElements = document.querySelectorAll('.weblang-translation');
    
    // Remove translation highlights
    translationElements.forEach(el => el.remove());
    
    // Restore original text
    processedElements.forEach(el => {
      const original = el.getAttribute('data-weblang-original');
      if (original) {
        el.textContent = original;
      }
      el.removeAttribute('data-weblang-processed');
      el.removeAttribute('data-weblang-original');
    });
    
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
  
  // Public API
  return {
    // Translation methods
    translateParagraphMode,
    translateFullPageMode,
    restoreOriginalText,
    
    // State management
    isTranslating: () => isTranslating,
    stopTranslation: () => { shouldStop = true; },
    getTranslationData: () => translationData,
    
    // Utilities
    detectLanguage,
    splitTextSmart
  };
})();
