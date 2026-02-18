import { StorageUtils } from '../common/storage.js';
import { createMessage, bindPasswordToggles } from './utils/formHelpers.js';
import { createApiSettingsController } from './controllers/apiSettings.js';
import { createLanguageSettingsController } from './controllers/languageSettings.js';
import { createDisplaySettingsController } from './controllers/displaySettings.js';

const DEFAULT_SETTINGS = {
  googleKey: '',
  azureKey: '',
  geminiKey: '',
  provider: 'google',
  useFreeMode: false,
  quickTranslateEnabled: true,
  translationColor: 'default',
  defaultSourceLang: 'auto',
  defaultTargetLang: 'id'
};

async function loadSettings() {
  return StorageUtils.get([
    'googleKey',
    'azureKey',
    'geminiKey',
    'provider',
    'useFreeMode',
    'quickTranslateEnabled',
    'translationColor',
    'defaultSourceLang',
    'defaultTargetLang'
  ]);
}

async function saveSettings(settings) {
  const payload = {
    ...settings,
    sourceLang: settings.defaultSourceLang,
    targetLang: settings.defaultTargetLang
  };
  return StorageUtils.set(payload);
}

export async function initializeOptionsPage() {
  const message = createMessage(document.getElementById('savedMsg'));
  const form = document.getElementById('apiForm');

  if (!form) {
    return;
  }

  bindPasswordToggles();

  const loaded = await loadSettings();
  const settings = { ...DEFAULT_SETTINGS, ...loaded };

  const apiController = createApiSettingsController({ message });
  const languageController = createLanguageSettingsController();
  const displayController = createDisplaySettingsController();

  apiController.hydrate(settings);
  languageController.hydrate(settings);
  displayController.hydrate(settings);

  apiController.bindEvents();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nextSettings = {
      ...apiController.collect(),
      ...languageController.collect(),
      ...displayController.collect()
    };

    const ok = await saveSettings(nextSettings);
    if (!ok) {
      message.show('Error saving settings.', 'error');
      return;
    }

    message.show('Settings saved successfully!', 'success');
    try {
      chrome.runtime.sendMessage({ action: 'settingsUpdated', settings: nextSettings });
    } catch {
      // ignore runtime messaging errors for non-extension pages
    }
  });
}
