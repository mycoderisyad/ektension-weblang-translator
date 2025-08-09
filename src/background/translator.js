import { TranslateProvider } from './providers.js';

export const UniversalTranslator = (() => {
  async function translate({ text, from = 'auto', to = 'id', provider, apiKeys, useFreeMode }) {
    if (!text || text.length < 2 || /^\s*$/.test(text) || /^\d+$/.test(text)) {
      return { text, detectedLang: from, usedService: 'NONE' };
    }
    if (from !== 'auto' && from === to) {
      return { text, detectedLang: from, usedService: 'SAME_LANG' };
    }

    let apis = [];
    if (useFreeMode) {
      apis = [
        { name: 'googleFree', func: TranslateProvider.googleFree },
        { name: 'myMemory', func: TranslateProvider.myMemory },
        { name: 'libre', func: TranslateProvider.libre },
      ];
    } else {
      if (provider === 'google' && apiKeys.googleKey) apis.push({ name: 'googlePaid', func: TranslateProvider.googlePaid, key: apiKeys.googleKey });
      if (provider === 'azure' && apiKeys.azureKey) apis.push({ name: 'azure', func: TranslateProvider.azure, key: apiKeys.azureKey });
      if (apis.length === 0) {
        if (apiKeys.googleKey) apis.push({ name: 'googlePaid', func: TranslateProvider.googlePaid, key: apiKeys.googleKey });
        if (apiKeys.azureKey) apis.push({ name: 'azure', func: TranslateProvider.azure, key: apiKeys.azureKey });
      }
      apis.push({ name: 'googleFree', func: TranslateProvider.googleFree });
      apis.push({ name: 'myMemory', func: TranslateProvider.myMemory });
      apis.push({ name: 'libre', func: TranslateProvider.libre });
    }

    for (let api of apis) {
      try {
        const result = api.key ? await api.func(text, from, to, api.key) : await api.func(text, from, to);
        if (result && typeof result === 'object' && result.text && result.text !== text && result.text.length > 0) {
          return result;
        }
      } catch {
        continue;
      }
    }
    return { text, detectedLang: from, usedService: 'FAILED' };
  }
  return { translate };
})();


