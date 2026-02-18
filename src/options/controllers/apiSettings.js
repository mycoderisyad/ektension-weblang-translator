function sendMessage(payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: 'No response' });
      });
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
}

export function createApiSettingsController({ message }) {
  const googleKeyInput = document.getElementById('googleKey');
  const azureKeyInput = document.getElementById('azureKey');
  const geminiKeyInput = document.getElementById('geminiKey');
  const providerSelect = document.getElementById('provider');
  const useFreeMode = document.getElementById('useFreeMode');
  const quickTranslateEnabled = document.getElementById('quickTranslateEnabled');
  const apiSection = document.getElementById('apiSection');

  function toggleApiSection() {
    const disabled = useFreeMode?.checked;
    if (!apiSection) return;

    apiSection.style.opacity = disabled ? '0.5' : '1';
    apiSection.style.pointerEvents = disabled ? 'none' : 'auto';
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
    const response = await sendMessage({ action: 'testAPI', apiType, apiKey });

    if (response?.success) {
      message.show(`${serviceName} API works! Result: "${response.result}"`, 'success');
      return;
    }

    message.show(`${serviceName} API failed: ${response?.error || 'Unknown error'}`, 'error');
  }

  function hydrate(settings) {
    if (googleKeyInput) googleKeyInput.value = settings.googleKey || '';
    if (azureKeyInput) azureKeyInput.value = settings.azureKey || '';
    if (geminiKeyInput) geminiKeyInput.value = settings.geminiKey || '';
    if (providerSelect) providerSelect.value = settings.provider || 'google';
    if (useFreeMode) useFreeMode.checked = !!settings.useFreeMode;
    if (quickTranslateEnabled) quickTranslateEnabled.checked = settings.quickTranslateEnabled !== false;
    toggleApiSection();
  }

  function collect() {
    return {
      googleKey: googleKeyInput?.value.trim() || '',
      azureKey: azureKeyInput?.value.trim() || '',
      geminiKey: geminiKeyInput?.value.trim() || '',
      provider: providerSelect?.value || 'google',
      useFreeMode: !!useFreeMode?.checked,
      quickTranslateEnabled: quickTranslateEnabled?.checked !== false
    };
  }

  function bindEvents() {
    useFreeMode?.addEventListener('change', toggleApiSection);
    document.getElementById('testGoogleBtn')?.addEventListener('click', () => testApi('google'));
    document.getElementById('testAzureBtn')?.addEventListener('click', () => testApi('azure'));
  }

  return {
    hydrate,
    collect,
    bindEvents
  };
}
