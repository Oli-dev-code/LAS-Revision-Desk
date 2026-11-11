(function initialiseQuestionReporter() {
  if (!document.querySelector('link[data-question-report-css]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'question-report.css';
    stylesheet.dataset.questionReportCss = 'true';
    document.head.appendChild(stylesheet);
  }
  const config = window.LAS_REPORT_CONFIG || {};
  const endpoint = config.endpoint || '';
  const queueKey = 'las-revision-question-report-queue';
  const submittedKey = 'las-revision-question-report-submitted';
  const maxQueue = 10;
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  let modal;
  let turnstileReady = false;
  let turnstileWidget;

  const readJson = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || ''); return value ?? fallback; } catch { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Offline reporting is best effort. */ } };
  const cleanText = (value, max = 4000) => String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
  const decode = (value) => { try { return decodeURIComponent(value || ''); } catch { return value || ''; } };
  const selectedAnswer = () => document.querySelector('.page-options button.selected, .exam-options button.selected')?.textContent?.trim() || '';
  const appVersion = () => window.LAS_REVISION_VERSION || document.querySelector('.app-version')?.textContent?.trim() || 'unknown';
  const platform = () => window.isSecureContext && 'serviceWorker' in navigator ? 'pwa' : 'desktop';
  const fingerprint = (report) => [report.questionId, report.selectedAnswer, report.comment].map((value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()).join('|');

  function loadTurnstile() {
    if (!config.turnstileSiteKey || config.turnstileSiteKey.startsWith('REPLACE_')) return Promise.resolve(false);
    if (window.turnstile) { turnstileReady = true; return Promise.resolve(true); }
    return new Promise((resolve) => {
      const existing = document.querySelector('script[data-turnstile]');
      if (existing) { existing.addEventListener('load', () => { turnstileReady = Boolean(window.turnstile); resolve(turnstileReady); }); return; }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.dataset.turnstile = 'true';
      script.addEventListener('load', () => { turnstileReady = Boolean(window.turnstile); resolve(turnstileReady); });
      script.addEventListener('error', () => resolve(false));
      document.head.appendChild(script);
    });
  }

  function closeModal() { modal?.remove(); modal = null; turnstileWidget = null; }
  function showModal(button) {
    closeModal();
    const report = {
      questionId: button.dataset.questionId,
      topicId: button.dataset.topicId,
      topicName: decode(button.dataset.topicName),
      questionText: decode(button.dataset.questionText),
      mode: button.dataset.mode,
      page: location.pathname.split('/').pop() || 'index.html',
      selectedAnswer: selectedAnswer(),
      appVersion: appVersion(),
      platform: platform()
    };
    modal = document.createElement('div');
    modal.className = 'question-report-modal';
    modal.innerHTML = `<div class="question-report-dialog" role="dialog" aria-modal="true" aria-labelledby="question-report-title"><h2 id="question-report-title">Report question</h2><p>Tell us what looks wrong and we’ll review it.</p><p class="question-report-question"></p><label for="question-report-comment">Comment (optional)<textarea id="question-report-comment" maxlength="1200" placeholder="What should be corrected?"></textarea></label><div class="question-report-turnstile"></div><p class="question-report-status" role="status"></p><div class="question-report-actions"><button type="button" class="question-report-cancel">Cancel</button><button type="button" class="question-report-submit primary">Submit report</button></div></div>`;
    modal.querySelector('.question-report-question').textContent = report.questionText;
    modal.querySelector('.question-report-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    modal.querySelector('.question-report-submit').addEventListener('click', async () => {
      report.comment = cleanText(modal.querySelector('#question-report-comment').value, 1200);
      const status = modal.querySelector('.question-report-status');
      const submit = modal.querySelector('.question-report-submit');
      if (!endpoint || endpoint.includes('REPLACE_WITH_')) { status.className = 'question-report-status error'; status.textContent = 'Reporting is not configured yet.'; return; }
      submit.disabled = true; status.className = 'question-report-status'; status.textContent = 'Sending report…';
      const token = turnstileWidget && window.turnstile?.getResponse(turnstileWidget);
      const result = await sendReport({ ...report, turnstileToken: token || '' });
      if (result.ok) { status.innerHTML = result.issueUrl ? `Report submitted. <a href="${result.issueUrl}" target="_blank" rel="noreferrer">View issue</a>` : 'Report submitted.'; submit.hidden = true; return; }
      enqueue(report); submit.disabled = false; status.className = 'question-report-status error'; status.textContent = result.queued ? 'Could not connect. Report saved to retry later.' : (result.message || 'Report could not be submitted.');
    });
    document.body.appendChild(modal);
    modal.querySelector('#question-report-comment').focus();
    loadTurnstile().then((ready) => {
      if (ready && window.turnstile && modal?.isConnected) turnstileWidget = window.turnstile.render(modal.querySelector('.question-report-turnstile'), { sitekey: config.turnstileSiteKey });
    });
  }

  async function sendReport(report) {
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
      const data = await response.json().catch(() => ({}));
      if (response.ok && ['created', 'duplicate'].includes(data.status)) return { ok: true, issueUrl: data.issueUrl };
      return { ok: false, message: data.message || 'The reporting service rejected the report.' };
    } catch { return { ok: false, queued: true }; }
  }
  function enqueue(report) { const queue = readJson(queueKey, []).filter((item) => Date.now() - item.queuedAt < maxAgeMs); if (queue.some((item) => fingerprint(item.report) === fingerprint(report))) return; queue.push({ report, queuedAt: Date.now() }); writeJson(queueKey, queue.slice(-maxQueue)); }
  async function flushQueue() { const queue = readJson(queueKey, []); const remaining = []; for (const item of queue) { if (Date.now() - item.queuedAt >= maxAgeMs) continue; const result = await sendReport(item.report); if (!result.ok) remaining.push(item); } writeJson(queueKey, remaining); }
  function bindButtons() { document.querySelectorAll('[data-report-question]:not([data-report-bound])').forEach((button) => { button.dataset.reportBound = 'true'; button.addEventListener('click', () => showModal(button)); }); }
  const observer = new MutationObserver(bindButtons);
  observer.observe(document.body, { childList: true, subtree: true });
  bindButtons();
  window.addEventListener('online', flushQueue);
  window.addEventListener('load', flushQueue);
}());
