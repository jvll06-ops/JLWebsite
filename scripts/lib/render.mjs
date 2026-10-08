// Post-build rendering with headless Chromium:
//   /resume/ -> resume.pdf  (US Letter, real text, embedded fonts, the header photo, exactly 1 page)
//   /og/     -> og.jpg      (1200x630 link-preview card; the /og/ page is then removed)
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { serve } from './serve.mjs';

/**
 * Resume fit path, loosest first. --fit scales the type (1 = 10pt body), --air
 * scales every gap and the page margins (src/styles/resume.css). The renderer
 * searches along the straight lines between these points for the loosest
 * setting whose natural height still fits one page, so every resume fills its
 * page: a short one gets a little more type and air, a long one gives up air
 * before type. Below 0.95 (9.5pt body) the build warns; past the last point
 * (85%) it fails rather than cut anything.
 */
export const FIT_STEPS = [
  { fit: 1.05, air: 1.35 },
  { fit: 1, air: 1 },
  { fit: 0.95, air: 0.62 },
  { fit: 0.85, air: 0.45 },
];
/** Smallest comfortable body size (fit x 10pt); smaller still fits but warns. */
export const FIT_WARN_BELOW = 0.95;

/** US Letter in CSS px (96/in), and how close to its bottom the content may come. */
const PAGE = { width: 816, height: 1056 };
const PAGE_SLACK = 3;

/** The (fit, air) pair at position t along FIT_STEPS (0 = loosest, length - 1 = tightest). */
export function fitAt(t) {
  const i = Math.min(Math.floor(t), FIT_STEPS.length - 2);
  const k = t - i;
  const a = FIT_STEPS[i];
  const b = FIT_STEPS[i + 1];
  const round = (v) => Math.round(v * 1000) / 1000;
  return { fit: round(a.fit + (b.fit - a.fit) * k), air: round(a.air + (b.air - a.air) * k) };
}

export async function pdfPageCount(bytes) {
  return (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
}

async function stampMetadata(bytes, profile, siteUrl) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const name = profile.name.full;
  doc.setTitle(`${name}, Resume`, { showInWindowTitleBar: true });
  doc.setAuthor(name);
  doc.setSubject(`Resume of ${name}. ${siteUrl}/`);
  doc.setKeywords(['resume', name, ...(profile.events ?? [])]);
  doc.setCreator(`${siteUrl}/resume/`);
  doc.setLanguage('en-US');
  return doc.save();
}

const waitForAssets = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    );
  });

/** Load every font face the print layout can use, so the PDF embeds the real fonts, never a fallback. */
const waitForPrintFonts = (page) =>
  page.evaluate(async () => {
    // The static faces: "Archivo Print", "Archivo Print Condensed" and "Newsreader" (not "Archivo Variable").
    const print = [...document.fonts].filter((f) => !/variable/i.test(f.family));
    await Promise.all(print.map((f) => f.load().catch(() => {})));
    await document.fonts.ready;
  });

/** Apply one (fit, air) point and return the sheet's natural height (page stretch off) in CSS px. */
const measureStep = (page, step) =>
  page.evaluate(({ fit, air }) => {
    const root = document.documentElement;
    root.style.setProperty('--fit', String(fit));
    root.style.setProperty('--air', String(air));
    root.setAttribute('data-rs-measure', '');
    const sheet = document.querySelector('.rs-sheet') ?? document.body;
    const height = sheet.getBoundingClientRect().height;
    root.removeAttribute('data-rs-measure');
    return height;
  }, step);

/**
 * Print /resume/ to a one-page PDF: find the loosest point on FIT_STEPS whose
 * natural height fits (binary search, measured in print layout), then confirm
 * the page count on the real PDF, nudging tighter if Chrome disagrees.
 * Returns { pdf, fit, air, fill } or throws if even the tightest point overflows.
 */
export async function printResume(context, url, slug) {
  const page = await context.newPage();
  try {
    await page.setViewportSize(PAGE);
    await page.emulateMedia({ media: 'print' });
    await page.goto(url, { waitUntil: 'networkidle' });
    await waitForPrintFonts(page);
    // The header photo must be decoded before the page is printed.
    await waitForAssets(page);
    const limit = PAGE.height - PAGE_SLACK;
    const tightest = FIT_STEPS.length - 1;
    const fits = async (t) => (await measureStep(page, fitAt(t))) <= limit;

    let t = 0;
    if (!(await fits(0))) {
      if (!(await fits(tightest))) {
        const over = Math.round((await measureStep(page, fitAt(tightest))) - PAGE.height);
        throw new Error(
          `${slug}: resume does not fit one page even at ${Math.round(fitAt(tightest).fit * 100)}% type ` +
            `(${over}px too tall). Shorten the resume in src/content/profile.json.`,
        );
      }
      let lo = 0; // overflows
      let hi = tightest; // fits
      while (hi - lo > 0.01) {
        const mid = (lo + hi) / 2;
        if (await fits(mid)) hi = mid;
        else lo = mid;
      }
      t = hi;
    }

    for (; t <= tightest; t = Math.min(tightest, t + 0.05)) {
      const step = fitAt(t);
      const height = await measureStep(page, step);
      const pdf = await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true, tagged: true });
      const pages = await pdfPageCount(pdf);
      if (pages === 1) return { pdf, ...step, fill: height / PAGE.height };
      if (t === tightest) throw new Error(`${slug}: resume prints ${pages} pages even at its tightest. Shorten the resume in src/content/profile.json.`);
    }
    throw new Error(`${slug}: resume fit search ended without a one-page PDF.`);
  } finally {
    await page.close();
  }
}

/**
 * Render resume.pdf and og.jpg into the built site in `dir`.
 * Returns { fit, air, fill, pages }. Throws if the resume can't fit on one page.
 */
export async function renderSite(browser, dir, profile, siteUrl) {
  const server = await serve(dir);
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  try {
    // Resume PDF: the loosest ladder step that fills exactly one Letter page.
    const { pdf, fit, air, fill } = await printResume(context, server.url + 'resume/', profile.slug);
    if (fit < FIT_WARN_BELOW) {
      console.warn(
        `  ! ${profile.slug}: resume needed ${Math.round(fit * 100)}% type (${(fit * 10).toFixed(1)}pt body) to fit one page; consider trimming it.`,
      );
    }
    fs.writeFileSync(path.join(dir, 'resume.pdf'), await stampMetadata(pdf, profile, siteUrl));
    // Bake the same step into the HTML so the screen sheet and browser printing match the PDF.
    const file = path.join(dir, 'resume/index.html');
    const html = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, html.replace('</head>', `<style>:root{--fit:${fit};--air:${air}}</style></head>`));

    const page = await context.newPage();

    // Link-preview card.
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.goto(server.url + 'og/', { waitUntil: 'networkidle' });
    await waitForAssets(page);
    await page.screenshot({
      path: path.join(dir, 'og.jpg'),
      type: 'jpeg',
      quality: 88,
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
    fs.rmSync(path.join(dir, 'og'), { recursive: true, force: true });

    return { fit, air, fill, pages: 1 };
  } finally {
    await context.close();
    await server.close();
  }
}
