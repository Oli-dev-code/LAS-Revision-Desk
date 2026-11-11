(function () {
  function readTheme() {
    try { return localStorage.getItem('las-revision-theme') || 'light'; } catch { return 'light'; }
  }

  function saveTheme(theme) {
    try { localStorage.setItem('las-revision-theme', theme); } catch { /* Optional preference only. */ }
  }

  function applyTheme(theme, toggle = document.getElementById('theme-toggle')) {
    const dark = theme === 'dark';
    document.body.dataset.theme = dark ? 'dark' : 'light';
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(dark));
    const icon = toggle.querySelector('.theme-icon');
    const label = toggle.querySelector('.theme-label');
    if (icon) icon.textContent = String.fromCodePoint(dark ? 9728 : 9790);
    if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
    if (!icon && !label) toggle.textContent = dark ? 'Light mode' : 'Dark mode';
  }

  function bindThemeToggle(toggle = document.getElementById('theme-toggle')) {
    if (!toggle) return;
    applyTheme(readTheme(), toggle);
    toggle.addEventListener('click', () => {
      const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      applyTheme(next, toggle);
    });
  }

  window.lasUi = { readTheme, saveTheme, applyTheme, bindThemeToggle };
}());
