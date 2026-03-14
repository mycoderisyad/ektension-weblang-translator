import { getActiveTab, sendToBackground, sendToContent } from './utils/messaging.js';
import { createTranslateController } from './controllers/translateController.js';
import { createAiController } from './controllers/aiController.js';
import { initializeOptionsPage } from '../options/app.js';
import { createExportController } from './controllers/exportController.js';
import { createSettingsController } from './controllers/settingsController.js';
import { populateLanguageSelect } from '../common/languages.js';

function setStatus(text) {
  const element = document.getElementById('status');
  if (element) {
    element.textContent = text || '';
  }
}

async function ensureContentScript() {
  const ping = await sendToContent({ type: 'PING' }, 2000);
  if (ping?.success) {
    return true;
  }

  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    return false;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js']
    });
  } catch {
    return false;
  }

  await new Promise((resolve) => setTimeout(resolve, 700));
  const secondPing = await sendToContent({ type: 'PING' }, 2000);
  return !!secondPing?.success;
}

async function initPopup() {
  // Populate language dropdowns from the shared data module
  populateLanguageSelect('sourceLang', true);
  populateLanguageSelect('targetLang', false);

  const services = {
    sendToContent,
    sendToBackground,
    ensureContentScript,
    setStatus
  };

  const translate = createTranslateController(services);
  const ai = createAiController(services);
  const exportController = createExportController(services);
  const settings = createSettingsController(services);

  // Initialize the embedded options page functionality
  await initializeOptionsPage();

  await settings.bind();
  translate.bind();
  ai.bind();
  exportController.bind();

  setInterval(() => settings.refreshApiMonitor(), 5000);
}

window.addEventListener('DOMContentLoaded', initPopup);


