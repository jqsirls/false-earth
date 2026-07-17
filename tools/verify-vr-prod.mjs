/**
 * Flat + ?webxr=1 production smoke for Booster's Meadow.
 * MUST use channel: 'chrome' — bundled Chromium rejects WebGPU grass shaders.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../output/vr-verify-2026-07-17');
mkdirSync(OUT, { recursive: true });

const FLAT = 'https://booster.storytailor.com/';
const WEBXR = 'https://booster.storytailor.com/?webxr=1&debug=1';

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

async function clickStart(page) {
  const start = page.getByRole('button', { name: /START/i }).first();
  await start.waitFor({ state: 'visible', timeout: 60000 });
  await start.click();
}

async function waitForMeadowReady(page) {
  // After START the gate unmounts; controls hint + story CTA appear.
  await page.getByText('MAKE A STORY WITH BOOSTER', { exact: false }).waitFor({
    state: 'visible',
    timeout: 120000,
  });
  // Give grass/character a few frames to settle
  await page.waitForTimeout(5000);
}

async function runScenario(browser, name, url) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  const errors = collectErrors(page);

  const result = {
    name,
    url,
    ok: false,
    hasCanvas: false,
    enterVrVisible: false,
    criticalErrors: [],
    screenshot: join(OUT, `${name}.png`),
  };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await clickStart(page);
    await waitForMeadowReady(page);

    result.hasCanvas = await page.evaluate(() => Boolean(document.querySelector('canvas')));
    const canvasBox = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { w: r.width, h: r.height, cw: c.width, ch: c.height };
    });
    result.canvasBox = canvasBox;

    result.enterVrVisible = await page.locator('[data-meadow-enter-vr]').isVisible().catch(() => false);

    result.hasGrassSignal = await page.evaluate(() => {
      // WebGPU meadow: canvas present + story CTA means load completed past START.
      return Boolean(
        document.querySelector('canvas') &&
          Array.from(document.querySelectorAll('button,a,[role="button"]')).some((el) =>
            /MAKE A STORY WITH/i.test(el.textContent || ''),
          ),
      );
    });

    // Probe XR helpers + grass path signals when debug is on
    result.runtime = await page.evaluate(() => {
      const gpu = Boolean(navigator.gpu);
      const webxrParam = new URLSearchParams(location.search).get('webxr');
      return {
        gpu,
        webxrParam,
        hasVrLog: Array.isArray(window.__meadowVrLog),
        vrLogLen: window.__meadowVrLog?.length ?? 0,
        userAgent: navigator.userAgent.slice(0, 80),
      };
    });

    await page.screenshot({ path: result.screenshot, fullPage: false });

    result.criticalErrors = errors.filter(
      (e) =>
        !/favicon/i.test(e) &&
        !/ResizeObserver/i.test(e) &&
        !/Failed to load resource/i.test(e),
    );

    result.ok =
      result.hasCanvas &&
      result.hasGrassSignal &&
      result.criticalErrors.length === 0 &&
      // Desktop must NOT show ENTER VR
      (name === 'flat-prod' || name === 'webxr-flat-preview' ? !result.enterVrVisible : true);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    try {
      await page.screenshot({ path: result.screenshot, fullPage: false });
    } catch {
      /* ignore */
    }
  } finally {
    await context.close();
  }

  return result;
}

/** Quest / VP UA + WebXR mock — proves ENTER VR gate + session start plumbing without a headset. */
async function runXrSessionMock(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/37.0 Chrome/146.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  const errors = collectErrors(page);
  const result = {
    name: 'quest-ua-webxr-mock',
    ok: false,
    screenshot: join(OUT, 'quest-ua-webxr-mock.png'),
  };

  try {
    await page.addInitScript(() => {
      class FakeXRSession extends EventTarget {
        mode = 'immersive-vr';
        visibilityState = 'visible';
        enabledFeatures = ['local-floor'];
        inputSources = [];
        async requestReferenceSpace() {
          return {
            getOffsetReferenceSpace() {
              return this;
            },
          };
        }
        updateRenderState() {}
        async end() {
          this.dispatchEvent(new Event('end'));
        }
        requestAnimationFrame(cb) {
          return window.requestAnimationFrame((t) => cb(t, { getViewerPose: () => null }));
        }
        cancelAnimationFrame(id) {
          window.cancelAnimationFrame(id);
        }
      }

      const fakeXr = {
        async isSessionSupported(mode) {
          return mode === 'immersive-vr';
        },
        async requestSession(mode) {
          if (mode !== 'immersive-vr') throw new Error('unsupported');
          return new FakeXRSession();
        },
      };
      Object.defineProperty(navigator, 'xr', {
        configurable: true,
        get() {
          return fakeXr;
        },
      });
    });

    await page.goto(WEBXR, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await clickStart(page);
    await waitForMeadowReady(page);

    // On Quest UA + webxr=1, ENTER VR should appear once supported probe resolves.
    const enter = page.locator('[data-meadow-enter-vr] button');
    await enter.waitFor({ state: 'visible', timeout: 30000 });
    result.enterVrVisible = true;

    await enter.click();
    await page.waitForTimeout(2500);

    result.runtime = await page.evaluate(() => ({
      vrLog: (window.__meadowVrLog ?? []).map((e) => e.event),
      lastError: document.querySelector('[data-meadow-enter-vr]')?.textContent ?? '',
    }));

    await page.screenshot({ path: result.screenshot, fullPage: false });

    // Mock cannot fully bind WebGL/WebGPU XR layers — accept either session_acquired
    // progress or a sanitized error (not a raw JS exception / crash).
    const log = result.runtime.vrLog ?? [];
    const progressed =
      log.includes('request_session_start') ||
      log.includes('session_acquired') ||
      log.includes('set_session_ok') ||
      log.includes('set_session_failed') ||
      // UI surfaced a session attempt error (fake XR cannot bind a real layer).
      /Update Meta Quest Browser|meadow is still loading|could not start|try again/i.test(
        result.runtime.lastError || '',
      );
    const crashed = errors.some((e) => /is not a function|Cannot read/i.test(e));
    result.criticalErrors = errors.filter((e) => /is not a function|Cannot read|TypeError/i.test(e));
    // ENTER VR visible on Quest UA proves probe + gate; session bind needs a real headset.
    result.ok = result.enterVrVisible && progressed && !crashed;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    try {
      await page.screenshot({ path: result.screenshot, fullPage: false });
    } catch {
      /* ignore */
    }
  } finally {
    await context.close();
  }

  return result;
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
});

const results = [];
results.push(await runScenario(browser, 'flat-prod', FLAT));
results.push(await runScenario(browser, 'webxr-flat-preview', WEBXR));
results.push(await runXrSessionMock(browser));

await browser.close();

const summary = {
  deployedCheck: 'booster.storytailor.com',
  timestamp: new Date().toISOString(),
  results,
  allAutomatedGreen: results.every((r) => r.ok),
};

writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.allAutomatedGreen ? 0 : 1);
