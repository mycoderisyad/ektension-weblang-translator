// TTS (Text-to-Speech) Module — Inspired by XTranslate
// Multi-layer: Google TTS audio → SpeechSynthesis fallback

export const TTS = (() => {
  let currentAudio = null;
  let currentUtterance = null;
  const TTS_MAX_LENGTH = 200; // Google TTS limit per segment

  // Get system TTS voices
  async function getVoices() {
    return new Promise((resolve) => {
      const voices = speechSynthesis.getVoices();
      if (voices.length) {
        resolve(voices);
      } else {
        speechSynthesis.onvoiceschanged = () => {
          resolve(speechSynthesis.getVoices());
        };
      }
    });
  }

  // Speak using SpeechSynthesis API (fallback)
  async function speakSynthesis(text, lang, rate = 0.85) {
    stop(); // Stop any active speech
    
    const voices = await getVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find a voice matching the language
    const matchingVoice = voices.find(v => v.lang.startsWith(lang)) ||
                          voices.find(v => v.lang.startsWith('en'));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }
    
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    currentUtterance = utterance;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    
    return new Promise((resolve, reject) => {
      utterance.onend = () => {
        currentUtterance = null;
        resolve();
      };
      utterance.onerror = (e) => {
        currentUtterance = null;
        reject(e);
      };
    });
  }

  // Split text for Google TTS (max ~200 chars per segment)
  function splitForTTS(text, maxLen = TTS_MAX_LENGTH) {
    if (text.length <= maxLen) return [text];
    
    const segments = [];
    // Try to split by sentences
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    let buffer = '';
    
    for (const sentence of sentences) {
      if ((buffer + sentence).length <= maxLen) {
        buffer += sentence;
      } else {
        if (buffer) segments.push(buffer.trim());
        // If single sentence is too long, split by words
        if (sentence.length > maxLen) {
          const words = sentence.split(' ');
          buffer = '';
          for (const word of words) {
            if ((buffer + ' ' + word).length <= maxLen) {
              buffer += (buffer ? ' ' : '') + word;
            } else {
              if (buffer) segments.push(buffer.trim());
              buffer = word;
            }
          }
        } else {
          buffer = sentence;
        }
      }
    }
    if (buffer) segments.push(buffer.trim());
    return segments.filter(s => s.length > 0);
  }

  // Play Google TTS audio
  async function playGoogleTTS(text, lang) {
    const segments = splitForTTS(text);
    
    for (const segment of segments) {
      const encodedText = encodeURIComponent(segment);
      const url = `https://translate.google.com/translate_tts?client=tw-ob&ie=UTF-8&tl=${lang}&q=${encodedText}`;
      
      await new Promise((resolve, reject) => {
        const audio = new Audio(url);
        currentAudio = audio;
        
        audio.onended = () => {
          currentAudio = null;
          resolve();
        };
        audio.onerror = (e) => {
          currentAudio = null;
          reject(e);
        };
        
        audio.play().catch(reject);
      });
    }
  }

  // Main speak function — tries Google TTS first, falls back to SpeechSynthesis
  async function speak(text, lang = 'en') {
    if (!text || text.trim().length === 0) return;
    
    stop(); // Stop any active speech
    
    try {
      // Try Google TTS first (better quality)
      await playGoogleTTS(text, lang);
    } catch (err) {
      console.warn('[TTS] Google TTS failed, falling back to SpeechSynthesis:', err);
      try {
        await speakSynthesis(text, lang);
      } catch (synthErr) {
        console.error('[TTS] SpeechSynthesis also failed:', synthErr);
      }
    }
  }

  // Stop all active speech
  function stop() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (currentUtterance) {
      speechSynthesis.cancel();
      currentUtterance = null;
    }
  }

  // Check if currently speaking
  function isSpeaking() {
    const audioPlaying = currentAudio && !currentAudio.paused && !currentAudio.ended;
    return audioPlaying || speechSynthesis.speaking;
  }

  // Toggle pause/resume
  function togglePause() {
    if (currentAudio) {
      if (currentAudio.paused) {
        currentAudio.play();
      } else {
        currentAudio.pause();
      }
    } else {
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
      } else {
        speechSynthesis.pause();
      }
    }
  }

  return {
    speak,
    stop,
    isSpeaking,
    togglePause,
    getVoices,
  };
})();
