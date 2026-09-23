import { expect, test, type Locator, type Page } from '@playwright/test';
import { wcagScan } from './axe.ts';
import { stubCalls, stubYouTubeApi, type StubBehaviour } from './youtube-stub.ts';

/**
 * The video player as someone without a mouse meets it.
 *
 * The dialog is the one place in the site that takes focus away from the page,
 * so it is the one place that has to give it back. WCAG 2.4.3 (focus order)
 * is what a missed return breaks: close the player and the next Tab starts
 * from the top of a page of 194 cards, or from nowhere at all on a screen
 * reader.
 *
 * Every test drives the stand-in player (see `youtube-stub.ts`): what is under
 * test is the dialog, and a real YouTube embed is not allowed to play in CI.
 */

/** Where the player opens from: the catalogue's card and the sign's own page. */
const ENTRY_POINTS = [
  {
    name: 'catalogue',
    path: '/',
    trigger: (page: Page) =>
      page.locator(
        '.sign-card[data-sign-id="leche"] .sign-card__lang[data-sl="lsc"] [data-action="play"]',
      ),
  },
  {
    name: 'sign page',
    path: '/signe/leche/',
    trigger: (page: Page) => page.getByRole('button', { name: /veure el signe/i }).first(),
  },
];

async function openByKeyboard(
  page: Page,
  path: string,
  trigger: (page: Page) => Locator,
  behaviour: StubBehaviour = {},
): Promise<{ opener: Locator; dialog: Locator }> {
  await stubYouTubeApi(page, behaviour);
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));

  const opener = trigger(page);
  await opener.focus();
  await page.keyboard.press('Enter');

  const dialog = page.locator('dialog[open]');
  await expect(dialog).toBeVisible();
  return { opener, dialog };
}

for (const { name, path, trigger } of ENTRY_POINTS) {
  test.describe(`the video player, by keyboard, from the ${name}`, () => {
    test('opening it moves focus into it, and announces the sign', async ({ page }) => {
      const { dialog } = await openByKeyboard(page, path, trigger);

      await expect(dialog).toBeFocused();
      await expect(dialog).toHaveAccessibleName(/llet/);
    });

    test('Escape closes it, stops the player, and returns focus to the button', async ({
      page,
    }) => {
      const { opener } = await openByKeyboard(page, path, trigger);
      await expect(page.locator('dialog[open] iframe')).toBeAttached();

      await page.keyboard.press('Escape');

      await expect(page.locator('dialog[open]')).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(await stubCalls(page)).toContain('destroy');
    });

    test('the close button returns focus to the button that opened it', async ({ page }) => {
      const { opener, dialog } = await openByKeyboard(page, path, trigger);

      await dialog.getByRole('button', { name: 'Tanca el vídeo' }).focus();
      await page.keyboard.press('Enter');

      await expect(page.locator('dialog[open]')).toHaveCount(0);
      await expect(opener).toBeFocused();
    });

    /**
     * Escape cannot close the player while focus is inside it. Key presses go
     * to the frame's own document, and YouTube's is on another origin, so this
     * page never hears them. It is not a keyboard trap (WCAG 2.1.2) as long as
     * the way out stays one keystroke away: the close button comes right
     * before the frame, so Shift+Tab from the frame lands on it.
     */
    test('from inside the video, Shift+Tab reaches the close button', async ({ page }) => {
      const { opener, dialog } = await openByKeyboard(page, path, trigger);
      await dialog.locator('iframe').focus();

      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: 'Tanca el vídeo' })).toBeFocused();

      await page.keyboard.press('Enter');
      await expect(opener).toBeFocused();
    });

    // A modal is modal for the keyboard too: the cards behind it are not
    // visible to the visitor, so Tab must never reach them.
    test('Tab never leaves it while it is open', async ({ page }) => {
      const { dialog } = await openByKeyboard(page, path, trigger);

      for (let press = 0; press < 8; press++) {
        await page.keyboard.press('Tab');
        const outside = await page.evaluate(() => {
          const active = document.activeElement;
          const open = document.querySelector('dialog[open]');
          // Focus parked on the document itself (between the dialog's last
          // control and the browser's own UI) is not a control behind the modal.
          return active !== null && active !== document.body && !open?.contains(active);
        });
        expect(outside, `after ${press + 1} Tab presses`).toBe(false);
      }
      await expect(dialog).toBeVisible();
    });
  });
}

/**
 * The play button is wired by the page's own script, at load; the player is an
 * island hydrated when the browser is idle. A tap between the two used to be
 * sent to nobody and lost, and the button looked dead — on a slow phone, or
 * for anyone quick enough on a page opened from a link straight to a sign.
 *
 * The island's module is held at the network until after the tap, so the tap
 * provably lands before the player exists; released, the player must open on
 * its own, with nothing tapped twice.
 */
for (const { name, path, trigger } of ENTRY_POINTS) {
  test(`a tap before the player has loaded still opens it, from the ${name}`, async ({ page }) => {
    await stubYouTubeApi(page);

    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/_astro/SignVideoDialog.*.js', async (route) => {
      await released;
      await route.continue();
    });

    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await trigger(page).click();

    // Still server-rendered: the tap reached a page with no player on it.
    await expect(page.locator('astro-island[ssr][opts*="SignVideoDialog"]')).toHaveCount(1);
    await expect(page.locator('dialog[open]')).toHaveCount(0);

    release();

    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();
    await expect(dialog).toHaveAccessibleName(/llet/);
  });
}

/**
 * The sweep in `a11y.spec.ts` scans each page as it loads, so it has never
 * seen the player: it only exists once asked for. Scanned here open, in both
 * palettes, playing and in the fallback a refused video falls back to.
 */
for (const colorScheme of ['light', 'dark'] as const) {
  for (const state of [
    { name: 'playing', behaviour: {} },
    { name: 'refused by YouTube', behaviour: { error: 150 } },
  ]) {
    test(`the open player has no detectable accessibility violations (${state.name}, ${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      const [catalogue] = ENTRY_POINTS;
      const { dialog } = await openByKeyboard(
        page,
        catalogue!.path,
        catalogue!.trigger,
        state.behaviour,
      );
      if (state.behaviour.error !== undefined) {
        await expect(dialog.getByRole('alert')).toBeVisible();
      } else {
        await expect(dialog.locator('iframe')).toBeAttached();
      }

      const results = await wcagScan(page).include('dialog[open]').analyze();

      expect(results.violations).toEqual([]);
    });
  }
}
