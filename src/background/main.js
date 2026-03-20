import { StorageUtils } from '../common/storage.js';
import { RateLimiter } from '../common/rateLimiter.js';
import { ExportUtils } from './export.js';
import { UniversalTranslator } from './translator.js';
import { GeminiAI } from './aiService.js';
import { DEFAULT_GEMINI_TTS_VOICE, normalizeGeminiTtsVoice } from '../common/geminiTts.js';

// Open side panel when clicking the extension icon
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

const apiLogs = [];

function addApiLog(entry) {
  apiLogs.unshift({
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (apiLogs.length > 50) {
    apiLogs.length = 50;
  }
}

/**
 * Generic handler for all AI analysis requests.
 * @param {'AI_SUMMARIZE'|'AI_ANALYZE'|'AI_KEYWORDS'} type
 * @param {string} text
 * @param {string} targetLang
 * @param {string} geminiKey
 * @param {string} geminiModel
 */
async function handleAiRequest(type, text, targetLang, geminiKey, geminiModel) {
  if (!geminiKey) {
    return { success: false, error: 'Gemini API key not configured' };
  }

  const methodMap = {
    AI_SUMMARIZE: GeminiAI.summarize,
    AI_ANALYZE: GeminiAI.analyze,
    AI_KEYWORDS: GeminiAI.keywords,
  };

  const method = methodMap[type];
  if (!method) {
    return { success: false, error: `Unknown AI request type: ${type}` };
  }

  const result = await method(text, geminiKey, targetLang, geminiModel);

  addApiLog({ type, provider: 'gemini', success: !!result, targetLang });

  if (result) {
    return { success: true, result };
  }
  return { success: false, error: `${type} failed` };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      // Rate limiting applies only to translation requests
      if ((message.type === 'TRANSLATE_TEXT' || message.type === 'TRANSLATE_BATCH') && RateLimiter.isLimited()) {
        sendResponse({ success: false, error: 'Rate limited. Please try again shortly.' });
        return;
      }

      const apiKeys = await StorageUtils.get([
        'googleKey',
        'azureKey',
        'geminiKey',
        'enableAiService',
        'enableGeminiTts',
        'geminiModel',
        'geminiTtsVoice',
        'provider',
        'rateLimit',
        'useFreeMode'
      ]);
      const provider = apiKeys.provider || 'google';

      // ----- API test -----
      if (message.action === 'testAPI') {
        const result = await UniversalTranslator.translate({
          text: 'Hello world',
          from: 'en',
          to: 'id',
          provider,
          apiKeys,
          useFreeMode: false
        });
        if (result?.text && result.text !== 'Hello world') {
          sendResponse({ success: true, result: result.text });
        } else {
          sendResponse({ success: false, error: 'API returned empty or unchanged result' });
        }
        return;
      }

      // ----- Single text translation -----
      if (message.type === 'TRANSLATE_TEXT') {
        const t = await UniversalTranslator.translate({
          text: message.text,
          from: message.from,
          to: message.to,
          provider,
          apiKeys,
          useFreeMode: apiKeys.useFreeMode !== false
        });
        if (t?.text) {
          addApiLog({ type: 'TRANSLATE_TEXT', provider, success: true, from: message.from, to: message.to });
          sendResponse({ success: true, translation: t.text, detectedLang: t.detectedLang });
        } else {
          addApiLog({ type: 'TRANSLATE_TEXT', provider, success: false, from: message.from, to: message.to });
          sendResponse({ success: false, error: 'Translation failed', translation: message.text });
        }
        return;
      }

      // ----- Batch translation -----
      if (message.type === 'TRANSLATE_BATCH') {
        const SEPARATOR = '\n\u200B\n';
        const texts = message.text.split(SEPARATOR);
        const results = await UniversalTranslator.translateBatch({
          texts,
          from: message.from,
          to: message.to,
          provider,
          apiKeys,
          useFreeMode: apiKeys.useFreeMode !== false
        });
        if (results?.length > 0) {
          addApiLog({ type: 'TRANSLATE_BATCH', provider, success: true, from: message.from, to: message.to, count: texts.length });
          sendResponse({ success: true, translations: results.join(SEPARATOR), detectedLang: 'auto', count: texts.length });
        } else {
          addApiLog({ type: 'TRANSLATE_BATCH', provider, success: false, from: message.from, to: message.to, count: texts.length });
          sendResponse({ success: false, error: 'Batch translation failed', translations: message.text });
        }
        return;
      }

      // ----- AI Analysis (Summarize / Analyze / Keywords) -----
      if (message.type === 'AI_SUMMARIZE' || message.type === 'AI_ANALYZE' || message.type === 'AI_KEYWORDS') {
        if (apiKeys.enableAiService === false) {
          sendResponse({ success: false, error: 'AI service is disabled in settings' });
          return;
        }

        const response = await handleAiRequest(
          message.type,
          message.text,
          message.targetLang || 'id',
          apiKeys.geminiKey,
          apiKeys.geminiModel
        );
        sendResponse(response);
        return;
      }

      if (message.type === 'GENERATE_TTS') {
        if (!apiKeys.geminiKey) {
          sendResponse({ success: false, error: 'Gemini API key not configured' });
          return;
        }

        if (apiKeys.enableGeminiTts === false) {
          sendResponse({ success: false, error: 'Gemini TTS is disabled in settings' });
          return;
        }

        const result = await GeminiAI.generateSpeech(
          message.text,
          apiKeys.geminiKey,
          message.lang || 'en',
          normalizeGeminiTtsVoice(apiKeys.geminiTtsVoice || DEFAULT_GEMINI_TTS_VOICE)
        );

        addApiLog({
          type: 'GENERATE_TTS',
          provider: 'gemini',
          success: !!result,
          targetLang: message.lang || 'en'
        });

        if (!result) {
          sendResponse({ success: false, error: 'Gemini TTS failed' });
          return;
        }

        sendResponse({ success: true, ...result });
        return;
      }

      // ----- CSS injection for AI popup -----
      if (message.type === 'INJECT_CONTENT_CSS') {
        const ALLOWED_CSS_FILES = ['styles/content/aiPopup.css'];
        const tabId = sender?.tab?.id;
        if (!tabId || !message.file) {
          sendResponse({ success: false, error: 'Missing tabId or file' });
          return;
        }
        if (!ALLOWED_CSS_FILES.includes(message.file)) {
          sendResponse({ success: false, error: 'CSS file not permitted' });
          return;
        }
        try {
          await chrome.scripting.insertCSS({ target: { tabId }, files: [message.file] });
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return;
      }

      // ----- API logs -----
      if (message.type === 'GET_API_LOGS') {
        sendResponse({
          success: true,
          logs: apiLogs.slice(0, 10),
          currentApi: apiLogs[0]?.provider || 'None',
          details: apiLogs[0]
            ? `${apiLogs[0].type} (${apiLogs[0].success ? 'success' : 'failed'})`
            : 'No API request yet'
        });
        return;
      }

      // ----- Export handlers -----
      if (message.type === 'EXPORT_AI_PDF') {
        try {
          const ok = await ExportUtils.doExport({
            fileType: 'pdf',
            content: message.content,
            filename: `weblang-ai-result-${Date.now()}`,
            title: message.title || 'WebLang AI Result'
          });
          sendResponse({ success: ok });
        } catch (e) {
          console.error('AI PDF export error:', e);
          sendResponse({ success: false, error: e.message });
        }
        return;
      }

      if (message.type === 'EXPORT_CONTENT') {
        const ok = await ExportUtils.doExport({
          fileType: message.fileType,
          content: message.content,
          filename: 'ai-analysis-result'
        });
        sendResponse({ success: ok });
        return;
      }

      if (message.type === 'EXPORT_TRANSLATION') {
        try {
          const ok = await ExportUtils.exportTranslation(message);
          sendResponse({ success: ok });
        } catch (e) {
          console.error('Export translation error:', e);
          sendResponse({ success: false, error: e.message || 'Export failed' });
        }
        return;
      }

      sendResponse({ success: false, error: 'Unknown request type.' });
    } catch (e) {
      console.error('Background script error:', e);
      sendResponse({ success: false, error: 'Internal error: ' + e.message });
    }
  })();
  return true;
});
