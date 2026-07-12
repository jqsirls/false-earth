// One-shot production verification of the START-gate time-limit copy.
// Runs real Chrome (bundled Chromium WebGPU rejects the grass shaders).
import { chromium } from 'playwright';

const URL = 'https://booster.storytailor.com';
const OUT = 'output/timer-copy';
const results = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function shot(name) {
  await page.screenshot({ path: `${OUT}-${name}.png` });
}
function check(label, ok) {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) process.exitCode = 1;
}

await page.goto(URL, { waitUntil: 'domcontentloaded' });
const collapsed = page.locator('[data-meadow-timer-row] button');
await page.getByText('[ START ]').waitFor({ timeout: 180_000 });
await page.waitForTimeout(1000);

check('collapsed default = SET TIME LIMIT', (await collapsed.first().innerText()) === 'SET TIME LIMIT');
check('aria-label updated', (await collapsed.first().getAttribute('aria-label')) === 'Set a session time limit');
await shot('1-collapsed');

await collapsed.first().click();
await page.waitForTimeout(300);
const expanded = await page.locator('[data-meadow-timer-row] button').allInnerTexts();
check(`expanded row = NONE 15 30 1H 2H (got: ${expanded.join(' ')})`,
  JSON.stringify(expanded) === JSON.stringify(['NONE', '15', '30', '1H', '2H']));
await shot('2-expanded');

await page.locator('[data-meadow-timer-row] button', { hasText: /^30$/ }).click();
await page.waitForTimeout(300);
check('echo after 30 = TIME LIMIT 30 MIN', (await collapsed.first().innerText()) === 'TIME LIMIT 30 MIN');
await shot('3-echo-30min');

await collapsed.first().click();
await page.waitForTimeout(300);
await page.locator('[data-meadow-timer-row] button', { hasText: 'NONE' }).click();
await page.waitForTimeout(300);
check('NONE resets to SET TIME LIMIT', (await collapsed.first().innerText()) === 'SET TIME LIMIT');
await shot('4-none-reset');

// 1H echo sanity check
await collapsed.first().click();
await page.waitForTimeout(300);
await page.locator('[data-meadow-timer-row] button', { hasText: /^1H$/ }).click();
await page.waitForTimeout(300);
check('echo after 1H = TIME LIMIT 1H', (await collapsed.first().innerText()) === 'TIME LIMIT 1H');
await shot('5-echo-1h');

const bodyText = await page.locator('body').innerText();
check('no em dashes on splash', !bodyText.includes('\u2014'));

console.log(results.join('\n'));
await browser.close();
