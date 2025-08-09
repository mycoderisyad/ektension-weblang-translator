(() => {
  // src/common/storage.js
  var StorageUtils = /* @__PURE__ */ (() => {
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

  // src/common/rateLimiter.js
  var RateLimiter = (() => {
    let lastRequestAt = 0;
    let requestCount = 0;
    let windowStart = Date.now();
    function isLimited(ms = 200) {
      const now = Date.now();
      if (now - windowStart > 1e4) {
        requestCount = 0;
        windowStart = now;
      }
      if (requestCount >= 50) {
        console.log("Rate limit hit: too many requests");
        return true;
      }
      if (now - lastRequestAt < ms) {
        return true;
      }
      lastRequestAt = now;
      requestCount++;
      return false;
    }
    return { isLimited };
  })();

  // src/background/export.js
  var ExportUtils = /* @__PURE__ */ (() => {
    async function doExport({ fileType, content, filename = "weblang-export" }) {
      try {
        if (fileType === "pdf") {
          const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${filename}</title>
<style>@page{margin:2cm;size:A4}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:none;margin:0;padding:20px;background:white}.header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:15px;margin-bottom:30px}.header h1{color:#2563eb;margin:0 0 10px 0;font-size:28px;font-weight:600}.header .meta{color:#64748b;font-size:14px}.content{white-space:pre-wrap;word-wrap:break-word;font-size:14px;line-height:1.8}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:12px}@media print{body{margin:0;padding:15px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}.header h1{color:#2563eb!important}}</style></head><body>
<div class="header"><h1>WebLang Export</h1><div class="meta">Generated on ${(/* @__PURE__ */ new Date()).toLocaleString("id-ID", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div></div>
<div class="content">${content.replace(/\n/g, "<br>")}</div>
<div class="footer"><p>Exported by WebLang Translator Chrome Extension</p></div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),800));window.addEventListener('afterprint',()=>setTimeout(()=>window.close(),1000));<\/script>
</body></html>`;
          const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
          await chrome.tabs.create({ url: dataUrl, active: true });
          return true;
        } else {
          const mimeType = "text/plain";
          const base64Content = btoa(unescape(encodeURIComponent(content)));
          await chrome.downloads.download({ url: `data:${mimeType};base64,${base64Content}`, filename: `${filename}.${fileType}`, conflictAction: "uniquify", saveAs: true });
          return true;
        }
      } catch (err) {
        console.error("Export failed:", err);
        throw err;
      }
    }
    async function exportTranslation({ fileType, originalTexts, translatedTexts, mode = "bilingual", sourceLang = "en", targetLang = "id" }) {
      try {
        let content = "", filename = `translation-${sourceLang}-to-${targetLang}`;
        if (mode === "translation-only") {
          filename += "-translated";
          content = translatedTexts.join("\n\n");
        } else {
          filename += "-bilingual";
          for (let i = 0; i < originalTexts.length; i++) {
            content += `[${sourceLang.toUpperCase()}]: ${originalTexts[i]}
[${targetLang.toUpperCase()}]: ${translatedTexts[i]}

`;
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

  // src/background/providers.js
  var TranslateProvider = /* @__PURE__ */ (() => {
    async function googlePaid(text, from, to, key) {
      try {
        const body = { q: text, target: to, format: "text" };
        if (from !== "auto") body.source = from;
        const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        return {
          text: data.data?.translations?.[0]?.translatedText,
          detectedLang: data.data?.translations?.[0]?.detectedSourceLanguage || from,
          usedService: "GOOGLE"
        };
      } catch {
        return null;
      }
    }
    async function googleFree(text, from, to) {
      const endpoints = [
        "https://translate.googleapis.com/translate_a/single",
        "https://clients5.google.com/translate_a/single",
        "https://translate.google.com/translate_a/single"
      ];
      for (let endpoint of endpoints) {
        try {
          const params = new URLSearchParams({ client: "gtx", sl: from === "auto" ? "auto" : from, tl: to, dt: "t", q: text });
          const url = `${endpoint}?${params.toString()}`;
          const res = await fetch(url, { method: "GET", headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*", Referer: "https://translate.google.com/" } });
          if (!res.ok) continue;
          const data = await res.json();
          const translatedText = Array.isArray(data[0]) ? data[0].map((i) => i[0]).join("") : "";
          const detectedLang = data[2] && data[2] || data[8] && data[8][0][0] || from;
          if (translatedText && translatedText !== text) {
            return { text: translatedText.trim(), detectedLang: detectedLang || from, usedService: "GOOGLEFREE" };
          }
        } catch {
          continue;
        }
      }
      return null;
    }
    async function azure(text, from, to, key, region = "southeastasia") {
      try {
        let query = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${to}`;
        if (from !== "auto") query += `&from=${from}`;
        const res = await fetch(query, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Ocp-Apim-Subscription-Region": region,
            "Content-Type": "application/json"
          },
          body: JSON.stringify([{ Text: text }])
        });
        const data = await res.json();
        return { text: data[0]?.translations?.[0]?.text, detectedLang: data[0]?.detectedLanguage?.language || from, usedService: "AZURE" };
      } catch {
        return null;
      }
    }
    async function myMemory(text, from, to) {
      try {
        if (from === "auto") return null;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${`${from}|${to}`}`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.responseStatus && Number(data.responseStatus) !== 200) return null;
        const translation = data.responseData?.translatedText;
        const isApiErrorText = typeof translation === "string" && /INVALID SOURCE LANGUAGE|EXAMPLE: LANGPAIR/i.test(translation);
        if (isApiErrorText) return null;
        const detectedLang = data.responseData.match?.lang || from;
        if (translation && translation !== text && translation.length > 0) {
          return { text: translation, detectedLang, usedService: "MYMEMORY" };
        }
        return null;
      } catch {
        return null;
      }
    }
    async function libre(text, from, to) {
      try {
        const res = await fetch("https://libretranslate.de/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ q: text, source: from === "auto" ? "auto" : from, target: to, format: "text" })
        });
        const data = await res.json();
        if (data && data.translatedText) return { text: data.translatedText, detectedLang: from, usedService: "LIBRE" };
        return null;
      } catch {
        return null;
      }
    }
    return { googlePaid, googleFree, azure, myMemory, libre };
  })();

  // src/background/translator.js
  var UniversalTranslator = /* @__PURE__ */ (() => {
    async function translate({ text, from = "auto", to = "id", provider, apiKeys, useFreeMode }) {
      if (!text || text.length < 2 || /^\s*$/.test(text) || /^\d+$/.test(text)) {
        return { text, detectedLang: from, usedService: "NONE" };
      }
      if (from !== "auto" && from === to) {
        return { text, detectedLang: from, usedService: "SAME_LANG" };
      }
      let apis = [];
      if (useFreeMode) {
        apis = [
          { name: "googleFree", func: TranslateProvider.googleFree },
          { name: "myMemory", func: TranslateProvider.myMemory },
          { name: "libre", func: TranslateProvider.libre }
        ];
      } else {
        if (provider === "google" && apiKeys.googleKey) apis.push({ name: "googlePaid", func: TranslateProvider.googlePaid, key: apiKeys.googleKey });
        if (provider === "azure" && apiKeys.azureKey) apis.push({ name: "azure", func: TranslateProvider.azure, key: apiKeys.azureKey });
        if (apis.length === 0) {
          if (apiKeys.googleKey) apis.push({ name: "googlePaid", func: TranslateProvider.googlePaid, key: apiKeys.googleKey });
          if (apiKeys.azureKey) apis.push({ name: "azure", func: TranslateProvider.azure, key: apiKeys.azureKey });
        }
        apis.push({ name: "googleFree", func: TranslateProvider.googleFree });
        apis.push({ name: "myMemory", func: TranslateProvider.myMemory });
        apis.push({ name: "libre", func: TranslateProvider.libre });
      }
      for (let api of apis) {
        try {
          const result = api.key ? await api.func(text, from, to, api.key) : await api.func(text, from, to);
          if (result && typeof result === "object" && result.text && result.text !== text && result.text.length > 0) {
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

  // src/background/aiService.js
  var GeminiAI = /* @__PURE__ */ (() => {
    const getLanguageName = (code) => {
      const langMap = {
        "id": "Indonesian",
        "en": "English",
        "ms": "Malay",
        "ja": "Japanese",
        "zh": "Chinese",
        "zh-TW": "Traditional Chinese",
        "ar": "Arabic",
        "fr": "French",
        "de": "German",
        "es": "Spanish",
        "ru": "Russian",
        "ko": "Korean",
        "th": "Thai",
        "vi": "Vietnamese",
        "hi": "Hindi",
        "pt": "Portuguese",
        "it": "Italian",
        "nl": "Dutch",
        "sv": "Swedish",
        "no": "Norwegian",
        "da": "Danish",
        "fi": "Finnish",
        "pl": "Polish",
        "tr": "Turkish",
        "he": "Hebrew",
        "cs": "Czech",
        "hu": "Hungarian",
        "ro": "Romanian",
        "bg": "Bulgarian",
        "hr": "Croatian",
        "sk": "Slovak",
        "sl": "Slovenian",
        "et": "Estonian",
        "lv": "Latvian",
        "lt": "Lithuanian",
        "uk": "Ukrainian",
        "be": "Belarusian",
        "is": "Icelandic",
        "ga": "Irish",
        "mt": "Maltese",
        "cy": "Welsh",
        "eu": "Basque",
        "ca": "Catalan",
        "gl": "Galician",
        "af": "Afrikaans",
        "sq": "Albanian",
        "am": "Amharic",
        "hy": "Armenian",
        "az": "Azerbaijani",
        "bn": "Bengali",
        "bs": "Bosnian",
        "ceb": "Cebuano",
        "ny": "Chichewa",
        "co": "Corsican",
        "eo": "Esperanto",
        "tl": "Filipino",
        "fy": "Frisian",
        "ka": "Georgian",
        "el": "Greek",
        "gu": "Gujarati",
        "ht": "Haitian Creole",
        "ha": "Hausa",
        "haw": "Hawaiian",
        "iw": "Hebrew",
        "hmn": "Hmong",
        "ig": "Igbo",
        "jw": "Javanese",
        "kn": "Kannada",
        "kk": "Kazakh",
        "km": "Khmer",
        "rw": "Kinyarwanda",
        "ky": "Kyrgyz",
        "lo": "Lao",
        "la": "Latin",
        "lb": "Luxembourgish",
        "mk": "Macedonian",
        "mg": "Malagasy",
        "ml": "Malayalam",
        "mi": "Maori",
        "mr": "Marathi",
        "mn": "Mongolian",
        "my": "Myanmar",
        "ne": "Nepali",
        "ps": "Pashto",
        "fa": "Persian",
        "pa": "Punjabi",
        "sm": "Samoan",
        "gd": "Scots Gaelic",
        "sr": "Serbian",
        "st": "Sesotho",
        "sn": "Shona",
        "sd": "Sindhi",
        "si": "Sinhala",
        "so": "Somali",
        "su": "Sundanese",
        "sw": "Swahili",
        "tg": "Tajik",
        "ta": "Tamil",
        "tt": "Tatar",
        "te": "Telugu",
        "uz": "Uzbek",
        "xh": "Xhosa",
        "yi": "Yiddish",
        "yo": "Yoruba",
        "zu": "Zulu"
      };
      return langMap[code] || "English";
    };
    async function makeRequest(prompt, key) {
      try {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
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
                      text: prompt
                    }
                  ]
                }
              ]
            })
          }
        );
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API Error: ${res.status} - ${errorText}`);
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (error) {
        console.error("Gemini AI request failed:", error);
        return null;
      }
    }
    async function summarize(text, key, targetLang = "id") {
      const langName = getLanguageName(targetLang);
      const prompt = `Create a brief and easy-to-understand summary of the following text in ${langName}:

${text}`;
      return await makeRequest(prompt, key);
    }
    async function analyze(text, key, targetLang = "id") {
      const langName = getLanguageName(targetLang);
      const prompt = `Analyze the following text in ${langName}. Provide results including: sentiment, readability level, and main themes.

Text:
${text}`;
      return await makeRequest(prompt, key);
    }
    async function keywords(text, key, targetLang = "id") {
      const langName = getLanguageName(targetLang);
      const prompt = `From the following text, extract 10 most important keywords in ${langName} (only words/phrases, separated by commas):

${text}`;
      return await makeRequest(prompt, key);
    }
    return { summarize, analyze, keywords };
  })();

  // src/background/main.js
  console.log("WebLang background script starting...");
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background received message:", message.type);
    (async () => {
      try {
        if ((message.type === "TRANSLATE_TEXT" || message.type === "TRANSLATE_BATCH") && RateLimiter.isLimited()) {
          console.log("Rate limited request");
          sendResponse({ success: false, error: "Rate limited! Coba lagi sebentar lagi." });
          return;
        }
        const apiKeys = await StorageUtils.get(["googleKey", "azureKey", "geminiKey", "provider", "rateLimit", "useFreeMode"]);
        const provider = apiKeys.provider || "google";
        if (message.action === "testAPI") {
          let result = await UniversalTranslator.translate({
            text: "Hello world",
            from: "en",
            to: "id",
            provider,
            apiKeys,
            useFreeMode: false
          });
          if (result && result.text && result.text !== "Hello world") {
            sendResponse({ success: true, result: result.text });
          } else {
            sendResponse({ success: false, error: "API returned empty or unchanged result" });
          }
          return;
        }
        if (message.type === "TRANSLATE_TEXT") {
          console.log("Processing TRANSLATE_TEXT request for:", message.text.substring(0, 30));
          const t = await UniversalTranslator.translate({
            text: message.text,
            from: message.from,
            to: message.to,
            provider,
            apiKeys,
            useFreeMode: apiKeys.useFreeMode !== false
            // Default to free mode
          });
          if (t && t.text) {
            console.log("Translation successful:", t.text.substring(0, 50));
            sendResponse({ success: true, translation: t.text, detectedLang: t.detectedLang });
          } else {
            console.log("Translation failed, using fallback");
            sendResponse({ success: false, error: "Translation failed", translation: message.text });
          }
          return;
        }
        if (message.type === "TRANSLATE_BATCH") {
          const t = await UniversalTranslator.translate({
            text: message.text,
            from: message.from,
            to: message.to,
            provider,
            apiKeys,
            useFreeMode: apiKeys.useFreeMode
          });
          if (t && t.text) {
            sendResponse({ success: true, translations: t.text, detectedLang: t.detectedLang, count: message.count });
          } else {
            sendResponse({ success: false, error: "Batch translation failed", translations: message.text });
          }
          return;
        }
        if (message.type === "AI_SUMMARIZE") {
          const geminiKey = apiKeys.geminiKey;
          if (!geminiKey) {
            sendResponse({ success: false, error: "Gemini API key not configured" });
            return;
          }
          const result = await GeminiAI.summarize(message.text, geminiKey, message.targetLang || "id");
          if (result) {
            sendResponse({ success: true, result });
          } else {
            sendResponse({ success: false, error: "AI summarization failed" });
          }
          return;
        }
        if (message.type === "AI_ANALYZE") {
          const geminiKey = apiKeys.geminiKey;
          if (!geminiKey) {
            sendResponse({ success: false, error: "Gemini API key not configured" });
            return;
          }
          const result = await GeminiAI.analyze(message.text, geminiKey, message.targetLang || "id");
          if (result) {
            sendResponse({ success: true, result });
          } else {
            sendResponse({ success: false, error: "AI analysis failed" });
          }
          return;
        }
        if (message.type === "AI_KEYWORDS") {
          const geminiKey = apiKeys.geminiKey;
          if (!geminiKey) {
            sendResponse({ success: false, error: "Gemini API key not configured" });
            return;
          }
          const result = await GeminiAI.keywords(message.text, geminiKey, message.targetLang || "id");
          if (result) {
            sendResponse({ success: true, result });
          } else {
            sendResponse({ success: false, error: "AI keyword extraction failed" });
          }
          return;
        }
        if (message.type === "EXPORT_AI_PDF") {
          try {
            const ok = await ExportUtils.doExport({
              fileType: "pdf",
              content: message.content,
              filename: `weblang-ai-result-${Date.now()}`,
              title: message.title || "WebLang AI Result"
            });
            sendResponse({ success: ok });
          } catch (e) {
            console.error("AI PDF export error:", e);
            sendResponse({ success: false, error: e.message });
          }
          return;
        }
        if (message.type === "EXPORT_CONTENT") {
          const ok = await ExportUtils.doExport({
            fileType: message.fileType,
            content: message.content,
            filename: "ai-analysis-result"
          });
          sendResponse({ success: ok });
          return;
        }
        if (message.type === "EXPORT_TRANSLATION") {
          try {
            const ok = await ExportUtils.exportTranslation(message);
            sendResponse({ success: ok });
          } catch (e) {
            console.error("Export translation error:", e);
            sendResponse({ success: false, error: e.message || "Export failed" });
          }
          return;
        }
        console.log("Unknown message type:", message.type);
        sendResponse({ success: false, error: "Unknown request type." });
      } catch (e) {
        console.error("Background script error:", e);
        sendResponse({ success: false, error: "Internal error occurred: " + e.message });
      }
    })();
    return true;
  });
  console.log("WebLang background script ready");
})();
//# sourceMappingURL=background.js.map
