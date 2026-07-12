// Production verification: Hue sheet CONNECTED phase — GET HUE LIGHTS link
// (new canonical URL everywhere), ambient glow behind the sheet mirroring the
// stage, reduced-motion static glow, mobile 390px, served-bundle URL swap.
// Real Chrome (WebGPU-safe). Run: node .verify-hue-connected/verify.mjs [base-url]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'package.json'));
const { chromium, devices } = require('playwright');

const ORIGIN = process.argv[2] ?? 'https://booster.storytailor.com';
const BASE = `${ORIGIN}/?meadow-auth-mock`;
const NEW_URL = 'https://amzn.to/4vw54hn';
const OLD_CODE = '4wDqjPl';
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

const HUE_CONNECTED = {
  success: true,
  data: {
    connected: true,
    disabled: false,
    bridgeState: 'linked',
    intensityPreset: 'gentle',
    storyRoom: { selectionType: 'room', selectionId: 'room-1', selectionName: 'Bedroom' },
  },
};

async function setupPage(context) {
  const consoleErrors = [];
  await context.addInitScript(() => {
    sessionStorage.setItem(
      'meadow_auth_mock_session',
      JSON.stringify({ userId: 'mock-verify', email: 'verify@example.com', memberstackId: 'ms_mock_verify' }),
    );
    sessionStorage.setItem('meadow_auth_mock_profile_complete', '1');
  });
  await context.route('**/functions/v1/meadow-hue*', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    let body = HUE_CONNECTED;
    if (req.method() === 'POST') {
      let action = '';
      try {
        action = JSON.parse(req.postData() ?? '{}').action ?? '';
      } catch {
        action = '';
      }
      if (action === 'ambientStart') {
        const stage = JSON.parse(req.postData()).stage;
        body = { success: true, data: { sessionId: 'amb-verify', stage, durationMs: 840000 } };
      } else if (action === 'ambientStop') {
        body = { success: true, data: { stopped: true } };
      } else if (action === 'ambientActivity' || action === 'ambientAccent') {
        body = { success: true, data: { applied: true } };
      }
    }
    await route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify(body),
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

async function openConnectedHueSheet(page) {
  const about = page.getByRole('button', { name: 'About', exact: true });
  await about.waitFor({ state: 'visible', timeout: 15_000 });
  await about.click();
  await page.locator('[data-testid="meadow-about-connect-lights"]').click();
  await page.locator('#meadow-hue-title').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('radio', { name: 'GENTLE' }).waitFor({ state: 'visible', timeout: 10_000 });
}

function glowLocator(page) {
  return page.locator('[data-testid="meadow-hue-glow"]');
}

async function glowState(page) {
  return glowLocator(page).evaluate((el) => {
    const blob = (id) => {
      const node = el.querySelector(`[data-testid="meadow-hue-glow-blob-${id}"]`);
      if (!node) return null;
      const cs = getComputedStyle(node);
      return { color: cs.backgroundColor, animation: cs.animationName, opacity: Number(cs.opacity) };
    };
    return {
      opacity: Number(getComputedStyle(el).opacity),
      stage: el.dataset.glowStage,
      cool: blob('cool'),
      mid: blob('mid'),
      warm: blob('warm'),
    };
  });
}

async function run() {
  // ---------- Served bundle: new URL in, old short code out ----------
  {
    const html = await (await fetch(`${ORIGIN}/?cb=${Date.now()}`)).text();
    const entry = html.match(/\/assets\/index-[\w-]+\.js/)?.[0];
    const entryJs = entry ? await (await fetch(`${ORIGIN}${entry}`)).text() : '';
    const appName = entryJs.match(/App-[\w-]+\.js/)?.[0];
    const appJs = appName ? await (await fetch(`${ORIGIN}/assets/${appName}`)).text() : '';
    const bundle = entryJs + appJs;
    check('bundle: new Hue store URL present', bundle.includes(NEW_URL), appName ?? 'no App chunk');
    check('bundle: old short code absent', !bundle.includes(OLD_CODE), '');
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  // ---------- Desktop, connected ----------
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const { page, consoleErrors } = await setupPage(context);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await clickStart(page);
    await page.waitForTimeout(2000);
    await openConnectedHueSheet(page);
    await page.waitForTimeout(600);

    // Stage row unaffected: 4 radios on one row.
    const radios = page.locator('[role="radiogroup"] [role="radio"]');
    check('stage row has 4 stages', (await radios.count()) === 4, '');
    const stageRows = await radios.evaluateAll(
      (els) => new Set(els.map((el) => el.getBoundingClientRect().top.toFixed(0))).size,
    );
    check('stage row on one row', stageRows === 1, `${stageRows} row(s)`);
    const stageLabels = await radios.allTextContents();
    check('stage order OFF GENTLE VIVID FULL', stageLabels.join(' ') === 'OFF GENTLE VIVID FULL', stageLabels.join(' '));

    // GET HUE LIGHTS link: attrs + shares the Disconnect row.
    const link = page.locator('[data-testid="meadow-connected-get-lights"]');
    check('connected link present', (await link.count()) === 1, '');
    const attrs = await link.evaluate((el) => ({
      href: el.href,
      target: el.target,
      rel: el.rel,
      text: el.textContent?.trim(),
    }));
    check('connected link href (new URL)', attrs.href === NEW_URL, attrs.href);
    check('connected link target _blank', attrs.target === '_blank', attrs.target);
    check('connected link rel noopener sponsored', /noopener/.test(attrs.rel) && /sponsored/.test(attrs.rel), attrs.rel);
    check('connected link label', /get hue lights/i.test(attrs.text ?? ''), attrs.text ?? '');
    const linkBox = await link.boundingBox();
    const discBox = await page.getByRole('button', { name: 'Disconnect Hue' }).boundingBox();
    check(
      'link shares the Disconnect row',
      linkBox && discBox && Math.abs(linkBox.y - discBox.y) < 14,
      linkBox && discBox ? `dy ${(linkBox.y - discBox.y).toFixed(1)}` : 'no box',
    );

    // Glow: off by default.
    let glow = await glowState(page);
    check('glow layer exists', (await glowLocator(page).count()) === 1, '');
    check('glow hidden while OFF', glow.opacity === 0 && glow.stage === 'off', `opacity ${glow.opacity}`);

    // GENTLE → barely-there glow, cascade animating.
    await page.getByRole('radio', { name: 'GENTLE' }).click();
    await page.waitForTimeout(2600);
    glow = await glowState(page);
    const gentleOpacity = glow.opacity;
    check('glow visible on GENTLE', glow.stage === 'gentle' && glow.opacity > 0.2 && glow.opacity < 0.45, `opacity ${glow.opacity}`);
    check(
      'cascade blobs animating along the arc',
      glow.cool?.animation.includes('meadowHueGlowCool') && glow.warm?.animation.includes('meadowHueGlowWarm') && glow.mid?.animation.includes('meadowHueGlowMid'),
      `${glow.cool?.animation} / ${glow.mid?.animation} / ${glow.warm?.animation}`,
    );
    check(
      'multiple distinct hues at once',
      glow.cool && glow.warm && glow.mid && glow.cool.color !== glow.warm.color && glow.cool.color !== glow.mid.color,
      `${glow.cool?.color} vs ${glow.mid?.color} vs ${glow.warm?.color}`,
    );
    check('GENTLE stays mostly in the blues (faint warm blob)', glow.warm.opacity > 0.2 && glow.warm.opacity < 0.5, `warm opacity ${glow.warm.opacity}`);
    await page.screenshot({ path: `${OUT}/desktop-glow-gentle.png` });

    // FULL → deepest glow.
    await page.getByRole('radio', { name: 'FULL' }).click();
    await page.waitForTimeout(2600);
    glow = await glowState(page);
    check('glow deepest on FULL', glow.stage === 'full' && glow.opacity > 0.7, `opacity ${glow.opacity}`);
    check('FULL glow > GENTLE glow', glow.opacity > gentleOpacity, `${glow.opacity} vs ${gentleOpacity}`);
    check('FULL reaches full warm tail', glow.warm.opacity === 1, `warm opacity ${glow.warm.opacity}`);
    check(
      'FULL keeps distinct hues at once',
      glow.cool.color !== glow.warm.color && glow.mid.color !== glow.warm.color,
      `${glow.cool.color} vs ${glow.mid.color} vs ${glow.warm.color}`,
    );
    await page.screenshot({ path: `${OUT}/desktop-glow-full.png` });

    // OFF → fades away.
    await page.getByRole('radio', { name: 'OFF' }).click();
    await page.waitForTimeout(2600);
    glow = await glowState(page);
    check('glow gone after OFF', glow.opacity === 0 && glow.stage === 'off', `opacity ${glow.opacity}`);

    check('desktop console clean', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
    await context.close();
  }

  // ---------- Desktop, reduced motion ----------
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    });
    const { page, consoleErrors } = await setupPage(context);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await clickStart(page);
    await page.waitForTimeout(2000);
    await openConnectedHueSheet(page);
    await page.getByRole('radio', { name: 'VIVID' }).click();
    await page.waitForTimeout(2600);
    const glow = await glowState(page);
    check(
      'reduced motion: static glow (no animation)',
      glow.cool?.animation === 'none' && glow.mid?.animation === 'none' && glow.warm?.animation === 'none',
      `${glow.cool?.animation} / ${glow.mid?.animation} / ${glow.warm?.animation}`,
    );
    check(
      'reduced motion: static multi-hue gradient',
      glow.cool && glow.warm && glow.cool.color !== glow.warm.color,
      `${glow.cool?.color} vs ${glow.warm?.color}`,
    );
    check('reduced motion: stage intensity kept', glow.stage === 'vivid' && glow.opacity > 0.4, `opacity ${glow.opacity}`);
    check('reduced-motion console clean', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
    await context.close();
  }

  // ---------- Mobile 390px (iPhone 13) ----------
  {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const { page, consoleErrors } = await setupPage(context);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await clickStart(page);
    await page.waitForTimeout(2500);
    await openConnectedHueSheet(page);
    await page.waitForTimeout(600);

    const vw = page.viewportSize().width;
    const link = page.locator('[data-testid="meadow-connected-get-lights"]');
    const attrs = await link.evaluate((el) => ({ href: el.href, rel: el.rel, target: el.target }));
    check('mobile link href (new URL)', attrs.href === NEW_URL, attrs.href);
    check('mobile link rel/target', attrs.target === '_blank' && /noopener/.test(attrs.rel) && /sponsored/.test(attrs.rel), `${attrs.target} / ${attrs.rel}`);
    const linkBox = await link.boundingBox();
    check('mobile link inside viewport', linkBox && linkBox.x >= 0 && linkBox.x + linkBox.width <= vw + 0.5, linkBox ? `x ${linkBox.x.toFixed(1)} w ${linkBox.width.toFixed(1)}` : 'no box');
    const radios = page.locator('[role="radiogroup"] [role="radio"]');
    const stageRows = await radios.evaluateAll(
      (els) => new Set(els.map((el) => el.getBoundingClientRect().top.toFixed(0))).size,
    );
    check('mobile stage row on one row', stageRows === 1, `${stageRows} row(s)`);

    await page.getByRole('radio', { name: 'GENTLE' }).click();
    await page.waitForTimeout(2600);
    const glow = await glowState(page);
    check('mobile glow on GENTLE', glow.stage === 'gentle' && glow.opacity > 0.2, `opacity ${glow.opacity}`);
    await page.screenshot({ path: `${OUT}/mobile-connected-glow-gentle.png` });

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
