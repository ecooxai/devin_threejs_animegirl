// Export the character as GLB via the studio page. Writes binary to file only —
// never prints base64 to stdout.
import {chromium} from 'playwright';
import {writeFileSync, mkdirSync} from 'fs';

const OUT = 'output/devin_threejs_animegirl.glb';
mkdirSync('output', {recursive: true});

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({viewport: {width: 1024, height: 1200}});
page.on('console', m => console.log('CONSOLE:', m.text()));
await page.goto('http://127.0.0.1:8123/studio/?still&view=threequarter');
await page.waitForFunction('window.__ready === true', {timeout: 30000});
const b64 = await page.evaluate('window.__studio.exportGLB()');
const buf = Buffer.from(b64, 'base64');
writeFileSync(OUT, buf);
console.log(`wrote ${OUT} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
await browser.close();
