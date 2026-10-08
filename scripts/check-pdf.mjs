// After a build: dist/resume.pdf is exactly one US Letter page with real,
// selectable text (embedded fonts with ToUnicode maps, no Type 3 outlines)
// and a title, and its text (read back the way an ATS reads it) has the
// person's name, their email, "Feniex Industries" and "Hamza Deyaf". When the
// build ships the static Archivo print faces, the PDF must embed Archivo (no
// silent fallback to Arial). The header photo is the one picture, stored as
// the JPEG it is, in a PDF of at most 400 KB. og.jpg is a
// 1200x630 JPEG.
//   npm run check:pdf   (after npm run build)
import fs from 'node:fs';
import path from 'node:path';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFStream } from 'pdf-lib';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { pageText, squash } from './lib/pdf-text.mjs';
import { FIT_WARN_BELOW } from './lib/render.mjs';

/** A resume is an email attachment: the photo must not make it heavy. */
const PDF_MAX_KB = 400;

const errors = [];
const rows = {};

function fontReport(doc, page) {
  const fonts = page.node.Resources()?.lookup(PDFName.of('Font'), PDFDict);
  if (!fonts) return { count: 0, names: [], problems: ['no fonts (is there any text?)'] };
  const problems = [];
  const names = [];
  let count = 0;
  for (const [key, ref] of fonts.entries()) {
    count++;
    const font = doc.context.lookup(ref, PDFDict);
    const subtype = font.get(PDFName.of('Subtype'))?.toString();
    const name = font.get(PDFName.of('BaseFont'))?.toString() ?? key.toString();
    names.push(name);
    if (subtype === '/Type3') problems.push(`${name} is Type 3 (text drawn as outlines)`);
    let desc = font.lookup(PDFName.of('FontDescriptor'));
    if (!desc) {
      const descendants = font.lookup(PDFName.of('DescendantFonts'), PDFArray);
      desc = descendants && doc.context.lookup(descendants.get(0), PDFDict).lookup(PDFName.of('FontDescriptor'));
    }
    const embedded = desc && ['FontFile', 'FontFile2', 'FontFile3'].some((n) => desc.get(PDFName.of(n)));
    if (subtype !== '/Type3' && !embedded) problems.push(`${name} is not embedded`);
    if (!font.get(PDFName.of('ToUnicode'))) problems.push(`${name} has no ToUnicode map (text not selectable)`);
  }
  return { count, names, problems };
}

/** How each picture in the PDF is stored (its /Filter): "/DCTDecode" is a JPEG kept as it is. */
function imageFilters(doc) {
  const filters = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFStream) || obj.dict.get(PDFName.of('Subtype'))?.toString() !== '/Image') continue;
    filters.push(obj.dict.get(PDFName.of('Filter'))?.toString() ?? 'none');
  }
  return filters;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const profile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/profile.json'), 'utf8'));

/** Strings the resume must contain, read back from the PDF text. */
function requiredText(d) {
  return [d.name?.full, d.contact?.email, 'Feniex Industries', 'Hamza Deyaf'].filter(Boolean);
}

/** True when this build ships the static Archivo print faces (so the PDF must use them). */
function shipsArchivoPrint(dir) {
  const assets = path.join(dir, '_astro');
  return fs.existsSync(assets) && fs.readdirSync(assets).some((f) => /archivo-print/i.test(f));
}

/** The --fit the build baked into resume/index.html (1 when absent). */
function bakedFit(dir) {
  const file = path.join(dir, 'resume/index.html');
  // The build's own <style>:root{--fit:…} block, not the phone reset in the inlined stylesheet.
  const m = fs.existsSync(file) && /<style>:root\{--fit:\s*([\d.]+)/.exec(fs.readFileSync(file, 'utf8'));
  return m ? Number(m[1]) : 1;
}

const warnings = [];
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('Nothing built yet. Run npm run build first.');
  process.exit(1);
}

const pdfFile = path.join(DIST, 'resume.pdf');
const ogFile = path.join(DIST, 'og.jpg');
const row = {};
if (!fs.existsSync(pdfFile)) {
  errors.push('resume.pdf missing');
} else {
  const doc = await PDFDocument.load(fs.readFileSync(pdfFile), { updateMetadata: false });
  const pages = doc.getPageCount();
  row.pages = pages;
  if (pages !== 1) errors.push(`resume.pdf has ${pages} pages (must be exactly 1)`);
  const { width, height } = doc.getPage(0).getSize();
  row.size = `${width}x${height}`;
  if (Math.round(width) !== 612 || Math.round(height) !== 792) errors.push(`resume.pdf is ${width}x${height}pt, not US Letter (612x792)`);
  const fonts = fontReport(doc, doc.getPage(0));
  row.fonts = fonts.count;
  for (const p of fonts.problems) errors.push(`resume.pdf ${p}`);
  if (shipsArchivoPrint(DIST) && !fonts.names.some((n) => /archivo/i.test(n))) {
    errors.push(`resume.pdf embeds ${fonts.names.join(', ')}, not the Archivo print faces (font fallback)`);
  }
  const text = pageText(doc, doc.getPage(0));
  const flat = squash(text);
  for (const needle of requiredText(profile)) {
    if (!flat.includes(squash(needle))) errors.push(`resume.pdf text is missing "${needle}"`);
  }
  row.words = text.split(/\s+/).filter((w) => /\w/.test(w)).length;
  const fit = bakedFit(DIST);
  row.body = `${(fit * 10).toFixed(2)}pt`;
  if (fit < FIT_WARN_BELOW) warnings.push(`resume body is ${row.body} (under ${FIT_WARN_BELOW * 10}pt to fit one page); consider trimming a bullet`);
  if (!doc.getTitle()) errors.push('resume.pdf has no title metadata');
  const photos = imageFilters(doc);
  row.photo = photos.length === 1 ? 'yes' : photos.length;
  if (profile.images?.hero) {
    if (photos.length !== 1) errors.push(`resume.pdf has ${photos.length} pictures (want 1: the header photo)`);
    else if (photos[0] !== '/DCTDecode') errors.push(`resume.pdf stores the photo as ${photos[0]}, not as a JPEG (the file gets heavy)`);
  }
  row.kb = Math.round(fs.statSync(pdfFile).size / 1024);
  if (row.kb > PDF_MAX_KB) errors.push(`resume.pdf is ${row.kb} KB (at most ${PDF_MAX_KB})`);
}
if (!fs.existsSync(ogFile)) {
  errors.push('og.jpg missing');
} else {
  const meta = await sharp(ogFile).metadata();
  row.og = `${meta.width}x${meta.height} ${meta.format}`;
  if (meta.width !== 1200 || meta.height !== 630 || meta.format !== 'jpeg') errors.push(`og.jpg is ${row.og}, expected 1200x630 jpeg`);
}
rows[profile.slug] = row;

console.table(rows);
if (warnings.length) console.warn(`\n! ${warnings.join('\n! ')}`);
if (errors.length) {
  console.error(`\n✗ PDF check failed:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ resume.pdf: 1 Letter page, real selectable text with your name, email, Feniex and Hamza, the photo as one JPEG, at most ${PDF_MAX_KB} KB; og.jpg 1200x630.`);
