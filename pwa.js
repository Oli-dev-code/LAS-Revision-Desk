(function registerPwa() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
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
