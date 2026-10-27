import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const devDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(devDir, '..');
const srcRoot = path.join(repoRoot, 'src');
const master = path.join(devDir, 'zh-cn-ui.js');
const marker = '/zh-cn-ui.js';
let updated = 0;

for (const entry of fs.readdirSync(srcRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const appRoot = path.join(srcRoot, entry.name);
  const indexFile = path.join(appRoot, 'index.html');
  const packageFile = path.join(appRoot, 'package.json');
  if (!fs.existsSync(indexFile) || !fs.existsSync(packageFile)) continue;

  const publicDir = path.join(appRoot, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(master, path.join(publicDir, 'zh-cn-ui.js'));

  let html = fs.readFileSync(indexFile, 'utf8');
  if (!html.includes(marker)) {
    const tag = '  <script type="module" src="/zh-cn-ui.js"></script>\n';
    if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${tag}</body>`);
    else html = html.replace(/<\/html>/i, `${tag}</html>`);
    fs.writeFileSync(indexFile, html, 'utf8');
  }
  updated += 1;
}

console.log(`Updated ${updated} app entry pages.`);
