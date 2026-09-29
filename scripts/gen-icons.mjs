/**
 * gen-icons.mjs — Gera os PNGs do PWA a partir dos SVGs usando o Chromium.
 *
 * Ferramenta de desenvolvimento (não é dependência do app). Rode com o
 * Playwright instalado localmente:
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright --no-save
 *   node scripts/gen-icons.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';

const jobs = [
  { svg: 'icons/icon.svg', out: 'icons/icon-192.png', size: 192 },
  { svg: 'icons/icon.svg', out: 'icons/icon-512.png', size: 512 },
  { svg: 'icons/icon-maskable.svg', out: 'icons/icon-maskable.png', size: 512 },
  // App Presença (/presenca)
  { svg: 'presenca/icons/icon.svg', out: 'presenca/icons/icon-192.png', size: 192 },
  { svg: 'presenca/icons/icon.svg', out: 'presenca/icons/icon-512.png', size: 512 },
  { svg: 'presenca/icons/icon-maskable.svg', out: 'presenca/icons/icon-maskable.png', size: 512 },
];

const browser = await chromium.launch({ executablePath: exe });
for (const job of jobs) {
  const svg = readFileSync(join(root, job.svg), 'utf8')
    .replace(/width="\d+"/, `width="${job.size}"`)
    .replace(/height="\d+"/, `height="${job.size}"`);
  const page = await browser.newPage({
    viewport: { width: job.size, height: job.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  const el = await page.$('svg');
  await el.screenshot({ path: join(root, job.out), omitBackground: true });
  await page.close();
  console.log('gerado:', job.out);
}
await browser.close();
