import { StorageUtils } from '../common/storage.js';

export const TTS = (() => {
  let currentAudio = null;
  let currentAudioUrl = null;
  let currentUtterance = null;
  let activeSessionId = 0;
  let pendingSegmentResolver = null;
  const GEMINI_TTS_MAX_LENGTH = 1000;

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

  async function speakSynthesis(text, lang, rate = 0.85) {
    const voices = await getVoices();
    const utterance = new SpeechSynthesisUtterance(text);
    const matchingVoice = voices.find((voice) => voice.lang.startsWith(lang)) ||
      voices.find((voice) => voice.lang.startsWith('en'));

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
      utterance.onerror = (event) => {
        currentUtterance = null;
        reject(event);
      };
    });
  }

  function splitForTTS(text, maxLen = GEMINI_TTS_MAX_LENGTH) {
    if (text.length <= maxLen) return [text];

    const segments = [];
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    let buffer = '';

    for (const sentence of sentences) {
      if ((buffer + sentence).length <= maxLen) {
        buffer += sentence;
        continue;
      }

      if (buffer) {
        segments.push(buffer.trim());
      }

      if (sentence.length > maxLen) {
        const words = sentence.split(' ');
        buffer = '';

        for (const word of words) {
          const candidate = buffer ? `${buffer} ${word}` : word;
          if (candidate.length <= maxLen) {
            buffer = candidate;
          } else {
            if (buffer) {
              segments.push(buffer.trim());
            }
            buffer = word;
          }
        }
      } else {
        buffer = sentence;
      }
    }

    if (buffer) {
      segments.push(buffer.trim());
    }

    return segments.filter((segment) => segment.length > 0);
  }

  async function getTtsConfig() {
    const settings = await StorageUtils.get(['geminiKey', 'enableGeminiTts']);
    return {
      hasGeminiKey: !!settings.geminiKey?.trim() && settings.enableGeminiTts !== false
    };
  }

  async function requestGeminiAudio(text, lang) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: 'GENERATE_TTS', text, lang }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response?.success) {
            reject(new Error(response?.error || 'Gemini TTS failed'));
            return;
          }

          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  function writeAscii(view, offset, value) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  function buildWavBlob(audioBase64, { sampleRate = 24000, channelCount = 1, bitsPerSample = 16 } = {}) {
    const pcmBytes = base64ToUint8Array(audioBase64);
    const byteRate = sampleRate * channelCount * (bitsPerSample / 8);
    const blockAlign = channelCount * (bitsPerSample / 8);
    const wavBuffer = new ArrayBuffer(44 + pcmBytes.length);
    const view = new DataView(wavBuffer);

    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmBytes.length, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, pcmBytes.length, true);

    new Uint8Array(wavBuffer, 44).set(pcmBytes);

    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  function cleanupCurrentAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }

    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
  }

  async function playAudioBlob(audioBlob, sessionId) {
    const audioUrl = URL.createObjectURL(audioBlob);

    return new Promise((resolve, reject) => {
      if (sessionId !== activeSessionId) {
        URL.revokeObjectURL(audioUrl);
        resolve();
        return;
      }

      const audio = new Audio(audioUrl);
      currentAudio = audio;
      currentAudioUrl = audioUrl;
      let settled = false;

      const finish = (callback) => {
        if (settled) {
          return;
        }
        settled = true;
        pendingSegmentResolver = null;
        cleanupCurrentAudio();
        callback();
      };

      pendingSegmentResolver = () => {
        finish(resolve);
      };

      audio.onended = () => {
        finish(resolve);
      };

      audio.onerror = () => {
        finish(() => reject(new Error('Audio playback failed')));
      };

      audio.play().catch((error) => {
        finish(() => reject(error));
      });
    });
  }

  async function playGeminiTTS(text, lang, sessionId) {
    const segments = splitForTTS(text);

    for (const segment of segments) {
      if (sessionId !== activeSessionId) {
        return;
      }

      const response = await requestGeminiAudio(segment, lang);
      if (sessionId !== activeSessionId) {
        return;
      }

      const audioBlob = buildWavBlob(response.audioBase64, {
        sampleRate: response.sampleRate,
        channelCount: response.channelCount,
        bitsPerSample: response.bitsPerSample
      });

      await playAudioBlob(audioBlob, sessionId);
    }
  }

  async function speak(text, lang = 'en') {
    if (!text || text.trim().length === 0) return;

    stop();
    const sessionId = activeSessionId;
    const { hasGeminiKey } = await getTtsConfig();

    if (sessionId !== activeSessionId) {
      return;
    }

    if (!hasGeminiKey) {
      await speakSynthesis(text, lang);
      return;
    }

    try {
      await playGeminiTTS(text, lang, sessionId);
    } catch (error) {
      if (sessionId !== activeSessionId) {
        return;
      }

      console.warn('[TTS] Gemini TTS failed, falling back to SpeechSynthesis:', error);
      await speakSynthesis(text, lang);
    }
  }

  function stop() {
    activeSessionId += 1;

    if (pendingSegmentResolver) {
      const resolveSegment = pendingSegmentResolver;
      pendingSegmentResolver = null;
      resolveSegment();
    }

    cleanupCurrentAudio();

    if (speechSynthesis.speaking || speechSynthesis.pending || speechSynthesis.paused || currentUtterance) {
      speechSynthesis.cancel();
      currentUtterance = null;
    }
  }

  function isSpeaking() {
    const audioPlaying = !!currentAudio && !currentAudio.paused && !currentAudio.ended;
    return audioPlaying || speechSynthesis.speaking;
  }

  function togglePause() {
    if (currentAudio) {
      if (currentAudio.paused) {
        currentAudio.play().catch(() => {});
      } else {
        currentAudio.pause();
      }
      return;
    }

    if (speechSynthesis.paused) {
      speechSynthesis.resume();
    } else {
      speechSynthesis.pause();
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
