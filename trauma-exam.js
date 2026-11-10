const database = window.questionDatabase || [];
const examType = document.body.dataset.examType || 'trauma';
const config = window[`${examType}ExamConfig`] || { questionCount: 50, medicalTopics: [], traumaTopics: [], coverage: [] };
const content = document.getElementById('exam-content');
const countLabel = document.getElementById('exam-count');
const themeToggle = document.getElementById('theme-toggle');
let questions = [];
let questionIndex = 0;
let answers = [];
let selectedAnswer = null;

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
  const topicPool = config.traumaTopics || config.medicalTopics || [];
  const examPool = database.filter((question) => topicPool.includes(question.topic));
  shuffle(examPool).forEach((question) => {
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
  selectedAnswer = null;
  countLabel.textContent = `Question ${questionIndex + 1} of ${questions.length}`;
  const progress = Math.round((questionIndex / questions.length) * 100);
  const options = shuffledAnswerOptions(question);
  content.innerHTML = `<div class="exam-progress" aria-label="Exam progress"><span style="width:${progress}%"></span></div><p class="exam-category">${topicName(question.topic)}</p><p class="exam-question">${question.question}</p><div class="exam-options">${options.map((item) => `<button type="button" data-index="${item.index}">${item.text}</button>`).join('')}</div><p class="exam-feedback" id="exam-feedback" aria-live="polite">Select an answer to continue. Answers and explanations are shown at the end.</p><div class="exam-actions"><button class="exam-button" id="next-question" type="button" disabled>${questionIndex === questions.length - 1 ? 'Finish exam' : 'Next question'}</button></div>`;
  content.querySelectorAll('.exam-options button').forEach((button) => button.addEventListener('click', () => selectAnswer(button)));
  content.querySelector('#next-question').addEventListener('click', () => {
    submitAnswer(question);
    questionIndex += 1;
    renderQuestion();
  });
}

function selectAnswer(button) {
  selectedAnswer = Number(button.dataset.index);
  content.querySelectorAll('.exam-options button').forEach((item) => item.classList.toggle('selected', item === button));
  content.querySelector('#next-question').disabled = false;
}

function submitAnswer(question) {
  const correct = selectedAnswer === question.answer;
  answers[questionIndex] = { id: question.id, selected: selectedAnswer, correct };
}

function renderResults() {
  const correct = answers.filter((answer) => answer?.correct).length;
  const percentage = Math.round((correct / questions.length) * 100);
  if (window.lasProgress?.recordQuestionResults) window.lasProgress.recordQuestionResults(answers);
  countLabel.textContent = `${questions.length} questions completed`;
  const covered = config.coverage.map((pool) => pool.label);
  const review = questions.map((question, index) => {
    const answer = answers[index];
    const selected = answer ? question.options[answer.selected] : 'No answer selected';
    const resultClass = answer?.correct ? 'correct' : 'wrong';
    return `<article class="exam-review-item ${resultClass}"><p class="exam-review-status">Question ${index + 1} · ${answer?.correct ? 'Correct' : 'Incorrect'}</p><h3>${question.question}</h3><p><strong>Your answer:</strong> ${selected}</p><p><strong>Correct answer:</strong> ${question.options[question.answer]}</p><p class="exam-review-explanation">${question.explanation}</p></article>`;
  }).join('');
  content.innerHTML = `<div class="exam-result"><h2>Exam complete</h2><p>You scored <strong>${correct}/${questions.length} (${percentage}%)</strong>.</p><p>Answers and explanations are shown below now that the exam is complete.</p><div class="exam-coverage">${covered.map((label) => `<span>${label}</span>`).join('')}</div><div class="exam-actions"><button class="exam-button" id="new-exam" type="button">Start a new exam</button><a class="exam-button secondary" href="index.html">Return to dashboard</a></div></div><section class="exam-review"><h2>Answer review</h2>${review}</section>`;
  content.querySelector('#new-exam').addEventListener('click', startExam);
}

function startExam() {
  questions = selectExamQuestions();
  questionIndex = 0;
  answers = [];
  selectedAnswer = null;
  renderQuestion();
}

startExam();

if (typeof module !== 'undefined') module.exports = { selectExamQuestions };
