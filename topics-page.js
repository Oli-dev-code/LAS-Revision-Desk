const topics = window.topicCatalog || [];
const topicTimerStart = Date.now();
let topicTimerSaved = topicTimerStart;
const flushTopicTime = () => { const elapsed = Math.max(0, Date.now() - topicTimerSaved); if (!elapsed) return; try { const today = new Date().toISOString().slice(0, 10); const stored = JSON.parse(localStorage.getItem('las-revision-time-stats') || '{}'); const time = { totalMs: (stored.totalMs || 0) + elapsed, todayDate: today, todayMs: stored.todayDate === today ? (stored.todayMs || 0) + elapsed : elapsed }; localStorage.setItem('las-revision-time-stats', JSON.stringify(time)); } catch { /* Time tracking is optional when storage is unavailable. */ } topicTimerSaved = Date.now(); };
window.setInterval(flushTopicTime, 15000);
window.addEventListener('beforeunload', flushTopicTime);
const themeToggle = document.getElementById('theme-toggle');
function applyTheme(theme) { const dark = theme === 'dark'; document.body.dataset.theme = dark ? 'dark' : 'light'; themeToggle.setAttribute('aria-pressed', dark); themeToggle.textContent = dark ? 'Light mode' : 'Dark mode'; }
let storedTheme = 'light';
try { storedTheme = localStorage.getItem('las-revision-theme') || 'light'; } catch { /* File URLs may not expose storage. */ }
applyTheme(storedTheme);
themeToggle.addEventListener('click', () => { const theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('las-revision-theme', theme); } catch { /* File URLs may not expose storage. */ } applyTheme(theme); });
const topicList = document.getElementById('topic-list');
const searchInput = document.getElementById('topic-search');
const categorySelect = document.getElementById('topic-category');
const statusSelect = document.getElementById('topic-status');
const resultCount = document.getElementById('topic-result-count');
const traumaTopics = new Set(['trauma', 'chest-injuries', 'drowning', 'suspension-blast-ballistics', 'abdominal-conditions', 'cardiac-conditions', 'burns', 'extrication-light-rescue']);
function categoryFor(topic) { return topic.id === 'body' ? 'Foundations' : traumaTopics.has(topic.id) ? 'Trauma & emergencies' : 'Body systems'; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function topicStatus(topic) {
  let learnt = [];
  let history = {};
  try { learnt = JSON.parse(localStorage.getItem('las-revision-learnt-topics') || '[]'); history = JSON.parse(localStorage.getItem('las-revision-question-history') || '{}'); } catch { /* Optional progress. */ }
  if (learnt.includes(topic.id)) return 'reviewed';
  const answered = Object.keys(history).some((id) => id.startsWith(`${topic.id}-`) && history[id]?.answered);
  return answered ? 'in-progress' : 'not-started';
}
function renderTopics() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;
  const status = statusSelect.value;
  const filtered = topics.filter((topic) => {
    const matchesSearch = !query || [topic.name, topic.description, topic.source].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (category === 'all' || categoryFor(topic) === category) && (status === 'all' || topicStatus(topic) === status);
  });
  resultCount.textContent = `${filtered.length} of ${topics.length} topics`;
  topicList.innerHTML = filtered.length ? filtered.map((topic) => `<article class="topic-library-item"><div class="topic-library-number">${String(topics.indexOf(topic) + 1).padStart(2, '0')}</div><div class="topic-library-copy"><h2>${escapeHtml(topic.name)}</h2><p>${escapeHtml(topic.description)}</p><small>${escapeHtml(topic.source)}</small></div><div class="topic-library-actions"><a href="learn.html?topic=${encodeURIComponent(topic.id)}">Learn <span>→</span></a><a href="test.html?topic=${encodeURIComponent(topic.id)}">Test <span>→</span></a><a href="quiz.html?topic=${encodeURIComponent(topic.id)}">Quiz <span>→</span></a></div></article>`).join('') : '<div class="topic-empty"><strong>No topics match those filters</strong>Try a broader search or reset one of the filters.</div>';
}
const categories = [...new Set(topics.map(categoryFor))].sort();
categorySelect.insertAdjacentHTML('beforeend', categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join(''));
searchInput.addEventListener('input', renderTopics);
categorySelect.addEventListener('change', renderTopics);
statusSelect.addEventListener('change', renderTopics);
renderTopics();
window.setTimeout(renderTopics, 0);
document.getElementById('topic-list').innerHTML = topics.map((topic, index) => `<article class="topic-library-item"><div class="topic-library-number">${String(index + 1).padStart(2, '0')}</div><div class="topic-library-copy"><h2>${topic.name}</h2><p>${topic.description}</p><small>${topic.source}</small></div><div class="topic-library-actions"><a href="learn.html?topic=${topic.id}">Learn <span>→</span></a><a href="test.html?topic=${topic.id}">Test <span>→</span></a><a href="quiz.html?topic=${topic.id}">Quiz <span>→</span></a></div></article>`).join('');
