(function () {
  const themeToggle = document.getElementById('theme-toggle');
  const topicLibrary = document.querySelector('[data-view="topics"]');
  if (themeToggle) {
    const readTheme = () => { try { return localStorage.getItem('las-revision-theme') || 'light'; } catch { return 'light'; } };
    const saveTheme = (theme) => { try { localStorage.setItem('las-revision-theme', theme); } catch { /* Optional preference only. */ } };
    const setTheme = (theme) => {
      const dark = theme === 'dark';
      document.body.dataset.theme = dark ? 'dark' : 'light';
      themeToggle.setAttribute('aria-pressed', dark);
      const icon = themeToggle.querySelector('.theme-icon');
      const label = themeToggle.querySelector('.theme-label');
      if (icon) icon.textContent = String.fromCodePoint(dark ? 9728 : 9790);
      if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
    };
    setTheme(readTheme());
    themeToggle.onclick = () => {
      const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      setTheme(next);
    };
  }
  if (topicLibrary) topicLibrary.onclick = () => { window.location.href = 'topics.html'; };

  const topics = window.topicCatalog || [];
  if (topics.length) {
    const questionStats = window.lasProgress?.questionStats() || { answered: 0, correct: 0 };
    const questionCard = document.querySelector('.stats-grid .stat-card:nth-child(2)');
    if (questionCard) {
      questionCard.querySelector('strong').textContent = questionStats.answered;
      questionCard.querySelector('small').innerHTML = questionStats.answered ? `<em>${Math.round((questionStats.correct / questionStats.answered) * 100)}%</em> average score` : 'No questions completed yet';
    }
    const statCards = document.querySelectorAll('.stats-grid .stat-card');
    const formatTime = (milliseconds) => { const minutes = Math.floor(milliseconds / 60000); if (minutes < 60) return `${minutes}m`; return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; };
    const updateTimeCards = () => {
      const time = window.lasProgress?.revisionTime?.() || { todayMs: 0, totalMs: 0 };
      if (statCards[0]) { statCards[0].querySelector('.stat-label').textContent = 'Revision today'; statCards[0].querySelector('strong').textContent = formatTime(time.todayMs); statCards[0].querySelector('small').textContent = 'Time in the app today'; }
      if (statCards[2]) { statCards[2].querySelector('.stat-label').textContent = 'Total revision'; statCards[2].querySelector('strong').textContent = formatTime(time.totalMs); statCards[2].querySelector('small').textContent = 'All recorded app time'; }
    };
    updateTimeCards();
    window.setInterval(updateTimeCards, 15000);
    const topicCount = document.querySelector('.nav-count');
    if (topicCount) topicCount.textContent = topics.length;
    const learntTopics = window.lasProgress?.learntTopics() || [];
    const learntCount = topics.filter((topic) => learntTopics.includes(topic.id)).length;
    const progressLabel = document.querySelector('.course-progress p');
    if (progressLabel) progressLabel.textContent = `${learntCount} of ${topics.length} topics reviewed`;
    const progressPercent = document.querySelector('.progress-top strong');
    const progress = Math.round((learntCount / topics.length) * 100);
    if (progressPercent) progressPercent.textContent = `${progress}%`;
    const progressBar = document.querySelector('.progress-track span');
    if (progressBar) progressBar.style.width = `${progress}%`;
    const courseList = document.querySelector('.course-list');
    courseList.innerHTML = topics.map((topic, index) => { const complete = learntTopics.includes(topic.id); return `<button class="course-item${index === 0 ? ' selected' : ''}" data-topic="${topic.id}"><span class="status-dot${complete ? ' complete' : (index === 0 ? ' current' : '')}">${complete ? '✓' : index + 1}</span><span class="course-name">${topic.name}</span></button>`; }).join('');
    courseList.querySelectorAll('.course-item').forEach((item) => item.addEventListener('click', () => {
      courseList.querySelectorAll('.course-item').forEach((course) => course.classList.remove('selected'));
      item.classList.add('selected');
      const topic = item.dataset.topic;
      document.querySelector('.mode-intro p').textContent = `${item.querySelector('.course-name').textContent} - Questions filtered to this topic`;
      document.querySelector('.mode-tab[href^="learn"]').href = `learn.html?topic=${topic}`;
      document.querySelector('.mode-tab[href^="test"]').href = `test.html?topic=${topic}`;
      document.querySelector('.mode-tab[href^="quiz"]').href = `quiz.html?topic=${topic}`;
      document.querySelector('.mode-tab[href^="focused-test"]').href = `focused-test.html?topic=${topic}`;
    }));
  }
}());
