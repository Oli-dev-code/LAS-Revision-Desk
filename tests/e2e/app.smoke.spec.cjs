const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('opens a topic from the topic library', async ({ page }) => {
  await page.getByRole('button', { name: 'Topic library' }).click();
  await expect(page).toHaveURL(/topics\.html$/);
  const topic = page.locator('.topic-library-item').filter({ hasText: 'Respiratory system' }).first();
  await topic.getByRole('link', { name: /Learn/ }).click();
  await expect(page).toHaveURL(/learn\.html\?topic=respiratory$/);
  await expect(page.locator('#page-topic')).toContainText('Respiratory system');
  await expect(page.locator('#page-content')).not.toBeEmpty();
});

test('starts, completes, records, and reviews a test', async ({ page }) => {
  await page.goto('/test.html?topic=chest-injuries');
  await expect(page.locator('#page-count')).toContainText('Question 1 of');

  const questionCount = Number((await page.locator('#page-count').textContent()).match(/of (\d+)/)[1]);
  for (let index = 0; index < questionCount; index += 1) {
    await page.evaluate(() => {
      const text = document.querySelector('.page-question')?.innerText;
      const question = window.questionDatabase.find((item) => item.question === text);
      const answerIndex = question ? (question.answer + 1) % question.options.length : 0;
      document.querySelector(`.page-options button[data-index="${answerIndex}"]`)?.click();
      document.querySelector('#next-question')?.click();
    });
  }

  await expect(page.locator('.results-summary')).toBeVisible();
  await expect(page.locator('.results-summary')).toContainText('FINAL SCORE');
  await expect(page.locator('.results-summary')).toContainText('Questions');
  await expect(page.locator('.topic-performance')).toBeVisible();
  await expect(page.locator('.confidence-gaps')).toBeVisible();
  await expect(page.locator('.missed-causes')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review missed questions' })).toBeVisible();
  await expect(page.locator('.wrong-answer .question-report-button').first()).toBeVisible();
  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('las-revision-question-stats')));
  expect(stats.answered).toBe(questionCount);
  expect(stats.incorrectQuestionIds.length).toBeGreaterThan(0);
});

async function completeFormalExam(page, url) {
  await page.goto(url);
  const questionCount = Number((await page.locator('#exam-count').textContent()).match(/of (\d+)/)[1]);
  for (let index = 0; index < questionCount; index += 1) {
    await page.evaluate(() => {
      const text = document.querySelector('.exam-question')?.innerText;
      const question = window.questionDatabase.find((item) => item.question === text);
      const answerIndex = question ? (question.answer + 1) % question.options.length : 0;
      document.querySelector(`.exam-options button[data-index="${answerIndex}"]`)?.click();
      document.querySelector('#next-question')?.click();
    });
  }
  await expect(page.locator('.exam-feedback-panel').first()).toBeVisible();
  await expect(page.locator('.exam-topic-performance')).toBeVisible();
  await expect(page.locator('.exam-confidence-grid')).toBeVisible();
  await expect(page.locator('.exam-review-item.wrong .question-report-button').first()).toBeVisible();
}

test('shows diagnostic feedback for Medical and Trauma exams', async ({ page }) => {
  await completeFormalExam(page, '/medical-exam.html');
  await completeFormalExam(page, '/trauma-exam.html');
});

test('flags a question and can open the flagged review', async ({ page }) => {
  await page.goto('/test.html?topic=body');
  await page.locator('#flag-question').click();
  await expect(page.locator('#flag-question')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('las-revision-flagged-question-ids')))).toHaveLength(1);
  await page.goto('/test.html?topic=flagged');
  await expect(page.locator('#page-topic')).toContainText('Questions flagged across all topics');
  await expect(page.locator('.page-question')).toBeVisible();
});

test('switches between light and dark themes', async ({ page }) => {
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Light mode' })).toBeVisible();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
});

test('renders update loading, error, and ready states', async ({ page }) => {
  await page.goto('/update-check.html');
  await expect(page.locator('.status')).toHaveText('Checking for updates...');
  await page.evaluate(() => window.updateCheckUi.showError());
  await expect(page.locator('.window')).toHaveClass(/error/);
  await expect(page.locator('.progress-label')).toHaveText('Continuing with the current version');
  await page.evaluate(() => window.updateCheckUi.showReady('9.9.9'));
  await expect(page.locator('.status')).toHaveText('Update ready to install');
  await expect(page.locator('.detail')).toContainText('9.9.9');
  await expect(page.locator('.ready-actions')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Restart and install' })).toHaveAttribute('href', 'las-revision://restart');
});
