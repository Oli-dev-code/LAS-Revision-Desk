const database = window.questionDatabase || [];
const diagramDatabase = window.diagramQuestionDatabase || [];
const topicCatalog = window.topicCatalog || [
  { id: 'body', name: 'Introduction to the body', source: 'Introduction to the body AAP April 2025 v2.ppsx' },
  { id: 'cardiovascular', name: 'Cardiovascular system', source: 'L3 CV System v1 September 2020.pdf' },
  { id: 'respiratory', name: 'Respiratory system', source: 'AAP Resp system update JUL26.ppsx' },
  { id: 'nervous', name: 'Nervous system', source: 'L3 Nervous System v3 May 2021.ppsx' },
  { id: 'lymphatic-urinary-reproductive', name: 'Lymphatic, urinary & reproductive systems', source: 'L3 Lymphatic, Urinary  Reproductive Systems v1 September 2020.pdf' }
];
const topicNames = Object.fromEntries(topicCatalog.map((item) => [item.id, item.name]));
const materials = {
  body: ['The body is organised from atoms into molecules, cells, tissues, organs and systems. Cells are the smallest unit of life and work together to keep the body functioning.', 'The supplied introduction material covers cell structure, metabolism, tissue types and how the body systems work together.'],
  cardiovascular: ['The cardiovascular system consists of the heart, blood and blood vessels. It transports oxygen and nutrients, removes waste and helps regulate temperature.', 'Deoxygenated blood returns to the right side of the heart, travels to the lungs for gas exchange, then oxygenated blood returns to the left side and is pumped to the body.'],
  respiratory: ['The respiratory system supports gas exchange: oxygen enters the body and carbon dioxide leaves it. It also helps regulate blood acidity, filter inspired air and produce voice.', 'Follow the movement of oxygen from the atmosphere through the airways and lungs, then connect it to circulation and cellular energy production.'],
  nervous: ['The nervous system controls movement, regulates heart rate, creates memories and processes sensory information. It is divided into the central and peripheral nervous systems.', 'The supplied nervous system material covers neurons, the brain, spinal cord, meninges, CSF and the somatic, sympathetic and parasympathetic divisions.'],
  'lymphatic-urinary-reproductive': ['The lymphatic system drains excess tissue fluid, filters it and supports immunity. The urinary and reproductive systems contribute to waste removal, fluid balance and reproduction.', 'Use the source material to connect drainage and immune defence with the body systems that maintain internal balance and support reproduction.'],
  airway: ['Keep the airway open and protected. Listen for snoring, gurgling or stridor and look for signs of obstruction.', 'Use head tilt and chin lift when spinal injury is not suspected. Use a jaw thrust when it is.'],
  'patient-assessment': ['The primary survey is a rapid, structured assessment used to identify and manage immediate life threats.', 'Work through Airway, Breathing, Circulation, Disability and Exposure in order. Treat problems as you find them, then reassess.'],
  trauma: ['Trauma assessment starts with scene safety, a general impression and an immediate search for life-threatening bleeding.', 'Control severe haemorrhage early, protect the spine when indicated and reassess the patient frequently.'],
  medical: ['Start with a general impression, identify immediate threats and use a structured primary survey for every seriously unwell patient.', 'Look for changes in consciousness, breathing, circulation and blood glucose, then escalate early when concerned.']
};
const params = new URLSearchParams(window.location.search);
let topic = params.get('topic') || 'body';
if (!topicNames[topic]) topic = 'body';
const mode = document.body.dataset.mode;
if (!window.lasProgress?.revisionTime) {
  const timerStart = Date.now();
  let timerSaved = timerStart;
  const flushRevisionTime = () => { const elapsed = Math.max(0, Date.now() - timerSaved); if (!elapsed) return; try { const today = new Date().toISOString().slice(0, 10); const stored = JSON.parse(localStorage.getItem('las-revision-time-stats') || '{}'); const time = { totalMs: (stored.totalMs || 0) + elapsed, todayDate: today, todayMs: stored.todayDate === today ? (stored.todayMs || 0) + elapsed : elapsed }; localStorage.setItem('las-revision-time-stats', JSON.stringify(time)); } catch { /* Time tracking is optional when storage is unavailable. */ } timerSaved = Date.now(); };
  window.setInterval(flushRevisionTime, 15000);
  window.addEventListener('beforeunload', flushRevisionTime);
}
const abbreviationGlossary = {
  ATP: 'adenosine triphosphate',
  ADH: 'antidiuretic hormone',
  ANS: 'autonomic nervous system',
  CNS: 'central nervous system',
  CSF: 'cerebrospinal fluid',
  DNA: 'deoxyribonucleic acid',
  PNS: 'peripheral nervous system',
  BP: 'blood pressure',
  CO2: 'carbon dioxide'
};
const abbreviationPattern = new RegExp(`\\b(${Object.keys(abbreviationGlossary).sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');
function withAbbreviationTooltips(text) {
  return String(text).replace(abbreviationPattern, (abbreviation) => `<span class="abbr-wrap" tabindex="0"><span class="abbr-text">${abbreviation}</span><span class="abbr-info" aria-hidden="true">i</span><span class="abbr-tooltip" role="tooltip">${abbreviationGlossary[abbreviation]}</span></span>`);
}
function shuffleQuestions(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
function savedIncorrectQuestionIds() {
  if (window.lasProgress?.questionStats) return new Set(window.lasProgress.questionStats().incorrectQuestionIds || []);
  try { return new Set(JSON.parse(localStorage.getItem('las-revision-question-stats') || '{}').incorrectQuestionIds || []); } catch { return new Set(); }
}
function questionsForSession() {
  const topicQuestions = database.filter((item) => item.topic === topic);
  const topicDiagrams = diagramDatabase.filter((item) => item.topic === topic);
  if (mode === 'quiz') return topicQuestions;
  if (mode === 'focused-test') return [...topicQuestions, ...topicDiagrams].filter((question) => savedIncorrectQuestionIds().has(question.id));
  return [...topicQuestions, ...topicDiagrams];
}
function recordSessionResults() {
  const results = questions.map((question, index) => ({ id: question.id, correct: question.type === 'diagram' ? Boolean(testAnswers[index]?.correct) : testAnswers[index] === question.answer }));
  if (window.lasProgress?.recordQuestionResults) { window.lasProgress.recordQuestionResults(results); return; }
  try {
    const stats = JSON.parse(localStorage.getItem('las-revision-question-stats') || '{"answered":0,"correct":0,"incorrectQuestionIds":[]}');
    const incorrect = new Set(stats.incorrectQuestionIds || []);
    results.forEach((result) => result.correct ? incorrect.delete(result.id) : incorrect.add(result.id));
    stats.answered = (stats.answered || 0) + results.length;
    stats.correct = (stats.correct || 0) + results.filter((result) => result.correct).length;
    stats.incorrectQuestionIds = [...incorrect];
    localStorage.setItem('las-revision-question-stats', JSON.stringify(stats));
  } catch { /* Progress is optional when storage is unavailable. */ }
}
function shuffledSessionQuestions() {
  const selected = shuffleQuestions(questionsForSession());
  if (mode !== 'test' && mode !== 'focused-test') return selected;
  const diagrams = selected.filter((question) => question.type === 'diagram');
  const ordinary = selected.filter((question) => question.type !== 'diagram').slice(0, diagrams.length ? 49 : 50);
  if (diagrams.length) ordinary.splice(Math.floor(Math.random() * (ordinary.length + 1)), 0, diagrams[0]);
  return ordinary;
}
let questions = shuffledSessionQuestions();
let questionIndex = 0;
let testAnswers = [];

const themeToggle = document.getElementById('theme-toggle');
function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.dataset.theme = dark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', dark);
  themeToggle.textContent = dark ? 'Light mode' : 'Dark mode';
}
let storedTheme = 'light';
try { storedTheme = localStorage.getItem('las-revision-theme') || 'light'; } catch { /* File URLs may not expose storage. */ }
applyTheme(storedTheme);
themeToggle.addEventListener('click', () => {
  const theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('las-revision-theme', theme); } catch { /* File URLs may not expose storage. */ }
  applyTheme(theme);
});

const selectedTopicRecord = topicCatalog.find((item) => item.id === topic);
document.getElementById('page-topic').textContent = selectedTopicRecord ? `${topicNames[topic]} - ${selectedTopicRecord.source}` : topicNames[topic];

function renderLearn() {
  document.getElementById('page-content').innerHTML = `<p class="page-lead">${materials[topic][0]}</p><div class="reading-section"><span>01</span><div><h2>What to remember</h2><p>${materials[topic][1]}</p></div></div><div class="reading-section"><span>02</span><div><h2>Keep reassessing</h2><p>After every intervention, repeat your assessment. A patient’s condition can change quickly, so record your findings and communicate concerns clearly.</p></div></div>`;
}

function answerIsCorrect(question, index) {
  return question.type === 'diagram' ? Boolean(testAnswers[index]?.correct) : testAnswers[index] === question.answer;
}

function diagramAnswerText(question, answer) {
  if (!answer?.placements) return 'No labels placed';
  return question.diagram.labels.map((label) => `${label.name}: ${answer.placements[label.id] === label.id ? 'correct' : 'incorrect'}`).join(' | ');
}

function renderDiagramTest(question) {
  const labels = shuffleQuestions(question.diagram.labels);
  const arrows = question.diagram.labels.map((label) => {
    const horizontal = label.x < 50 || label.x > 50;
    const start = horizontal ? { x: label.x < 50 ? 4 : 96, y: label.y } : { x: label.x, y: label.y < 50 ? 7 : 93 };
    return `<line class="diagram-arrow" x1="${start.x}" y1="${start.y}" x2="${label.x}" y2="${label.y}" marker-end="url(#diagram-arrowhead)" />`;
  }).join('');
  const targets = question.diagram.labels.map((label) => `<div class="diagram-target" data-target-id="${label.id}" style="left:${label.x}%;top:${label.y}%"><span>Drop label</span></div>`).join('');
  const tiles = labels.map((label) => `<button class="diagram-label" draggable="true" data-label-id="${label.id}">${label.name}</button>`).join('');
  document.getElementById('page-count').textContent = `Question ${questionIndex + 1} of ${questions.length}`;
  document.getElementById('page-content').innerHTML = `<p class="question-label">DIAGRAM LABEL</p><p class="page-question">${withAbbreviationTooltips(question.question)}</p><div class="diagram-layout"><div class="diagram-board"><img src="${question.diagram.image}" alt="${question.diagram.alt}"><svg class="diagram-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="diagram-arrowhead" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#d68428" /></marker></defs>${arrows}</svg>${targets}</div><div class="diagram-label-bank">${tiles}</div></div><p class="page-feedback" id="diagram-feedback" aria-live="polite">Drag every label onto a matching target.</p><button class="page-button" id="check-diagram" disabled>Check labels</button><button class="page-button" id="next-question" disabled>${questionIndex === questions.length - 1 ? 'Submit test' : 'Next question'} <span>-></span></button>`;
  const placements = {};
  const checkButton = document.getElementById('check-diagram');
  const nextButton = document.getElementById('next-question');
  const refresh = () => {
    document.querySelectorAll('.diagram-target').forEach((target) => {
      const labelId = placements[target.dataset.targetId];
      const label = question.diagram.labels.find((item) => item.id === labelId);
      target.innerHTML = `<span>${label ? label.name : 'Drop label'}</span>`;
      target.classList.toggle('filled', Boolean(label));
    });
    document.querySelectorAll('.diagram-label').forEach((label) => label.classList.toggle('placed', Object.values(placements).includes(label.dataset.labelId)));
    checkButton.disabled = Object.keys(placements).length !== question.diagram.labels.length;
  };
  document.querySelectorAll('.diagram-label').forEach((label) => label.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/plain', label.dataset.labelId)));
  document.querySelectorAll('.diagram-target').forEach((target) => {
    target.addEventListener('dragover', (event) => event.preventDefault());
    target.addEventListener('drop', (event) => {
      event.preventDefault();
      const labelId = event.dataTransfer.getData('text/plain');
      Object.keys(placements).forEach((targetId) => { if (placements[targetId] === labelId) delete placements[targetId]; });
      placements[target.dataset.targetId] = labelId;
      refresh();
    });
  });
  checkButton.addEventListener('click', () => {
    const correct = question.diagram.labels.every((label) => placements[label.id] === label.id);
    testAnswers[questionIndex] = { correct, placements: { ...placements } };
    document.getElementById('diagram-feedback').textContent = correct ? 'All labels are correct.' : 'Some labels are in the wrong place. Review the result at the end of the test.';
    document.getElementById('diagram-feedback').className = `page-feedback${correct ? '' : ' error'}`;
    checkButton.disabled = true;
    nextButton.disabled = false;
  });
}

function renderTest() {
  const question = questions[questionIndex];
  if (question.type === 'diagram') { renderDiagramTest(question); return; }
  const lastQuestion = questionIndex === questions.length - 1;
  document.getElementById('page-count').textContent = `Question ${questionIndex + 1} of ${questions.length}`;
  document.getElementById('page-content').innerHTML = `<p class="question-label">QUESTION ${(questionIndex + 1).toString().padStart(2, '0')}</p><p class="page-question">${withAbbreviationTooltips(question.question)}</p><div class="page-options">${question.options.map((option, index) => `<button data-index="${index}" class="${testAnswers[questionIndex] === index ? 'selected' : ''}">${withAbbreviationTooltips(option)}</button>`).join('')}</div><p class="page-feedback" aria-live="polite">Your answer will be marked when you finish the test.</p><button class="page-button" id="next-question" ${testAnswers[questionIndex] === undefined ? 'disabled' : ''}>${lastQuestion ? 'Submit test' : 'Next question'} <span>-></span></button>`;
  document.querySelectorAll('.page-options button').forEach((button) => button.addEventListener('click', () => {
    testAnswers[questionIndex] = Number(button.dataset.index);
    document.querySelectorAll('.page-options button').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
    document.getElementById('next-question').disabled = false;
  }));
  document.getElementById('next-question').addEventListener('click', () => {
    if (lastQuestion) renderTestResults();
    else { questionIndex += 1; renderTest(); }
  });
}

function renderTestResults() {
  const score = questions.reduce((total, question, index) => total + (answerIsCorrect(question, index) ? 1 : 0), 0);
  recordSessionResults();
  const missed = questions.filter((question, index) => !answerIsCorrect(question, index));
  document.getElementById('page-count').textContent = 'Test complete';
  const review = missed.length ? `<div class="wrong-list"><div class="review-heading"><div><span class="results-label">KNOWLEDGE CHECK</span><h2>Review missed questions</h2></div><span class="missed-count">${missed.length} to revisit</span></div>${missed.map((question) => { const index = questions.indexOf(question); const yourAnswer = question.type === 'diagram' ? diagramAnswerText(question, testAnswers[index]) : (testAnswers[index] === undefined ? 'No answer selected' : question.options[testAnswers[index]]); const correctAnswer = question.type === 'diagram' ? 'Place every label on its matching target' : question.options[question.answer]; return `<article class="wrong-answer"><div class="wrong-question"><span class="question-index">Question ${index + 1}</span><p>${withAbbreviationTooltips(question.question)}</p></div><div class="answer-comparison"><div class="answer-line incorrect"><span class="answer-label">Your answer</span><strong>${withAbbreviationTooltips(yourAnswer)}</strong></div><div class="answer-line correct"><span class="answer-label">Correct answer</span><strong>${withAbbreviationTooltips(correctAnswer)}</strong></div></div><div class="explanation"><span>Why</span><p>${withAbbreviationTooltips(question.explanation)}</p></div></article>`; }).join('')}</div>` : '<p class="all-correct">Excellent. You got every question right.</p>';
  document.getElementById('page-content').innerHTML = `<div class="results-summary"><span class="results-label">FINAL SCORE</span><strong>${score} / ${questions.length}</strong><p>${score === questions.length ? 'Excellent work.' : `${questions.length - score} question${questions.length - score === 1 ? '' : 's'} to revisit.`}</p></div>${review}<button class="page-button" id="retry-test">Try again <span><-</span></button>`;
  document.getElementById('retry-test').addEventListener('click', () => { questionIndex = 0; testAnswers = []; questions = shuffledSessionQuestions(); renderTest(); });
}

function renderQuiz() {
  const question = questions[questionIndex % questions.length];
  document.getElementById('page-count').textContent = `Question ${(questionIndex % questions.length) + 1} of ${questions.length}`;
  document.getElementById('page-content').innerHTML = `<p class="question-label">THINK BEFORE REVEALING</p><p class="page-question">${withAbbreviationTooltips(question.question)}</p><button class="page-button" id="reveal-answer">Reveal answer</button><div class="answer-box" id="answer-box" hidden><strong>${withAbbreviationTooltips(question.options[question.answer])}</strong><p>${withAbbreviationTooltips(question.explanation)}</p></div><button class="page-link" id="next-question">Next question <span>-></span></button>`;
  document.getElementById('reveal-answer').addEventListener('click', () => { document.getElementById('answer-box').hidden = false; document.getElementById('reveal-answer').textContent = 'Answer revealed'; });
  document.getElementById('next-question').addEventListener('click', () => { questionIndex += 1; renderQuiz(); });
}

if (mode === 'learn') renderLearn();
if ((mode === 'test' || mode === 'focused-test') && questions.length) renderTest();
if (mode === 'quiz' && questions.length) renderQuiz();
if ((mode === 'test' || mode === 'focused-test' || mode === 'quiz') && !questions.length) document.getElementById('page-content').textContent = mode === 'focused-test' ? 'No questions currently need focused revision for this topic.' : 'No questions have been added for this topic yet.';
