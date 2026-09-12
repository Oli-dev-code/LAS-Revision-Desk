(function () {
  const key = 'las-revision-learnt-topics';
  const statsKey = 'las-revision-question-stats';
  function read() { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
  function write(topics) { try { localStorage.setItem(key, JSON.stringify(topics)); } catch { /* Progress is optional when storage is unavailable. */ } }
  function readStats() { try { const stats = JSON.parse(localStorage.getItem(statsKey) || '{"answered":0,"correct":0,"incorrectQuestionIds":[]}'); return { answered: stats.answered || 0, correct: stats.correct || 0, incorrectQuestionIds: Array.isArray(stats.incorrectQuestionIds) ? stats.incorrectQuestionIds : [] }; } catch { return { answered: 0, correct: 0, incorrectQuestionIds: [] }; } }
  function recordQuestions(answered, correct) { const stats = readStats(); stats.answered += answered; stats.correct += correct; try { localStorage.setItem(statsKey, JSON.stringify(stats)); } catch { /* Progress is optional when storage is unavailable. */ } return stats; }
  function recordQuestionResults(results) { const stats = readStats(); const incorrect = new Set(stats.incorrectQuestionIds); results.forEach(({ id, correct }) => { if (correct) incorrect.delete(id); else incorrect.add(id); }); stats.answered += results.length; stats.correct += results.filter((result) => result.correct).length; stats.incorrectQuestionIds = [...incorrect]; try { localStorage.setItem(statsKey, JSON.stringify(stats)); } catch { /* Progress is optional when storage is unavailable. */ } return stats; }
  window.lasProgress = {
    learntTopics: read,
    isLearnt: (topic) => read().includes(topic),
    markLearnt: (topic) => { const topics = read(); if (!topics.includes(topic)) { topics.push(topic); write(topics); } return topics; },
    questionStats: readStats,
    recordQuestions,
    recordQuestionResults,
    needsFocus: (questionId) => readStats().incorrectQuestionIds.includes(questionId)
  };
}());
