const toast = document.getElementById('toast');
const modeTabs = document.querySelectorAll('.mode-tab');
const modeViews = document.querySelectorAll('.mode-view');
const dashboardQuestionDatabase = window.questionDatabase || [];
const topicCatalog = window.topicCatalog || [];
const themeToggle = document.getElementById('theme-toggle');
let selectedTopic = topicCatalog.find((topic) => !(window.lasProgress?.learntTopics?.() || []).includes(topic.id))?.id || topicCatalog[0]?.id || 'body';
try {
  const savedTopic = localStorage.getItem('las-revision-selected-topic');
  if (savedTopic && topicCatalog.some((topic) => topic.id === savedTopic)) selectedTopic = savedTopic;
} catch { /* Optional preference. */ }
let testIndex = 0;
let quizIndex = 0;

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.dataset.theme = dark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', dark);
  themeToggle.querySelector('.theme-icon').textContent = dark ? '☀' : '☾';
  themeToggle.querySelector('.theme-label').textContent = dark ? 'Light mode' : 'Dark mode';
}

function readTheme() {
  try { return localStorage.getItem('las-revision-theme') || 'light'; } catch { return 'light'; }
}

function saveTheme(theme) {
  try { localStorage.setItem('las-revision-theme', theme); } catch { /* File URLs may not expose storage. */ }
}

const savedTheme = readTheme();
applyTheme(savedTheme);
themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  saveTheme(nextTheme);
  applyTheme(nextTheme);
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function questionsForSelectedTopic() {
  return dashboardQuestionDatabase.filter((question) => question.topic === selectedTopic);
}
function shuffleOptions(options) {
  const shuffled = [...options];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function renderTestQuestion() {
  const questions = questionsForSelectedTopic();
  const question = questions.length ? questions[testIndex % questions.length] : null;
  const options = document.getElementById('test-options');
  document.getElementById('test-count').textContent = question ? `Question ${(testIndex % questions.length) + 1} of ${questions.length}` : 'No questions';
  document.getElementById('test-question').textContent = question ? question.question : 'No questions have been added for this topic yet.';
  const shuffledOptions = question ? shuffleOptions(question.options.map((option, index) => ({ option, index }))) : [];
  options.innerHTML = question ? shuffledOptions.map(({ option, index }) => `<button data-answer-index="${index}">${option}</button>`).join('') : '';
  const result = document.querySelector('.test-result');
  result.textContent = '';
  result.className = 'test-result';
  document.getElementById('next-test').disabled = true;
  if (!question) return;
  options.querySelectorAll('button').forEach((answer) => answer.addEventListener('click', () => {
    const correct = Number(answer.dataset.answerIndex) === question.answer;
    options.querySelectorAll('button').forEach((item) => item.classList.remove('correct', 'wrong'));
    answer.classList.add(correct ? 'correct' : 'wrong');
    result.className = `test-result${correct ? '' : ' error'}`;
    result.textContent = correct ? `Correct. ${question.explanation}` : `Not quite. ${question.explanation}`;
    document.getElementById('next-test').disabled = false;
  }));
}

function renderQuizQuestion() {
  const questions = questionsForSelectedTopic();
  const question = questions.length ? questions[quizIndex % questions.length] : null;
  document.getElementById('quiz-count').textContent = question ? `Question ${(quizIndex % questions.length) + 1} of ${questions.length}` : 'No questions';
  document.getElementById('quiz-question').textContent = question ? question.question : 'No questions have been added for this topic yet.';
  document.getElementById('quiz-answer').textContent = question ? question.options[question.answer] : 'No answer yet';
  document.getElementById('quiz-explanation').textContent = question ? question.explanation : '';
  document.getElementById('revealed-answer').hidden = true;
  document.getElementById('reveal-answer').textContent = 'Reveal answer';
}

function selectMode(mode, shouldScroll = true) {
  modeTabs.forEach((tab) => {
    const selected = tab.dataset.mode === mode;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', selected);
  });
  modeViews.forEach((view) => {
    view.hidden = view.dataset.modeView !== mode;
    view.classList.toggle('active', view.dataset.modeView === mode);
  });
  if (mode === 'test') renderTestQuestion();
  if (mode === 'quiz') renderQuizQuestion();
  if (shouldScroll) document.getElementById('mode-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.setDashboardTopic = (topic) => {
  selectedTopic = topic;
  testIndex = 0;
  quizIndex = 0;
  renderTestQuestion();
  renderQuizQuestion();
};

modeTabs.forEach((tab) => tab.addEventListener('click', () => selectMode(tab.dataset.mode)));

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.view === 'topics') { window.location.assign(new URL('topics.html', window.location.href).href); return; }
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    const matchingNav = document.querySelector(`.nav-item[data-view="${button.dataset.view}"]`);
    if (matchingNav) matchingNav.classList.add('active');
    const label = button.dataset.view.charAt(0).toUpperCase() + button.dataset.view.slice(1);
    document.querySelector('.breadcrumb strong').textContent = label;
    if (button.dataset.view === 'topics') selectMode('learn');
    if (button.dataset.view === 'practice') selectMode('test');
    showToast(`${label} view selected`);
  });
});

document.getElementById('start-session').addEventListener('click', () => showToast('Study session started'));
const openLearnPage = () => { window.location.assign(`learn.html?topic=${selectedTopic}`); };
document.getElementById('resume-topic')?.addEventListener('click', openLearnPage);
document.getElementById('view-topic')?.addEventListener('click', openLearnPage);

if (topicCatalog.length) {
  document.querySelector('.course-list').innerHTML = topicCatalog.map((topic, index) => `<button class="course-item${topic.id === selectedTopic ? ' selected' : ''}" data-topic="${topic.id}"><span class="status-dot${topic.id === selectedTopic ? ' current' : ''}">${index + 1}</span><span class="course-name">${topic.name}</span></button>`).join('');
  document.querySelector('.mode-intro p').innerHTML = `${topicCatalog[0].name} <span> - </span> Questions filtered to this topic`;
  document.querySelector('.mode-tab[href^="learn"]').href = `learn.html?topic=${selectedTopic}`;
  document.querySelector('.mode-tab:not([data-flagged-test])[href^="test"]').href = `test.html?topic=${selectedTopic}`;
  document.querySelector('.mode-tab[href^="quiz"]').href = `quiz.html?topic=${selectedTopic}`;
}

document.querySelectorAll('.course-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.course-item').forEach((course) => {
      course.classList.remove('selected');
      course.querySelector('.status-dot')?.classList.remove('current');
    });
    item.classList.add('selected');
    item.querySelector('.status-dot')?.classList.add('current');
    selectedTopic = item.dataset.topic;
    testIndex = 0;
    quizIndex = 0;
    const topicName = item.querySelector('.course-name')?.textContent || item.textContent.trim();
    document.querySelector('.mode-intro p').innerHTML = `${topicName} <span> - </span> Questions filtered to this topic`;
    document.querySelector('.mode-tab[href^="learn"]').href = `learn.html?topic=${selectedTopic}`;
    document.querySelector('.mode-tab:not([data-flagged-test])[href^="test"]').href = `test.html?topic=${selectedTopic}`;
    document.querySelector('.mode-tab[href^="quiz"]').href = `quiz.html?topic=${selectedTopic}`;
    renderTestQuestion();
    renderQuizQuestion();
    showToast(`${topicName} selected`);
  });
});

document.getElementById('next-test').addEventListener('click', () => {
  testIndex += 1;
  renderTestQuestion();
  showToast('Next test question loaded');
});

document.getElementById('reveal-answer').addEventListener('click', () => {
  document.getElementById('revealed-answer').hidden = false;
  document.getElementById('reveal-answer').textContent = 'Answer revealed';
  showToast('Answer revealed');
});

document.getElementById('quiz-got-it').addEventListener('click', () => showToast('Nice recall'));
document.getElementById('new-question')?.addEventListener('click', () => {
  quizIndex += 1;
  renderQuizQuestion();
  showToast('A new question is ready');
});
document.getElementById('mark-learned')?.addEventListener('click', (event) => {
  window.lasProgress?.markLearnt(selectedTopic);
  event.currentTarget.innerHTML = 'Reviewed <span>✓</span>';
  showToast('Topic marked as reviewed');
});

document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) selectMode('learn');
});

document.querySelectorAll('.answers button').forEach((answer) => {
  answer.addEventListener('click', () => {
    document.querySelectorAll('.answers button').forEach((item) => item.classList.remove('correct', 'wrong'));
    const feedback = document.querySelector('.quiz-feedback');
    const isCorrect = answer.dataset.answer === 'correct';
    answer.classList.add(isCorrect ? 'correct' : 'wrong');
    feedback.className = `quiz-feedback${isCorrect ? '' : ' error'}`;
    feedback.textContent = isCorrect ? 'Correct. Treat immediate threats as you find them.' : 'Not quite. Start with the ABCDE approach and immediate threats.';
  });
});

renderTestQuestion();
renderQuizQuestion();

// Dashboard state is derived from the progress store so the overview never shows stale demo data.
function formatDashboardTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function topicCompletion(topicId) {
  if (window.lasProgress?.isLearnt(topicId)) return 100;
  const questions = dashboardQuestionDatabase.filter((question) => question.topic === topicId);
  const history = window.lasProgress?.questionHistory?.() || {};
  const answered = questions.reduce((total, question) => total + (history[question.id]?.answered || 0), 0);
  return questions.length ? Math.min(99, Math.round((answered / questions.length) * 100)) : 0;
}

function renderDashboardFocus() {
  const topic = topicCatalog.find((item) => item.id === selectedTopic) || topicCatalog[0];
  if (!topic) return;
  const progress = topicCompletion(topic.id);
  const topicQuestions = dashboardQuestionDatabase.filter((question) => question.topic === topic.id);
  document.getElementById('focus-topic-number').textContent = String(topicCatalog.indexOf(topic) + 1).padStart(2, '0');
  document.getElementById('focus-topic-tag').textContent = topic.name.toUpperCase();
  document.getElementById('focus-topic-name').textContent = topic.name;
  document.getElementById('focus-topic-description').textContent = topic.description || 'Review the essential knowledge for this topic.';
  document.getElementById('focus-topic-source').textContent = `Source: ${topic.source}`;
  document.getElementById('focus-topic-questions').textContent = `${topicQuestions.length} questions`;
  document.getElementById('focus-topic-percent').innerHTML = `${progress}<small>%</small>`;
  document.getElementById('focus-topic-ring').style.background = `conic-gradient(#75bbae 0 ${progress}%,#385d68 ${progress}% 100%)`;
  document.getElementById('focus-topic-status').textContent = progress === 100 ? 'Reviewed' : progress ? 'In progress' : 'Not started';
  document.querySelector('.mode-intro p').innerHTML = `${topic.name} <span>·</span> Questions filtered to this topic`;
  document.querySelector('.mode-tab[href^="learn"]').href = `learn.html?topic=${topic.id}`;
  document.querySelector('.mode-tab:not([data-flagged-test])[href^="test"]').href = `test.html?topic=${topic.id}`;
  document.querySelector('.mode-tab[href^="quiz"]').href = `quiz.html?topic=${topic.id}`;
  document.getElementById('resume-topic').onclick = () => window.location.assign(`learn.html?topic=${topic.id}`);
}

function renderDashboardStats() {
  const stats = window.lasProgress?.questionStats() || { answered: 0, correct: 0 };
  const learnt = window.lasProgress?.learntTopics() || [];
  const time = window.lasProgress?.revisionTime?.() || { todayMs: 0, totalMs: 0 };
  const cards = document.querySelectorAll('.stats-grid .stat-card');
  cards[0].querySelector('strong').textContent = formatDashboardTime(time.todayMs);
  cards[0].querySelector('small').textContent = 'Revision today';
  cards[1].querySelector('strong').textContent = stats.answered;
  cards[1].querySelector('small').innerHTML = stats.answered ? `<em>${Math.round((stats.correct / stats.answered) * 100)}%</em> average score` : 'No questions completed yet';
  cards[2].querySelector('strong').textContent = `${learnt.length}/${topicCatalog.length}`;
  cards[2].querySelector('small').textContent = `${topicCatalog.length - learnt.length} topics remaining`;
  const progress = topicCatalog.length ? Math.round((learnt.length / topicCatalog.length) * 100) : 0;
  document.querySelector('.progress-top strong').textContent = `${progress}%`;
  document.querySelector('.progress-track span').style.width = `${progress}%`;
  document.querySelector('.course-progress p').textContent = `${learnt.length} of ${topicCatalog.length} topics reviewed`;
}

function renderDashboardActivity() {
  const time = window.lasProgress?.revisionTime?.() || { dailyMs: {} };
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    days.push({ key, label: date.toLocaleDateString(undefined, { weekday: 'short' }), minutes: Math.round((time.dailyMs?.[key] || 0) / 60000) });
  }
  const max = Math.max(20, Math.ceil(Math.max(...days.map((day) => day.minutes), 0) / 20) * 20);
  document.getElementById('chart-max').textContent = `${max}m`;
  document.getElementById('chart-mid').textContent = `${Math.round(max * 2 / 3)}m`;
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('activity-bars').innerHTML = days.map((day) => `<span class="${day.key === today ? 'today' : ''}" style="height:${day.minutes ? Math.max(4, (day.minutes / max) * 100) : 2}%" title="${day.minutes} minutes"><b>${day.label}</b></span>`).join('');
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  document.getElementById('activity-summary').textContent = total ? `${total}m this week` : 'No activity recorded yet';
}

function refreshDashboard() {
  renderDashboardFocus();
  renderDashboardStats();
  renderDashboardActivity();
}

const originalSetDashboardTopic = window.setDashboardTopic;
window.setDashboardTopic = (topic) => {
  selectedTopic = topic;
  try { localStorage.setItem('las-revision-selected-topic', topic); } catch { /* Optional preference. */ }
  originalSetDashboardTopic?.(topic);
  refreshDashboard();
};

refreshDashboard();
window.setInterval(refreshDashboard, 15000);
document.querySelectorAll('.course-item').forEach((item) => item.addEventListener('click', () => {
  selectedTopic = item.dataset.topic;
  try { localStorage.setItem('las-revision-selected-topic', selectedTopic); } catch { /* Optional preference. */ }
  refreshDashboard();
}));
