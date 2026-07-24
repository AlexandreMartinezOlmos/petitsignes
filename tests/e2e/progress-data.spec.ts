import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

/**
 * Export / import / reset of the locally stored progress.
 *
 * This is the only way a visitor keeps their favourites when they change
 * device — the site has no accounts — so the round trip is covered end to end
 * rather than only at the unit level.
 */

const ABOUT_PATH = '/el-projecte/';

/** The section is `client:visible`, so it hydrates only once scrolled to. */
async function openProgressSection(page: Page) {
  const section = page.locator('.progress-data');
  await section.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  return section;
}

async function seedProgress(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => document.querySelector('.sign-card')?.getAttribute('data-learned') !== null,
  );
  await page
    .locator('.sign-card[data-sign-id="leche"]')
    .getByRole('button', { name: /afegeix a preferits/i })
    .click();
  await expect(
    page.locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]'),
  ).toHaveAttribute('aria-pressed', 'true');
}

test.describe('progress data', () => {
  test('summarises what is stored in this browser', async ({ page }) => {
    await seedProgress(page);
    await page.goto(ABOUT_PATH);
    const section = await openProgressSection(page);

    await expect(section).toContainText('1 preferit ·');
  });

  test('exports the progress as a dated JSON file', async ({ page }) => {
    await seedProgress(page);
    await page.goto(ABOUT_PATH);
    const section = await openProgressSection(page);

    const downloadPromise = page.waitForEvent('download');
    await section.getByRole('button', { name: /exporta el progrés/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^petitsignes-progres-\d{4}-\d{2}-\d{2}\.json$/);

    const contents = await readFile(await download.path(), 'utf8');
    expect(JSON.parse(contents)).toMatchObject({ favorites: ['leche'], learned: [] });
  });

  test('imports a file and the catalogue reflects it', async ({ page }) => {
    await page.goto(ABOUT_PATH);
    const section = await openProgressSection(page);

    await section.locator('input[type="file"]').setInputFiles({
      name: 'progres.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          favorites: ['leche', 'agua'],
          learned: ['mas'],
          preferences: { language: 'ca', signLanguage: 'lsc' },
        }),
      ),
    });

    await expect(page.getByRole('status')).toContainText('2 preferits');
    await expect(section).toContainText('2 preferits');

    // The imported progress is real progress, not just a message.
    await page.goto('/');
    await expect(
      page.locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('rejects a file that is not a progress export', async ({ page }) => {
    await seedProgress(page);
    await page.goto(ABOUT_PATH);
    const section = await openProgressSection(page);

    await section.locator('input[type="file"]').setInputFiles({
      name: 'shopping-list.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"milk":true}'),
    });

    await expect(page.getByRole('alert')).toContainText(/no sembla una exportació/i);
    // The existing progress must survive a bad file.
    await expect(section).toContainText('1 preferit ·');
  });

  test('reset asks first and then clears the progress', async ({ page }) => {
    await seedProgress(page);
    await page.goto(ABOUT_PATH);
    const section = await openProgressSection(page);

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toMatch(/esborrar preferits/i);
      void dialog.dismiss();
    });
    await section.getByRole('button', { name: /reinicia el progrés/i }).click();
    await expect(section).toContainText('1 preferit ·');

    page.once('dialog', (dialog) => void dialog.accept());
    await section.getByRole('button', { name: /reinicia el progrés/i }).click();

    await expect(page.getByRole('status')).toContainText(/esborrat el progrés/i);
    await expect(section).toContainText('0 preferits');
  });

  test('the file input is reachable and labelled for keyboard users', async ({ page }) => {
    await page.goto(ABOUT_PATH);
    const section = await openProgressSection(page);

    const input = section.locator('input[type="file"]');
    // Visually hidden, but never `display: none` — that would take it off the
    // keyboard path entirely.
    await expect(input).toHaveCSS('display', 'block');
    await input.focus();
    await expect(input).toBeFocused();

    const inputId = await input.getAttribute('id');
    await expect(section.locator(`label[for="${inputId}"]`)).toHaveText(/importa el progrés/i);
  });
});
