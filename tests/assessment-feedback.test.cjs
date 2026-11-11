const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function loadFeedback() {
  const values = new Map();
  const context = { window: {}, localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) }, Date, Math, JSON };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assessment-feedback.js'), 'utf8'), context);
  return context.window.lasAssessmentFeedback;
}

test('classifies automatic confidence and missed-question causes', () => {
  const feedback = loadFeedback();
  assert.equal(feedback.classifyAttempt({ answered: false }).code, 'skipped');
  assert.equal(feedback.classifyAttempt({ answered: true, correct: false, responseMs: 3000, answerChanges: 0 }).code, 'quick-guess');
  assert.equal(feedback.classifyAttempt({ answered: true, correct: false, responseMs: 25000, answerChanges: 0 }).code, 'knowledge-gap');
  assert.equal(feedback.classifyAttempt({ answered: true, correct: false, responseMs: 12000, answerChanges: 1 }).code, 'changed-answer');
  assert.equal(feedback.classifyAttempt({ answered: true, correct: true, responseMs: 22000, answerChanges: 0 }).code, 'under-confident');
});

test('summarises topic performance and recommendations', () => {
  const feedback = loadFeedback();
  const summary = feedback.summariseSession([
    { id: 'airway-01', topic: 'airway' },
    { id: 'airway-02', topic: 'airway' },
    { id: 'sepsis-01', topic: 'sepsis' }
  ], [
    { answered: true, correct: false, responseMs: 3000 },
    { answered: true, correct: true, responseMs: 25000 },
    { answered: true, correct: false, responseMs: 30000 }
  ], { mode: 'test', durationMs: 120000 });
  assert.equal(summary.topics.find((item) => item.topicId === 'airway').accuracy, 50);
  assert.equal(summary.confidenceGaps.overconfident, 1);
  assert.equal(summary.confidenceGaps.underconfident, 1);
  assert.ok(summary.recommendations.length > 0);
});

test('persists only the latest fifty compact session summaries', () => {
  const feedback = loadFeedback();
  for (let index = 0; index < 55; index += 1) feedback.saveSessionSummary({ sessionId: String(index), details: [] });
  const stored = feedback.readSessionSummaries();
  assert.equal(stored.length, 50);
  assert.equal(stored[0].sessionId, '54');
  assert.equal(stored.at(-1).sessionId, '5');
});
