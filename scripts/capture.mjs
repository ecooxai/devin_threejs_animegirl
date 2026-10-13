import {chromium} from 'playwright';
import fs from 'node:fs/promises';

const iter = process.argv[2] || 'iter01';
const base = process.env.STUDIO_URL || 'http://127.0.0.1:8123/studio/';
const views = process.argv[3] ? process.argv[3].split(',')
  : ['front', 'threequarter', 'side', 'back', 'closeup'];
const outDir = 'output/iterations';
await fs.mkdir(outDir, {recursive: true});

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({viewport: {width: 1200, height: 1400}});
page.on('pageerror', e => console.error('BROWSER ERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });

const files = [];
for (const v of views) {
  await page.goto(`${base}?still&shot=${v}`);
  await page.waitForFunction(() => window.__ready, {timeout: 60000});
  await page.waitForTimeout(500);
  const p = `${outDir}/${iter}-${v}.png`;
  await page.screenshot({path: p});
  files.push(p);
}
// update manifest for progress page
let manifest = [];
try { manifest = JSON.parse(await fs.readFile('output/iterations/manifest.json', 'utf8')); } catch {}
manifest = manifest.filter(m => m.iter !== iter);
manifest.push({iter, time: new Date().toISOString(), files});
await fs.writeFile('output/iterations/manifest.json', JSON.stringify(manifest, null, 2));
console.log('captured', iter, files.length, 'views');
await browser.close();
