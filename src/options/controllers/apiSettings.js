import { sendToBackground } from '../../popup/utils/messaging.js';
import {
  DEFAULT_GEMINI_TTS_VOICE,
  GEMINI_TTS_VOICES,
  normalizeGeminiTtsVoice
} from '../../common/geminiTts.js';

export function createApiSettingsController({ message }) {
  const googleKeyInput = document.getElementById('googleKey');
  const azureKeyInput = document.getElementById('azureKey');
  const geminiKeyInput = document.getElementById('geminiKey');
  const enableAiServiceInput = document.getElementById('enableAiService');
  const enableGeminiTtsInput = document.getElementById('enableGeminiTts');
  const geminiModelInput = document.getElementById('geminiModel');
  const geminiTtsVoiceInput = document.getElementById('geminiTtsVoice');
  const providerSelect = document.getElementById('provider');
  const useFreeMode = document.getElementById('useFreeMode');
  const quickTranslateEnabled = document.getElementById('quickTranslateEnabled');
  const apiSection = document.getElementById('apiSection');

  function populateGeminiVoiceOptions() {
    if (!geminiTtsVoiceInput || geminiTtsVoiceInput.options.length > 0) {
      return;
    }

    for (const voice of GEMINI_TTS_VOICES) {
      const option = document.createElement('option');
      option.value = voice.value;
      option.textContent = voice.label;
      geminiTtsVoiceInput.appendChild(option);
    }
  }

  function toggleApiSection() {
    const disabled = useFreeMode?.checked;
    if (!apiSection) return;

    apiSection.style.opacity = disabled ? '0.5' : '1';
    apiSection.style.pointerEvents = disabled ? 'none' : 'auto';
  }

  function toggleGeminiFields() {
    const aiEnabled = enableAiServiceInput?.checked !== false;
    const ttsEnabled = enableGeminiTtsInput?.checked !== false;

    if (geminiModelInput) {
      geminiModelInput.disabled = !aiEnabled;
      geminiModelInput.style.opacity = aiEnabled ? '1' : '0.6';
    }

    if (geminiTtsVoiceInput) {
      geminiTtsVoiceInput.disabled = !ttsEnabled;
      geminiTtsVoiceInput.style.opacity = ttsEnabled ? '1' : '0.6';
    }
  }

  async function testApi(apiType) {
    const isAzure = apiType === 'azure';
    const serviceName = isAzure ? 'Azure Translator' : 'Google Translate';
    const apiKey = (isAzure ? azureKeyInput?.value : googleKeyInput?.value)?.trim();

    if (!apiKey) {
      message.show(`Please enter ${serviceName} API key first`, 'error');
      return;
    }

    message.show(`Testing ${serviceName}...`, 'info');
    const response = await sendToBackground({ action: 'testAPI', apiType, apiKey });

    if (response?.success) {
      message.show(`${serviceName} API works! Result: "${response.result}"`, 'success');
      return;
    }

    message.show(`${serviceName} API failed: ${response?.error || 'Unknown error'}`, 'error');
  }

  function hydrate(settings) {
    populateGeminiVoiceOptions();
    if (googleKeyInput) googleKeyInput.value = settings.googleKey || '';
    if (azureKeyInput) azureKeyInput.value = settings.azureKey || '';
    if (geminiKeyInput) geminiKeyInput.value = settings.geminiKey || '';
    if (enableAiServiceInput) enableAiServiceInput.checked = settings.enableAiService !== false;
    if (enableGeminiTtsInput) enableGeminiTtsInput.checked = settings.enableGeminiTts !== false;
    if (geminiModelInput) geminiModelInput.value = settings.geminiModel || '';
    if (geminiTtsVoiceInput) geminiTtsVoiceInput.value = normalizeGeminiTtsVoice(settings.geminiTtsVoice || DEFAULT_GEMINI_TTS_VOICE);
    if (providerSelect) providerSelect.value = settings.provider || 'google';
    if (useFreeMode) useFreeMode.checked = !!settings.useFreeMode;
    if (quickTranslateEnabled) quickTranslateEnabled.checked = settings.quickTranslateEnabled !== false;
    toggleApiSection();
    toggleGeminiFields();
  }

  function collect() {
    return {
      googleKey: googleKeyInput?.value.trim() || '',
      azureKey: azureKeyInput?.value.trim() || '',
      geminiKey: geminiKeyInput?.value.trim() || '',
      enableAiService: enableAiServiceInput?.checked !== false,
      enableGeminiTts: enableGeminiTtsInput?.checked !== false,
      geminiModel: geminiModelInput?.value.trim() || '',
      geminiTtsVoice: normalizeGeminiTtsVoice(geminiTtsVoiceInput?.value || DEFAULT_GEMINI_TTS_VOICE),
      provider: providerSelect?.value || 'google',
      useFreeMode: !!useFreeMode?.checked,
      quickTranslateEnabled: quickTranslateEnabled?.checked !== false
    };
  }

  function bindEvents() {
    useFreeMode?.addEventListener('change', toggleApiSection);
    enableAiServiceInput?.addEventListener('change', toggleGeminiFields);
    enableGeminiTtsInput?.addEventListener('change', toggleGeminiFields);
    document.getElementById('testGoogleBtn')?.addEventListener('click', () => testApi('google'));
    document.getElementById('testAzureBtn')?.addEventListener('click', () => testApi('azure'));
  }

  return {
    hydrate,
    collect,
    bindEvents
  };
}
