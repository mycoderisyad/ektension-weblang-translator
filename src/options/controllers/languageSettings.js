export function createLanguageSettingsController() {
  const sourceSelect = document.getElementById('defaultSourceLang');
  const targetSelect = document.getElementById('defaultTargetLang');

  function hydrate(settings) {
    if (sourceSelect) sourceSelect.value = settings.defaultSourceLang || 'auto';
    if (targetSelect) targetSelect.value = settings.defaultTargetLang || 'id';
  }

  function collect() {
    return {
      defaultSourceLang: sourceSelect?.value || 'auto',
      defaultTargetLang: targetSelect?.value || 'id'
    };
  }

  return { hydrate, collect };
}
