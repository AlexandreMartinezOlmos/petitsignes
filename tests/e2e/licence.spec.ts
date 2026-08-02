import { expect, test } from '@playwright/test';

/**
 * The source link is a licence obligation, not a courtesy.
 *
 * The site is AGPL-3.0-or-later and ships minified JavaScript to the browser.
 * Minified JS is an object form of the program, so §13 applies: every user
 * interacting with it over a network must be offered the Corresponding Source.
 * The footer link is that offer, and the footer is on every page.
 *
 * This is why it gets a spec of its own instead of an assertion tucked into an
 * accessibility test. Nothing about the page breaks if the link disappears —
 * it renders fine, it passes axe, Lighthouse does not care. It would simply
 * stop complying, silently, and the first person to notice would be someone
 * with a reason to look. A tidy-up of the footer is exactly how that happens.
 */

const REPO = 'https://github.com/AlexandreMartinezOlmos/petitsignes';

// Both locales, because they are built separately: a change applied to the
// shared layout still has to be proven on the page that actually ships.
const PAGES = [
  { path: '/', label: 'Codi font' },
  { path: '/el-projecte/', label: 'Codi font' },
  { path: '/credits/', label: 'Codi font' },
  { path: '/accessibilitat/', label: 'Codi font' },
  { path: '/signe/leche/', label: 'Codi font' },
  { path: '/es/', label: 'Código fuente' },
  { path: '/es/el-projecte/', label: 'Código fuente' },
  { path: '/es/credits/', label: 'Código fuente' },
  { path: '/es/accessibilitat/', label: 'Código fuente' },
  { path: '/es/signe/leche/', label: 'Código fuente' },
];

for (const { path, label } of PAGES) {
  test(`${path} offers the source code the AGPL requires`, async ({ page }) => {
    await page.goto(path);

    const link = page.locator('#footer-nav').getByRole('link', { name: label });

    await expect(link).toHaveAttribute('href', REPO);
    // Visible, not merely present: an offer nobody can reach is not an offer.
    await expect(link).toBeVisible();
  });
}

test('the credits page states the licence the repository actually carries', async ({ page }) => {
  await page.goto('/credits/');

  // The whole section, not the heading: `PageShell` emits
  // `<section aria-labelledby="licences">` around the heading and the slot, so
  // this survives the callout being restyled or re-wrapped.
  const licences = page.locator('section[aria-labelledby="licences"]');

  await expect(licences).toContainText('AGPL-3.0-or-later');
  // The previous licence. Left behind on a page like this it would not look
  // stale, it would look authoritative — and it says the opposite of the truth
  // about whether someone may close and sell a fork.
  await expect(licences).not.toContainText('MIT');
});

test('the Spanish credits page says the same thing', async ({ page }) => {
  await page.goto('/es/credits/');

  await expect(page.getByRole('link', { name: 'AGPL-3.0-or-later' })).toBeVisible();
});

/**
 * The three-way split is the claim that keeps this project honest: the AGPL
 * covers the code, and it does not reach the videos. Somebody who forks this
 * and assumes otherwise would redistribute material from DILSE and the
 * Generalitat that this project has no right to license — the failure mode the
 * whole architecture is arranged to prevent (§2.1, §2.4).
 */
test('the credits page keeps the videos outside the licence', async ({ page }) => {
  await page.goto('/credits/');

  // The whole section, not the heading: `PageShell` emits
  // `<section aria-labelledby="licences">` around the heading and the slot, so
  // this survives the callout being restyled or re-wrapped.
  const licences = page.locator('section[aria-labelledby="licences"]');

  await expect(licences).toContainText('CC BY-SA 4.0');
  await expect(licences).toContainText('fonts respectives');
  // The one thing the licence does not grant, stated where people check.
  await expect(licences).toContainText('reservats');
});

/**
 * The site redistributes other people's code — React, Nano Stores and Fuse.js
 * inside the bundle, Nunito Sans as .woff2 from this origin — and MIT and the
 * SIL Open Font Licence both ask their notice to travel with the copy. The
 * minifier strips comments, so the bundle cannot carry them: this link is the
 * only route from the site that serves the code to the notices that cover it.
 */
test('the credits page reaches the third-party notices', async ({ page }) => {
  await page.goto('/credits/');

  const link = page
    .locator('section[aria-labelledby="licences"]')
    .getByRole('link', { name: 'Avisos de tercers' });

  await expect(link).toHaveAttribute(
    'href',
    'https://github.com/AlexandreMartinezOlmos/petitsignes/blob/HEAD/THIRD-PARTY-NOTICES.md',
  );
  await expect(link).toBeVisible();
});

test('the project page links to the licences instead of restating them', async ({ page }) => {
  await page.goto('/el-projecte/');

  await page.getByRole('link', { name: 'Consulta les llicències' }).click();

  await expect(page).toHaveURL(/\/credits\/#licences$/);
  // The anchor has to land on a heading that exists; a contents link pointing
  // at a renamed id fails by doing nothing at all.
  await expect(page.locator('#licences')).toBeVisible();
});
