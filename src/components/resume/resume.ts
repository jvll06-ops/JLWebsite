// Shapes one person's data into the resume: the sections in their fixed
// order, the contact line and the download file name. Pure functions, no
// Astro imports.
import type { SiteData } from '../../lib/athlete.ts';
import type { Athlete } from '../../lib/schema.ts';
import { dashes } from '../../lib/typography.ts';

/** Year ranges with a closed-up en dash (lib/typography.ts); the resume page uses it too. */
export { dashes };

/** Every intern is in Austin; the contact line says so. */
export const RESUME_LOCATION = 'Austin, TX';

/** One block in a section: a bold title line with dates, a secondary line, then bullets or a details line. */
export interface ResumeItem {
  title: string;
  dates?: string;
  /** Organization, degree or location, shown under the title. */
  sub?: string;
  bullets: string[];
  /** Short facts run together on one line (education details). */
  details: string[];
}

export interface ResumeSection {
  id: string;
  title: string;
  items: ResumeItem[];
}

export interface ContactItem {
  text: string;
  href?: string;
}

/** The resume photo file: the top square of the hero photo. It prints about 1.1in wide, so this stays sharp even where the crop zooms in. */
export const RESUME_PHOTO_PX = 480;

/**
 * Where the square photo sits inside its round frame, as CSS values for the
 * <img> (--zoom, --left, --top; see .rs-photo in resume.css). `images.resumeCrop`
 * names the point at the center and the zoom; the frame never leaves the photo.
 */
export function photoFrame(a: Athlete): string {
  const { x = 0.5, y = 0.5, zoom = 1 } = a.images?.resumeCrop ?? {};
  // Offset of the zoomed photo so (x, y) lands on the center, held between "flush left/top" (0) and "flush right/bottom" (1 - zoom).
  const offset = (at: number) => Math.min(0, Math.max(1 - zoom, 0.5 - at * zoom));
  const pct = (v: number) => `${Math.round(v * 10000) / 100}%`;
  return `--zoom:${zoom};--left:${pct(offset(x))};--top:${pct(offset(y))}`;
}

/** `<First>-<Last>-Resume.pdf`, ASCII only (the home page buttons use it too, through fit.ts). */
export function resumeFileName(a: Athlete): string {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${clean(a.name.first)}-${clean(a.name.last)}-Resume.pdf`;
}

/** The person's production URL from the data file (`site.url`), when set. */
export function siteUrlOf(a: Athlete): string | undefined {
  return a.site?.url.replace(/\/+$/, '');
}

/** A dates line: en-dash ranges, and "Present" / "Expected" capitalized after the dash on every resume (2025–Present). */
export function dateRange(text: string | undefined): string | undefined {
  return dashes(text)?.replace(/–(present|expected)\b/g, (_, w: string) => `–${w[0].toUpperCase()}${w.slice(1)}`);
}

const joinSub = (...parts: (string | undefined)[]) => dashes(parts.filter(Boolean).join(' · ') || undefined);

/** Email · site URL · LinkedIn (if any) · Austin, TX. */
export function contactLine(data: SiteData): ContactItem[] {
  const { a } = data;
  const items: ContactItem[] = [];
  const email = a.contact?.email;
  if (email) items.push({ text: email, href: `mailto:${email}` });
  const url = siteUrlOf(a);
  if (url) items.push({ text: url.replace(/^https?:\/\/(www\.)?/, ''), href: `${url}/` });
  const linkedin = data.socials.find((s) => s.kind === 'linkedin');
  if (linkedin) {
    items.push({ text: linkedin.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), href: linkedin.url });
  }
  items.push({ text: RESUME_LOCATION });
  return items;
}

/** Experience, Education, Athletics, Leadership: in that order, empty ones dropped. */
export function resumeSections(data: SiteData): ResumeSection[] {
  const { a, site } = data;
  const r = a.resume;

  const entry = (e: { role: string; org?: string; location?: string; dates?: string; bullets: string[] }): ResumeItem => ({
    title: dashes(e.role),
    dates: dateRange(e.dates),
    sub: joinSub(e.org, e.location),
    bullets: e.bullets.map((b) => dashes(b)),
    details: [],
  });

  // Every person was a Feniex PM intern in 2026; the resume always says so.
  const experience = (r?.experience ?? []).map(entry);
  if (!(r?.experience ?? []).some((e) => /feniex/i.test(e.org ?? ''))) {
    experience.unshift(
      entry({ role: 'Project Manager Intern', org: site.feniex.name, location: RESUME_LOCATION, dates: '2026', bullets: [] }),
    );
  }

  const education: ResumeItem[] = r?.education.length
    ? r.education.map((e) => ({
        title: e.school,
        dates: dateRange(e.dates),
        sub: dashes(e.degree),
        bullets: [],
        details: e.details.map((d) => dashes(d)),
      }))
    : a.school?.name
      ? [
          {
            title: a.school.name,
            dates: dateRange(a.school.gradDate),
            sub: [a.school.major, a.school.minor && `Minor in ${a.school.minor}`].filter(Boolean).join('; ') || undefined,
            bullets: [],
            details: [],
          },
        ]
      : [];

  return [
    { id: 'experience', title: 'Experience', items: experience },
    { id: 'education', title: 'Education', items: education },
    { id: 'athletics', title: 'Athletics', items: (r?.athletics ?? []).map(entry) },
    { id: 'leadership', title: 'Leadership', items: (r?.leadership ?? []).map(entry) },
  ].filter((s) => s.items.length > 0);
}

export interface SkillRow {
  label: string;
  items: string[];
}

export function skillRows(a: Athlete): SkillRow[] {
  const s = a.resume?.skills;
  return [
    { label: 'Core', items: s?.core ?? [] },
    { label: 'Tools', items: s?.tools ?? [] },
    { label: 'Languages', items: s?.languages ?? [] },
  ].filter((row) => row.items.length > 0);
}

export function honorsOf(a: Athlete): { title: string; year?: string }[] {
  return (a.resume?.honors ?? []).map((h) => ({ title: dashes(h.title), year: dashes(h.year) }));
}

export interface Reference {
  quote?: string;
  name: string;
  /** Title and company, after the name. */
  role?: string;
}

/** Hamza is everyone's reference: his quote when written, otherwise his name and title. */
export function reference(data: SiteData): Reference {
  const { a, site } = data;
  const attribution = a.hamzaQuote?.attribution ?? `${site.hamza.name}, ${site.hamza.title}`;
  const comma = attribution.indexOf(',');
  return {
    quote: a.hamzaQuote?.text,
    name: comma > 0 ? attribution.slice(0, comma).trim() : attribution,
    role: comma > 0 ? attribution.slice(comma + 1).trim() : undefined,
  };
}
