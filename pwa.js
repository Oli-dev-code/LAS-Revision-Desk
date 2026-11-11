(function registerPwa() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = './pwa.css';
  document.head.appendChild(stylesheet);

  const sidebar = document.querySelector('.sidebar');
  const topbar = document.querySelector('.topbar');
  if (sidebar && topbar) {
    const drawerId = 'pwa-topic-drawer';
    sidebar.id = drawerId;
    const menuToggle = document.createElement('button');
    menuToggle.type = 'button';
    menuToggle.className = 'pwa-menu-toggle';
    menuToggle.setAttribute('aria-controls', drawerId);
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.innerHTML = '<span aria-hidden="true">☰</span><span>Topics</span>';
    topbar.prepend(menuToggle);

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'pwa-drawer-backdrop';
    backdrop.setAttribute('aria-label', 'Close topics menu');
    document.body.appendChild(backdrop);

    const setDrawerOpen = (open) => {
      document.body.classList.toggle('pwa-drawer-open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      if (open) sidebar.querySelector('button, a')?.focus({ preventScroll: true });
    };
    menuToggle.addEventListener('click', () => setDrawerOpen(!document.body.classList.contains('pwa-drawer-open')));
    backdrop.addEventListener('click', () => setDrawerOpen(false));
    sidebar.addEventListener('click', (event) => {
      if (event.target.closest('a, [data-view="topics"], .course-item')) setDrawerOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    });
  }

  if (window.matchMedia?.('(max-width:700px)').matches) {
    const stats = document.querySelector('.stats-grid');
    const dashboardGrid = document.querySelector('.dashboard-grid');
    const activityPanel = dashboardGrid?.querySelector('.activity-panel');
    if (stats && dashboardGrid && activityPanel) {
      const activitySection = document.createElement('details');
      activitySection.className = 'pwa-activity-section';
      const summary = document.createElement('summary');
      summary.innerHTML = '<span><strong>Activity</strong><small>Study time, questions and topic progress</small></span><span class="pwa-activity-chevron" aria-hidden="true">⌄</span>';
      const content = document.createElement('div');
      content.className = 'pwa-activity-content';
      activitySection.append(summary, content);
      stats.parentNode.insertBefore(activitySection, stats);
      content.append(stats, activityPanel);
    }
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error) => {
      console.warn('LAS Revision Desk offline mode is unavailable:', error);
    });
  });

  if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone) return;
  const help = document.createElement('aside');
  help.setAttribute('aria-label', 'Install LAS Revision Desk');
  help.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:20;max-width:320px;padding:14px 16px;border:1px solid #b4d2ca;border-radius:8px;background:#fbfcfa;color:#203c43;box-shadow:0 8px 24px rgba(32,60,67,.16);font:13px/1.45 system-ui,sans-serif';
  help.innerHTML = '<strong style="display:block;margin-bottom:5px">Install on your phone</strong><span>On iPhone, open Safari\'s Share menu and choose <b>Add to Home Screen</b>. On Android, use your browser\'s Install or Add to Home screen option.</span><button type="button" aria-label="Dismiss install instructions" style="display:block;margin-top:9px;border:0;background:transparent;color:#176f6b;padding:0;font:inherit;font-weight:600;cursor:pointer">Dismiss</button>';
  help.querySelector('button').addEventListener('click', () => help.remove());
  document.body.appendChild(help);
})();
