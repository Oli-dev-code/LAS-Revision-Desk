(function () {
  function setStatus(status, detail) {
    document.querySelector('.status').textContent = status;
    document.querySelector('.detail').textContent = detail;
  }

  function setProgress(percent, speed, eta) {
    const root = document.querySelector('.window');
    const track = document.querySelector('.progress-track');
    const bar = track?.querySelector('span');
    const label = document.querySelector('.progress-label');
    const stats = document.querySelector('.download-stats');
    if (!root || !track || !bar || !label || !stats) return;
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    root.classList.remove('error');
    track.classList.remove('indeterminate');
    bar.style.width = `${safePercent.toFixed(1)}%`;
    label.textContent = `${safePercent.toFixed(1)}% downloaded`;
    stats.textContent = [speed, eta].filter(Boolean).join(' - ');
  }

  function setCheckEnabled(enabled) {
    const button = document.querySelector('.check-action');
    if (!button) return;
    button.setAttribute('aria-disabled', String(!enabled));
  }

  function showChecking() {
    const root = document.querySelector('.window');
    const track = document.querySelector('.progress-track');
    const bar = track?.querySelector('span');
    const label = document.querySelector('.progress-label');
    const stats = document.querySelector('.download-stats');
    if (!root || !track || !bar || !label || !stats) return;
    root.classList.remove('error');
    track.classList.add('indeterminate');
    bar.style.width = '';
    label.textContent = 'Checking...';
    stats.textContent = '';
    setCheckEnabled(false);
  }

  function showCheckComplete() {
    setCheckEnabled(true);
  }

  function showError() {
    const root = document.querySelector('.window');
    const track = document.querySelector('.progress-track');
    const label = document.querySelector('.progress-label');
    const stats = document.querySelector('.download-stats');
    if (!root || !track || !label || !stats) return;
    root.classList.add('error');
    track.classList.remove('indeterminate');
    track.querySelector('span').style.width = '0';
    label.textContent = 'Continuing with the current version';
    stats.textContent = '';
    showCheckComplete();
  }

  function showReady(version) {
    const root = document.querySelector('.window');
    const track = document.querySelector('.progress-track');
    const label = document.querySelector('.progress-label');
    const stats = document.querySelector('.download-stats');
    const actions = document.querySelector('.ready-actions');
    if (!root || !track || !label || !stats || !actions) return;
    root.classList.remove('error');
    setStatus('Update ready to install', `Version ${version} has been downloaded.`);
    track.classList.remove('indeterminate');
    track.querySelector('span').style.width = '100%';
    label.textContent = 'Download complete';
    stats.textContent = '';
    actions.hidden = false;
    showCheckComplete();
  }

  window.updateCheckUi = { setStatus, setProgress, showChecking, showCheckComplete, showError, showReady };
}());
