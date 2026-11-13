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
  return { topics: context.window.topicCatalog, grouping: context.window.topicGrouping };
}

function loadProgressStore(seed = {}) {
  const values = new Map();
  Object.entries(seed).forEach(([key, value]) => values.set(key, String(value)));
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
  const { grouping } = loadTopicCatalog();
  const categoryFor = grouping.categoryFor;
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
  const packageVersion = JSON.parse(read('package.json')).version;
  assert.match(read('app-version.js'), new RegExp(`['\"]${packageVersion.replace(/\./g, '\\.') }['\"]`));
  assert.doesNotMatch(read('app.js'), /data-view===['\"](?:practice|notes)['\"]|data-view === ['\"](?:practice|notes)['\"]/);
});

test('theme preference has one shared persistent controller', () => {
  const sharedUi = read('shared-ui.js');
  assert.match(sharedUi, /localStorage\.setItem\('las-revision-theme'/);
  assert.match(read('app.js'), /lasUi\?\.bindThemeToggle\(themeToggle\)/);
  assert.match(read('dashboard-pwa-controls.js'), /lasUi\?\.bindThemeToggle\(themeToggle\)/);
  assert.doesNotMatch(read('dashboard-pwa-controls.js'), /saveTheme|readTheme|setTheme/);
});

test('progress time keys use the local calendar date', () => {
  const progressStore = read('progress-store.js');
  assert.match(progressStore, /getFullYear\(\)/);
  assert.match(progressStore, /dateKey: localDateKey/);
  assert.doesNotMatch(progressStore, /toISOString\(\)\.slice\(0, 10\)/);
});

test('study time cards recover today\'s total from the rhythm bucket', () => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const context = loadProgressStore({
    'las-revision-time-stats': JSON.stringify({ totalMs: 3600000, todayDate: todayKey, todayMs: 0, dailyMs: { [todayKey]: 1800000 } })
  });
  assert.ok(context.progress.revisionTime().todayMs >= 1800000);
});

test('study time migration restores legacy today totals to the rhythm history', () => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const context = loadProgressStore({
    'las-revision-time-stats': JSON.stringify({ totalMs: 3600000, todayDate: todayKey, todayMs: 2400000 })
  });
  assert.ok(context.progress.revisionTime().dailyMs[todayKey] >= 2400000);
  const stored = JSON.parse(context.localStorage.getItem('las-revision-time-stats'));
  assert.ok(stored.dailyMs[todayKey] >= 2400000);
});

test('Trauma Exam selects 50 questions with required coverage pools', () => {
  const context = { window: {} };
  vm.runInNewContext(`${read('question-bank.js')}\nwindow.loadedQuestions = questionDatabase;`, context);
  const config = context.window.traumaExamConfig;
  const examSource = read('trauma-exam.js');
  assert.equal(config.questionCount, 50);
  assert.equal(config.recentExamCount, 3);
  assert.equal(config.topicQuotaBuffer, 2);
  assert.equal(config.coverage.length, 16);
  assert.ok(config.coverage.some((pool) => pool.id === 'cushings-triad' && pool.questionIds.length >= 5 && pool.questionIds.includes('head-injuries-34')));
  assert.ok(config.coverage.some((pool) => pool.id === 'retroperitoneal' && pool.questionIds.length >= 5 && pool.questionIds.includes('abdominal-injuries-34')));
  assert.ok(config.coverage.some((pool) => pool.id === 'msc' && pool.questionIds.includes('musculoskeletal-injuries-17')));
  assert.ok(config.traumaTopics.includes('burns'));
  assert.ok(config.traumaTopics.includes('suspension-blast-ballistics'));
  assert.match(examSource, /readRotationHistory/);
  assert.match(examSource, /otherRotationKey/);
  assert.match(examSource, /slice\(-recentExamCount\)/);
});

test('Medical Exam config selects 50 questions with requested coverage', () => {
  const context = { window: {} };
  vm.runInNewContext(`${read('question-bank.js')}\nwindow.loadedQuestions = questionDatabase;`, context);
  const config = context.window.medicalExamConfig;
  assert.equal(config.questionCount, 50);
  assert.equal(config.recentExamCount, 3);
  assert.equal(config.topicQuotaBuffer, 2);
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

test('Medical and Trauma exams can flag questions for later review', () => {
  const exam = read('trauma-exam.js');
  assert.match(exam, /id="flag-question"/);
  assert.match(exam, /setQuestionFlagged\(question\.id/);
  assert.match(exam, /las-revision-flagged-question-ids/);
  assert.match(exam, /Remove flag/);
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

test('multiple-choice answer positions do not repeat for the same question', () => {
  const storage = new Map();
  const context = {
    window: {},
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    Math
  };
  vm.runInNewContext(`${read('question-bank.js')}`, context);
  const question = { id: 'position-test', options: ['Wrong 1', 'Correct', 'Wrong 2', 'Wrong 3'], answer: 1 };
  const first = context.shuffledAnswerOptions(question);
  const second = context.shuffledAnswerOptions(question);
  const firstCorrectPosition = first.findIndex((option) => option.index === question.answer);
  const secondCorrectPosition = second.findIndex((option) => option.index === question.answer);
  assert.notEqual(firstCorrectPosition, secondCorrectPosition);
  assert.deepEqual(Array.from(first, (option) => option.index).sort(), [0, 1, 2, 3]);
  assert.deepEqual(Array.from(second, (option) => option.index).sort(), [0, 1, 2, 3]);
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
  const { topics } = loadTopicCatalog();
  const respiratoryMatches = filterTopics(topics, { query: 'respiratory' });
  assert.ok(respiratoryMatches.some((topic) => topic.id === 'respiratory'));
  assert.ok(respiratoryMatches.length >= 1);
  assert.ok(filterTopics(topics, { category: 'Trauma & emergencies' }).every((topic) => topic.id !== 'body' && topic.id !== 'musculoskeletal' && topic.id !== 'cardiovascular' && topic.id !== 'respiratory' && topic.id !== 'nervous' && topic.id !== 'digestive'));
  assert.deepEqual(Array.from(filterTopics(topics, { status: 'reviewed', learnt: ['body'] }).map((topic) => topic.id)), ['body']);
  assert.deepEqual(Array.from(filterTopics(topics, { status: 'in-progress', history: { 'respiratory-01': { answered: 1 } } }).map((topic) => topic.id)), ['respiratory']);
});

test('topic numbering resets within each displayed group', () => {
  const { topics, grouping } = loadTopicCatalog();
  const libraryGroups = grouping.categoryOrder.map((category) => topics.filter((topic) => grouping.categoryFor(topic) === category));
  assert.equal(libraryGroups.reduce((total, group) => total + group.length, 0), topics.length);
  assert.ok(libraryGroups.every((group) => group.length > 0));
  grouping.dashboardGroups.forEach((group) => {
    const groupTopics = topics.filter(group.matches);
    assert.ok(groupTopics.length > 0);
    assert.equal(groupTopics[0].id, group.name === 'Medical' ? 'body' : 'trauma');
  });
  assert.match(read('topics-page.js'), /topic-library-group/);
  assert.match(read('app.js'), /topicsInGroup\.map\(\(topic, index\)/);
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
  assert.match(read('update-check.html'), /las-revision:\/\/check/);
  assert.match(read('update-check.html'), /Check for updates/);
  assert.match(read('update-check.js'), /showChecking/);
  assert.match(updater, /manualUpdateCheckInProgress/);
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
  assert.match(studyPage, /TOPIC PERFORMANCE/);
  assert.match(studyPage, /CONFIDENCE GAPS/);
  assert.match(studyPage, /MISSED-QUESTION CAUSES/);
  assert.match(studyPage, /Missed/);
  assert.match(studyPage, /result-flag-row.*reportButtonMarkup|wrong-answer.*reportButtonMarkup/s);
  assert.match(studyPage, /focused-test\.html\?topic=/);
  assert.match(studyPage, /learn\.html\?topic=/);
  assert.match(styles, /\.results-summary/);
  assert.match(styles, /\.recommendation-card/);
  assert.match(styles, /\.confidence-grid/);
  assert.match(styles, /\.feedback-panel/);
  const exam = read('trauma-exam.js');
  assert.match(exam, /Topic performance/);
  assert.match(exam, /Confidence gaps/);
  assert.match(exam, /Recommended follow-up/);
  assert.match(exam, /exam-review-item.*reportButtonMarkup/s);
});
