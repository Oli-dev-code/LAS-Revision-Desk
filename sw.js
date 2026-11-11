const CACHE_NAME = 'las-revision-v1.0.84';
const APP_SHELL = [
  './', './index.html', './learn.html', './test.html', './focused-test.html', './trauma-exam.html', './medical-exam.html', './quiz.html', './topics.html',
  './styles.css', './dashboard.css', './study-page.css', './learn.css', './test.css', './trauma-exam.css', './topics.css', './pwa.css', './pwa.js', './question-report.css', './question-report.js', './report-config.js', './manifest.webmanifest',
  './app.js', './dashboard-controls.js', './dashboard-pwa-controls.js', './study-page.js', './trauma-exam.js', './learn-page.js', './topics-page.js', './learn-content.js', './nervous-content.js', './lymphatic-content.js', './question-bank.js', './progress-store.js', './topic-catalog.js',
  './assets/las-logo.png', './assets/las-logo-icon.png',
  './assets/diagrams/arm.png', './assets/diagrams/Axial-and-Appendicular-Skeleton.png', './assets/diagrams/body-organisation.png', './assets/diagrams/bone.png', './assets/diagrams/bone-fibrous.png', './assets/diagrams/brain-lobes.png', './assets/diagrams/Cartilaginous.png', './assets/diagrams/digestive-system.png', './assets/diagrams/heart-anatomy.png', './assets/diagrams/Lumbar-Vertebra.png', './assets/diagrams/lymphatic-urinary-reproductive.png', './assets/diagrams/nervous-system.png', './assets/diagrams/Odontoid-process.png', './assets/diagrams/pelvis.png', './assets/diagrams/pelvis-leg-foot.png', './assets/diagrams/respiratory-system.png', './assets/diagrams/Sacrum-and-Coccyx.png', './assets/diagrams/skull-front.png', './assets/diagrams/skull-side.png', './assets/diagrams/spinal-cord.png', './assets/diagrams/spine.png', './assets/diagrams/Synovial-joint.png', './assets/diagrams/upper-vertebrae.png',
  './assets/test-diagrams/arm-test.png', './assets/test-diagrams/Axial-and-Appendicular-Skeleton-test.png', './assets/test-diagrams/body-organisation-test.png', './assets/test-diagrams/bone-diagram-test.png', './assets/test-diagrams/bone-fibrous-test.png', './assets/test-diagrams/brain-lobes-test.png', './assets/test-diagrams/Cartilaginous-test.png', './assets/test-diagrams/digestive-system-test.png', './assets/test-diagrams/heart-anatomy-test.png', './assets/test-diagrams/Lumbar-Vertebra-test.png', './assets/test-diagrams/lymphatic-urinary-reproductive-test.png', './assets/test-diagrams/nervous-system-test.png', './assets/test-diagrams/Odontoid-process-Lumbar-Vertebra-test-diagram.png', './assets/test-diagrams/Odontoid-process-test.png', './assets/test-diagrams/pelvis-leg-foot-test.png', './assets/test-diagrams/pelvis-test.png', './assets/test-diagrams/respiratory-system-test.png', './assets/test-diagrams/Sacrum-and-Coccyx-test.png', './assets/test-diagrams/skull-front-test.png', './assets/test-diagrams/skull-side-test.png', './assets/test-diagrams/spinal-cord-test.png', './assets/test-diagrams/spine-test.png', './assets/test-diagrams/Synovial-joint-test-diagram.png', './assets/test-diagrams/upper-vertebrae-test.png'
];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))); });
self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
