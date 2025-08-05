// WebLang Translator - Background Script
// Multi-provider translation with AI analysis support
const StorageUtils = (() => {
  async function get(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(keys, (data) => {
          if (chrome.runtime.lastError) resolve({});
          else resolve(data);
        });
      } catch {
        resolve({});
      }
    });
  }
  async function set(obj) {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.set(obj, () => resolve(!chrome.runtime.lastError));
      } catch {
        resolve(false);
      }
    });
  }
  return { get, set };
})();

const RateLimiter = (() => {
  let lastRequestAt = 0;
  function isLimited(ms = 500) {
    const now = Date.now();
    if (now - lastRequestAt < ms) return true;
    lastRequestAt = now;
    return false;
  }
  return { isLimited };
})();

const TranslateProvider = (() => {
  async function googlePaid(text, from, to, key) {
    try {
      const body = { q: text, target: to, format: "text" };
      if (from !== "auto") body.source = from;
      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      return {
        text: data.data?.translations?.[0]?.translatedText,
        detectedLang:
          data.data?.translations?.[0]?.detectedSourceLanguage || from,
        usedService: "GOOGLE",
      };
    } catch {
      return null;
    }
  }

  // ----------- Google Translate (FREE Web API) -----------
  async function googleFree(text, from, to) {
    const endpoints = [
      "https://translate.googleapis.com/translate_a/single",
      "https://clients5.google.com/translate_a/single",
      "https://translate.google.com/translate_a/single",
    ];
    for (let endpoint of endpoints) {
      try {
        const params = new URLSearchParams({
          client: "gtx",
          sl: from === "auto" ? "auto" : from,
          tl: to,
          dt: "t",
          q: text,
        });
        const url = `${endpoint}?${params.toString()}`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "*/*",
            Referer: "https://translate.google.com/",
          },
        });
        if (!res.ok) continue;
        const data = await res.json();
        let translatedText = Array.isArray(data[0])
          ? data[0].map((i) => i[0]).join("")
          : "";
        let detectedLang =
          (data[2] && data[2]) || (data[8] && data[8][0][0]) || from;
        if (translatedText && translatedText !== text) {
          return {
            text: translatedText.trim(),
            detectedLang: detectedLang || from,
            usedService: "GOOGLEFREE",
          };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  // ----------- Azure Translator -----------
  async function azure(text, from, to, key, region = "southeastasia") {
    try {
      let query = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${to}`;
      if (from !== "auto") query += `&from=${from}`;
      let res = await fetch(query, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Ocp-Apim-Subscription-Region": region,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([{ Text: text }]),
      });
      let data = await res.json();
      return {
        text: data[0]?.translations?.[0]?.text,
        detectedLang: data[0]?.detectedLanguage?.language || from,
        usedService: "AZURE",
      };
    } catch {
      return null;
    }
  }

  // ----------- MyMemory API -----------
  async function myMemory(text, from, to) {
    try {
      if (from === "auto" && to === "en") return null;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        text
      )}&langpair=${from === "auto" ? `auto|${to}` : `${from}|${to}`}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) return null;
      const data = await res.json();
      const translation = data.responseData?.translatedText;
      const detectedLang = data.responseData.match?.lang || from;
      if (translation && translation !== text && translation.length > 0) {
        return {
          text: translation,
          detectedLang,
          usedService: "MYMEMORY",
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // ----------- LibreTranslate -----------
  async function libre(text, from, to) {
    try {
      if (from === "auto" && to === "en") return null;
      const res = await fetch("https://libretranslate.de/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          q: text,
          source: from === "auto" ? "auto" : from,
          target: to,
          format: "text",
        }),
      });
      const data = await res.json();
      if (data && data.translatedText) {
        return {
          text: data.translatedText,
          detectedLang: from,
          usedService: "LIBRE",
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // Provider registry
  return {
    googlePaid,
    googleFree,
    azure,
    myMemory,
    libre,
  };
})();

// ============= [MODUL: UNIVERSAL TRANSLATOR] =============
const UniversalTranslator = (() => {
  async function translate({
    text,
    from = "auto",
    to = "id",
    provider,
    apiKeys,
    useFreeMode,
  }) {
    if (!text || text.length < 2 || /^\s*$/.test(text) || /^\d+$/.test(text)) {
      return { text, detectedLang: from, usedService: "NONE" };
    }
    if (from !== "auto" && from === to) {
      return { text, detectedLang: from, usedService: "SAME_LANG" };
    }

    // Setup order
    let apis = [];
    if (useFreeMode) {
      apis = [
        { name: "googleFree", func: TranslateProvider.googleFree },
        { name: "myMemory", func: TranslateProvider.myMemory },
        { name: "libre", func: TranslateProvider.libre },
      ];
    } else {
      if (provider === "google" && apiKeys.googleKey)
        apis.push({
          name: "googlePaid",
          func: TranslateProvider.googlePaid,
          key: apiKeys.googleKey,
        });
      if (provider === "azure" && apiKeys.azureKey)
        apis.push({
          name: "azure",
          func: TranslateProvider.azure,
          key: apiKeys.azureKey,
        });
      if (apis.length === 0) {
        if (apiKeys.googleKey)
          apis.push({
            name: "googlePaid",
            func: TranslateProvider.googlePaid,
            key: apiKeys.googleKey,
          });
        if (apiKeys.azureKey)
          apis.push({
            name: "azure",
            func: TranslateProvider.azure,
            key: apiKeys.azureKey,
          });
      }
      // Fallback ke free jika semua paid fail
      apis.push({ name: "googleFree", func: TranslateProvider.googleFree });
      apis.push({ name: "myMemory", func: TranslateProvider.myMemory });
      apis.push({ name: "libre", func: TranslateProvider.libre });
    }
    // Execute chain
    for (let api of apis) {
      try {
        let result = api.key
          ? await api.func(text, from, to, api.key)
          : await api.func(text, from, to);
        if (
          result &&
          typeof result === "object" &&
          result.text &&
          result.text !== text &&
          result.text.length > 0
        ) {
          return result;
        }
      } catch {
        continue;
      }
    }
    return { text, detectedLang: from, usedService: "FAILED" };
  }
  return { translate };
})();

// ============== [MODUL: AI GEMINI HANDLERS] ==============
const GeminiAI = (() => {
  async function summarize(text, key) {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-goog-api-key": key
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Buat ringkasan singkat dan mudah dimengerti dari teks berikut dalam bahasa Indonesia:\n\n${text}`,
                  },
                ],
              },
            ],
          }),
        }
      );
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} - ${errorText}`);
      }
      
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      return null;
    }
  }
  
  async function analyze(text, key) {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-goog-api-key": key
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analisa teks berikut dalam bahasa Indonesia. Berikan hasil berupa: sentimen, tingkat kemudahan dibaca, dan tema utama.\n\nTeks:\n${text}`,
                  },
                ],
              },
            ],
          }),
        }
      );
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} - ${errorText}`);
      }
      
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      return null;
    }
  }
  
  async function keywords(text, key) {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-goog-api-key": key
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Dari teks berikut, ekstrak 10 kata kunci terpenting dalam bahasa Indonesia (hanya kata/frasa, pisahkan dengan koma):\n\n${text}`,
                  },
                ],
              },
            ],
          }),
        }
      );
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} - ${errorText}`);
      }
      
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      return null;
    }
  }
  return { summarize, analyze, keywords };
})();

// =============== [MODUL: EXPORT / DOWNLOAD] ===============
const ExportUtils = (() => {
  async function doExport({ fileType, content, filename = "weblang-export" }) {
    try {
      if (fileType === "pdf") {
        // Create a well-formatted HTML content for PDF conversion
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${filename}</title>
    <style>
        @page {
            margin: 2cm;
            size: A4;
        }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; 
            color: #333;
            max-width: none;
            margin: 0;
            padding: 20px;
            background: white;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 15px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #2563eb;
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 600;
        }
        .header .meta {
            color: #64748b;
            font-size: 14px;
        }
        .content {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 14px;
            line-height: 1.8;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 12px;
        }
        @media print {
            body { 
                margin: 0; 
                padding: 15px; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .no-print { display: none; }
            .header h1 { color: #2563eb !important; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌐 WebLang Export</h1>
        <div class="meta">Generated on ${new Date().toLocaleString('id-ID', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</div>
    </div>
    
    <div class="content">${content.replace(/\n/g, '<br>')}</div>
    
    <div class="footer">
        <p>Exported by WebLang Translator Chrome Extension</p>
    </div>
    
    <script>
        // Auto-trigger print dialog after page loads
        window.addEventListener('load', function() {
            setTimeout(function() {
                window.print();
            }, 800);
        });
        
        // Close tab after printing (optional)
        window.addEventListener('afterprint', function() {
            setTimeout(function() {
                window.close();
            }, 1000);
        });
    </script>
</body>
</html>`;
        
        // Create data URL and open in new tab
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        
        // Open in new tab - browser will show print dialog for PDF save
        await chrome.tabs.create({ 
          url: dataUrl,
          active: true 
        });
        
        return true;
      } else {
        // Handle TXT export
        const mimeType = "text/plain";
        const base64Content = btoa(unescape(encodeURIComponent(content)));
        await chrome.downloads.download({
          url: `data:${mimeType};base64,${base64Content}`,
          filename: `${filename}.${fileType}`,
          conflictAction: "uniquify",
          saveAs: true,
        });
        return true;
      }
    } catch (err) {
      console.error("Export failed:", err);
      throw err;
    }
  }

  async function exportTranslation({
    fileType,
    originalTexts,
    translatedTexts,
    mode = "bilingual",
    sourceLang = "en",
    targetLang = "id",
  }) {
    try {
      let content = "",
        filename = `translation-${sourceLang}-to-${targetLang}`;
      
      if (mode === "translation-only") {
        filename += "-translated";
        if (fileType === "pdf") {
          // For PDF, create clean text content
          content = translatedTexts.join("\n\n");
        } else {
          content = translatedTexts.join("\n\n");
        }
      } else {
        filename += "-bilingual";
        if (fileType === "pdf") {
          // For PDF, create clean bilingual text
          for (let i = 0; i < originalTexts.length; i++) {
            content += `[${sourceLang.toUpperCase()}]: ${originalTexts[i]}\n`;
            content += `[${targetLang.toUpperCase()}]: ${translatedTexts[i]}\n\n`;
          }
        } else {
          for (let i = 0; i < originalTexts.length; i++) {
            content += `[${sourceLang.toUpperCase()}]: ${
              originalTexts[i]
            }\n[${targetLang.toUpperCase()}]: ${translatedTexts[i]}\n\n`;
          }
        }
      }
      
      const result = await doExport({ fileType, content, filename });
      if (!result) throw new Error("Export failed");
      return result;
    } catch (err) {
      console.error("Translation export failed:", err);
      throw err;
    }
  }
  return { doExport, exportTranslation };
})();

// ================= [MODUL: MAIN HANDLER] ==================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      // --- Rate limit
      if (RateLimiter.isLimited()) {
        sendResponse({
          success: false,
          error: "Rate limited! Coba lagi sebentar lagi.",
        });
        return;
      }
      const apiKeys = await StorageUtils.get([
        "googleKey",
        "azureKey",
        "geminiKey",
        "provider",
        "rateLimit",
        "useFreeMode",
      ]);
      const provider = apiKeys.provider || "google";

      // --- Test API Key
      if (message.action === "testAPI") {
        let testResult;
        if (message.apiType === "azure")
          testResult = await TranslateProvider.azure(
            "Hello world",
            "en",
            "id",
            message.apiKey
          );
        else if (message.apiType === "google")
          testResult = await TranslateProvider.googlePaid(
            "Hello world",
            "en",
            "id",
            message.apiKey
          );
        else {
          sendResponse({ success: false, error: "Unknown API type" });
          return;
        }
        if (
          testResult &&
          testResult.text &&
          testResult.text !== "Hello world"
        ) {
          sendResponse({ success: true, result: testResult.text });
        } else {
          sendResponse({
            success: false,
            error: "API returned empty or unchanged result",
          });
        }
        return;
      }

      // --- Translation
      if (message.type === "TRANSLATE_TEXT") {
        const translationResult = await UniversalTranslator.translate({
          text: message.text,
          from: message.from,
          to: message.to,
          provider,
          apiKeys,
          useFreeMode: apiKeys.useFreeMode,
        });
        sendResponse({
          success: true,
          translation: translationResult.text,
          detectedLang: translationResult.detectedLang,
        });
        return;
      }

      // --- AI Summarize/Analyze/Keywords
      if (
        ["AI_SUMMARIZE", "AI_ANALYZE", "AI_KEYWORDS"].includes(message.type)
      ) {
        if (!apiKeys.geminiKey) {
          sendResponse({
            success: false,
            error: "Gemini API Key belum diisi di Options.",
          });
          return;
        }
        let result;
        if (message.type === "AI_SUMMARIZE")
          result = await GeminiAI.summarize(message.text, apiKeys.geminiKey);
        if (message.type === "AI_ANALYZE")
          result = await GeminiAI.analyze(message.text, apiKeys.geminiKey);
        if (message.type === "AI_KEYWORDS")
          result = await GeminiAI.keywords(message.text, apiKeys.geminiKey);
        sendResponse({ success: true, result: result });
        return;
      }

      // --- Export Content (AI Results)
      if (message.type === "EXPORT_CONTENT") {
        let ok = await ExportUtils.doExport({
          fileType: message.fileType,
          content: message.content,
          filename: "ai-analysis-result"
        });
        sendResponse({ success: ok });
        return;
      }

      // --- Export Translation
      if (message.type === "EXPORT_TRANSLATION") {
        try {
          let ok = await ExportUtils.exportTranslation(message);
          sendResponse({ success: ok });
        } catch (error) {
          sendResponse({
            success: false,
            error: error.message || "Export failed",
          });
        }
        return;
      }

      // --- Other: TEST, BATCH, etc
      if (message.type === "TEST") {
        sendResponse({
          success: true,
          message: "Background script is working!",
        });
        return;
      }

      sendResponse({ success: false, error: "Unknown request type." });
    } catch (error) {
      sendResponse({ success: false, error: "Internal error occurred" });
    }
  })();
  return true;
});

// ============ END OF MODULARIZED background.js ===========
