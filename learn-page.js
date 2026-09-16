const learnParams = new URLSearchParams(window.location.search);
const learnTopic = learnParams.get('topic') || 'body';
const learnPageContent = document.getElementById('page-content');

function renderDetailedLearnPage(learnData) {
  const sourceLine = `<div class="source-line"><span>Source material</span>${learnData.source}</div>`;
  const heroImage = learnData.image ? `<figure class="learn-figure${learnData.imageOverlay ? ' diagram-figure' : ''}"><img src="${learnData.image}" alt="${learnData.imageAlt}">${learnData.imageOverlay ? `<span class="diagram-label-overlay" style="left:${learnData.imageOverlay.x}%;top:${learnData.imageOverlay.y}%">${learnData.imageOverlay.text}</span>` : ''}<figcaption>Diagram from the supplied course material.</figcaption></figure>` : '';
  const sections = learnData.sections.map(([number, title, copy, expanded]) => expanded === undefined ? `<section class="learn-section"><span class="learn-section-number">${number}</span><div><h2>${title}</h2><p>${copy}</p></div></section>` : `<details class="learn-section learn-collapsible"${expanded ? ' open' : ''}><summary><span class="learn-section-number">${number}</span><span class="learn-section-title">${title}</span><span class="learn-section-toggle" aria-hidden="true">+</span></summary><p>${copy}</p></details>`).join('');
  const secondaryImages = (learnData.secondaryImages || []).map((image) => `<figure class="learn-figure secondary"><img src="${image.src}" alt="${image.alt}"><figcaption>Diagram from the supplied course material.</figcaption></figure>`).join('');
  const learnt = window.lasProgress?.isLearnt(learnTopic);
  learnPageContent.innerHTML = `${sourceLine}<p class="page-lead">${learnData.intro}</p>${heroImage}<div class="learn-sections">${sections}</div>${secondaryImages}<div class="learn-footer-note">Use this page alongside the source document in the course materials. The diagrams are included to support visual recall of key structures.</div><p><button class="page-button" id="mark-topic-learnt">${learnt ? 'Topic learnt' : 'Mark topic as learnt'} <span>✓</span></button></p>`;
  document.getElementById('mark-topic-learnt').addEventListener('click', (event) => {
    window.lasProgress?.markLearnt(learnTopic);
    event.currentTarget.innerHTML = 'Topic learnt <span>✓</span>';
  });
}

function startLearnPage() {
  const learnData = window.topicLearnOverrides?.[learnTopic] || window.nervousLearnContent?.[learnTopic] || window.learnContent[learnTopic] || window.learnContent.body;
  renderDetailedLearnPage(learnData);
}

if ((learnTopic === 'nervous' || learnTopic === 'lymphatic-urinary-reproductive') && !window.topicLearnOverrides?.[learnTopic] && !window.nervousLearnContent) {
  const nervousScript = document.createElement('script');
  nervousScript.src = learnTopic === 'nervous' ? 'nervous-content.js' : 'lymphatic-content.js';
  nervousScript.onload = startLearnPage;
  document.head.appendChild(nervousScript);
} else {
  startLearnPage();
}
