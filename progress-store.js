(function () {
  const key = 'las-revision-learnt-topics';
  const statsKey = 'las-revision-question-stats';
  function read() { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
  function write(topics) { try { localStorage.setItem(key, JSON.stringify(topics)); } catch { /* Progress is optional when storage is unavailable. */ } }
  function readStats() { try { return JSON.parse(localStorage.getItem(statsKey) || '{"answered":0,"correct":0}'); } catch { return { answered: 0, correct: 0 }; } }
  function recordQuestions(answered, correct) { const stats = readStats(); stats.answered += answered; stats.correct += correct; try { localStorage.setItem(statsKey, JSON.stringify(stats)); } catch { /* Progress is optional when storage is unavailable. */ } return stats; }
  window.lasProgress = {
    learntTopics: read,
    isLearnt: (topic) => read().includes(topic),
    markLearnt: (topic) => { const topics = read(); if (!topics.includes(topic)) { topics.push(topic); write(topics); } return topics; },
    questionStats: readStats,
    recordQuestions
  };
}());
