// Loads and validates src/content/profile.json, and derives everything the
// pages need (URLs, images, socials, SEO text).
import type { ImageMetadata } from 'astro';
import { athleteSchema, siteSchema, formatIssues, type Athlete, type SiteConfig } from './schema.ts';
import { typesetAthlete } from './typography.ts';
import siteJson from '../content/site.json';
import profileJson from '../content/profile.json';

// The photos in src/assets/photos/, by file name.
const athleteImages = Object.fromEntries(
  Object.entries(
    import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.{jpg,jpeg,png,webp,avif}', { eager: true }),
  ).map(([key, mod]) => [key.split('/').pop()!, mod]),
);
const placeholderImages = import.meta.glob<{ default: ImageMetadata }>('../assets/placeholders/*.jpg', {
  eager: true,
});

export interface Img {
  src: ImageMetadata;
  alt: string;
  placeholder: boolean;
}

/** The tall photo beside the strengths cards, and where to hold it when it is cropped. */
export interface Feature extends Img {
  /** CSS object-position, e.g. "50% 35%". */
  position: string;
}

export interface SocialLink {
  kind: 'linkedin' | 'instagram' | 'x' | 'tiktok';
  label: string;
  handle: string;
  url: string;
}

export interface SiteData {
  a: Athlete;
  site: SiteConfig;
  /** Public site URL, no trailing slash. */
  url: string;
  host: string;
  noindex: boolean;
  displayName: string;
  initials: string;
  title: string;
  description: string;
  /**
   * `action` is every action photo; `gallery` is the ones the gallery shows (all of them but the
   * strengths `feature`, when that is an action photo), so no photo appears twice on the page.
   */
  images: { hero: Img; portrait: Img; action: Img[]; gallery: Img[]; feature?: Feature; og: Img };
  /** True when the person has real photography (drives the "imagery enhanced" note). */
  hasPhotography: boolean;
  socials: SocialLink[];
  /** Email split so it never sits in the HTML as one readable string. */
  emailParts?: { user: string; domain: string };
}

export const site: SiteConfig = parseOrThrow(siteSchema, siteJson, 'src/content/site.json');

function parseOrThrow<T>(schema: { safeParse: (v: unknown) => any }, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`Invalid data:\n${formatIssues(result.error, label)}`);
  return result.data as T;
}

function readProfile(): Athlete {
  return parseOrThrow<Athlete>(athleteSchema, profileJson, 'src/content/profile.json');
}

function placeholder(name: 'hero' | 'portrait' | 'action'): Img {
  const mod = placeholderImages[`../assets/placeholders/${name}.jpg`];
  if (!mod) throw new Error(`Missing placeholder image src/assets/placeholders/${name}.jpg`);
  return { src: mod.default, alt: '', placeholder: true };
}

async function athleteImage(slug: string, file: string | undefined, alt: string): Promise<Img | undefined> {
  if (!file) return undefined;
  const mod = athleteImages[file];
  if (!mod) throw new Error(`Image "${file}" not found in src/assets/photos/ (${slug})`);
  return { src: mod.default, alt, placeholder: false };
}

const SOCIAL_BASES: Record<SocialLink['kind'], { label: string; url: (h: string) => string }> = {
  linkedin: { label: 'LinkedIn', url: (h) => `https://www.linkedin.com/in/${h}/` },
  instagram: { label: 'Instagram', url: (h) => `https://www.instagram.com/${h}/` },
  x: { label: 'X', url: (h) => `https://x.com/${h}` },
  tiktok: { label: 'TikTok', url: (h) => `https://www.tiktok.com/@${h}` },
};

export function socialLink(kind: SocialLink['kind'], value: string): SocialLink {
  const base = SOCIAL_BASES[kind];
  if (/^https?:\/\//i.test(value)) {
    const parts = new URL(value).pathname.split('/').filter(Boolean);
    const handle = (parts[parts.length - 1] ?? value).replace(/^@/, '');
    return { kind, label: base.label, handle, url: value };
  }
  const handle = value.replace(/^@/, '');
  return { kind, label: base.label, handle, url: base.url(handle) };
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

let cached: Promise<SiteData> | undefined;

/** Everything about the person this build is for. Cached per build. */
export function loadSite(): Promise<SiteData> {
  cached ??= build();
  return cached;
}

async function build(): Promise<SiteData> {
  // Curly quotes and en-dash year ranges everywhere the words are shown (lib/typography.ts).
  const a = typesetAthlete(readProfile());
  const url = String(import.meta.env.SITE ?? `https://${a.slug}.vercel.app`).replace(/\/+$/, '');
  const full = a.name.full;
  const images = a.images;

  const hero = (await athleteImage(a.slug, images?.hero, `${full}`)) ?? placeholder('hero');
  const portrait = (await athleteImage(a.slug, images?.portrait, images?.portraitAlt ?? `Portrait of ${full}`)) ?? placeholder('portrait');
  const action: Img[] = [];
  for (const [i, file] of (images?.action ?? []).entries()) {
    const img = await athleteImage(a.slug, file, images?.actionAlt[i] ?? `${full} competing`);
    if (img) action.push(img);
  }
  const og = (await athleteImage(a.slug, images?.og, `${full}`)) ?? hero;

  // The strengths photo: images.feature, else the most upright action photo when there are two or more
  // (the gallery keeps the rest), else the studio portrait in uniform (unless it is the hero itself).
  const files = images?.action ?? [];
  let featureFile = images?.feature;
  if (!featureFile && action.length >= 2) {
    const ratio = (img: Img) => img.src.width / img.src.height;
    const upright = action.reduce((best, img) => (ratio(img) <= ratio(best) ? img : best));
    featureFile = files[action.indexOf(upright)];
  }
  const actionIndex = featureFile ? files.indexOf(featureFile) : -1;
  let feature: Img | undefined;
  if (actionIndex >= 0) feature = action[actionIndex];
  else if (featureFile) feature = await athleteImage(a.slug, featureFile, `${full}`);
  else if (!portrait.placeholder && images?.portrait !== images?.hero) feature = portrait;
  const focus = images?.featureFocus ?? { x: 0.5, y: actionIndex >= 0 ? 0.4 : 0.2 };
  const gallery = actionIndex >= 0 ? action.filter((_, i) => i !== actionIndex) : action;

  const socials = (['linkedin', 'instagram', 'x', 'tiktok'] as const)
    .filter((k) => a.contact?.[k])
    .map((k) => socialLink(k, a.contact![k]!));

  const email = a.contact?.email;
  const [user, domain] = email ? email.split('@') : [];

  const role = a.headline ?? 'Texas Track & Field';
  const title = a.seo?.title ?? clip(`${full} | ${role}`, 70);
  const description =
    a.seo?.description ??
    clip(
      a.bio?.short ?? `${full}: ${role}. Project Manager Intern at ${site.feniex.name}, 2026. Portfolio and resume.`,
      160,
    );

  return {
    a,
    site,
    url,
    host: new URL(url).host,
    noindex: a.noindex ?? site.noindexDefault,
    displayName: a.name.preferred ?? a.name.first,
    initials: (a.name.first[0] + a.name.last[0]).toUpperCase(),
    title,
    description,
    images: {
      hero,
      portrait,
      action,
      gallery,
      feature: feature && {
        ...feature,
        alt: actionIndex >= 0 ? feature.alt : `${full} in uniform, studio portrait`,
        position: `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%`,
      },
      og,
    },
    hasPhotography: !hero.placeholder || !portrait.placeholder || action.length > 0,
    socials,
    emailParts: user && domain ? { user, domain } : undefined,
  };
}

/** Absolute URL on this person's site. */
export function abs(data: SiteData, path = '/'): string {
  return data.url + (path.startsWith('/') ? path : `/${path}`);
}
