// Small helpers for the Studio components: sizing the condensed display type
// to its box, splitting stat values, readable dates, credits and the defaults
// for optional fields.
import type { Athlete } from '../lib/schema.ts';

// Advance widths (em) of Archivo at font-stretch 65%, weight 900, measured in
// Chromium. Used to size names and numbers so they fill, but never overflow,
// their container: font-size = min(cap, 100cqi / widthEm(text)).
const ADVANCE: Record<string, number> = {
  A: 0.55, B: 0.52, C: 0.534, D: 0.53, E: 0.483, F: 0.423, G: 0.566, H: 0.538, I: 0.271, J: 0.47,
  K: 0.536, L: 0.451, M: 0.726, N: 0.543, O: 0.576, P: 0.504, Q: 0.576, R: 0.53, S: 0.489, T: 0.495,
  U: 0.529, V: 0.513, W: 0.75, X: 0.522, Y: 0.504, Z: 0.495,
  a: 0.461, b: 0.458, c: 0.44, d: 0.458, e: 0.447, f: 0.295, g: 0.435, h: 0.455, i: 0.235, j: 0.239,
  k: 0.478, l: 0.235, m: 0.677, n: 0.455, o: 0.451, p: 0.458, q: 0.458, r: 0.308, s: 0.417, t: 0.305,
  u: 0.455, v: 0.43, w: 0.662, x: 0.465, y: 0.424, z: 0.397,
  "'": 0.218, '’': 0.218, '-': 0.247, '–': 0.4, '.': 0.231, ',': 0.231, ':': 0.231, ' ': 0.116,
  '+': 0.538, '×': 0.538, '%': 0.762, '#': 0.512, '/': 0.28, '(': 0.389, ')': 0.389,
};
const DIGIT = 0.458; // tabular figures

/** Width of a string in em at the display setting (65% / 900). */
export function widthEm(text: string, { upper = true, tracking = -0.005 } = {}): number {
  const s = upper ? text.toUpperCase() : text;
  let w = 0;
  for (const ch of s) {
    const base = ch.normalize('NFD')[0] ?? ch;
    w += /\d/.test(ch) ? DIGIT : (ADVANCE[ch] ?? ADVANCE[base] ?? 0.55);
    w += tracking;
  }
  return Math.max(w, 0.5);
}

/**
 * How much wider than its box a photo has to be drawn to fill it (object-fit: cover): a 16:9 photo in a
 * square box is drawn 1.78 boxes wide. `sizes` must say that width, or the browser fetches a file sized
 * for the box and stretches it (the strengths photo was drawn at 2.4 times its pixels).
 */
export function coverScale(photo: { width: number; height: number }, boxRatio: number): number {
  return Math.max(1, photo.width / photo.height / boxRatio);
}

/** One `sizes` length: the box's width times the cover scale, rounded up ("66vw" x 1.5 -> "99vw"). */
export function coverSize(photo: { width: number; height: number }, boxWidth: number, unit: 'vw' | 'rem', boxRatio: number): string {
  return `${Math.ceil(boxWidth * coverScale(photo, boxRatio))}${unit}`;
}

/** A stat value split into a counting number and its prefix/suffix ("8.19" + "m"). */
export interface StatParts {
  prefix: string;
  number?: string;
  suffix: string;
  /** Count up from zero on scroll (plain numbers only; not years, times or words). */
  countable: boolean;
  decimals: number;
}

export function splitStat(value: string): StatParts {
  const m = value.match(/^([^\d]*?)(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return { prefix: value, suffix: '', countable: false, decimals: 0 };
  const [, prefix, number, suffix] = m;
  const isYear = /^(19|20)\d\d$/.test(number) && !prefix && !suffix;
  const isTime = /^[:.]\d/.test(suffix);
  // A race time ("2:08.50") is one figure, not a number and a unit.
  if (isTime) return { prefix, number: number + suffix, suffix: '', countable: false, decimals: 0 };
  return {
    prefix,
    number,
    suffix,
    countable: !isYear && !isTime && Number(number) > 0,
    decimals: number.includes('.') ? number.split('.')[1].length : 0,
  };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-06-09" -> "June 9, 2026"; "2026-06" -> "June 2026"; anything else as written. */
export function readableDate(value?: string): string | undefined {
  if (!value) return undefined;
  const full = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) return `${MONTHS[Number(full[2]) - 1]} ${Number(full[3])}, ${full[1]}`;
  const month = value.match(/^(\d{4})-(\d{2})$/);
  if (month) return `${MONTHS[Number(month[2]) - 1]} ${month[1]}`;
  return value;
}

/** "Hamza Deyaf, Founder & CEO, Feniex Industries" -> name + title. */
export function splitAttribution(attribution: string): { name: string; title?: string } {
  const i = attribution.indexOf(',');
  if (i < 0) return { name: attribution };
  return { name: attribution.slice(0, i).trim(), title: attribution.slice(i + 1).trim() };
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** A mark like "8.19m (26-10.5)" -> main "8.19m", aside "26-10.5". */
export function splitMark(mark: string): { main: string; aside?: string } {
  const m = mark.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { main: m[1], aside: m[2] } : { main: mark };
}

/** The person's own existing website, if they have one. */
export function websiteOf(a: Athlete): string | undefined {
  return a.contact?.website;
}

/** "Texas Track & Field · Long Jump" -> "Texas Track & Field". */
export function programOf(a: Athlete): string {
  return (a.headline ?? 'Texas Track & Field').split('·')[0].trim();
}

/** "Texas Track & Field · Long Jump · High Jump" -> "Long Jump · High Jump". */
export function disciplineOf(a: Athlete): string | undefined {
  const parts = (a.headline ?? '').split('·').map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(' · ') : a.events.length ? a.events.join(' · ') : undefined;
}

/** Photo credits without the portrait line (the AI portrait note covers that). */
export function actionCredits(a: Athlete): string[] {
  return a.photoCredits.filter((c) => !/^portraits?\b/i.test(c));
}

export const PORTRAIT_NOTE = 'AI-assisted portrait edit of an official Texas Athletics headshot.';

/** The line under an original (unedited) portrait: "Photo: Texas Athletics". */
export function portraitCredit(a: Athlete): string {
  const credit = a.photoCredits.find((c) => /^portraits?\b/i.test(c))?.replace(/^portraits?\s*:\s*/i, '');
  return `Photo: ${credit || 'Texas Athletics'}`;
}

/** Download name for the resume PDF: "James-Ledbetter-Resume.pdf" (one rule, shared with the resume page). */
export { resumeFileName } from './resume/resume.ts';
