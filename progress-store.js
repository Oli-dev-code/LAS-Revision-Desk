(function () {
  const key = 'las-revision-learnt-topics';
  const statsKey = 'las-revision-question-stats';
  const flaggedKey = 'las-revision-flagged-question-ids';
  const timeKey = 'las-revision-time-stats';
  const sessionStart = Date.now();
  function read() { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
  function write(topics) { try { localStorage.setItem(key, JSON.stringify(topics)); } catch { /* Progress is optional when storage is unavailable. */ } }
  function readStats() { try { const stats = JSON.parse(localStorage.getItem(statsKey) || '{"answered":0,"correct":0,"incorrectQuestionIds":[]}'); return { answered: stats.answered || 0, correct: stats.correct || 0, incorrectQuestionIds: Array.isArray(stats.incorrectQuestionIds) ? stats.incorrectQuestionIds : [] }; } catch { return { answered: 0, correct: 0, incorrectQuestionIds: [] }; } }
  function readFlagged() { try { const ids = JSON.parse(localStorage.getItem(flaggedKey) || '[]'); return Array.isArray(ids) ? ids : []; } catch { return []; } }
  function writeFlagged(ids) { try { localStorage.setItem(flaggedKey, JSON.stringify([...new Set(ids)])); } catch { /* Flags are optional when storage is unavailable. */ } }
  function setQuestionFlagged(id, flagged) { const ids = new Set(readFlagged()); if (flagged) ids.add(id); else ids.delete(id); writeFlagged([...ids]); return flagged; }
  function readTime() { const today = new Date().toISOString().slice(0, 10); try { const stored = JSON.parse(localStorage.getItem(timeKey) || '{}'); return { totalMs: stored.totalMs || 0, todayDate: today, todayMs: stored.todayDate === today ? (stored.todayMs || 0) : 0 }; } catch { return { totalMs: 0, todayDate: today, todayMs: 0 }; } }
  function writeTime(time) { try { localStorage.setItem(timeKey, JSON.stringify(time)); } catch { /* Time tracking is optional when storage is unavailable. */ } }
  function recordTime() { const elapsed = Math.max(0, Date.now() - recordTime.lastSaved); if (!elapsed) return; const time = readTime(); time.totalMs += elapsed; time.todayMs += elapsed; writeTime(time); recordTime.lastSaved = Date.now(); }
  recordTime.lastSaved = sessionStart;
  window.setInterval(recordTime, 15000);
  window.addEventListener('beforeunload', recordTime);
  function revisionTime() { recordTime(); const time = readTime(); const live = Math.max(0, Date.now() - recordTime.lastSaved); return { todayMs: time.todayMs + live, totalMs: time.totalMs + live }; }
  function recordQuestions(answered, correct) { return recordQuestionResults(Array.from({ length: answered }, (_, index) => ({ id: `legacy-${Date.now()}-${index}`, correct: index < correct }))); }
  function recordQuestionResults(results) { const stats = readStats(); const incorrect = new Set(stats.incorrectQuestionIds); results.forEach(({ id, correct }) => { if (correct) incorrect.delete(id); else incorrect.add(id); }); stats.answered += results.length; stats.correct += results.filter((result) => result.correct).length; stats.incorrectQuestionIds = [...incorrect]; try { localStorage.setItem(statsKey, JSON.stringify(stats)); } catch { /* Progress is optional when storage is unavailable. */ } return stats; }
  window.lasProgress = { learntTopics: read, isLearnt: (topic) => read().includes(topic), markLearnt: (topic) => { const topics = read(); if (!topics.includes(topic)) { topics.push(topic); write(topics); } return topics; }, questionStats: readStats, recordQuestions, recordQuestionResults, needsFocus: (questionId) => readStats().incorrectQuestionIds.includes(questionId), flaggedQuestionIds: readFlagged, isQuestionFlagged: (questionId) => readFlagged().includes(questionId), setQuestionFlagged, revisionTime };
}());
