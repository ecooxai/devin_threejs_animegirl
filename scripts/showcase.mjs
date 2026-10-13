// Showcase renders: all named views with the credit bar.
import {chromium} from 'playwright';
import {mkdirSync} from 'fs';

const views = (process.argv[2] || 'front,threequarter,side,back,closeup,full').split(',');
mkdirSync('output/showcase', {recursive: true});

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({viewport: {width: 1200, height: 1400}});
for (const v of views) {
  await page.goto(`http://127.0.0.1:8123/studio/?still&credit&view=${v}`);
  await page.waitForFunction('window.__ready === true', {timeout: 30000});
  await page.waitForTimeout(350);
  await page.screenshot({path: `output/showcase/devin_threejs_animegirl_${v}.png`});
  console.log(`showcase ${v}`);
}
await browser.close();
