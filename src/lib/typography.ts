// Typesetting for the words people read: curly quotes and apostrophes, and an
// en dash in year ranges (2023-24 -> 2023–24), so data typed on a keyboard
// reads like set type. Pure functions, no Astro imports.
import type { Athlete } from './schema.ts';

// WORD JOINER: no line may break here (a range never splits as "2026–" / "27").
const GLUE = '⁠';

/** Year ranges get a closed-up en dash: 2022-2025 and 2022 – 2025 -> 2022–2025, 2025-26 -> 2025–26, 2025-present -> 2025–present. */
export function dashes(text: string): string;
export function dashes(text: string | undefined): string | undefined;
export function dashes(text: string | undefined): string | undefined {
  return text?.replace(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2}|\d{2}\b|present\b|expected\b)/gi, '$1–$2');
}

/** "it's" -> “it’s”: straight quotes to curly ones, by what stands before them. */
export function quotes(text: string): string {
  return (
    text
      // An opening double quote starts the text or follows a space, an opening bracket or a dash.
      .replace(/(^|[\s([{–—-])"/g, '$1“')
      .replace(/"/g, '”')
      // '24 is an apostrophe; a single quote before a word, after a space, opens a quotation.
      .replace(/(^|[\s([{–—“-])'(?=\d)/g, '$1’')
      .replace(/(^|[\s([{–—“-])'(?=\S)/g, '$1‘')
      .replace(/'/g, '’')
  );
}

/** Quotes and dashes, for prose. `glue` also keeps a year range on one line (screen text only). */
export function typeset(text: string, glue?: boolean): string;
export function typeset(text: string | undefined, glue?: boolean): string | undefined;
export function typeset(text: string | undefined, glue = false): string | undefined {
  if (text === undefined) return undefined;
  const set = quotes(dashes(text));
  return glue ? set.replace(/(\d)–(?=\d)/g, `$1–${GLUE}`) : set;
}

/**
 * A short line set in a narrow box (a stat's label, a card's title): typeset, year ranges kept whole,
 * and a hyphenated word kept whole too, so a label never breaks as "all-" / "time".
 */
export function label(text: string): string;
export function label(text: string | undefined): string | undefined;
export function label(text: string | undefined): string | undefined {
  return typeset(text, true)?.replace(/(\p{L})-(?=\p{L})/gu, `$1-${GLUE}`);
}

/**
 * The person's data, typeset. Left as written: names, the contact block, URLs,
 * dates (they are parsed), image file names and alt text, and the SEO text.
 * The home page's prose also keeps its year ranges whole; the resume does not
 * get the invisible joiner, so the PDF's text stays plain.
 */
export function typesetAthlete(a: Athlete): Athlete {
  const home = (s: string | undefined) => typeset(s, true);
  const entry = <T extends { role: string; org?: string; location?: string; dates?: string; bullets: string[] }>(e: T): T => ({
    ...e,
    role: typeset(e.role),
    org: typeset(e.org),
    dates: typeset(e.dates),
    bullets: e.bullets.map((b) => typeset(b)),
  });
  return {
    ...a,
    tagline: label(a.tagline),
    bio: a.bio && { ...a.bio, long: a.bio.long.map((p) => typeset(p, true)) },
    stats: a.stats.map((s) => ({ ...s, label: label(s.label), note: label(s.note) })),
    prs: a.prs.map((p) => ({ ...p, event: label(p.event), meet: home(p.meet) })),
    timeline: a.timeline.map((t) => ({ ...t, title: label(t.title), detail: home(t.detail) })),
    honors: a.honors.map((h) => ({ ...h, title: label(h.title), year: home(h.year) })),
    inTheirWords: a.inTheirWords.map((q) => ({ ...q, quote: typeset(q.quote, true), source: home(q.source) })),
    press: a.press.map((p) => ({ ...p, title: label(p.title), outlet: home(p.outlet) })),
    strengths: a.strengths.map((s) => ({ ...s, title: label(s.title), detail: label(s.detail) })),
    hamzaQuote: a.hamzaQuote && { ...a.hamzaQuote, text: typeset(a.hamzaQuote.text) },
    resume: a.resume && {
      ...a.resume,
      summary: typeset(a.resume.summary),
      experience: a.resume.experience.map(entry),
      athletics: a.resume.athletics.map(entry),
      leadership: a.resume.leadership.map(entry),
      education: a.resume.education.map((e) => ({
        ...e,
        school: typeset(e.school),
        degree: typeset(e.degree),
        dates: typeset(e.dates),
        details: e.details.map((d) => typeset(d)),
      })),
      honors: a.resume.honors.map((h) => ({ ...h, title: typeset(h.title), year: typeset(h.year) })),
    },
  };
}
