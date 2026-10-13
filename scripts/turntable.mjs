// Turntable video: deterministic frames via __studio.renderSpin(angle),
// then ffmpeg → mp4. Credit bar rendered by ?credit.
import {chromium} from 'playwright';
import {mkdirSync, rmSync} from 'fs';
import {execSync} from 'child_process';

const FRAMES = 240;
const DIR = 'output/.turn_frames';
const OUT = 'output/devin_threejs_animegirl_turntable.mp4';
rmSync(DIR, {recursive: true, force: true});
mkdirSync(DIR, {recursive: true});

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({viewport: {width: 1280, height: 720}});
await page.goto('http://127.0.0.1:8123/studio/?still&credit&view=full');
await page.waitForFunction('window.__ready === true', {timeout: 30000});

for (let i = 0; i < FRAMES; i++) {
  const angle = (i / FRAMES) * Math.PI * 2;
  await page.evaluate(`window.__studio.renderSpin(${angle})`);
  await page.screenshot({path: `${DIR}/f${String(i).padStart(4, '0')}.png`});
  if (i % 60 === 0) console.log(`frame ${i}/${FRAMES}`);
}
await browser.close();

execSync(`ffmpeg -y -framerate 30 -i ${DIR}/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 19 -movflags +faststart ${OUT}`, {stdio: 'inherit'});
rmSync(DIR, {recursive: true, force: true});
console.log(`wrote ${OUT}`);
