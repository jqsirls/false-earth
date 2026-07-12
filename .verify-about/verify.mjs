// Production verification: About modal + CONNECT LIGHTS + buy-lights link,
// desktop orb-counter size, desktop footer brightness, pointer-lock audit.
// Real Chrome (WebGPU-safe). Run: node .verify-about/verify.mjs [base-url]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'package.json'));
const { chromium, devices } = require('playwright');

const ORIGIN = process.argv[2] ?? 'https://booster.storytailor.com';
const BASE = `${ORIGIN}/?meadow-auth-mock`;
const OUT = path.resolve(here, 'shots');
mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const CORS = {
  'access-control-allow-origin': new URL(ORIGIN).origin,
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'authorization, content-type, x-request-id',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
};

const HUE_DISCONNECTED = JSON.stringify({
  success: true,
  data: { connected: false, disabled: false, bridgeState: 'unlinked', intensityPreset: 'gentle', storyRoom: null },
});

async function setupPage(context, { signedIn, hueBody }) {
  const consoleErrors = [];
  if (signedIn) {
    await context.addInitScript(() => {
      sessionStorage.setItem(
        'meadow_auth_mock_session',
        JSON.stringify({ userId: 'mock-verify', email: 'verify@example.com', memberstackId: 'ms_mock_verify' }),
      );
      sessionStorage.setItem('meadow_auth_mock_profile_complete', '1');
    });
  }
  await context.route('**/functions/v1/meadow-hue*', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: hueBody,
    });
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  return { page, consoleErrors };
}

async function clickStart(page) {
  const start = page.getByText(/\[ ?START ?\]/i).first();
  await start.waitFor({ state: 'visible', timeout: 90_000 });
  await start.click();
  await page.locator('.meadow-cta').waitFor({ state: 'visible', timeout: 60_000 });
}

async function openAbout(page) {
  const about = page.getByRole('button', { name: 'About', exact: true });
  await about.waitFor({ state: 'visible', timeout: 15_000 });
  await about.click();
  await page.locator('#meadow-legal-title').waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(500);
}

function assertBuyLink(name, attrs) {
  check(`${name}: buy link href`, attrs?.href === 'https://amzn.to/4vw54hn', attrs?.href ?? 'missing');
  check(`${name}: buy link target _blank`, attrs?.target === '_blank', attrs?.target ?? '');
  check(
    `${name}: buy link rel noopener sponsored`,
    /noopener/.test(attrs?.rel ?? '') && /sponsored/.test(attrs?.rel ?? ''),
    attrs?.rel ?? '',
  );
}

async function buyLinkAttrs(page, scope) {
  const link = scope.locator('[data-testid="meadow-buy-lights"]').first();
  if ((await link.count()) === 0) return null;
  return link.evaluate((el) => ({ href: el.href, target: el.target, rel: el.rel, text: el.textContent }));
}

const IGNORE_TLS = ORIGIN.includes('localhost');

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const contextDefaults = IGNORE_TLS ? { ignoreHTTPSErrors: true } : {};

  // ---------- Desktop, signed OUT ----------
  {
    const context = await browser.newContext({ ...contextDefaults, viewport: { width: 1280, height: 800 } });
    const { page, consoleErrors } = await setupPage(context, { signedIn: false, hueBody: HUE_DISCONNECTED });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await clickStart(page);
    await page.waitForTimeout(2500);

    // Footer: four links, About first, desktop brightness.
    const footerLabels = await page.locator('footer button').allTextContents();
    check('footer has 4 links About first', JSON.stringify(footerLabels) === JSON.stringify(['About', 'Privacy', 'Terms', 'Research']), footerLabels.join(' · '));
    const footerColor = await page.getByRole('button', { name: 'About', exact: true }).evaluate((el) => getComputedStyle(el).color);
    check('desktop footer color brightened (alpha ~0.88)', /0\.88/.test(footerColor), footerColor);

    // Orb counter desktop size.
    await page.evaluate(() => window.__MEADOW_EVENTS__?.emit('orb:gathered', { count: 7 }));
    await page.waitForTimeout(2200);
    const counterSize = await page.locator('.orb-counter-readout').evaluate((el) => getComputedStyle(el).fontSize);
    check('desktop orb counter enlarged (16.8px = 1.05rem)', counterSize === '16.8px', counterSize);
    const counterOpacity = await page.locator('.orb-counter-readout').evaluate((el) => getComputedStyle(el).opacity);
    check('desktop counter rest opacity stays 1', counterOpacity === '1', counterOpacity);
    await page.screenshot({ path: `${OUT}/desktop-hud-counter-footer.png` });

    // About modal + copy.
    await openAbout(page);
    const modalText = await page.locator('[role="dialog"]').innerText();
    check('about: quiet meadow copy present', modalText.includes('This is a quiet meadow at the edge of the sky'), '');
    check('about: booster line present', modalText.includes("Storytailor's Booster lives here."), '');
    check('about: stay line present', modalText.includes('Stay as long as you like.'), '');
    check('about: zero em dashes', !modalText.includes('\u2014'), '');
    const aboutBuy = await buyLinkAttrs(page, page.locator('[role="dialog"]'));
    assertBuyLink('about modal', aboutBuy);
    await page.screenshot({ path: `${OUT}/desktop-about-modal.png` });

    // CONNECT LIGHTS signed out → auth sheet.
    await page.locator('[data-testid="meadow-about-connect-lights"]').click();
    await page.locator('#meadow-auth-title').waitFor({ state: 'visible', timeout: 10_000 });
    const aboutGone = (await page.locator('#meadow-legal-title').count()) === 0;
    check('signed-out CONNECT LIGHTS closes About, opens auth sheet', aboutGone, '');
    // hue_connect intent: auth title copy is the lights-flavored one.
    const authTitle = await page.locator('#meadow-auth-title').innerText();
    check('auth sheet carries hue intent copy', /light|glow|lamp|room/i.test(authTitle), authTitle);
    // Auth flow has no clean affiliate spot (email → code → profile forms only) — assert no buy link inside it.
    const authBuy = await buyLinkAttrs(page, page.locator('[aria-labelledby="meadow-auth-title"]'));
    check('auth sheet stays free of buy link', authBuy === null, '');
    await page.screenshot({ path: `${OUT}/desktop-auth-from-about.png` });

    // End-to-end intent proof (mock OTP): email → 000000 → profile → Hue sheet.
    await page.locator('input[type="email"]').fill('verify-intent@example.com');
    await page.locator('form button[type="submit"]').first().click();
    const firstDigit = page.locator('input[inputmode="numeric"]').first();
    await firstDigit.waitFor({ state: 'visible', timeout: 10_000 });
    await firstDigit.click();
    await firstDigit.pressSequentially('000000');
    await page.locator('input[autocomplete="given-name"]').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('input[autocomplete="given-name"]').fill('Verify');
    await page.locator('input[autocomplete="bday-year"]').fill('1990');
    await page.locator('input[autocomplete="bday-month"]').fill('01');
    await page.locator('input[autocomplete="bday-day"]').fill('15');
    await page.locator('select').selectOption({ index: 1 });
    await page.locator('form button[type="submit"]').first().click();
    await page.locator('#meadow-hue-title').waitFor({ state: 'visible', timeout: 15_000 });
    check('hue_connect intent resumes into Hue sheet after OTP + profile', true, '');
    await page.screenshot({ path: `${OUT}/desktop-hue-after-intent.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Pointer-lock audit: engage lock via canvas click, diff DOM for app toasts.
    const domBefore = await page.evaluate(() => document.querySelectorAll('body *').length);
    await page.mouse.click(640, 400);
    await page.waitForTimeout(1200);
    const lockState = await page.evaluate(() => ({
      locked: Boolean(document.pointerLockElement),
      domCount: document.querySelectorAll('body *').length,
      toastText: Array.from(document.querySelectorAll('body *'))
        .filter((el) => /esc/i.test(el.textContent ?? '') && el.children.length === 0)
        .map((el) => el.textContent?.trim())
        .join(' | '),
    }));
    // Headless Chrome denies requestPointerLock — report, don't fail. The
    // assertable part is that the app injects no toast of its own on click.
    console.log(`INFO  pointer lock state after canvas click (headless): locked=${lockState.locked}`);
    check(
      'no app-owned pointer-lock toast injected',
      lockState.domCount - domBefore <= 0,
      `domDelta ${lockState.domCount - domBefore}; persistent esc hint: ${lockState.toastText}`,
    );

    check('desktop console clean', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
    await context.close();
  }

  // ---------- Desktop, signed IN (mock), Hue disconnected ----------
  {
    const context = await browser.newContext({ ...contextDefaults, viewport: { width: 1280, height: 800 } });
    const { page, consoleErrors } = await setupPage(context, { signedIn: true, hueBody: HUE_DISCONNECTED });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await clickStart(page);
    await page.waitForTimeout(2000);

    await openAbout(page);
    await page.locator('[data-testid="meadow-about-connect-lights"]').click();
    await page.locator('#meadow-hue-title').waitFor({ state: 'visible', timeout: 15_000 });
    const aboutGone = (await page.locator('#meadow-legal-title').count()) === 0;
    check('signed-in CONNECT LIGHTS closes About, opens Hue sheet', aboutGone, '');
    await page.getByText('[ CONNECT HUE ]').waitFor({ state: 'visible', timeout: 10_000 });
    const hueBuy = await buyLinkAttrs(page, page.locator('.meadow-hue-panel'));
    assertBuyLink('hue sheet (not connected)', hueBuy);
    await page.screenshot({ path: `${OUT}/desktop-hue-sheet-buy-link.png` });

    check('signed-in console clean', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
    await context.close();
  }

  // ---------- Mobile 390px (iPhone 13) ----------
  {
    const context = await browser.newContext({ ...contextDefaults, ...devices['iPhone 13'] });
    const { page, consoleErrors } = await setupPage(context, { signedIn: false, hueBody: HUE_DISCONNECTED });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await clickStart(page);
    await page.waitForTimeout(2500);

    // Footer fits at 390px with four links.
    const footer = page.locator('footer');
    const box = await footer.boundingBox();
    const vw = page.viewportSize().width;
    check('mobile footer fits viewport at 390px', box && box.x >= 0 && box.x + box.width <= vw + 0.5, box ? `x ${box.x.toFixed(1)} w ${box.width.toFixed(1)} vw ${vw}` : 'no box');
    const rows = await footer.locator('button').evaluateAll((els) => new Set(els.map((el) => el.getBoundingClientRect().top.toFixed(0))).size);
    check('mobile footer links on one row', rows === 1, `${rows} row(s)`);
    const labels = await footer.locator('button').allTextContents();
    check('mobile footer 4 links About first', labels[0] === 'About' && labels.length === 4, labels.join(' · '));

    // Mobile keeps the muted footer color and small counter.
    const footerColor = await page.getByRole('button', { name: 'About', exact: true }).evaluate((el) => getComputedStyle(el).color);
    check('mobile footer keeps muted color (alpha 0.55)', /0\.55/.test(footerColor), footerColor);
    await page.evaluate(() => window.__MEADOW_EVENTS__?.emit('orb:gathered', { count: 4 }));
    await page.waitForTimeout(2200);
    const counterSize = await page.locator('.orb-counter-readout').evaluate((el) => getComputedStyle(el).fontSize);
    check('mobile orb counter keeps 0.7rem (11.2px)', counterSize === '11.2px', counterSize);
    await page.screenshot({ path: `${OUT}/mobile-footer-counter.png` });

    await openAbout(page);
    const modalText = await page.locator('[role="dialog"]').innerText();
    check('mobile about: zero em dashes', !modalText.includes('\u2014'), '');
    const aboutBuy = await buyLinkAttrs(page, page.locator('[role="dialog"]'));
    assertBuyLink('mobile about modal', aboutBuy);
    await page.screenshot({ path: `${OUT}/mobile-about-modal.png` });

    check('mobile console clean', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
    await context.close();
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
