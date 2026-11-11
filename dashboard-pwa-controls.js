(function initialiseDashboardPwaControls() {
  const topics = Array.isArray(window.topicCatalog) ? window.topicCatalog : [];
  const topicCount = document.querySelector('.nav-count');
  const themeToggle = document.getElementById('theme-toggle');
  if (topicCount) topicCount.textContent = String(topics.length);

  window.lasUi?.bindThemeToggle(themeToggle);

  const stopAndHandle = (event, action) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    action();
  };
  const updateTopicLinks = (topicId) => {
    if (!topicId) return;
    document.querySelectorAll('.mode-tab[href]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (/^(learn|test|quiz|focused-test)\.html/.test(href)) link.setAttribute('href', `${href.split('?')[0]}?topic=${encodeURIComponent(topicId)}`);
    });
    window.setDashboardTopic?.(topicId);
  };

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-view], .course-group-toggle, .course-item');
    if (!target) return;
    if (target.matches('[data-view="topics"]')) {
      stopAndHandle(event, () => { window.location.assign(new URL('topics.html', window.location.href).href); });
    } else if (target.matches('[data-view="overview"]')) {
      stopAndHandle(event, () => { document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active')); target.classList.add('active'); });
    } else if (target.matches('.course-group-toggle')) {
      stopAndHandle(event, () => {
        const group = target.closest('.course-group');
        const items = group?.querySelector('.course-group-items');
        const expanded = target.getAttribute('aria-expanded') === 'true';
        target.setAttribute('aria-expanded', String(!expanded));
        group?.classList.toggle('collapsed', expanded);
        if (items) items.hidden = expanded;
      });
    } else if (target.matches('.course-item')) {
      stopAndHandle(event, () => {
        document.querySelectorAll('.course-item').forEach((item) => { item.classList.remove('selected'); item.querySelector('.status-dot')?.classList.remove('current'); });
        target.classList.add('selected');
        target.querySelector('.status-dot')?.classList.add('current');
        const topicId = target.dataset.topic;
        const topicName = target.querySelector('.course-name')?.textContent || target.textContent.trim();
        const intro = document.querySelector('.mode-intro p');
        if (intro) intro.innerHTML = `${topicName} <span> - </span> Questions filtered to this topic`;
        updateTopicLinks(topicId);
      });
    }
  }, true);
})();
