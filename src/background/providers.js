export const TranslateProvider = (() => {
  async function googlePaid(text, from, to, key) {
    try {
      const body = { q: text, target: to, format: 'text' };
      if (from !== 'auto') body.source = from;
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return {
        text: data.data?.translations?.[0]?.translatedText,
        detectedLang: data.data?.translations?.[0]?.detectedSourceLanguage || from,
        usedService: 'GOOGLE',
      };
    } catch {
      return null;
    }
  }

  async function googleFree(text, from, to) {
    const endpoints = [
      'https://translate.googleapis.com/translate_a/single',
      'https://clients5.google.com/translate_a/single',
      'https://translate.google.com/translate_a/single',
    ];
    for (let endpoint of endpoints) {
      try {
        const params = new URLSearchParams({ client: 'gtx', sl: from === 'auto' ? 'auto' : from, tl: to, dt: 't', q: text });
        const url = `${endpoint}?${params.toString()}`;
        const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*', Referer: 'https://translate.google.com/' } });
        if (!res.ok) continue;
        const data = await res.json();
        const translatedText = Array.isArray(data[0]) ? data[0].map((i) => i[0]).join('') : '';
        const detectedLang = (data[2] && data[2]) || (data[8] && data[8][0][0]) || from;
        if (translatedText && translatedText !== text) {
          return { text: translatedText.trim(), detectedLang: detectedLang || from, usedService: 'GOOGLEFREE' };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  // Batch Google Translate — sends multiple texts in one request (like XTranslate's translateMany)
  // Uses /translate_a/t endpoint with multiple 'q' parameters via POST
  async function googleFreeBatch(texts, from, to) {
    const endpoints = [
      'https://translate.googleapis.com/translate_a/t',
      'https://clients5.google.com/translate_a/t',
    ];
    
    for (const endpoint of endpoints) {
      try {
        const queryParams = new URLSearchParams({
          client: 'gtx',
          sl: from === 'auto' ? 'auto' : from,
          tl: to,
        });
        
        const bodyParams = new URLSearchParams(
          texts.map(text => ['q', text])
        );
        
        const url = `${endpoint}?${queryParams.toString()}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0',
            'Accept': '*/*',
          },
          body: bodyParams.toString(),
        });
        
        if (!res.ok) continue;
        const data = await res.json();
        
        let translations = [];
        if (from === 'auto') {
          // Response format: [[text, locale], ...]
          if (Array.isArray(data)) {
            translations = data.map(item => {
              if (Array.isArray(item)) return item[0];
              if (typeof item === 'string') return item;
              return null;
            });
          }
        } else {
          // Response format: [text, ...]
          if (Array.isArray(data)) {
            translations = data.map(item => {
              if (typeof item === 'string') return item;
              if (Array.isArray(item)) return item[0];
              return null;
            });
          }
        }
        
        if (translations.length > 0 && translations.some(t => t)) {
          return translations;
        }
      } catch (err) {
        console.error('[Providers] Batch translate error:', err);
        continue;
      }
    }
    return null;
  }

  async function azure(text, from, to, key, region = 'southeastasia') {
    try {
      let query = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${to}`;
      if (from !== 'auto') query += `&from=${from}`;
      const res = await fetch(query, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Ocp-Apim-Subscription-Region': region,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ Text: text }]),
      });
      const data = await res.json();
      return { text: data[0]?.translations?.[0]?.text, detectedLang: data[0]?.detectedLanguage?.language || from, usedService: 'AZURE' };
    } catch {
      return null;
    }
  }

  async function myMemory(text, from, to) {
    try {
      if (from === 'auto') return null;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${`${from}|${to}`}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.responseStatus && Number(data.responseStatus) !== 200) return null;
      const translation = data.responseData?.translatedText;
      const isApiErrorText = typeof translation === 'string' && /INVALID SOURCE LANGUAGE|EXAMPLE: LANGPAIR/i.test(translation);
      if (isApiErrorText) return null;
      const detectedLang = data.responseData.match?.lang || from;
      if (translation && translation !== text && translation.length > 0) {
        return { text: translation, detectedLang, usedService: 'MYMEMORY' };
      }
      return null;
    } catch {
      return null;
    }
  }

  async function libre(text, from, to) {
    try {
      const res = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ q: text, source: from === 'auto' ? 'auto' : from, target: to, format: 'text' }),
      });
      const data = await res.json();
      if (data && data.translatedText) return { text: data.translatedText, detectedLang: from, usedService: 'LIBRE' };
      return null;
    } catch {
      return null;
    }
  }

  return { googlePaid, googleFree, googleFreeBatch, azure, myMemory, libre };
})();


