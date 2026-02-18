import { StorageUtils } from '../../common/storage.js';

function updateTranslateButton(isTranslating) {
  const button = document.getElementById('translateBtn');
  if (!button) return;

  if (isTranslating) {
    button.textContent = '⏹ Stop';
    button.classList.add('stop-mode');
    button.style.backgroundColor = '#dc3545';
    button.style.borderColor = '#dc3545';
    return;
  }

  button.textContent = 'Translate';
  button.classList.remove('stop-mode');
  button.style.backgroundColor = '';
  button.style.borderColor = '';
}

export function createTranslateController({ sendToContent, setStatus }) {
  async function checkTranslationStatus() {
    try {
      const response = await sendToContent({ action: 'getTranslationStatus' }, 1500);
      updateTranslateButton(!!response?.isTranslating);
    } catch {
      updateTranslateButton(false);
    }
  }

  async function onTranslateClick() {
    const status = await sendToContent({ type: 'GET_TRANSLATION_STATUS' });
    if (status?.isTranslating) {
      setStatus('Stopping translation...');
      await sendToContent({ type: 'STOP_TRANSLATION' });
      updateTranslateButton(false);
      setStatus('Translation stopped');
      setTimeout(() => setStatus(''), 2000);
      return;
    }

    const mode = document.getElementById('mode')?.value || 'paragraph';
    const sourceLang = document.getElementById('sourceLang')?.value || 'auto';
    const targetLang = document.getElementById('targetLang')?.value || 'id';

    await StorageUtils.set({ sourceLang, targetLang, translationMode: mode });

    updateTranslateButton(true);
    setStatus('Starting translation...');

    const result = await sendToContent({ type: 'TRANSLATE_PAGE', mode, sourceLang, targetLang });

    updateTranslateButton(false);
    if (result?.success) {
      setStatus('Translation complete!');
      setTimeout(() => setStatus(''), 2000);
      return;
    }

    setStatus('Translation failed: ' + (result?.error || 'Unknown error'));
    setTimeout(() => setStatus(''), 3000);
  }

  async function restoreOriginal() {
    setStatus('Restoring original text...');
    const response = await sendToContent({ type: 'RESTORE_ORIGINAL' });
    if (response?.success) {
      setStatus('Text restored!');
    } else {
      setStatus('Restore failed');
    }
    setTimeout(() => setStatus(''), 2000);
  }

  function bind() {
    document.getElementById('translateBtn')?.addEventListener('click', onTranslateClick);
    document.getElementById('restoreBtn')?.addEventListener('click', restoreOriginal);
    document.getElementById('cleanupBtn')?.addEventListener('click', restoreOriginal);

    checkTranslationStatus();
    setInterval(checkTranslationStatus, 500);
  }

  return { bind };
}
