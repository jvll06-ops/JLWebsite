// Builds the finished site into dist/.
//
//   npm run build
//
// astro build -> make URLs relative -> print resume.pdf (exactly one page, or
// the build stops) and og.jpg (the link-preview picture) with headless
// Chromium -> drop image originals nothing uses.
//
// Each time the resume is printed from new words, photos or design, a copy of
// resume.pdf and og.jpg is saved in public/ (and its type size in
// scripts/last-render.json). Commit those files: where Chromium can't run (on
// Vercel's build machines), the build uses the saved copies instead.
// Flag: --fresh  fail instead of using the saved copies.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { relativizeSite } from './lib/relativize.mjs';
import { renderSite } from './lib/render.mjs';
import { pruneUnreferenced } from './lib/prune.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');
const SAVED = path.join(ROOT, 'scripts/last-render.json');
const fresh = process.argv.includes('--fresh');

const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/profile.json'), 'utf8'));
const siteUrl = String(profile.site?.url ?? `https://${profile.slug}.vercel.app`).replace(/\/+$/, '');
const t0 = Date.now();

/** A fingerprint of everything the resume and the preview picture are made from (all of src/). */
function inputsHash() {
  const hash = crypto.createHash('sha256');
  const walk = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
  for (const file of walk(path.join(ROOT, 'src'))) {
    let bytes = fs.readFileSync(file);
    // Same fingerprint on Windows and Mac/Linux: text line endings don't count.
    if (/\.(json|astro|ts|css|mjs|js|svg)$/.test(file)) bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    hash.update(path.relative(ROOT, file).split(path.sep).join('/')).update('\0').update(bytes).update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

function astroBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/astro/bin/astro.mjs'), 'build'], {
      cwd: ROOT,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
      stdio: 'inherit',
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`astro build failed (exit ${code})`))));
  });
}

/** The copies saved in public/ by the last build that printed the resume, or undefined. */
function savedRender() {
  const ok = fs.existsSync(SAVED) && ['resume.pdf', 'og.jpg'].every((f) => fs.existsSync(path.join(PUBLIC, f)));
  return ok ? JSON.parse(fs.readFileSync(SAVED, 'utf8')) : undefined;
}

/** Bake the resume's type size into /resume/ so the screen and browser printing match the PDF. */
function bakeFit({ fit, air }) {
  const file = path.join(DIST, 'resume/index.html');
  const html = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, html.replace('</head>', `<style>:root{--fit:${fit};--air:${air}}</style></head>`));
}

async function launchChromium() {
  try {
    return await chromium.launch();
  } catch (e) {
    if (fresh) throw e;
    return undefined;
  }
}

await astroBuild();
relativizeSite(DIST);

const inputs = inputsHash();
const browser = await launchChromium();
if (browser) {
  let result;
  try {
    result = await renderSite(browser, DIST, profile, siteUrl);
  } finally {
    await browser.close();
  }
  console.log(`✓ resume.pdf printed on one page (body type ${(result.fit * 10).toFixed(1)}pt) and og.jpg made`);
  const saved = savedRender();
  if (saved?.inputs !== inputs) {
    fs.mkdirSync(PUBLIC, { recursive: true });
    fs.copyFileSync(path.join(DIST, 'resume.pdf'), path.join(PUBLIC, 'resume.pdf'));
    fs.copyFileSync(path.join(DIST, 'og.jpg'), path.join(PUBLIC, 'og.jpg'));
    fs.writeFileSync(SAVED, JSON.stringify({ fit: result.fit, air: result.air, inputs }, null, 2) + '\n');
    console.log('✓ saved a copy in public/resume.pdf and public/og.jpg: commit them so your live site gets them too');
  }
} else {
  // No Chromium here (Vercel's build machines): use the copies saved in public/,
  // which Astro has already copied into dist/.
  const saved = savedRender();
  if (!saved) {
    console.error('✗ Chromium is not available to print the resume, and there is no saved copy in public/.');
    console.error('  Run "npm run build" on your own computer once, then commit public/ and scripts/last-render.json.');
    process.exit(1);
  }
  bakeFit(saved);
  fs.rmSync(path.join(DIST, 'og'), { recursive: true, force: true });
  console.log('• Chromium is not available here: using the saved public/resume.pdf and public/og.jpg');
  if (saved.inputs !== inputs) {
    console.warn('! The saved resume.pdf is older than your latest changes. Run "npm run build" on your computer');
    console.warn('  and commit public/resume.pdf, public/og.jpg and scripts/last-render.json to update it.');
  }
}

const pruned = pruneUnreferenced(DIST);
console.log(`✓ built dist/ for ${profile.name.full} (${pruned} unused image originals removed) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
