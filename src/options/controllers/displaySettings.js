export function createDisplaySettingsController() {
  function hydrate(settings) {
    const value = settings.translationColor || 'default';
    const selected = document.querySelector(`input[name="translationColor"][value="${value}"]`);
    if (selected) selected.checked = true;
  }

  function collect() {
    const value = document.querySelector('input[name="translationColor"]:checked')?.value || 'default';
    return { translationColor: value };
  }

  return { hydrate, collect };
}
