const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('source files are UTF-8 and contain no common mojibake markers', () => {
  const sourceExtensions = new Set(['.js', '.cjs', '.html', '.css', '.json', '.md', '.bat', '.yml', '.yaml']);
  const ignoredDirectories = new Set(['.git', 'node_modules', '.playwright-cli', 'docs', 'assets', 'release', 'tmp-airway-management', 'tmp-meds-management']);
  const mojibake = /[\u00c2\u00c3\u00e2\u00f0\u00ef\ufffd]/;
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (ignoredDirectories.has(entry.name)) continue;
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) files.push(filePath);
    }
  };
  visit(root);
  for (const filePath of files) {
    const bytes = fs.readFileSync(filePath);
    const text = bytes.toString('utf8');
    assert.deepEqual(Buffer.from(text, 'utf8'), bytes, `${path.relative(root, filePath)} must be valid UTF-8`);
    assert.doesNotMatch(text, mojibake, `${path.relative(root, filePath)} contains mojibake`);
  }
});

function loadTopicCatalog() {
  const context = { window: {} };
  vm.runInNewContext(read('topic-catalog.js'), context);
  return context.window.topicCatalog;
}

function loadProgressStore() {
  const values = new Map();
  const localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
  const context = {
    window: { setInterval: () => 1, addEventListener: () => {} },
    localStorage,
    Date,
    JSON,
    Math,
    Set,
    Array,
    Object
  };
  vm.runInNewContext(read('progress-store.js'), context);
  return { progress: context.window.lasProgress, localStorage };
}

function filterTopics(topics, { query = '', category = 'all', status = 'all', learnt = [], history = {} } = {}) {
  const traumaTopics = new Set(['trauma', 'chest-injuries', 'drowning', 'suspension-blast-ballistics', 'abdominal-conditions', 'cardiac-conditions', 'burns', 'extrication-light-rescue']);
  const categoryFor = (topic) => topic.id === 'body' ? 'Foundations' : traumaTopics.has(topic.id) ? 'Trauma & emergencies' : 'Body systems';
  const statusFor = (topic) => learnt.includes(topic.id) ? 'reviewed' : Object.keys(history).some((id) => id.startsWith(`${topic.id}-`) && history[id]?.answered) ? 'in-progress' : 'not-started';
  const normalized = query.trim().toLowerCase();
  return topics.filter((topic) => {
    const matchesSearch = !normalized || [topic.name, topic.description, topic.source].some((value) => value.toLowerCase().includes(normalized));
    return matchesSearch && (category === 'all' || categoryFor(topic) === category) && (status === 'all' || statusFor(topic) === status);
  });
}

test('navigation exposes the dashboard and topic-library routes', () => {
  const index = read('index.html');
  assert.match(index, /data-view="overview"/);
  assert.match(index, /data-view="topics"/);
  assert.match(index, /href="learn\.html\?topic=/);
  assert.match(index, /href="test\.html\?topic=/);
  assert.match(index, /href="quiz\.html\?topic=/);
  assert.doesNotMatch(index, /data-view="practice"|data-view="notes"/);
  const app = read('app.js');
  assert.match(app, /course-group/);
  assert.match(app, /course-group-toggle/);
  assert.match(app, /aria-expanded="false"/);
  assert.match(app, /\['Medical'/);
  assert.match(app, /\['Trauma'/);
  assert.match(read('index.html'), /Medical Exam/);
  assert.match(read('index.html'), /Trauma Exam/);
  assert.match(read('index.html'), /href="medical-exam\.html"/);
  assert.match(read('index.html'), /href="trauma-exam\.html"/);
});

test('Trauma Exam selects 50 questions with required coverage pools', () => {
  const context = { window: {} };
  vm.runInNewContext(`${read('question-bank.js')}\nwindow.loadedQuestions = questionDatabase;`, context);
  const config = context.window.traumaExamConfig;
  assert.equal(config.questionCount, 50);
  assert.equal(config.coverage.length, 16);
  assert.ok(config.coverage.some((pool) => pool.id === 'cushings-triad' && pool.questionIds.includes('head-injuries-23')));
  assert.ok(config.coverage.some((pool) => pool.id === 'retroperitoneal' && pool.questionIds.includes('abdominal-injuries-02')));
  assert.ok(config.coverage.some((pool) => pool.id === 'msc' && pool.questionIds.includes('musculoskeletal-injuries-17')));
  assert.ok(config.traumaTopics.includes('burns'));
  assert.ok(config.traumaTopics.includes('suspension-blast-ballistics'));
});

test('Medical Exam config selects 50 questions with requested coverage', () => {
  const context = { window: {} };
  vm.runInNewContext(`${read('question-bank.js')}\nwindow.loadedQuestions = questionDatabase;`, context);
  const config = context.window.medicalExamConfig;
  assert.equal(config.questionCount, 50);
  assert.ok(config.coverage.some((pool) => pool.id === 'infection-terms' && pool.questionIds.includes('sepsis-31')));
  assert.ok(config.coverage.some((pool) => pool.id === 'oxygen-masks' && pool.questionIds.includes('medical-gases-15')));
  assert.ok(config.coverage.some((pool) => pool.id === 'suction' && pool.questionIds.includes('airway-management-23')));
  assert.ok(config.coverage.some((pool) => pool.id === 'ecg' && pool.questionIds.includes('ecg-interpretation-14')));
  assert.ok(config.medicalTopics.includes('sepsis'));
  assert.ok(config.medicalTopics.includes('respiratory-conditions'));
});

test('Medical and Trauma exams submit answers only when advancing', () => {
  const exam = read('trauma-exam.js');
  assert.match(exam, /selectedAnswer = Number\(button\.dataset\.index\)/);
  assert.match(exam, /submitAnswer\(question\)/);
  assert.match(exam, /answers\[questionIndex\] = \{ id: question\.id, selected: selectedAnswer, correct \}/);
  assert.doesNotMatch(exam, /item\.disabled = true/);
});

test('question scoring identifies the configured correct answer', () => {
  const questions = [];
  const context = { window: {}, questionDatabase: questions };
  vm.runInNewContext(`${read('question-bank.js')}\nwindow.loadedQuestions = questionDatabase;`, context);
  const question = context.window.loadedQuestions.find((item) => item.topic === 'body');
  assert.ok(question);
  assert.equal(question.options[question.answer], 'Organs');
  assert.notEqual(question.options[question.answer], question.options[(question.answer + 1) % question.options.length]);
});

test('progress persistence records totals, incorrect questions, and per-question history', () => {
  const { progress, localStorage } = loadProgressStore();
  progress.recordQuestionResults([
    { id: 'body-01', correct: true },
    { id: 'body-02', correct: false }
  ]);
  const stats = progress.questionStats();
  assert.equal(stats.answered, 2);
  assert.equal(stats.correct, 1);
  assert.deepEqual([...stats.incorrectQuestionIds], ['body-02']);
  assert.equal(progress.questionHistory()['body-01'].answered, 1);
  assert.equal(progress.questionHistory()['body-02'].correct, 0);
  assert.ok(localStorage.getItem('las-revision-question-stats'));
  assert.ok(localStorage.getItem('las-revision-question-history'));
});

test('topic filtering searches content and applies category/status filters', () => {
  const topics = loadTopicCatalog();
  const respiratoryMatches = filterTopics(topics, { query: 'respiratory' });
  assert.ok(respiratoryMatches.some((topic) => topic.id === 'respiratory'));
  assert.ok(respiratoryMatches.length >= 1);
  assert.ok(filterTopics(topics, { category: 'Trauma & emergencies' }).every((topic) => topic.id === 'trauma' || topic.id === 'burns' || topic.id === 'drowning' || topic.id === 'chest-injuries' || topic.id === 'suspension-blast-ballistics' || topic.id === 'abdominal-conditions' || topic.id === 'cardiac-conditions' || topic.id === 'extrication-light-rescue'));
  assert.deepEqual(Array.from(filterTopics(topics, { status: 'reviewed', learnt: ['body'] }).map((topic) => topic.id)), ['body']);
  assert.deepEqual(Array.from(filterTopics(topics, { status: 'in-progress', history: { 'respiratory-01': { answered: 1 } } }).map((topic) => topic.id)), ['respiratory']);
});

test('update UI wiring includes progress and recoverable error states', () => {
  const updater = read('electron-main.cjs');
  assert.match(updater, /download-progress/);
  assert.match(updater, /progress\.percent/);
  assert.match(updater, /progress\.bytesPerSecond/);
  assert.match(updater, /remaining/);
  assert.match(updater, /We couldn.?t check for updates/);
  assert.match(updater, /forceDevUpdateConfig/);
  assert.match(updater, /showUpdateReady/);
  assert.match(updater, /startPeriodicUpdateChecks/);
  assert.match(updater, /UPDATE_CHECK_INTERVAL_MS = 30 \* 60 \* 1000/);
  assert.match(updater, /setInterval\(async/);
  assert.match(updater, /Notification/);
  assert.match(updater, /notifyUpdateReady/);
  assert.match(updater, /lastNotifiedUpdateVersion/);
  assert.match(updater, /notification\.on\('click'/);
  assert.doesNotMatch(updater, /showMessageBoxSync/);
  assert.match(read('update-check.html'), /las-revision:\/\/restart/);
  assert.match(read('update-check.html'), /Restart and install/);
});

test('test sessions render richer result summaries and recommendations', () => {
  const studyPage = read('study-page.js');
  const styles = read('study-page.css');
  assert.match(studyPage, /let sessionStart = Date\.now\(\)/);
  assert.match(studyPage, /Time spent/);
  assert.match(studyPage, /Weak topics/);
  assert.match(studyPage, /Missed/);
  assert.match(studyPage, /focused-test\.html\?topic=/);
  assert.match(studyPage, /learn\.html\?topic=/);
  assert.match(styles, /\.results-summary/);
  assert.match(styles, /\.recommendation-card/);
});
