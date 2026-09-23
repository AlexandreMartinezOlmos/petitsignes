import { expect, test } from '@playwright/test';

/**
 * One page per sign.
 *
 * The catalogue publishes 194 concepts at a single address, which for a search
 * engine is one thing rather than 194 — while the question a parent types is
 * "how do you sign milk in LSC". These pages are the answer, and they are also
 * the link somebody can send.
 *
 * The invariants they inherit are the strict ones: only the page's own sign
 * language reaches the DOM, and nothing describes the gesture.
 */

const CA = '/signe/leche/';
const ES = '/es/signe/leche/';

test.describe('finding a sign page', () => {
  test('the word on a card is the way in', async ({ page }) => {
    await page.goto('/');

    await page
      .locator('.sign-card[data-sign-id="leche"]')
      .getByRole('link', { name: 'llet' })
      .click();

    await expect(page).toHaveURL(new RegExp(`${CA}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('llet');
  });

  test('the Spanish catalogue leads to the Spanish page, not the Catalan one', async ({ page }) => {
    await page.goto('/es/');

    await page
      .locator('.sign-card[data-sign-id="leche"]')
      // Anchored at the start: the external CTA on a Spanish card is also named
      // after the word ("Ver en CNSE-DILSE: leche"), so a bare substring matches
      // both. Not anchored at the colon — `.sr-only` is positioned, so the
      // accessible name reads "leche : ficha del signo" with a space before it.
      .getByRole('link', { name: /^leche/i })
      .click();

    await expect(page).toHaveURL(new RegExp(`${ES}$`));
  });

  test('the sitemap lists every sign, in both languages', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();

    // Read from the collection rather than written by hand, so this is really
    // asking whether the endpoint is still wired to the content.
    expect(xml).toContain('/signe/leche/');
    expect(xml).toContain('/es/signe/leche/');
    expect((xml.match(/<loc>/g) ?? []).length).toBeGreaterThan(300);
  });
});

test.describe('what a sign page says', () => {
  /**
   * The invariant that makes "no invented sign" structural rather than a good
   * intention: the
   * other sign language's gesture must not be in the document at all, one
   * `display` away from being shown under the wrong word.
   */
  test('ships only the sign language its URL promises', async ({ request }) => {
    const catalan = await (await request.get(CA)).text();
    expect(catalan).toContain('Llengua de Signes Catalana');
    expect(catalan).not.toContain('fundacioncnse-dilse.org');

    const spanish = await (await request.get(ES)).text();
    expect(spanish).toContain('Lengua de Signos Española');
    expect(spanish).toContain('fundacioncnse-dilse.org');
  });

  /**
   * The videos are not ours. The Vocabulari is reused under Llei 19/2014
   * art. 17.1, which requires citing the source *and the date of the version* —
   * so the date is a legal obligation here, not a detail.
   */
  test('credits the source, with its date and a link to the original entry', async ({ page }) => {
    await page.goto(CA);

    const source = page.locator('.sign-source');
    await expect(source).toContainText('Gencat-VocabulariLSC');
    await expect(source).toContainText('Llei 19/2014');
    await expect(source.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
    await expect(source.getByRole('link')).toHaveAttribute('href', /llengua\.gencat\.cat/);
  });

  test('is described to search engines by what it can actually deliver', async ({ request }) => {
    const html = await (await request.get(CA)).text();

    // The one sentence a search result shows. It has to name the word and the
    // sign language, because that pair is the entire query.
    expect(html).toMatch(/<meta name="description" content="[^"]*llet[^"]*Llengua de Signes/);
    expect(html).toContain('<link rel="canonical" href="https://petitsignes.cat/signe/leche/"');
    expect(html).toContain('hreflang="es" href="https://petitsignes.cat/es/signe/leche/"');
  });

  /**
   * The route for someone who can tell us a sign is wrong.
   *
   * "Never invent a sign" only holds if the people who know LSC or LSE can
   * report a breach, and this page is the one screen where a mistake is
   * visible. Prefilling matters as much as the link: a report that arrives
   * naming the entry and the sign language is actionable, "the video for milk
   * looks wrong" is a hunt through 194 files.
   */
  test('lets someone report a wrong sign, with the entry already identified', async ({ page }) => {
    await page.goto(CA);

    const link = page.locator('.sign-report__link');
    const href = await link.getAttribute('href');
    const url = new URL(href ?? '');

    expect(url.origin).toBe('https://github.com');
    expect(url.pathname).toMatch(/\/issues\/new$/);

    // Decoded, because the maintainer reads the form, not the query string.
    expect(url.searchParams.get('title')).toContain('llet');
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('leche');
    expect(body).toContain('LSC');
    expect(body).toContain('/signe/leche/');

    // No placeholder survived into what someone is about to send.
    expect(href).not.toContain('{');

    await expect(link).toHaveAttribute('rel', /noopener/);
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  /** The Spanish page must report the LSE entry, not the Catalan one. */
  test('reports the sign language of the page it was opened from', async ({ page }) => {
    await page.goto(ES);

    const href = (await page.locator('.sign-report__link').getAttribute('href')) ?? '';
    const body = new URL(href).searchParams.get('body') ?? '';

    expect(body).toContain('LSE');
    expect(body).not.toContain('LSC');
    expect(body).toContain('/es/signe/leche/');
  });

  /**
   * The GitHub route needs an account, and the people most able to spot a
   * wrong sign — Deaf signers, interpreters, parents — mostly do not have one.
   * The same report goes by email, with the subject saying which sign in which
   * sign language, so it arrives identified either way.
   */
  for (const { path, subject } of [
    { path: CA, subject: 'Signe «llet» (LSC)' },
    { path: ES, subject: 'Signo «leche» (LSE)' },
  ]) {
    test(`offers the same report by email, with no account needed (${path})`, async ({ page }) => {
      await page.goto(path);

      const email = page.locator('.sign-report__hint a[href^="mailto:"]');
      await expect(email).toHaveText('petitsignes@petitsignes.cat');

      const href = (await email.getAttribute('href')) ?? '';
      expect(href.startsWith('mailto:petitsignes@petitsignes.cat?subject=')).toBe(true);
      expect(decodeURIComponent(href.split('subject=')[1] ?? '')).toBe(subject);

      // Told apart from the muted sentence by its underline, not only its colour.
      await expect(email).toHaveCSS('text-decoration-line', 'underline');
    });
  }

  test('offers a way onward rather than being a dead end', async ({ page }) => {
    await page.goto(CA);

    const related = page.locator('.sign-related');
    // The neighbours only — the section also holds the link back to the whole
    // catalogue, which is deliberately not a sign page.
    const hrefs = await related
      .locator('.sign-related__link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

    expect(hrefs.length).toBeGreaterThan(0);
    // Every neighbour is a sign page, and none of them is the page you are on.
    expect(hrefs.every((href) => /^\/signe\/[a-z0-9-]+\/$/.test(href ?? ''))).toBe(true);
    expect(hrefs).not.toContain(CA);

    // Three steps since the category pages arrived, and the order is the claim:
    // a sign belongs to a category, which belongs to the catalogue. Asserting
    // the whole trail rather than "a link to /" is what would catch the middle
    // step being dropped or the two being swapped.
    const trail = await page
      .locator('.breadcrumb__link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(trail).toEqual(['/', '/categoria/menjar-i-beure/']);
  });
});

test.describe('a sign page is not a dead card', () => {
  /**
   * The toggles have to be real. `mountSignCards` finds them by
   * `data-progress-for` rather than by the card's class, which is what lets this
   * page carry the same state without pretending to be a card.
   */
  test('favouriting here shows up in the catalogue', async ({ page }) => {
    await page.goto(CA);

    const favorite = page.locator('[data-action="favorite"]');
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/');
    await expect(
      page.locator('.sign-card[data-sign-id="leche"] [data-action="favorite"]'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  /**
   * The same control, not a lookalike.
   *
   * These buttons first shipped with a set of styles of their own — a bordered
   * square that turned brand-soft when pressed — so the star that goes yellow in
   * the grid went beige here, and the learned pill that fills green did not fill
   * at all. Two looks for one control teaches the visitor that they are two
   * different things.
   *
   * The tokens are read from `:root` rather than written in as hex, so this
   * asserts "the same colour the design system calls star" and not "the colour
   * star happened to be the day this was written".
   */
  test('wears the catalogue’s toggles rather than a second set of its own', async ({ page }) => {
    await page.goto(CA);

    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const resolve = (name: string) => {
        const probe = document.createElement('span');
        probe.style.color = root.getPropertyValue(name).trim();
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      return { star: resolve('--color-star'), learned: resolve('--color-learned') };
    });

    const favorite = page.locator('.sign-detail [data-action="favorite"]');
    const learned = page.locator('.sign-detail [data-action="learned"]');

    // Unpressed it is the bare 44px pill: the raised, bordered variant belongs
    // to a card, where the toggles float over the media panel and need to stay
    // legible on an arbitrary category tint.
    await expect(favorite).toHaveCSS('border-top-width', '0px');
    await expect(favorite).toHaveCSS('border-top-left-radius', '999px');
    await expect(favorite).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
    await expect(favorite).toHaveCSS('color', tokens.star);

    await learned.click();
    await expect(learned).toHaveAttribute('aria-pressed', 'true');
    await expect(learned).toHaveCSS('background-color', tokens.learned);
  });

  /**
   * The media panel used to be `--color-surface-sunken` while the chip
   * two lines below it carried the category's tint — the panel and the chip
   * of the same entry read as two different components. Compared against the
   * card's own placeholder rather than a hardcoded colour, so this is really
   * asking "does it read `--cat-bg`/`--cat-fg` off the same element the card
   * does", not "is it beige today".
   */
  test('the media panel wears the card’s placeholder, not a lookalike', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.sign-card[data-sign-id="leche"] .sign-card__placeholder');
    const cardStyle = await card.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { backgroundImage: cs.backgroundImage, color: cs.color };
    });

    await page.goto(CA);
    const panel = page.locator('.sign-detail__media .sign-card__placeholder');
    await expect(panel).toHaveCSS('background-image', cardStyle.backgroundImage);
    await expect(panel).toHaveCSS('color', cardStyle.color);
  });

  /**
   * No source allows a poster, so the placeholder is permanent, not pending.
   * It used to carry an `sr-only` "we do not have the image yet", which a
   * screen reader read before every word of the catalogue — 194 times per
   * page — promising an image that is never coming. The word and the category
   * heading already say what the placeholder depicts.
   */
  test('the placeholder is decoration, and promises nothing', async ({ page }) => {
    for (const path of ['/', '/es/', CA, ES]) {
      await page.goto(path);
      const placeholders = page.locator('.sign-card__placeholder');
      expect(await placeholders.count(), `${path} has no placeholder to check`).toBeGreaterThan(0);

      const exposed = await placeholders.evaluateAll(
        (els) =>
          els.filter(
            (el) =>
              el.closest('[aria-hidden="true"]') === null || (el.textContent ?? '').trim() !== '',
          ).length,
      );
      expect(exposed, `${path}: placeholders reachable by a screen reader`).toBe(0);
    }
  });

  /**
   * The card never plays on its own, and browsing must not contact
   * YouTube. A page dedicated to one sign is exactly where that rule would be
   * quietly dropped, so it is checked here too — matched on hostname, because a
   * naive `/youtube/` also catches our own module served by the dev server.
   */
  test('does not contact YouTube until the sign is asked for', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (request) => {
      const host = new URL(request.url()).hostname;
      if (host.endsWith('youtube.com') || host.endsWith('ytimg.com')) hits.push(host);
    });

    await page.goto(CA);
    await page.waitForLoadState('networkidle');
    expect(hits).toEqual([]);

    await page.getByRole('button', { name: /veure el signe/i }).click();
    await expect(page.locator('dialog.player-dialog')).toBeVisible();
    await expect.poll(() => hits.length).toBeGreaterThan(0);
  });

  test('the Spanish page links out to the dictionary instead of playing', async ({ page }) => {
    await page.goto(ES);

    const cta = page.locator('a.sign-card__cta--external');
    await expect(cta).toHaveAttribute('href', /fundacioncnse-dilse\.org/);
    await expect(cta).toHaveAttribute('rel', /noopener/);
  });
});

/**
 * WCAG 3.1.2, language of parts. The citation quotes the source, and a quote
 * keeps the language it was written in — so it says which one, and a screen
 * reader switches voice instead of reading Catalan with Spanish phonetics.
 * What the project adds in its own words is translated, not quoted: it was
 * Catalan on every Spanish page.
 */
test.describe('the citation speaks the page’s language, and marks what it quotes', () => {
  test('the Spanish page quotes DILSE in Spanish and explains the link in Spanish', async ({
    page,
  }) => {
    await page.goto(ES);
    const source = page.locator('.sign-source');

    await expect(source.locator('.sign-source__license[lang="es"]')).toContainText('DILSE');
    await expect(source).toContainText('Enlazamos a la ficha original');
    await expect(source).not.toContainText(/enllaç|projecte|allotja/i);
  });

  test('the Catalan page quotes the Vocabulari in Catalan', async ({ page }) => {
    await page.goto(CA);
    const source = page.locator('.sign-source');

    await expect(source.locator('.sign-source__license[lang="ca"]')).toContainText(
      'Vocabulari bàsic de la LSC',
    );
    // An embedded video is not "only linked": the sentence is for DILSE's
    // delivery, not for every source.
    await expect(source).not.toContainText('Enllacem a la fitxa original');
  });
});

test.describe('the citation repositions, never disappears', () => {
  /**
   * The source's attribution is required, not decorative — unlike the text pages'
   * contents list, which this two-column shape is modelled on and which is
   * safe to hide below `lg` because it only repeats the article. Copying
   * `.page-aside` verbatim would have copied its `display: none` default
   * too, and silently dropped the citation from every phone. This is the one
   * thing that check exists to catch.
   */
  test('the citation stays visible on a phone, in the same reading order', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await page.goto(CA);

    await expect(page.locator('.sign-source')).toBeVisible();

    // Right after the article, before the report link and the related
    // signs — the same order the comment above `.sign-source` in the
    // component describes, at every width.
    const [detailTop = -1, sourceTop = -1, reportTop = -1, relatedTop = -1] = await page.evaluate(
      () =>
        ['.sign-detail', '.sign-source', '.sign-report', '.sign-related'].map(
          (selector) => document.querySelector(selector)?.getBoundingClientRect().top ?? -1,
        ),
    );
    expect(detailTop).toBeLessThan(sourceTop);
    expect(sourceTop).toBeLessThan(reportTop);
    expect(reportTop).toBeLessThan(relatedTop);
  });

  /** The 416px that used to sit empty next to a 736px column. */
  test('the citation sits beside the article on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(CA);

    const detail = await page.locator('.sign-detail').boundingBox();
    const source = await page.locator('.sign-source').boundingBox();
    const related = await page.locator('.sign-related').boundingBox();
    if (!detail || !source || !related) throw new Error('expected all three blocks on screen');

    // Beside, not below: the citation starts to the right of the article, on
    // roughly the same row.
    expect(source.x).toBeGreaterThan(detail.x + detail.width);
    expect(Math.abs(source.y - detail.y)).toBeLessThan(20);

    // Related signs never move into the aside — only the citation does.
    // They stay in the main column, under the article.
    expect(related.x).toBeLessThan(source.x);
    expect(related.y).toBeGreaterThan(detail.y);
  });
});

test.describe('.sign-page--no-source: the layout when a sign has no video', () => {
  /**
   * No sign in the catalogue lacks a video today — all 194 have both LSC and
   * LSE — so this state has never run against real content, only been
   * checked by hand in a browser. Rather than wait
   * for data that may never arrive, this simulates exactly what
   * SignView.astro renders when `video` is falsy: the same class the
   * component would add, the same `<aside>` it would omit (both driven by
   * the identical `video` check, so they cannot drift from each other).
   *
   * Same technique the project already used once for this exact problem:
   * when every card gained a video, `.sign-card__novideo` had nothing left
   * to test against, and the fix was to inject the markup the component
   * would produce and measure its real computed shape, rather than mock the
   * DOM or drop the guard. See the `qa` skill for that precedent.
   */
  const simulateNoSource = () => {
    document.querySelector('.sign-source')?.remove();
    document.querySelector('.sign-page')?.classList.add('sign-page--no-source');
  };

  test('collapses to a single column on a wide screen, with no orphaned gap', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(CA);
    await page.evaluate(simulateNoSource);

    await expect(page.locator('.sign-source')).toHaveCount(0);

    const detail = await page.locator('.sign-detail').boundingBox();
    const report = await page.locator('.sign-report').boundingBox();
    if (!detail || !report) throw new Error('expected both blocks on screen');

    // Stacked, not beside: with nothing to put in a second column, the
    // two-column rule (`.sign-page:not(.sign-page--no-source)`) must not
    // apply, or the report would float in the empty column instead of below.
    expect(report.x).toBeLessThan(detail.x + detail.width);
    expect(report.y).toBeGreaterThan(detail.y);

    // One `row-gap` (2rem = 32px), not two — the exact shape of a bug once
    // found in this same layout: an area left in the template with nothing to
    // fill it doubles the gap around empty space instead of closing it.
    const gap = report.y - (detail.y + detail.height);
    expect(gap).toBeGreaterThan(24);
    expect(gap).toBeLessThan(40);
  });

  test('stacks the same way on a phone, where it always did', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 1200 });
    await page.goto(CA);
    await page.evaluate(simulateNoSource);

    const detail = await page.locator('.sign-detail').boundingBox();
    const report = await page.locator('.sign-report').boundingBox();
    if (!detail || !report) throw new Error('expected both blocks on screen');

    const gap = report.y - (detail.y + detail.height);
    expect(gap).toBeGreaterThan(24);
    expect(gap).toBeLessThan(40);
  });

  test('does not scroll sideways at 320px even with no citation', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(CA);
    await page.evaluate(simulateNoSource);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('a sign page on a phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  /** WCAG 1.4.10. A source URL is long and has no spaces to break at. */
  test('does not scroll sideways at 320px', async ({ page }) => {
    await page.goto(CA);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

/**
 * The word in the other languages, as text. On a site whose one structural
 * promise is that the other sign language never reaches the page, this line
 * has to stay words: no link, no video, nothing that could stand in for a
 * gesture. And each word is marked with its language, or a screen reader
 * reads "leche" with Catalan phonetics (WCAG 3.1.2).
 */
test.describe('the word in the other languages', () => {
  test('names it in each other language, marked as that language', async ({ page }) => {
    await page.goto(CA);
    const line = page.locator('.sign-detail__elsewhere');

    await expect(line).toContainText('castellà «leche»');
    await expect(line).toContainText('anglès «milk»');
    await expect(line.locator('[lang="es"]')).toHaveText('leche');
    await expect(line.locator('[lang="en"]')).toHaveText('milk');
    await expect(line.locator('a, button, iframe, video')).toHaveCount(0);
  });

  test('leaves out the language the page is already in', async ({ page }) => {
    await page.goto(ES);
    const line = page.locator('.sign-detail__elsewhere');

    await expect(line).toContainText('catalán «llet»');
    await expect(line.locator('[lang="es"]')).toHaveCount(0);
  });

  test('introduces the related signs with what their category is for', async ({ page }) => {
    await page.goto(CA);
    await expect(page.locator('.sign-related__intro')).toContainText('«aigua»');
  });
});
