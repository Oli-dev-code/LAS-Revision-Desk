if (!document.querySelector('script[data-question-report-loader]')) {
  const reportConfigScript = document.createElement('script');
  reportConfigScript.src = 'report-config.js';
  reportConfigScript.dataset.questionReportLoader = 'true';
  reportConfigScript.onload = () => { const reportScript = document.createElement('script'); reportScript.src = 'question-report.js'; document.head.appendChild(reportScript); };
  document.head.appendChild(reportConfigScript);
}
const database = window.questionDatabase || [];
const assessmentFeedbackReady = window.lasAssessmentFeedback ? Promise.resolve() : new Promise((resolve) => {
  const feedbackScript = document.createElement('script');
  feedbackScript.src = 'assessment-feedback.js';
  feedbackScript.onload = resolve;
  feedbackScript.onerror = resolve;
  document.head.appendChild(feedbackScript);
});
const examType = document.body.dataset.examType || 'trauma';
const config = window[`${examType}ExamConfig`] || { questionCount: 50, medicalTopics: [], traumaTopics: [], coverage: [] };
const content = document.getElementById('exam-content');
const countLabel = document.getElementById('exam-count');
const themeToggle = document.getElementById('theme-toggle');
let questions = [];
let questionIndex = 0;
let answers = [];
let answerMeta = [];
let questionPresentedAt = Date.now();
let sessionStart = Date.now();
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
  const topicPool = config.traumaTopics || config.medicalTopics || [];
  const examPool = database.filter((question) => topicPool.includes(question.topic));
  const examIds = new Set(examPool.map((question) => question.id));
  const isMedicalExam = examType === 'medical';
  const usedKey = 'las-revision-medical-exam-used-question-ids';
  let used = new Set();
  if (isMedicalExam) {
    try {
      const stored = JSON.parse(localStorage.getItem(usedKey) || '[]');
      used = new Set(Array.isArray(stored) ? stored.filter((id) => examIds.has(id)) : []);
    } catch { used = new Set(); }
  }
  let freshPool = examPool.filter((question) => !used.has(question.id));
  if (isMedicalExam && freshPool.length === 0) {
    used = new Set();
    freshPool = [...examPool];
  }
  const selected = new Map();
  const freshIds = new Set(freshPool.map((question) => question.id));
  const coveragePools = config.coverage.map((pool) => ({
    pool,
    candidates: pool.questionIds.map((id) => byId.get(id)).filter((question) => question && examIds.has(question.id))
  })).sort((left, right) => {
    const leftFresh = left.candidates.filter((question) => freshIds.has(question.id)).length;
    const rightFresh = right.candidates.filter((question) => freshIds.has(question.id)).length;
    return leftFresh - rightFresh;
  });
  coveragePools.forEach(({ pool, candidates }) => {
    const alreadyCovered = candidates.filter((question) => selected.has(question.id)).length;
    const needed = Math.max(0, pool.minimum - alreadyCovered);
    shuffle(candidates.filter((question) => freshIds.has(question.id) && !selected.has(question.id)))
      .slice(0, needed)
      .forEach((question) => selected.set(question.id, question));
  });
  coveragePools.forEach(({ pool, candidates }) => {
    const alreadyCovered = candidates.filter((question) => selected.has(question.id)).length;
    const needed = Math.max(0, pool.minimum - alreadyCovered);
    shuffle(candidates.filter((question) => !selected.has(question.id)))
      .slice(0, needed)
      .forEach((question) => selected.set(question.id, question));
  });
  shuffle(freshPool).forEach((question) => {
    if (selected.size < config.questionCount) selected.set(question.id, question);
  });
  shuffle(examPool).forEach((question) => {
    if (selected.size < config.questionCount) selected.set(question.id, question);
  });
  const result = shuffle([...selected.values()]).slice(0, config.questionCount);
  if (isMedicalExam) {
    try { localStorage.setItem(usedKey, JSON.stringify([...new Set([...used, ...result.map((question) => question.id)])])); } catch { /* Exam rotation is best effort when storage is unavailable. */ }
  }
  return result;
}

function bindSharedTheme() {
  if (window.lasUi) { window.lasUi.bindThemeToggle(themeToggle); return; }
  const sharedUi = document.createElement('script');
  sharedUi.src = 'shared-ui.js';
  sharedUi.onload = () => window.lasUi?.bindThemeToggle(themeToggle);
  document.head.appendChild(sharedUi);
}
bindSharedTheme();

function topicName(topicId) {
  return topicId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isQuestionFlagged(questionId) {
  if (window.lasProgress?.isQuestionFlagged) return window.lasProgress.isQuestionFlagged(questionId);
  try { return JSON.parse(localStorage.getItem('las-revision-flagged-question-ids') || '[]').includes(questionId); } catch { return false; }
}

function setQuestionFlagged(questionId, flagged) {
  if (window.lasProgress?.setQuestionFlagged) return window.lasProgress.setQuestionFlagged(questionId, flagged);
  try {
    const ids = new Set(JSON.parse(localStorage.getItem('las-revision-flagged-question-ids') || '[]'));
    if (flagged) ids.add(questionId); else ids.delete(questionId);
    localStorage.setItem('las-revision-flagged-question-ids', JSON.stringify([...ids]));
  } catch { /* Flags are optional when storage is unavailable. */ }
  return flagged;
}

function bindFlagButton(question) {
  const button = document.getElementById('flag-question');
  if (!button) return;
  button.addEventListener('click', () => {
    const flagged = setQuestionFlagged(question.id, !isQuestionFlagged(question.id));
    button.setAttribute('aria-pressed', String(flagged));
    button.textContent = flagged ? 'Remove flag' : 'Flag question';
  });
}
function reportButtonMarkup(question) {
  const name = topicName(question.topic);
  return `<button class="exam-button question-report-button" type="button" data-report-question data-question-id="${encodeURIComponent(question.id)}" data-topic-id="${encodeURIComponent(question.topic)}" data-topic-name="${encodeURIComponent(name)}" data-question-text="${encodeURIComponent(question.question)}" data-mode="${examType}-exam" aria-label="Report this question">Report question</button>`;
}

function renderQuestion() {
  const question = questions[questionIndex];
  if (!question) return renderResults();
  questionPresentedAt = Date.now();
  selectedAnswer = null;
  countLabel.textContent = `Question ${questionIndex + 1} of ${questions.length}`;
  const progress = Math.round((questionIndex / questions.length) * 100);
  const options = shuffledAnswerOptions(question);
  const flagged = isQuestionFlagged(question.id);
  content.innerHTML = `<div class="exam-progress" aria-label="Exam progress"><span style="width:${progress}%"></span></div><p class="exam-category">${topicName(question.topic)}</p><p class="exam-question">${question.question}</p><div class="exam-options">${options.map((item) => `<button type="button" data-index="${item.index}">${item.text}</button>`).join('')}</div><p class="exam-feedback" id="exam-feedback" aria-live="polite">Select an answer to continue. Answers and explanations are shown at the end.</p><div class="exam-actions"><button class="exam-button exam-flag-button${flagged ? ' flagged' : ''}" id="flag-question" type="button" aria-pressed="${flagged}">${flagged ? 'Remove flag' : 'Flag question'}</button>${reportButtonMarkup(question)}<button class="exam-button" id="next-question" type="button" disabled>${questionIndex === questions.length - 1 ? 'Finish exam' : 'Next question'}</button></div>`;
  bindFlagButton(question);
  content.querySelectorAll('.exam-options button').forEach((button) => button.addEventListener('click', () => selectAnswer(button)));
  content.querySelector('#next-question').addEventListener('click', () => {
    submitAnswer(question);
    questionIndex += 1;
    renderQuestion();
  });
}

function selectAnswer(button) {
  if (selectedAnswer !== null && selectedAnswer !== Number(button.dataset.index)) answerMeta[questionIndex] = { ...(answerMeta[questionIndex] || {}), answerChanges: (answerMeta[questionIndex]?.answerChanges || 0) + 1 };
  selectedAnswer = Number(button.dataset.index);
  content.querySelectorAll('.exam-options button').forEach((item) => item.classList.toggle('selected', item === button));
  content.querySelector('#next-question').disabled = false;
}

function submitAnswer(question) {
  const correct = selectedAnswer === question.answer;
  answers[questionIndex] = { id: question.id, selected: selectedAnswer, correct };
  answerMeta[questionIndex] = { ...(answerMeta[questionIndex] || {}), responseMs: Date.now() - questionPresentedAt, submittedAt: Date.now() };
}

function renderResults() {
  if (!window.lasAssessmentFeedback) { assessmentFeedbackReady.then(renderResults); return; }
  const correct = answers.filter((answer) => answer?.correct).length;
  const percentage = Math.round((correct / questions.length) * 100);
  if (window.lasProgress?.recordQuestionResults) window.lasProgress.recordQuestionResults(answers);
  const attempts = questions.map((question, index) => ({ ...(answers[index] || {}), answered: answers[index]?.selected !== null && answers[index]?.selected !== undefined, correct: Boolean(answers[index]?.correct), responseMs: answerMeta[index]?.responseMs || 0, answerChanges: answerMeta[index]?.answerChanges || 0 }));
  const feedback = window.lasAssessmentFeedback.saveSessionSummary(window.lasAssessmentFeedback.summariseSession(questions, attempts, { mode: `${examType}-exam`, durationMs: Date.now() - sessionStart }));
  countLabel.textContent = `${questions.length} questions completed`;
  const covered = config.coverage.map((pool) => pool.label);
  const topicPerformance = `<section class="exam-feedback-panel"><h2>Topic performance</h2><div class="exam-topic-performance">${feedback.topics.map((item) => `<div><span>${topicName(item.topicId)}</span><strong>${item.accuracy}%</strong><small>${item.correct}/${item.questions} correct · ${item.status === 'needs-review' ? 'Needs review' : item.status === 'developing' ? 'Developing' : 'Strong'}</small></div>`).join('')}</div></section>`;
  const confidence = `<section class="exam-feedback-panel"><h2>Confidence gaps</h2><p class="exam-feedback-note">Behavior-based indicators are approximate, not a judgement of confidence.</p><div class="exam-confidence-grid"><div><strong>${feedback.confidenceGaps.overconfident}</strong><span>Quick incorrect</span><small>Likely over-confidence</small></div><div><strong>${feedback.confidenceGaps.underconfident}</strong><span>Slow or changed correct</span><small>Likely under-confidence</small></div><div><strong>${feedback.confidenceGaps.hesitation}</strong><span>Changed incorrect</span><small>Hesitation</small></div></div></section>`;
  const recommendations = feedback.recommendations.length ? `<section class="exam-feedback-panel"><h2>Recommended follow-up</h2><div class="exam-recommendations">${feedback.recommendations.map((item) => `<article><strong>${item.topicId ? topicName(item.topicId) : item.title}</strong><small>${item.detail}</small><div>${item.topicId ? `<a class="exam-button secondary" href="learn.html?topic=${encodeURIComponent(item.topicId)}">Learn</a><a class="exam-button secondary" href="focused-test.html?topic=${encodeURIComponent(item.topicId)}">Focused test</a>` : `<a class="exam-button secondary" href="quiz.html?topic=${encodeURIComponent(feedback.topics[0]?.topicId || '')}">Quiz</a>`}</div></article>`).join('')}</div></section>` : '';
  const causeMarkup = `<section class="exam-feedback-panel"><h2>Missed-question causes</h2>${feedback.details.filter((item) => !item.correct).map((item) => `<details class="exam-cause"><summary>${topicName(item.topicId)} · ${item.causeLabel}</summary><small>${item.responseMs ? `${Math.round(item.responseMs / 1000)}s response` : 'No response time recorded'}${item.answerChanges ? ` · ${item.answerChanges} answer change${item.answerChanges === 1 ? '' : 's'}` : ''}</small></details>`).join('') || '<p class="exam-feedback-note">No missed questions to classify.</p>'}</section>`;
  const review = questions.map((question, index) => {
    const answer = answers[index];
    const selected = answer ? question.options[answer.selected] : 'No answer selected';
    const resultClass = answer?.correct ? 'correct' : 'wrong';
    return `<article class="exam-review-item ${resultClass}"><p class="exam-review-status">Question ${index + 1} · ${answer?.correct ? 'Correct' : 'Incorrect'}</p><h3>${question.question}</h3><p><strong>Your answer:</strong> ${selected}</p><p><strong>Correct answer:</strong> ${question.options[question.answer]}</p><p class="exam-review-explanation">${question.explanation}</p></article>`;
  }).join('');
  content.innerHTML = `<div class="exam-result"><h2>Exam complete</h2><p>You scored <strong>${correct}/${questions.length} (${percentage}%)</strong>.</p><p>Answers and explanations are shown below now that the exam is complete.</p><div class="exam-coverage">${covered.map((label) => `<span>${label}</span>`).join('')}</div><div class="exam-actions"><button class="exam-button" id="new-exam" type="button">Start a new exam</button><a class="exam-button secondary" href="index.html">Return to dashboard</a></div></div><section class="exam-review"><h2>Answer review</h2>${review}</section>`;
  content.insertAdjacentHTML('afterbegin', topicPerformance + confidence + recommendations + causeMarkup);
  content.querySelector('#new-exam').addEventListener('click', startExam);
}

function startExam() {
  questions = selectExamQuestions();
  questionIndex = 0;
  answers = [];
  answerMeta = [];
  sessionStart = Date.now();
  selectedAnswer = null;
  renderQuestion();
}

startExam();

if (typeof module !== 'undefined') module.exports = { selectExamQuestions };
