// Checks src/content/profile.json before a build: every field in the right
// shape (src/lib/schema.ts), every photo it names is in src/assets/photos/,
// and no phone numbers anywhere (they are never published).
//   npm run check:data
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { athleteSchema, siteSchema, formatIssues } from '../src/lib/schema.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE = 'src/content/profile.json';
const SITE = 'src/content/site.json';
const PHOTOS = 'src/assets/photos';

const errors = [];
const warnings = [];

// US-style phone numbers with separators, or 10+ bare digits.
const PHONE = /(?:\+?\d{1,2}[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b|\b\d{10,}\b/;

function strings(value, at = []) {
  if (typeof value === 'string') return [[at.join('.'), value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, [...at, i]));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, [...at, k]));
  return [];
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  } catch (e) {
    errors.push(`  ${file}: not valid JSON (${e.message}). Look for a missing comma or quote near that spot.`);
    return undefined;
  }
}

const siteRaw = readJson(SITE);
if (siteRaw) {
  const result = siteSchema.safeParse(siteRaw);
  if (!result.success) errors.push(formatIssues(result.error, SITE));
}

const raw = readJson(PROFILE);
if (raw) {
  for (const [at, s] of strings(raw)) {
    if (at === '$schema') continue;
    if (PHONE.test(s)) errors.push(`  ${PROFILE}: ${at} looks like a phone number ("${s}"). Phone numbers are never published.`);
  }
  const result = athleteSchema.safeParse(raw);
  if (!result.success) {
    errors.push(formatIssues(result.error, PROFILE));
  } else {
    const a = result.data;
    const imgs = [a.images?.hero, a.images?.portrait, a.images?.og, a.images?.feature, ...(a.images?.action ?? [])].filter(Boolean);
    for (const img of imgs) {
      if (!fs.existsSync(path.join(ROOT, PHOTOS, img))) errors.push(`  ${PROFILE}: photo "${img}" is not in ${PHOTOS}/`);
    }
    const alts = a.images?.actionAlt ?? [];
    if (alts.length && alts.length !== (a.images?.action.length ?? 0)) {
      errors.push(`  ${PROFILE}: images.actionAlt has ${alts.length} descriptions for ${a.images?.action.length ?? 0} action photo(s); give one per photo`);
    }
    if (!a.site?.url) warnings.push(`  ${PROFILE}: no site.url, so links and the resume will say https://${a.slug}.vercel.app`);
    console.log(`Checked ${PROFILE} for ${a.name.full}: ${imgs.length} photo(s), ${a.noindex === false ? 'visible to' : 'hidden from'} search engines.`);
  }
}

if (warnings.length) console.warn(`Warnings:\n${warnings.join('\n')}`);
if (errors.length) {
  console.error(`\n✗ Data check failed:\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('✓ Data is valid.');
