const toast = document.getElementById('toast');
const modeTabs = document.querySelectorAll('.mode-tab');
const modeViews = document.querySelectorAll('.mode-view');
const questionDatabase = window.questionDatabase || [];
const topicCatalog = window.topicCatalog || [];
const themeToggle = document.getElementById('theme-toggle');
let selectedTopic = 'body';
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
  return questionDatabase.filter((question) => question.topic === selectedTopic);
}

function renderTestQuestion() {
  const questions = questionsForSelectedTopic();
  const question = questions.length ? questions[testIndex % questions.length] : null;
  const options = document.getElementById('test-options');
  document.getElementById('test-count').textContent = question ? `Question ${(testIndex % questions.length) + 1} of ${questions.length}` : 'No questions';
  document.getElementById('test-question').textContent = question ? question.question : 'No questions have been added for this topic yet.';
  options.innerHTML = question ? question.options.map((option, index) => `<button data-answer-index="${index}">${option}</button>`).join('') : '';
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
document.getElementById('resume-topic')?.addEventListener('click', () => selectMode('learn'));
document.getElementById('view-topic')?.addEventListener('click', () => selectMode('learn'));

if (topicCatalog.length) {
  document.querySelector('.course-list').innerHTML = topicCatalog.map((topic, index) => `<button class="course-item${index === 0 ? ' selected' : ''}" data-topic="${topic.id}"><span class="status-dot${index === 0 ? ' current' : ''}">${index + 1}</span><span class="course-name">${topic.name}</span></button>`).join('');
  document.querySelector('.mode-intro p').innerHTML = `${topicCatalog[0].name} <span> - </span> Questions filtered to this topic`;
  document.querySelector('.mode-tab[href^="learn"]').href = `learn.html?topic=${selectedTopic}`;
  document.querySelector('.mode-tab[href^="test"]').href = `test.html?topic=${selectedTopic}`;
  document.querySelector('.mode-tab[href^="quiz"]').href = `quiz.html?topic=${selectedTopic}`;
}

document.querySelectorAll('.course-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.course-item').forEach((course) => course.classList.remove('selected'));
    item.classList.add('selected');
    selectedTopic = item.dataset.topic;
    testIndex = 0;
    quizIndex = 0;
    const topicName = item.querySelector('.course-name')?.textContent || item.textContent.trim();
    document.querySelector('.mode-intro p').innerHTML = `${topicName} <span> - </span> Questions filtered to this topic`;
    document.querySelector('.mode-tab[href^="learn"]').href = `learn.html?topic=${selectedTopic}`;
    document.querySelector('.mode-tab[href^="test"]').href = `test.html?topic=${selectedTopic}`;
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
document.getElementById('mark-learned').addEventListener('click', (event) => {
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

document.getElementById('new-question').addEventListener('click', () => {
  document.querySelectorAll('.answers button').forEach((item) => item.classList.remove('correct', 'wrong'));
  document.querySelector('.quiz-feedback').textContent = '';
  showToast('A new question is ready');
});

renderTestQuestion();
renderQuizQuestion();
