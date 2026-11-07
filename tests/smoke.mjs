// Browser smoke test: every tab and every game mode on an iPhone and both iPad orientations, failing on
// page errors and horizontal overflow. Needs Playwright with Chromium:
//   npm i --no-save playwright && npx playwright install chromium   (CI does this)
//   node tests/smoke.mjs
// Serves the repository itself on a free port, so no other server is needed.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright'));
}

const root = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  if (!path || path === '.' || path.startsWith('..')) path = 'index.html';
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const VIEWPORTS = [
  { name: 'iPhone', viewport: { width: 440, height: 956 }, isMobile: true, hasTouch: true },
  { name: 'iPad', viewport: { width: 820, height: 1180 } },
  { name: 'iPad landscape', viewport: { width: 1180, height: 820 } },
];
const PAGES = ['#/', '#/progress', '#/progress/ja', '#/help', '#/settings', '#/changelog', '#/words/ja/food', '#/words/ja/saved'];
const MODES = ['mix', 'flash', 'quiz', 'reverse', 'listen', 'type', 'dictate', 'match', 'memory', 'survival', 'timed'];
const SETTINGS = { lang: 'ja', sets: { ja: ['food'] }, introNew: false, autoSpeak: false, sound: false, seenTips: ['flash', 'type', 'dictate', 'match'] };

const failures = [];
const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ ...vp, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => failures.push(`${vp.name}: ${e.message}`));
  await page.addInitScript((s) => {
    if (!localStorage.getItem('evocab.settings.v1')) localStorage.setItem('evocab.settings.v1', JSON.stringify(s));
    // headless Chromium has no voices: make speech a no-op so listen/dictate work the same everywhere
    if (window.speechSynthesis) window.speechSynthesis.speak = () => {};
  }, SETTINGS);
  const overflow = async (where) => {
    const px = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (px > 1) failures.push(`${vp.name} ${where}: page is ${px}px wider than the screen`);
  };

  for (const hash of PAGES) {
    await page.goto(base + hash);
    await page.waitForSelector('.page-title', { timeout: 10000 }).catch(() => failures.push(`${vp.name} ${hash}: no page title`));
    await overflow(hash);
  }

  for (const theme of ['light', 'dark']) {
    for (const mode of MODES) {
      await page.goto(base + '#/');
      await page.evaluate(({ mode, theme }) => {
        const s = JSON.parse(localStorage.getItem('evocab.settings.v1'));
        localStorage.setItem('evocab.settings.v1', JSON.stringify({ ...s, mode, theme }));
      }, { mode, theme });
      await page.reload();
      await page.waitForSelector('.tab-start');
      await page.click('.tab-start');
      const where = `${theme} ${mode}`;
      try {
        await page.waitForSelector('body.in-game .game', { timeout: 10000 });
        // answer a few questions whatever the mode is
        for (let i = 0; i < 3; i++) {
          if (await page.locator('.option:not([disabled])').count()) await page.locator('.option').first().click();
          else if (await page.locator('.type-input').count()) {
            await page.fill('.type-input', 'x');
            await page.click('.type-form .btn.primary');
          } else if (await page.locator('.flashcard').count()) await page.locator('.round-btn.good').click();
          else if (await page.locator('.tile').count()) await page.locator('.tile').first().click();
          else if (await page.locator('.mem-card').count()) {
            await page.locator('.mem-card').nth(0).click();
            await page.locator('.mem-card').nth(1).click();
          }
          await page.waitForTimeout(250);
          const next = page.locator('.actions .btn.primary:not(.hidden), .type-form .btn.primary');
          if (await next.count()) await next.first().click().catch(() => {});
          await page.waitForTimeout(250);
        }
        await overflow(where);
        await page.click('.game-top .icon-btn');
        await page.waitForSelector('body:not(.in-game)', { timeout: 5000 });
      } catch (err) {
        failures.push(`${vp.name} ${where}: ${err.message.split('\n')[0]}`);
      }
    }
  }
  await ctx.close();
}
await browser.close();
server.close();

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`smoke test OK: ${PAGES.length} pages and ${MODES.length} modes × 2 themes on ${VIEWPORTS.length} screens`);
