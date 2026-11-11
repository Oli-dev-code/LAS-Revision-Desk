(function () {
  const QUICK_RESPONSE_MS = 8000;
  const SLOW_RESPONSE_MS = 20000;
  const STORAGE_KEY = 'las-revision-session-diagnostics';
  const MAX_SESSIONS = 50;

  function responseMsFor(meta) {
    return Math.max(0, Number(meta?.responseMs) || 0);
  }

  function classifyAttempt(attempt) {
    if (!attempt?.answered) return { code: 'skipped', label: 'Skipped', confidence: 'unknown' };
    const responseMs = responseMsFor(attempt);
    const changed = Number(attempt.answerChanges) > 0;
    const quick = responseMs > 0 && responseMs < QUICK_RESPONSE_MS;
    const slow = responseMs >= SLOW_RESPONSE_MS;
    if (!attempt.correct && changed) return { code: 'changed-answer', label: 'Changed answer', confidence: 'hesitant' };
    if (!attempt.correct && quick) return { code: 'quick-guess', label: 'Quick guess', confidence: 'over-confident' };
    if (!attempt.correct) return { code: 'knowledge-gap', label: 'Knowledge gap', confidence: 'uncertain' };
    if (slow || changed) return { code: 'under-confident', label: 'Under-confident correct', confidence: 'under-confident' };
    return { code: 'confident-recall', label: 'Confident recall', confidence: 'aligned' };
  }

  function summariseSession(questions, attempts, metadata = {}) {
    const details = questions.map((question, index) => {
      const attempt = { ...(attempts?.[index] || {}), questionId: question.id, topicId: question.topic };
      const classification = classifyAttempt(attempt);
      return { questionId: question.id, topicId: question.topic, correct: Boolean(attempt.correct), answered: Boolean(attempt.answered), responseMs: responseMsFor(attempt), answerChanges: Number(attempt.answerChanges) || 0, cause: classification.code, causeLabel: classification.label, confidence: classification.confidence };
    });
    const topicMap = new Map();
    details.forEach((detail) => {
      const current = topicMap.get(detail.topicId) || { topicId: detail.topicId, questions: 0, correct: 0, missed: 0 };
      current.questions += 1;
      if (detail.correct) current.correct += 1; else current.missed += 1;
      topicMap.set(detail.topicId, current);
    });
    const topics = [...topicMap.values()].map((item) => ({ ...item, accuracy: item.questions ? Math.round((item.correct / item.questions) * 100) : 0, status: item.accuracy >= 80 ? 'strong' : item.accuracy >= 60 ? 'developing' : 'needs-review' }));
    const causes = details.reduce((counts, detail) => { counts[detail.cause] = (counts[detail.cause] || 0) + 1; return counts; }, {});
    const confidenceGaps = {
      overconfident: causes['quick-guess'] || 0,
      underconfident: causes['under-confident'] || 0,
      hesitation: causes['changed-answer'] || 0
    };
    const summary = { sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, completedAt: new Date().toISOString(), mode: metadata.mode || 'test', durationMs: Number(metadata.durationMs) || 0, total: details.length, correct: details.filter((detail) => detail.correct).length, topics, causes, confidenceGaps, details };
    summary.recommendations = buildRecommendations(summary);
    return summary;
  }

  function buildRecommendations(summary) {
    const recommendations = [];
    const weakest = [...(summary.topics || [])].sort((left, right) => left.accuracy - right.accuracy || right.missed - left.missed);
    weakest.filter((topic) => topic.missed > 0).slice(0, 2).forEach((topic) => recommendations.push({ kind: 'topic', topicId: topic.topicId, title: `Review ${topic.topicId}`, detail: `${topic.accuracy}% accuracy · ${topic.missed} to revisit` }));
    if ((summary.causes['knowledge-gap'] || 0) > 0) recommendations.push({ kind: 'knowledge-gap', title: 'Revisit the learning material', detail: `${summary.causes['knowledge-gap']} missed answer${summary.causes['knowledge-gap'] === 1 ? '' : 's'} look like knowledge gaps.` });
    if ((summary.confidenceGaps.overconfident || 0) > 0) recommendations.push({ kind: 'quick-guess', title: 'Slow down on quick decisions', detail: `${summary.confidenceGaps.overconfident} quick answer${summary.confidenceGaps.overconfident === 1 ? '' : 's'} was incorrect.` });
    if ((summary.confidenceGaps.underconfident || 0) > 0) recommendations.push({ kind: 'under-confident', title: 'Build confidence with recall practice', detail: `${summary.confidenceGaps.underconfident} correct answer${summary.confidenceGaps.underconfident === 1 ? '' : 's'} took longer or changed.` });
    if ((summary.causes.skipped || 0) > 0) recommendations.push({ kind: 'skipped', title: 'Complete unanswered questions', detail: `${summary.causes.skipped} question${summary.causes.skipped === 1 ? '' : 's'} was left unanswered.` });
    return recommendations.slice(0, 3);
  }

  function readSessionSummaries() {
    try { const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(stored) ? stored : []; } catch { return []; }
  }

  function saveSessionSummary(summary) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([summary, ...readSessionSummaries()].slice(0, MAX_SESSIONS))); } catch { /* Diagnostics are optional when storage is unavailable. */ }
    return summary;
  }

  window.lasAssessmentFeedback = { QUICK_RESPONSE_MS, SLOW_RESPONSE_MS, classifyAttempt, summariseSession, buildRecommendations, readSessionSummaries, saveSessionSummary };
}());
