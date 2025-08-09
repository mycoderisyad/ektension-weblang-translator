import { DomUtils } from './domUtils.js';
import { UI } from './ui.js';
import { TranslationCache } from './cache.js';
import { MegaBatchTranslator } from './batch.js';

export const TranslationPipeline = (() => {
  let state = {
    translations: { originalTexts: [], translatedTexts: [], sourceLang: 'auto', targetLang: 'id', mode: 'paragraph' },
    isTranslating: false,
    shouldStop: false,
    stats: { total: 0, translated: 0, cached: 0, failed: 0, startTime: 0, endTime: 0 },
  };

  async function translatePage(mode, sourceLang, targetLang, callback) {
    if (state.isTranslating) { callback({ success: false, error: 'Translation already in progress' }); return; }
    state.isTranslating = true; state.shouldStop = false;
    state.stats = { total: 0, translated: 0, cached: 0, failed: 0, startTime: Date.now(), endTime: 0 };
    state.translations = { originalTexts: [], translatedTexts: [], sourceLang, targetLang, mode };
    try {
      const elements = DomUtils.getTranslatableElements();
      if (elements.length === 0) { UI.showNotification('No translatable content found', 'info'); callback({ success: true, message: 'No content to translate' }); return; }
      state.stats.total = elements.length;
      const batches = MegaBatchTranslator.createBatches(elements);
      let processed = 0;
      for (let i = 0; i < batches.length; i++) {
        if (state.shouldStop) break;
        const batch = batches[i];
        const texts = batch.map((it) => it.text);
        UI.showProgress(processed, state.stats.total, 'Translating page');
        const translations = await MegaBatchTranslator.translateBatch(texts, sourceLang, targetLang);
          for (let j = 0; j < batch.length; j++) {
          const { element, text } = batch[j];
          const translation = translations[j];
            // Inject even if translation equals original to keep paragraph pairing consistent
            if (translation && translation.trim().length > 0) {
            const modeToUse = mode === 'fullpage' ? 'replace' : 'after';
            await UI.injectTranslation(element, translation, modeToUse);
            DomUtils.markTranslated(element, text);
            state.translations.originalTexts.push(text);
            state.translations.translatedTexts.push(translation);
            state.stats.translated++;
          } else { state.stats.failed++; }
          processed++;
        }
      }
      state.stats.endTime = Date.now();
      UI.showProgress(state.stats.total, state.stats.total);
      callback({ success: true, stats: state.stats });
    } catch (e) {
      UI.showNotification('Translation failed: ' + e.message, 'error');
      callback({ success: false, error: e.message });
    } finally { state.isTranslating = false; state.shouldStop = false; }
  }

  function stopTranslation() { state.shouldStop = true; UI.showNotification('Stopping translation...', 'info'); }
  function getTranslations() { return state.translations; }
  function getStats() { return state.stats; }
  function clearCache() { TranslationCache.clear(); UI.showNotification('Translation cache cleared', 'info'); }
  const isTranslating = () => state.isTranslating;
  
  function resetState() {
    // Reset all translation state to allow re-translation
    state.translations = { originalTexts: [], translatedTexts: [], sourceLang: 'auto', targetLang: 'id', mode: 'paragraph' };
    state.isTranslating = false;
    state.shouldStop = false;
    state.stats = { total: 0, translated: 0, cached: 0, failed: 0, startTime: 0, endTime: 0 };
    console.log('Translation pipeline state reset');
  }

  return { translatePage, stopTranslation, getTranslations, getStats, clearCache, isTranslating, resetState };
})();


