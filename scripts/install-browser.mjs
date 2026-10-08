// Runs after npm install: downloads the small headless Chrome that prints
// resume.pdf and og.jpg. Skipped on Vercel, whose build uses the copies saved
// in public/. A failed download never fails the install; the build says what
// to do.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.VERCEL) {
  console.log('On Vercel: skipping the Chromium download (the build uses public/resume.pdf and public/og.jpg).');
  process.exit(0);
}
const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/playwright/cli.js');
const result = spawnSync(process.execPath, [cli, 'install', '--only-shell', 'chromium'], { stdio: 'inherit' });
if (result.status !== 0) {
  console.warn('! Could not download Chromium. To print the resume later, run: npx playwright install --only-shell chromium');
}
