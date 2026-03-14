export const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
export const DEFAULT_GEMINI_TTS_VOICE = 'Kore';
export const GEMINI_TTS_VOICES = [
  { value: 'Kore', label: 'Kore' },
  { value: 'Achird', label: 'Achird' },
  { value: 'Puck', label: 'Puck' }
];

export function normalizeGeminiTtsVoice(value) {
  const match = GEMINI_TTS_VOICES.find((voice) => voice.value === value);
  return match?.value || DEFAULT_GEMINI_TTS_VOICE;
}
