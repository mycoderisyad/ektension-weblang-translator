import { StorageUtils } from '../../common/storage.js';

function updateModeIndicator(prefs) {
  const modeText = document.getElementById('modeText');
  if (!modeText) return;

  const provider = prefs.provider || 'google';
  const useFreeMode = prefs.useFreeMode !== false;
  const hasGoogleKey = !!prefs.googleKey?.trim();
  const hasAzureKey = !!prefs.azureKey?.trim();

  if (useFreeMode) {
    modeText.textContent = 'Free Mode';
    return;
  }

  if (provider === 'google' && hasGoogleKey) {
    modeText.textContent = 'Google Paid';
    return;
  }

  if (provider === 'azure' && hasAzureKey) {
    modeText.textContent = 'Azure Paid';
    return;
  }

  modeText.textContent = 'Free Fallback';
}

export function createSettingsController({ sendToContent, sendToBackground, ensureContentScript, setStatus }) {
  async function loadPrefsIntoUI() {
    const prefs = await StorageUtils.get([
      'sourceLang',
      'targetLang',
      'translationMode',
      'quickTranslateEnabled',
      'showOriginalOnHover',
      'translationColor',
      'provider',
      'useFreeMode',
      'googleKey',
      'azureKey'
    ]);

    const source = document.getElementById('sourceLang');
    const target = document.getElementById('targetLang');
    const mode = document.getElementById('mode');
    const qtSwitch = document.getElementById('qtSwitch');

    if (source) source.value = prefs.sourceLang || 'auto';
    if (target) target.value = prefs.targetLang || 'id';
    if (mode) mode.value = prefs.translationMode || 'paragraph';
    if (qtSwitch) qtSwitch.checked = prefs.quickTranslateEnabled !== false;

    const tooltipSwitch = document.getElementById('tooltipSwitch');
    if (tooltipSwitch) tooltipSwitch.checked = prefs.showOriginalOnHover !== false;

    const color = prefs.translationColor || 'default';
    const colorRadio = document.querySelector(`input[name="translationColor"][value="${color}"]`);
    if (colorRadio) colorRadio.checked = true;

    updateModeIndicator(prefs);
  }

  async function saveCurrentPrefs() {
    const sourceLang = document.getElementById('sourceLang')?.value || 'auto';
    const targetLang = document.getElementById('targetLang')?.value || 'id';
    const translationMode = document.getElementById('mode')?.value || 'paragraph';
    await StorageUtils.set({ sourceLang, targetLang, translationMode });
  }

  async function refreshApiMonitor() {
    const response = await sendToBackground({ type: 'GET_API_LOGS' });
    if (!response?.success) {
      return;
    }

    const currentApi = document.getElementById('currentApi');
    const apiDetails = document.getElementById('apiDetails');

    if (currentApi) currentApi.textContent = response.currentApi || 'None';
    if (apiDetails) apiDetails.textContent = response.details || 'No API request yet';
  }

  async function showApiLogs() {
    const response = await sendToBackground({ type: 'GET_API_LOGS' });
    if (!response?.success || !response.logs?.length) {
      setStatus('No API logs yet');
      setTimeout(() => setStatus(''), 2000);
      return;
    }

    const details = response.logs
      .map((entry, index) => {
        return `${index + 1}. [${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.type} - ${entry.provider} - ${entry.success ? 'OK' : 'FAILED'}`;
      })
      .join('\n');

    alert(`Recent API Logs:\n\n${details}`);
  }

  async function bind() {
    await ensureContentScript();
    await loadPrefsIntoUI();
    await refreshApiMonitor();

    const mainView = document.getElementById('mainView');
    const settingsView = document.getElementById('settingsView');
    const openOptionsBtn = document.getElementById('openOptions');
    const backToMainBtn = document.getElementById('backToMain');

    if (openOptionsBtn && mainView && settingsView) {
      openOptionsBtn.addEventListener('click', () => {
        mainView.style.display = 'none';
        settingsView.style.display = 'block';
      });
    }

    if (backToMainBtn && mainView && settingsView) {
      backToMainBtn.addEventListener('click', () => {
        settingsView.style.display = 'none';
        mainView.style.display = 'block';
      });
    }

    document.addEventListener('change', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.getAttribute('name') === 'translationColor') {
        const color = target.value;
        await StorageUtils.set({ translationColor: color });
        await sendToContent({ action: 'updateTranslationColor', color });
      }
    });

    const qtSwitch = document.getElementById('qtSwitch');
    if (qtSwitch) {
      qtSwitch.addEventListener('change', async () => {
        const enabled = qtSwitch.checked;
        await StorageUtils.set({ quickTranslateEnabled: enabled });
        await sendToContent({ type: 'SET_QUICK_TRANSLATE', enabled });
      });
    }

    const tooltipSwitch = document.getElementById('tooltipSwitch');
    if (tooltipSwitch) {
      tooltipSwitch.addEventListener('change', async () => {
        const enabled = tooltipSwitch.checked;
        await StorageUtils.set({ showOriginalOnHover: enabled });
        await sendToContent({ type: 'SET_TOOLTIP_MODE', enabled });
      });
    }

    document.getElementById('sourceLang')?.addEventListener('change', saveCurrentPrefs);
    document.getElementById('targetLang')?.addEventListener('change', saveCurrentPrefs);
    document.getElementById('mode')?.addEventListener('change', saveCurrentPrefs);
    document.getElementById('viewApiLogs')?.addEventListener('click', showApiLogs);
  }

  return { bind, refreshApiMonitor };
}
