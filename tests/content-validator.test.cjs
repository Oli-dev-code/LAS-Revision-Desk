const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadBrowserData, validateContent } = require('../scripts/content-validator.cjs');

const root = path.resolve(__dirname, '..');

test('the shipped content passes structural validation', () => {
  const result = validateContent({ ...loadBrowserData(root), docsDir: path.join(root, 'docs'), now: new Date('2026-11-11') });
  assert.equal(result.errors.length, 0, result.errors.map((problem) => `${problem.code}: ${problem.message}`).join('\n'));
  assert.ok(result.summary.diagramQuestions > 0);
});

test('content validation catches common question defects', () => {
  const base = { id: 'x-01', topic: 'body', question: 'Same question', options: ['A', 'B'], answer: 0, explanation: 'Because.' };
  const result = validateContent({
    questions: [
      base,
      { ...base, id: 'x-02', options: ['A', ''], answer: 4, explanation: '' },
      { id: 'x-03', topic: 'missing-topic', question: 'Another question', options: ['A', 'B'], answer: 0, explanation: 'Because.' }
    ],
    topics: [{ id: 'body', name: 'Body', source: 'body 2026.pdf' }],
    learnContent: { body: {} },
    docsDir: root,
    now: new Date('2026-11-11')
  });
  const codes = new Set(result.errors.map((problem) => problem.code));
  assert.ok(codes.has('duplicate-question'));
  assert.ok(codes.has('empty-option'));
  assert.ok(codes.has('invalid-answer-index'));
  assert.ok(codes.has('unknown-question-topic'));
});

test('content validation catches invalid diagram coordinates and stale sources', () => {
  const result = validateContent({
    questions: [{
      id: 'diagram-01', topic: 'body', type: 'diagram', question: 'Label it', explanation: 'Explanation.',
      diagram: { image: 'missing.png', alt: 'Diagram', labels: [{ id: 'one', name: 'One', x: 101, y: 20, targetX: 20, targetY: -1, targetWidthPercent: 0, targetHeightPercent: 101 }] }
    }],
    topics: [{ id: 'body', name: 'Body', source: 'body 2019.pdf' }],
    learnContent: { body: {} },
    docsDir: root,
    now: new Date('2026-11-11')
  });
  assert.ok(result.errors.some((problem) => problem.code === 'invalid-diagram-coordinate'));
  assert.ok(result.errors.some((problem) => problem.code === 'invalid-diagram-dimension'));
  assert.ok(result.warnings.some((problem) => problem.code === 'outdated-source-document'));
});

test('content validation catches quality and coverage risks', () => {
  const result = validateContent({
    questions: [
      { id: 'quality-01', topic: 'body', question: 'Which action is appropriate?', options: ['A', 'A', 'All of the above', 'D'], answer: 0, explanation: 'Use the appropriate action.' },
      { id: 'quality-02', topic: 'body', question: 'Which action is safe?', options: ['A', 'B', 'C', 'D'], answer: 0, explanation: 'Use the appropriate action.' },
      { id: 'quality-03', topic: 'body', question: 'Which action is unsafe?', options: ['A', 'B', 'C', 'D'], answer: 0, explanation: 'A distinct explanation.' }
    ],
    topics: [{ id: 'body', name: 'Body', source: 'body 2026.pdf' }, { id: 'empty', name: 'Empty', source: 'empty 2026.pdf' }],
    learnContent: { body: {}, empty: {} },
    docsDir: root,
    now: new Date('2026-11-11')
  });
  const warningCodes = new Set(result.warnings.map((problem) => problem.code));
  assert.ok(result.errors.some((problem) => problem.code === 'duplicate-option'));
  assert.ok(warningCodes.has('duplicate-explanation'));
  assert.ok(warningCodes.has('unrealistic-distractor'));
  assert.ok(warningCodes.has('low-topic-coverage'));
  assert.ok(warningCodes.has('answer-balance'));
});

test('content validation requires complete diagram coordinates and non-empty images', () => {
  const result = validateContent({
    questions: [{
      id: 'diagram-02', topic: 'body', type: 'diagram', question: 'Label it', explanation: 'Explanation.',
      diagram: { image: 'tests/fixtures/empty-diagram.png', alt: 'Diagram', labels: [{ id: 'one', name: 'One', x: 20 }] }
    }],
    topics: [{ id: 'body', name: 'Body', source: 'body 2026.pdf' }],
    learnContent: { body: {} },
    docsDir: root,
    now: new Date('2026-11-11')
  });
  assert.ok(result.errors.some((problem) => problem.code === 'missing-diagram-coordinate'));
  assert.ok(result.errors.some((problem) => problem.code === 'missing-diagram-image'));
});
