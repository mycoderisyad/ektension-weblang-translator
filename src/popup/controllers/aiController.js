import { StorageUtils } from '../../common/storage.js';

export function createAiController({ sendToContent, sendToBackground, setStatus }) {
  async function handleAIRequest(aiType, statusMessage) {
    setStatus(statusMessage);

    const contentData = await sendToContent({ type: 'GET_TRANSLATION_DATA' });
    if (!contentData?.success || !contentData?.data?.translatedTexts?.length) {
      setStatus('No translated content found. Please translate the page first.');
      setTimeout(() => setStatus(''), 3000);
      return;
    }

    const targetLang = document.getElementById('targetLang')?.value || 'id';
    const text = contentData.data.translatedTexts.join('\n\n');

    const response = await sendToBackground({
      type: aiType,
      text,
      targetLang
    });

    if (!response?.success) {
      setStatus(`AI request failed: ${response?.error || 'Unknown error'}`);
      setTimeout(() => setStatus(''), 3000);
      return;
    }

    await StorageUtils.set({
      aiLastResult: response.result,
      aiLastType: aiType,
      aiLastTargetLang: targetLang,
      aiLastUpdatedAt: Date.now()
    });

    const showPopupResponse = await sendToContent({
      type: 'SHOW_AI_POPUP',
      result: response.result,
      aiType,
      targetLang
    });

    if (!showPopupResponse?.success) {
      alert(`${aiType.replace('AI_', '')} Result:\n\n${response.result}`);
    }

    setStatus('AI analysis complete!');
    setTimeout(() => setStatus(''), 2500);
  }

  function bind() {
    document.getElementById('summarizeBtn')?.addEventListener('click', () => handleAIRequest('AI_SUMMARIZE', 'Summarizing content...'));
    document.getElementById('analyzeBtn')?.addEventListener('click', () => handleAIRequest('AI_ANALYZE', 'Analyzing content...'));
    document.getElementById('keywordsBtn')?.addEventListener('click', () => handleAIRequest('AI_KEYWORDS', 'Extracting keywords...'));
  }

  return { bind };
}
