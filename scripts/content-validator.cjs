const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DEFAULT_SOURCE_MAX_AGE_YEARS = 5;

function loadBrowserData(root) {
  const context = {
    window: {},
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    }
  };
  const load = (file) => vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  load('question-bank.js');
  load('topic-catalog.js');
  load('learn-content.js');
  return {
    questions: [...(context.window.questionDatabase || []), ...(context.window.diagramQuestionDatabase || [])],
    topics: context.window.topicCatalog || [],
    learnContent: context.window.learnContent || {}
  };
}

function issue(severity, code, message, details = {}) {
  return { severity, code, message, ...details };
}

function normalizedQuestion(text) {
  return String(text || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function sourceYear(source) {
  const years = [...String(source || '').matchAll(/\b(19|20)\d{2}\b/g)].map((match) => Number(match[0]));
  return years.length ? Math.max(...years) : null;
}

function validateContent({ questions, topics, learnContent, docsDir, now = new Date(), sourceMaxAgeYears = DEFAULT_SOURCE_MAX_AGE_YEARS }) {
  const errors = [];
  const warnings = [];
  const topicIds = new Set(topics.map((topic) => topic.id));
  const questionIds = new Set();
  const questionTextOwners = new Map();

  const add = (problem) => (problem.severity === 'error' ? errors : warnings).push(problem);

  questions.forEach((question, index) => {
    const location = { questionId: question.id || `(index ${index})`, topicId: question.topic };
    if (!question.id) add(issue('error', 'missing-question-id', 'Question has no id.', location));
    else if (questionIds.has(question.id)) add(issue('error', 'duplicate-question-id', `Question id "${question.id}" is duplicated.`, location));
    else questionIds.add(question.id);

    const questionKey = normalizedQuestion(question.question);
    if (!questionKey) add(issue('error', 'missing-question-text', 'Question text is empty.', location));
    else if (questionTextOwners.has(questionKey)) add(issue('error', 'duplicate-question', 'Question text is duplicated.', { ...location, duplicateOf: questionTextOwners.get(questionKey) }));
    else questionTextOwners.set(questionKey, question.id || location.questionId);

    if (!topicIds.has(question.topic)) add(issue('error', 'unknown-question-topic', `Question refers to unknown topic "${question.topic}".`, location));
    if (typeof question.explanation !== 'string' || !question.explanation.trim()) add(issue('error', 'missing-explanation', 'Question has no explanation.', location));

    if (question.type === 'diagram') {
      validateDiagram(question, docsDir, add);
      return;
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      add(issue('error', 'invalid-options', 'Question must have at least two options.', location));
    } else {
      question.options.forEach((option, optionIndex) => {
        if (typeof option !== 'string' || !option.trim()) add(issue('error', 'empty-option', `Option ${optionIndex + 1} is empty.`, location));
      });
    }
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= (question.options?.length || 0)) {
      add(issue('error', 'invalid-answer-index', `Answer index ${question.answer} is outside the option range.`, location));
    }
  });

  topics.forEach((topic) => {
    const location = { topicId: topic.id };
    if (!topic.id || !topic.name) add(issue('error', 'invalid-topic', 'Topic is missing an id or name.', location));
    if (!learnContent[topic.id]) add(issue('error', 'missing-topic-content', 'Topic has no matching learning content.', location));
    if (!String(topic.source || '').trim()) {
      add(issue('error', 'missing-topic-source', 'Topic has no source document.', location));
      return;
    }
    const sourcePath = path.join(docsDir, topic.source);
    if (!fs.existsSync(sourcePath)) add(issue('error', 'missing-source-document', `Source document "${topic.source}" was not found.`, location));
    const year = sourceYear(topic.source);
    if (year && now.getFullYear() - year > sourceMaxAgeYears) {
      add(issue('warning', 'outdated-source-document', `Source document appears to be ${now.getFullYear() - year} years old.`, { ...location, source: topic.source, sourceYear: year }));
    } else if (!year) {
      add(issue('warning', 'undated-source-document', 'Source document name does not contain a four-digit year.', { ...location, source: topic.source }));
    }
  });

  const summary = {
    questions: questions.length,
    ordinaryQuestions: questions.filter((question) => question.type !== 'diagram').length,
    diagramQuestions: questions.filter((question) => question.type === 'diagram').length,
    topics: topics.length,
    errors: errors.length,
    warnings: warnings.length
  };
  return { errors, warnings, summary, ok: errors.length === 0 };
}

function validateDiagram(question, docsDir, add) {
  const location = { questionId: question.id, topicId: question.topic };
  const diagram = question.diagram;
  if (!diagram || typeof diagram !== 'object') {
    add(issue('error', 'missing-diagram', 'Diagram question has no diagram definition.', location));
    return;
  }
  if (!String(diagram.image || '').trim()) add(issue('error', 'missing-diagram-image', 'Diagram has no image path.', location));
  else if (docsDir && !fs.existsSync(path.resolve(docsDir, '..', diagram.image))) {
    // Diagram paths are relative to the project root, while docsDir points at project/docs.
    add(issue('error', 'missing-diagram-image', `Diagram image "${diagram.image}" was not found.`, location));
  }
  if (!String(diagram.alt || '').trim()) add(issue('error', 'missing-diagram-alt', 'Diagram has no accessible alt text.', location));
  if (!Array.isArray(diagram.labels) || !diagram.labels.length) {
    add(issue('error', 'missing-diagram-labels', 'Diagram has no labels.', location));
    return;
  }
  const labelIds = new Set();
  diagram.labels.forEach((label, index) => {
    const labelLocation = { ...location, labelId: label.id || `(index ${index})` };
    if (!label.id || labelIds.has(label.id)) add(issue('error', 'duplicate-diagram-label-id', 'Diagram label ids must be present and unique.', labelLocation));
    labelIds.add(label.id);
    if (!String(label.name || '').trim()) add(issue('error', 'missing-diagram-label-name', 'Diagram label has no name.', labelLocation));
    ['x', 'y', 'targetX', 'targetY'].forEach((coordinate) => {
      if (label[coordinate] !== undefined && (!Number.isFinite(label[coordinate]) || label[coordinate] < 0 || label[coordinate] > 100)) {
        add(issue('error', 'invalid-diagram-coordinate', `${coordinate} must be a number between 0 and 100.`, labelLocation));
      }
    });
    ['targetWidthPercent', 'targetHeightPercent'].forEach((dimension) => {
      if (label[dimension] !== undefined && (!Number.isFinite(label[dimension]) || label[dimension] <= 0 || label[dimension] > 100)) {
        add(issue('error', 'invalid-diagram-dimension', `${dimension} must be greater than 0 and at most 100.`, labelLocation));
      }
    });
  });
}

function formatIssue(problem) {
  const subject = problem.questionId || problem.topicId || 'content';
  return `${problem.code}: ${subject} - ${problem.message}`;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const strictSources = process.argv.includes('--strict-sources');
  const result = validateContent({ ...loadBrowserData(root), docsDir: path.join(root, 'docs') });
  [...result.errors, ...result.warnings].forEach((problem) => console.log(`${problem.severity.toUpperCase()} ${formatIssue(problem)}`));
  console.log(`Validated ${result.summary.questions} questions across ${result.summary.topics} topics: ${result.summary.errors} errors, ${result.summary.warnings} warnings.`);
  process.exitCode = result.errors.length || (strictSources && result.warnings.length) ? 1 : 0;
}

module.exports = { DEFAULT_SOURCE_MAX_AGE_YEARS, loadBrowserData, validateContent };
