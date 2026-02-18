import { StorageUtils } from '../../common/storage.js';

export function createExportController({ sendToContent, sendToBackground, setStatus }) {
  async function exportTranslation(fileType) {
    setStatus(fileType === 'pdf' ? 'Exporting PDF...' : 'Exporting...');
    const data = await sendToContent({ type: 'GET_TRANSLATION_DATA' });

    if (!data?.success || !data?.data?.originalTexts?.length) {
      setStatus('No translation data found');
      setTimeout(() => setStatus(''), 2000);
      return;
    }

    const mode = document.getElementById('exportMode')?.value || 'bilingual';
    const response = await sendToBackground({
      type: 'EXPORT_TRANSLATION',
      fileType,
      originalTexts: data.data.originalTexts,
      translatedTexts: data.data.translatedTexts,
      mode,
      sourceLang: data.data.sourceLang,
      targetLang: data.data.targetLang
    });

    if (response?.success) {
      setStatus(fileType === 'pdf' ? 'PDF export complete!' : 'Export complete!');
    } else {
      setStatus(fileType === 'pdf' ? 'PDF export failed' : 'Export failed');
    }

    setTimeout(() => setStatus(''), 2000);
  }

  async function exportAiResult(fileType) {
    const data = await StorageUtils.get(['aiLastResult', 'aiLastType']);
    if (!data.aiLastResult) {
      setStatus('No AI result to export');
      setTimeout(() => setStatus(''), 2000);
      return;
    }

    setStatus(fileType === 'pdf' ? 'Exporting AI PDF...' : 'Exporting AI TXT...');

    const response = fileType === 'pdf'
      ? await sendToBackground({
          type: 'EXPORT_AI_PDF',
          content: data.aiLastResult,
          title: data.aiLastType || 'AI Result'
        })
      : await sendToBackground({
          type: 'EXPORT_CONTENT',
          fileType: 'txt',
          content: data.aiLastResult
        });

    if (response?.success) {
      setStatus('AI export complete!');
    } else {
      setStatus('AI export failed');
    }

    setTimeout(() => setStatus(''), 2000);
  }

  function bind() {
    document.getElementById('exportTransTxtBtn')?.addEventListener('click', () => exportTranslation('txt'));
    document.getElementById('exportTransPdfBtn')?.addEventListener('click', () => exportTranslation('pdf'));
    document.getElementById('exportTxtBtn')?.addEventListener('click', () => exportAiResult('txt'));
    document.getElementById('exportPdfBtn')?.addEventListener('click', () => exportAiResult('pdf'));
  }

  return { bind };
}
