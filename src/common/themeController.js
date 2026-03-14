let isInitialized = false;

export function initThemeController() {
  if (isInitialized) return;
  isInitialized = true;

  const toggleBtn = document.getElementById('themeToggle');
  const sunIcon = toggleBtn?.querySelector('.sun-icon');
  const moonIcon = toggleBtn?.querySelector('.moon-icon');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (sunIcon && moonIcon) {
      if (theme === 'light') {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      }
    }
  }

  // Load saved theme
  chrome.storage.sync.get(['theme'], (data) => {
    // Default to dark theme if not set
    const currentTheme = data.theme || 'dark';
    applyTheme(currentTheme);
  });

  // Handle toggle clicks
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isCurrentlyLight = document.documentElement.getAttribute('data-theme') === 'light';
      const newTheme = isCurrentlyLight ? 'dark' : 'light';
      
      applyTheme(newTheme);
      chrome.storage.sync.set({ theme: newTheme });
    });
  }

  // Listen for cross-page sync
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.theme) {
      applyTheme(changes.theme.newValue);
    }
  });
}
