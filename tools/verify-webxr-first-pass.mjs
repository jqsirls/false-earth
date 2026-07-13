// Meadow + WebXR smoke (real Chrome — grass shaders need it).
// Prod bundle check: WebXR UI lives in the lazy App-*.js chunk, not index-*.js.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const PROD = 'https://booster.storytailor.com';
const OUT = 'output/webxr-first-pass';
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

async function verifyProdWebXrBundles() {
  const htmlRes = await fetch(PROD);
  if (!htmlRes.ok) {
    check('prod: fetch HTML', false, `HTTP ${htmlRes.status}`);
    return;
  }
  check('prod: fetch HTML', true);

  const html = await htmlRes.text();
  const indexFromHtml = html.match(/\/assets\/(index-[^"']+\.js)/);
  check('prod: index bundle referenced in HTML', !!indexFromHtml, indexFromHtml?.[1]);
  if (!indexFromHtml) return;

  const indexUrl = `${PROD}/assets/${indexFromHtml[1]}`;
  const indexRes = await fetch(indexUrl);
  if (!indexRes.ok) {
    check('prod: fetch index bundle', false, `HTTP ${indexRes.status}`);
    return;
  }
  const indexJs = await indexRes.text();
  check('prod: fetch index bundle', true, indexFromHtml[1]);

  const appImport = indexJs.match(/import\("\.\/(App-[^"]+\.js)"\)/);
  const appFile = appImport?.[1];
  check('prod: App chunk name from dynamic import', !!appFile, appFile ?? 'no import("./App-….js")');
  if (!appFile) return;

  const appUrl = `${PROD}/assets/${appFile}`;
  const appRes = await fetch(appUrl);
  if (!appRes.ok) {
    check('prod: fetch App chunk', false, `HTTP ${appRes.status}`);
    return;
  }
  const appJs = await appRes.text();
  check('prod: fetch App chunk', true, appFile);

  const hasEnterVr = appJs.includes('ENTER VR');
  const hasImmersiveVr = appJs.includes('immersive-vr');
  check('prod App chunk: ENTER VR shipped', hasEnterVr);
  check('prod App chunk: immersive-vr session probe', hasImmersiveVr);

  if (!indexJs.includes('ENTER VR') && hasEnterVr) {
    check(
      'prod: WebXR not falsely expected in index bundle',
      true,
      'ENTER VR only in lazy App chunk (expected)',
    );
  }
}

async function waitForStart(page) {
  await page.getByText('[ START ]').waitFor({ state: 'visible', timeout: 120_000 });
}

async function clickStart(page) {
  await page.getByText('[ START ]').click();
  await page.waitForTimeout(2_500);
}

async function grassShaderOk(page) {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')];
    const main = canvases
      .map((c) => ({ c, area: c.width * c.height }))
      .sort((a, b) => b.area - a.area)[0]?.c;
    if (!main) return { ok: false, reason: 'no canvas' };
    const gl = main.getContext('webgpu');
    if (!gl) return { ok: false, reason: 'no webgpu context' };
    const w = main.width;
    const h = main.height;
    if (w < 400 || h < 300) return { ok: false, reason: `main canvas too small ${w}x${h}` };
    return { ok: true, w, h };
  });
}

async function xrProbe(page) {
  return page.evaluate(async () => {
    const hasXr = typeof navigator.xr !== 'undefined';
    let immersiveVr = false;
    if (hasXr) {
      try {
        immersiveVr = await navigator.xr.isSessionSupported('immersive-vr');
      } catch {
        immersiveVr = false;
      }
    }
    return { hasXr, immersiveVr };
  });
}

async function runFlatSmoke(browser, label, url) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitForStart(page);
  check(`${label}: START gate visible`, true);

  const gpuErr = await page.getByText(/GPU|WebGPU/i).isVisible().catch(() => false);
  check(`${label}: no GPU error banner at gate`, !gpuErr, gpuErr ? 'GPU error visible' : undefined);

  await clickStart(page);
  await page.screenshot({ path: `${OUT}/${label}-after-start.png`, fullPage: false });

  const grass = await grassShaderOk(page);
  check(`${label}: WebGPU canvas alive after START`, grass.ok, grass.reason ?? `${grass.w}x${grass.h}`);

  const enterVr = await page.getByText('ENTER VR').isVisible().catch(() => false);
  const exitVr = await page.getByText('EXIT').isVisible().catch(() => false);
  check(`${label}: no VR session active`, !exitVr);

  const xr = await xrProbe(page);
  const expectEnterHidden = !xr.immersiveVr;
  if (url.includes('webxr=1')) {
    check(
      `${label}: ENTER VR ${expectEnterHidden ? 'hidden' : 'visible'} (immersive-vr=${xr.immersiveVr})`,
      expectEnterHidden ? !enterVr : enterVr,
      `hasXr=${xr.hasXr}`,
    );
  } else {
    check(`${label}: ENTER VR hidden without spike flag`, !enterVr);
  }

  await page.waitForTimeout(3_000);
  const breaking = errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource') &&
      !e.includes('net::ERR_'),
  );
  check(
    `${label}: no console-breaking errors`,
    breaking.length === 0,
    breaking.slice(0, 3).join(' | ') || 'clean',
  );

  await ctx.close();
}

await verifyProdWebXrBundles();

const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  await runFlatSmoke(browser, 'flat-prod', PROD);
  await runFlatSmoke(browser, 'webxr-flat', `${PROD}?webxr=1`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, failed: failed.length }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
