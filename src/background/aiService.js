import {
  DEFAULT_GEMINI_TTS_VOICE,
  GEMINI_TTS_MODEL,
  normalizeGeminiTtsVoice
} from '../common/geminiTts.js';

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

  async function makeJsonRequest(modelName, key, body) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-goog-api-key": key
          },
          body: JSON.stringify(body),
        }
      );
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} - ${errorText}`);
      }
      
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Gemini AI request failed:', error);
      return null;
    }
  }

  async function makeRequest(prompt, key, model) {
    const modelName = model || 'gemini-2.5-flash-lite';
    const data = await makeJsonRequest(modelName, key, {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    });
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  function extractAudioPayload(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((part) => part.inlineData?.data);

    if (!audioPart?.inlineData?.data) {
      return null;
    }

    const mimeType = audioPart.inlineData.mimeType || 'audio/L16;rate=24000';
    const rateMatch = mimeType.match(/rate=(\d+)/i);

    return {
      audioBase64: audioPart.inlineData.data,
      mimeType,
      sampleRate: rateMatch ? Number(rateMatch[1]) : 24000,
      channelCount: 1,
      bitsPerSample: 16
    };
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

  async function generateSpeech(text, key, targetLang = 'en', voice = DEFAULT_GEMINI_TTS_VOICE) {
    const langName = getLanguageName(targetLang);
    const selectedVoice = normalizeGeminiTtsVoice(voice);
    const prompt = `Read the following text exactly as written in ${langName}. Do not add, remove, or translate anything.\n\n${text}`;
    const data = await makeJsonRequest(GEMINI_TTS_MODEL, key, {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: selectedVoice
            }
          }
        }
      }
    });

    return extractAudioPayload(data);
  }
  
  return { summarize, analyze, keywords, generateSpeech };
})();

export { GeminiAI };
