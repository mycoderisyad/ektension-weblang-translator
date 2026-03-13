import { StorageUtils } from '../common/storage.js';
import { RateLimiter } from '../common/rateLimiter.js';
import { ExportUtils } from './export.js';
import { UniversalTranslator } from './translator.js';
import { GeminiAI } from './aiService.js';

console.log('WebLang background script starting...');

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

// Wire message handlers using modular pieces
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);
  
  (async () => {
    try {
      // Check rate limiting only for actual translation requests
      if ((message.type === 'TRANSLATE_TEXT' || message.type === 'TRANSLATE_BATCH') && RateLimiter.isLimited()) {
        console.log('Rate limited request');
        sendResponse({ success: false, error: 'Rate limited! Please try again shortly.' });
        return;
      }
      
      const apiKeys = await StorageUtils.get(['googleKey', 'azureKey', 'geminiKey', 'geminiModel', 'provider', 'rateLimit', 'useFreeMode']);
      const provider = apiKeys.provider || 'google';

      if (message.action === 'testAPI') {
        // Simple test via provider modules
        let result = await UniversalTranslator.translate({ 
          text: 'Hello world', 
          from: 'en', 
          to: 'id', 
          provider, 
          apiKeys, 
          useFreeMode: false 
        });
        if (result && result.text && result.text !== 'Hello world') {
          sendResponse({ success: true, result: result.text });
        } else {
          sendResponse({ success: false, error: 'API returned empty or unchanged result' });
        }
        return;
      }

      if (message.type === 'TRANSLATE_TEXT') {
        console.log('Processing TRANSLATE_TEXT request for:', message.text.substring(0, 30));
        const t = await UniversalTranslator.translate({ 
          text: message.text, 
          from: message.from, 
          to: message.to, 
          provider, 
          apiKeys, 
          useFreeMode: apiKeys.useFreeMode !== false // Default to free mode
        });
        if (t && t.text) {
          console.log('Translation successful:', t.text.substring(0, 50));
          addApiLog({
            type: 'TRANSLATE_TEXT',
            provider,
            success: true,
            from: message.from,
            to: message.to
          });
          sendResponse({ success: true, translation: t.text, detectedLang: t.detectedLang });
        } else {
          console.log('Translation failed, using fallback');
          addApiLog({
            type: 'TRANSLATE_TEXT',
            provider,
            success: false,
            from: message.from,
            to: message.to
          });
          sendResponse({ success: false, error: 'Translation failed', translation: message.text });
        }
        return;
      }
      
      if (message.type === 'TRANSLATE_BATCH') {
        try {
          // Split joined texts back into array
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
          
          if (results && results.length > 0) {
            addApiLog({
              type: 'TRANSLATE_BATCH',
              provider,
              success: true,
              from: message.from,
              to: message.to,
              count: texts.length
            });
            // Join back with same separator
            sendResponse({ success: true, translations: results.join(SEPARATOR), detectedLang: 'auto', count: texts.length });
          } else {
            addApiLog({
              type: 'TRANSLATE_BATCH',
              provider,
              success: false,
              from: message.from,
              to: message.to,
              count: texts.length
            });
            sendResponse({ success: false, error: 'Batch translation failed', translations: message.text });
          }
        } catch (err) {
          console.error('Batch translation error:', err);
          sendResponse({ success: false, error: err.message, translations: message.text });
        }
        return;
      }

      // AI Analysis Handlers
      if (message.type === 'AI_SUMMARIZE') {
        const geminiKey = apiKeys.geminiKey;
        const geminiModel = apiKeys.geminiModel;
        if (!geminiKey) {
          sendResponse({ success: false, error: 'Gemini API key not configured' });
          return;
        }
        
        const result = await GeminiAI.summarize(message.text, geminiKey, message.targetLang || 'id', geminiModel);
        if (result) {
          addApiLog({ type: 'AI_SUMMARIZE', provider: 'gemini', success: true, targetLang: message.targetLang || 'id' });
          sendResponse({ success: true, result });
        } else {
          addApiLog({ type: 'AI_SUMMARIZE', provider: 'gemini', success: false, targetLang: message.targetLang || 'id' });
          sendResponse({ success: false, error: 'AI summarization failed' });
        }
        return;
      }

      if (message.type === 'AI_ANALYZE') {
        const geminiKey = apiKeys.geminiKey;
        const geminiModel = apiKeys.geminiModel;
        if (!geminiKey) {
          sendResponse({ success: false, error: 'Gemini API key not configured' });
          return;
        }
        
        const result = await GeminiAI.analyze(message.text, geminiKey, message.targetLang || 'id', geminiModel);
        if (result) {
          addApiLog({ type: 'AI_ANALYZE', provider: 'gemini', success: true, targetLang: message.targetLang || 'id' });
          sendResponse({ success: true, result });
        } else {
          addApiLog({ type: 'AI_ANALYZE', provider: 'gemini', success: false, targetLang: message.targetLang || 'id' });
          sendResponse({ success: false, error: 'AI analysis failed' });
        }
        return;
      }

      if (message.type === 'AI_KEYWORDS') {
        const geminiKey = apiKeys.geminiKey;
        const geminiModel = apiKeys.geminiModel;
        if (!geminiKey) {
          sendResponse({ success: false, error: 'Gemini API key not configured' });
          return;
        }
        
        const result = await GeminiAI.keywords(message.text, geminiKey, message.targetLang || 'id', geminiModel);
        if (result) {
          addApiLog({ type: 'AI_KEYWORDS', provider: 'gemini', success: true, targetLang: message.targetLang || 'id' });
          sendResponse({ success: true, result });
        } else {
          addApiLog({ type: 'AI_KEYWORDS', provider: 'gemini', success: false, targetLang: message.targetLang || 'id' });
          sendResponse({ success: false, error: 'AI keyword extraction failed' });
        }
        return;
      }

      if (message.type === 'INJECT_CONTENT_CSS') {
        try {
          const tabId = sender?.tab?.id;
          if (!tabId || !message.file) {
            sendResponse({ success: false, error: 'Missing tabId or file' });
            return;
          }
          await chrome.scripting.insertCSS({
            target: { tabId },
            files: [message.file]
          });
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return;
      }

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

      console.log('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown request type.' });
    } catch (e) {
      console.error('Background script error:', e);
      sendResponse({ success: false, error: 'Internal error occurred: ' + e.message });
    }
  })();
  return true;
});

console.log('WebLang background script ready');


