const topics = window.topicCatalog || [];
const themeToggle = document.getElementById('theme-toggle');
function applyTheme(theme) { const dark = theme === 'dark'; document.body.dataset.theme = dark ? 'dark' : 'light'; themeToggle.setAttribute('aria-pressed', dark); themeToggle.textContent = dark ? 'Light mode' : 'Dark mode'; }
let storedTheme = 'light';
try { storedTheme = localStorage.getItem('las-revision-theme') || 'light'; } catch { /* File URLs may not expose storage. */ }
applyTheme(storedTheme);
themeToggle.addEventListener('click', () => { const theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('las-revision-theme', theme); } catch { /* File URLs may not expose storage. */ } applyTheme(theme); });
document.getElementById('topic-list').innerHTML = topics.map((topic, index) => `<article class="topic-library-item"><div class="topic-library-number">${String(index + 1).padStart(2, '0')}</div><div class="topic-library-copy"><h2>${topic.name}</h2><p>${topic.description}</p><small>${topic.source}</small></div><div class="topic-library-actions"><a href="learn.html?topic=${topic.id}">Learn <span>→</span></a><a href="test.html?topic=${topic.id}">Test <span>→</span></a><a href="quiz.html?topic=${topic.id}">Quiz <span>→</span></a></div></article>`).join('');
