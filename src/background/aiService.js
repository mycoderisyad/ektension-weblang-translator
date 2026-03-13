// AI Service with Gemini for dynamic language analysis
const GeminiAI = (() => {
  
  // Language mapping for prompts
  const getLanguageName = (code) => {
    const langMap = {
      'id': 'Indonesian',
      'en': 'English', 
      'ms': 'Malay',
      'ja': 'Japanese',
      'zh': 'Chinese',
      'zh-TW': 'Traditional Chinese',
      'ar': 'Arabic',
      'fr': 'French',
      'de': 'German',
      'es': 'Spanish',
      'ru': 'Russian',
      'ko': 'Korean',
      'th': 'Thai',
      'vi': 'Vietnamese',
      'hi': 'Hindi',
      'pt': 'Portuguese',
      'it': 'Italian',
      'nl': 'Dutch',
      'sv': 'Swedish',
      'no': 'Norwegian',
      'da': 'Danish',
      'fi': 'Finnish',
      'pl': 'Polish',
      'tr': 'Turkish',
      'he': 'Hebrew',
      'cs': 'Czech',
      'hu': 'Hungarian',
      'ro': 'Romanian',
      'bg': 'Bulgarian',
      'hr': 'Croatian',
      'sk': 'Slovak',
      'sl': 'Slovenian',
      'et': 'Estonian',
      'lv': 'Latvian',
      'lt': 'Lithuanian',
      'uk': 'Ukrainian',
      'be': 'Belarusian',
      'is': 'Icelandic',
      'ga': 'Irish',
      'mt': 'Maltese',
      'cy': 'Welsh',
      'eu': 'Basque',
      'ca': 'Catalan',
      'gl': 'Galician',
      'af': 'Afrikaans',
      'sq': 'Albanian',
      'am': 'Amharic',
      'hy': 'Armenian',
      'az': 'Azerbaijani',
      'bn': 'Bengali',
      'bs': 'Bosnian',
      'ceb': 'Cebuano',
      'ny': 'Chichewa',
      'co': 'Corsican',
      'eo': 'Esperanto',
      'tl': 'Filipino',
      'fy': 'Frisian',
      'ka': 'Georgian',
      'el': 'Greek',
      'gu': 'Gujarati',
      'ht': 'Haitian Creole',
      'ha': 'Hausa',
      'haw': 'Hawaiian',
      'iw': 'Hebrew',
      'hmn': 'Hmong',
      'ig': 'Igbo',
      'jw': 'Javanese',
      'kn': 'Kannada',
      'kk': 'Kazakh',
      'km': 'Khmer',
      'rw': 'Kinyarwanda',
      'ky': 'Kyrgyz',
      'lo': 'Lao',
      'la': 'Latin',
      'lb': 'Luxembourgish',
      'mk': 'Macedonian',
      'mg': 'Malagasy',
      'ml': 'Malayalam',
      'mi': 'Maori',
      'mr': 'Marathi',
      'mn': 'Mongolian',
      'my': 'Myanmar',
      'ne': 'Nepali',
      'ps': 'Pashto',
      'fa': 'Persian',
      'pa': 'Punjabi',
      'sm': 'Samoan',
      'gd': 'Scots Gaelic',
      'sr': 'Serbian',
      'st': 'Sesotho',
      'sn': 'Shona',
      'sd': 'Sindhi',
      'si': 'Sinhala',
      'so': 'Somali',
      'su': 'Sundanese',
      'sw': 'Swahili',
      'tg': 'Tajik',
      'ta': 'Tamil',
      'tt': 'Tatar',
      'te': 'Telugu',
      'uz': 'Uzbek',
      'xh': 'Xhosa',
      'yi': 'Yiddish',
      'yo': 'Yoruba',
      'zu': 'Zulu'
    };
    return langMap[code] || 'English';
  };

  async function makeRequest(prompt, key, model) {
    const modelName = model || 'gemini-2.5-flash-lite';
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
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
                    text: prompt,
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
      console.error('Gemini AI request failed:', error);
      return null;
    }
  }

  async function summarize(text, key, targetLang = 'id', model) {
    const langName = getLanguageName(targetLang);
    const prompt = `Create a brief and easy-to-understand summary of the following text in ${langName}:\n\n${text}`;
    return await makeRequest(prompt, key, model);
  }
  
  async function analyze(text, key, targetLang = 'id', model) {
    const langName = getLanguageName(targetLang);
    const prompt = `Analyze the following text in ${langName}. Provide results including: sentiment, readability level, and main themes.\n\nText:\n${text}`;
    return await makeRequest(prompt, key, model);
  }
  
  async function keywords(text, key, targetLang = 'id', model) {
    const langName = getLanguageName(targetLang);
    const prompt = `From the following text, extract 10 most important keywords in ${langName} (only words/phrases, separated by commas):\n\n${text}`;
    return await makeRequest(prompt, key, model);
  }
  
  return { summarize, analyze, keywords };
})();

export { GeminiAI };
