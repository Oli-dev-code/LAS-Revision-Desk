const database = window.questionDatabase || [];
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
function shuffleQuestions(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
let questions = shuffleQuestions(database.filter((item) => item.topic === topic));
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

function renderTest() {
  const question = questions[questionIndex];
  const lastQuestion = questionIndex === questions.length - 1;
  document.getElementById('page-count').textContent = `Question ${questionIndex + 1} of ${questions.length}`;
  document.getElementById('page-content').innerHTML = `<p class="question-label">QUESTION ${(questionIndex + 1).toString().padStart(2, '0')}</p><p class="page-question">${question.question}</p><div class="page-options">${question.options.map((option, index) => `<button data-index="${index}" class="${testAnswers[questionIndex] === index ? 'selected' : ''}">${option}</button>`).join('')}</div><p class="page-feedback" aria-live="polite">Your answer will be marked when you finish the test.</p><button class="page-button" id="next-question" ${testAnswers[questionIndex] === undefined ? 'disabled' : ''}>${lastQuestion ? 'Submit test' : 'Next question'} <span>-></span></button>`;
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
  const score = questions.reduce((total, question, index) => total + (testAnswers[index] === question.answer ? 1 : 0), 0);
  window.lasProgress?.recordQuestions(questions.length, score);
  const missed = questions.filter((question, index) => testAnswers[index] !== question.answer);
  document.getElementById('page-count').textContent = 'Test complete';
  const review = missed.length ? `<div class="wrong-list"><div class="review-heading"><div><span class="results-label">KNOWLEDGE CHECK</span><h2>Review missed questions</h2></div><span class="missed-count">${missed.length} to revisit</span></div>${missed.map((question) => { const index = questions.indexOf(question); return `<article class="wrong-answer"><div class="wrong-question"><span class="question-index">Question ${index + 1}</span><p>${question.question}</p></div><div class="answer-comparison"><div class="answer-line incorrect"><span class="answer-label">Your answer</span><strong>${testAnswers[index] === undefined ? 'No answer selected' : question.options[testAnswers[index]]}</strong></div><div class="answer-line correct"><span class="answer-label">Correct answer</span><strong>${question.options[question.answer]}</strong></div></div><div class="explanation"><span>Why</span><p>${question.explanation}</p></div></article>`; }).join('')}</div>` : '<p class="all-correct">Excellent. You got every question right.</p>';
  document.getElementById('page-content').innerHTML = `<div class="results-summary"><span class="results-label">FINAL SCORE</span><strong>${score} / ${questions.length}</strong><p>${score === questions.length ? 'Excellent work.' : `${questions.length - score} question${questions.length - score === 1 ? '' : 's'} to revisit.`}</p></div>${review}<button class="page-button" id="retry-test">Try again <span><-</span></button>`;
  document.getElementById('retry-test').addEventListener('click', () => { questionIndex = 0; testAnswers = []; questions = shuffleQuestions(database.filter((item) => item.topic === topic)); renderTest(); });
}

function renderQuiz() {
  const question = questions[questionIndex % questions.length];
  document.getElementById('page-count').textContent = `Question ${(questionIndex % questions.length) + 1} of ${questions.length}`;
  document.getElementById('page-content').innerHTML = `<p class="question-label">THINK BEFORE REVEALING</p><p class="page-question">${question.question}</p><button class="page-button" id="reveal-answer">Reveal answer</button><div class="answer-box" id="answer-box" hidden><strong>${question.options[question.answer]}</strong><p>${question.explanation}</p></div><button class="page-link" id="next-question">Next question <span>-></span></button>`;
  document.getElementById('reveal-answer').addEventListener('click', () => { document.getElementById('answer-box').hidden = false; document.getElementById('reveal-answer').textContent = 'Answer revealed'; });
  document.getElementById('next-question').addEventListener('click', () => { questionIndex += 1; renderQuiz(); });
}

if (mode === 'learn') renderLearn();
if (mode === 'test' && questions.length) renderTest();
if (mode === 'quiz' && questions.length) renderQuiz();
if ((mode === 'test' || mode === 'quiz') && !questions.length) document.getElementById('page-content').textContent = 'No questions have been added for this topic yet.';
