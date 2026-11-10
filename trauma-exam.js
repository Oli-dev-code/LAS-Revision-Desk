const database = window.questionDatabase || [];
const config = window.traumaExamConfig || { questionCount: 50, traumaTopics: [], coverage: [] };
const content = document.getElementById('exam-content');
const countLabel = document.getElementById('exam-count');
const themeToggle = document.getElementById('theme-toggle');
let questions = [];
let questionIndex = 0;
let answers = [];

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function selectExamQuestions() {
  const byId = new Map(database.map((question) => [question.id, question]));
  const selected = new Map();
  config.coverage.forEach((pool) => {
    shuffle(pool.questionIds.map((id) => byId.get(id)).filter(Boolean))
      .slice(0, pool.minimum)
      .forEach((question) => selected.set(question.id, question));
  });
  const traumaPool = database.filter((question) => config.traumaTopics.includes(question.topic));
  shuffle(traumaPool).forEach((question) => {
    if (selected.size < config.questionCount) selected.set(question.id, question);
  });
  return shuffle([...selected.values()]).slice(0, config.questionCount);
}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.dataset.theme = dark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.textContent = dark ? 'Light mode' : 'Dark mode';
}

let storedTheme = 'light';
try { storedTheme = localStorage.getItem('las-revision-theme') || 'light'; } catch { /* Optional preference. */ }
applyTheme(storedTheme);
themeToggle.addEventListener('click', () => {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('las-revision-theme', nextTheme); } catch { /* Optional preference. */ }
  applyTheme(nextTheme);
});

function topicName(topicId) {
  return topicId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderQuestion() {
  const question = questions[questionIndex];
  if (!question) return renderResults();
  countLabel.textContent = `Question ${questionIndex + 1} of ${questions.length}`;
  const progress = Math.round((questionIndex / questions.length) * 100);
  const options = shuffle(question.options.map((text, index) => ({ text, index })));
  content.innerHTML = `<div class="exam-progress" aria-label="Exam progress"><span style="width:${progress}%"></span></div><p class="exam-category">${topicName(question.topic)}</p><p class="exam-question">${question.question}</p><div class="exam-options">${options.map((item) => `<button type="button" data-index="${item.index}">${item.text}</button>`).join('')}</div><p class="exam-feedback" id="exam-feedback" aria-live="polite"></p><div class="exam-actions"><button class="exam-button" id="next-question" type="button" disabled>${questionIndex === questions.length - 1 ? 'Finish exam' : 'Next question'}</button></div>`;
  content.querySelectorAll('.exam-options button').forEach((button) => button.addEventListener('click', () => answerQuestion(question, button)));
  content.querySelector('#next-question').addEventListener('click', () => { questionIndex += 1; renderQuestion(); });
}

function answerQuestion(question, button) {
  const chosen = Number(button.dataset.index);
  const correct = chosen === question.answer;
  answers[questionIndex] = { id: question.id, correct };
  content.querySelectorAll('.exam-options button').forEach((item) => {
    item.disabled = true;
    if (Number(item.dataset.index) === question.answer) item.classList.add('correct');
  });
  if (!correct) button.classList.add('wrong');
  const feedback = content.querySelector('#exam-feedback');
  feedback.className = `exam-feedback${correct ? '' : ' error'}`;
  feedback.textContent = `${correct ? 'Correct.' : 'Not quite.'} ${question.explanation}`;
  content.querySelector('#next-question').disabled = false;
}

function renderResults() {
  const correct = answers.filter((answer) => answer?.correct).length;
  const percentage = Math.round((correct / questions.length) * 100);
  if (window.lasProgress?.recordQuestionResults) window.lasProgress.recordQuestionResults(answers);
  countLabel.textContent = `${questions.length} questions completed`;
  const covered = config.coverage.map((pool) => pool.label);
  content.innerHTML = `<div class="exam-result"><h2>Exam complete</h2><p>You scored <strong>${correct}/${questions.length} (${percentage}%)</strong>.</p><p>Review the topic pages for any areas that need more practice.</p><div class="exam-coverage">${covered.map((label) => `<span>${label}</span>`).join('')}</div><div class="exam-actions"><button class="exam-button" id="new-exam" type="button">Start a new exam</button><a class="exam-button secondary" href="index.html">Return to dashboard</a></div></div>`;
  content.querySelector('#new-exam').addEventListener('click', startExam);
}

function startExam() {
  questions = selectExamQuestions();
  questionIndex = 0;
  answers = [];
  renderQuestion();
}

startExam();

if (typeof module !== 'undefined') module.exports = { selectExamQuestions };
