const ALLOWED_ORIGINS = new Set([
  'https://oli-dev-code.github.io',
  'http://127.0.0.1',
  'http://localhost'
]);
const ALLOWED_MODES = new Set(['test', 'focused-test', 'quiz', 'medical-exam', 'trauma-exam']);
const TURNSTILE_ACTION = 'question-report';
const MAX_REPORTS_PER_HOUR = 5;

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  } catch {
    return false;
  }
}

function expectedTurnstileHostname(origin) {
  if (origin === 'https://oli-dev-code.github.io') return 'oli-dev-code.github.io';
  try {
    const url = new URL(origin);
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)) return url.hostname;
  } catch {
    // Invalid origins are rejected by isAllowedOrigin.
  }
  return null;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function response(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

function clean(value, max) {
  return String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyTurnstile(token, request, env, expectedHostname) {
  if (!token || !env.TURNSTILE_SECRET_KEY) return { ok: false, code: 'missing-input-response' };
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.set('remoteip', ip);
  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = await result.json();
    if (data.success !== true) {
      const code = Array.isArray(data['error-codes']) ? data['error-codes'][0] || 'verification-failed' : 'verification-failed';
      console.warn('Turnstile verification failed', { code, hostname: data.hostname || null });
      return { ok: false, code };
    }
    if (data.action !== TURNSTILE_ACTION) return { ok: false, code: 'invalid-action' };
    if (data.hostname !== expectedHostname) return { ok: false, code: 'invalid-hostname' };
    return { ok: true };
  } catch {
    return { ok: false, code: 'siteverify-unavailable' };
  }
}

function issueBody(report) {
  return [
    '## Question report',
    '',
    `**Question ID:** ${report.questionId}`,
    `**Topic:** ${report.topicName} (${report.topicId})`,
    `**Mode:** ${report.mode}`,
    `**Page:** ${report.page}`,
    `**App version:** ${report.appVersion}`,
    `**Platform:** ${report.platform}`,
    '',
    '### Question',
    '```text', report.questionText, '```',
    '',
    `**Selected answer:** ${report.selectedAnswer || 'Not provided'}`,
    '',
    '### Reporter comment',
    report.comment || 'No comment provided.'
  ].join('\n');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || 'null';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST') return response({ message: 'Method not allowed.' }, 405, origin);
    if (!isAllowedOrigin(origin)) return response({ message: 'Origin not allowed.' }, 403, origin);
    const expectedHostname = expectedTurnstileHostname(origin);

    let input;
    try { input = await request.json(); } catch { return response({ message: 'Invalid JSON.' }, 400, origin); }
    const report = {
      questionId: clean(input.questionId, 120),
      topicId: clean(input.topicId, 120),
      topicName: clean(input.topicName, 180),
      questionText: clean(input.questionText, 4000),
      mode: clean(input.mode, 40),
      page: clean(input.page, 120),
      selectedAnswer: clean(input.selectedAnswer, 500),
      comment: clean(input.comment, 1200),
      appVersion: clean(input.appVersion, 40),
      platform: clean(input.platform, 20)
    };
    if (!report.questionId || !report.topicId || !report.topicName || !report.questionText || !report.appVersion || !ALLOWED_MODES.has(report.mode) || !['pwa', 'desktop'].includes(report.platform)) return response({ message: 'Required report fields are missing or invalid.' }, 400, origin);
    const verification = await verifyTurnstile(input.turnstileToken, request, env, expectedHostname);
    if (!verification.ok) return response({ message: 'Verification failed. Please try again.', code: verification.code }, 403, origin);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const bucket = new Date().toISOString().slice(0, 13);
    const rateKey = await digest(`${env.RATE_LIMIT_SALT || 'las-report'}:${ip}`);
    const rate = await env.REPORT_DB.prepare('SELECT count FROM rate_limits WHERE key_hash = ? AND bucket = ?').bind(rateKey, bucket).first();
    if ((rate?.count || 0) >= MAX_REPORTS_PER_HOUR) return response({ message: 'Report limit reached. Please try again later.' }, 429, origin);
    await env.REPORT_DB.prepare('INSERT INTO rate_limits (key_hash, bucket, count) VALUES (?, ?, 1) ON CONFLICT(key_hash, bucket) DO UPDATE SET count = count + 1').bind(rateKey, bucket).run();

    const fingerprint = await digest([report.questionId, report.selectedAnswer, report.comment].join('|').toLowerCase().replace(/\s+/g, ' ').trim());
    const duplicate = await env.REPORT_DB.prepare('SELECT issue_url FROM reports WHERE fingerprint = ?').bind(fingerprint).first();
    if (duplicate) return response({ status: 'duplicate', issueUrl: duplicate.issue_url }, 200, origin);

    const githubResponse = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.GITHUB_ISSUE_TOKEN}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'LAS-Revision-Desk-Question-Reporter' },
      body: JSON.stringify({ title: `[Question report] ${report.topicName} · ${report.questionId}`, body: issueBody(report), labels: ['question-report'] })
    });
    if (!githubResponse.ok) return response({ message: 'GitHub could not create the issue.' }, githubResponse.status === 403 ? 503 : 502, origin);
    const issue = await githubResponse.json();
    await env.REPORT_DB.prepare('INSERT INTO reports (fingerprint, issue_url, issue_number, created_at) VALUES (?, ?, ?, ?)').bind(fingerprint, issue.html_url, issue.number, new Date().toISOString()).run();
    return response({ status: 'created', issueUrl: issue.html_url }, 201, origin);
  }
};
