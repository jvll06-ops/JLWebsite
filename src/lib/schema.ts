// The content contract for src/content/profile.json.
// Every object is strict, so a typo'd key fails validation instead of
// silently disappearing. There is deliberately no phone field anywhere:
// phone numbers are never published.
//
// Plain zod (no Astro imports) so Node scripts can use it directly
// (Node >= 22.18 runs .ts files natively).
import { z } from 'zod';

const text = z.string().trim().min(1);
/** Years and dates may be written as 2025 or "2025" or "Spring 2026". */
const when = z.union([z.string().trim().min(1), z.number()]).transform((v) => String(v));
/** A profile URL or a bare handle ("@name" or "name"). */
const social = text;

export const EVENT_GROUPS = ['sprints', 'hurdles', 'jumps', 'throws', 'distance', 'multis', 'other'] as const;
export const IMAGERY = ['ai', 'original'] as const;
export const DEFAULT_HAMZA_ATTRIBUTION = 'Hamza Deyaf, Founder & CEO, Feniex Industries';

const entryWithBullets = z.strictObject({
  role: text,
  org: text.optional(),
  location: text.optional(),
  dates: text.optional(),
  bullets: z.array(text).default([]),
});

export const athleteSchema = z.strictObject({
  $schema: z.string().optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words joined by "-"'),
  name: z.strictObject({
    first: text,
    last: text,
    full: text,
    preferred: text.optional(),
  }),
  tagline: text.max(140).optional(),
  headline: text.optional(),
  eventGroup: z.enum(EVENT_GROUPS).optional(),
  events: z.array(text).default([]),
  hometown: text.optional(),
  school: z
    .strictObject({
      name: text.optional(),
      major: text.optional(),
      minor: text.optional(),
      classYear: text.optional(),
      gradDate: text.optional(),
    })
    .optional(),
  contact: z
    .strictObject({
      email: z.email().optional(),
      /** The person's own existing website (absolute URL). */
      website: z.url().optional(),
      linkedin: social.optional(),
      instagram: social.optional(),
      x: social.optional(),
      tiktok: social.optional(),
    })
    .optional(),
  bio: z
    .strictObject({
      short: text.max(280).optional(),
      long: z.array(text).default([]),
    })
    .optional(),
  stats: z
    .array(z.strictObject({ label: text, value: text, note: text.optional() }))
    .max(4)
    .default([]),
  prs: z
    .array(
      z.strictObject({
        event: text,
        mark: text,
        wind: text.optional(),
        meet: text.optional(),
        year: when.optional(),
        indoor: z.boolean().optional(),
      }),
    )
    .default([]),
  timeline: z
    .array(z.strictObject({ year: when, title: text, detail: text.optional() }))
    .default([]),
  honors: z.array(z.strictObject({ title: text, year: when.optional() })).default([]),
  inTheirWords: z
    .array(
      z.strictObject({
        quote: text,
        source: text.optional(),
        date: when.optional(),
        url: z.url().optional(),
      }),
    )
    .default([]),
  press: z
    .array(
      z.strictObject({
        title: text,
        outlet: text.optional(),
        date: when.optional(),
        url: z.url(),
      }),
    )
    .default([]),
  strengths: z.array(z.strictObject({ title: text, detail: text.optional() })).default([]),
  resume: z
    .strictObject({
      summary: text.optional(),
      experience: z.array(entryWithBullets).default([]),
      education: z
        .array(
          z.strictObject({
            school: text,
            degree: text.optional(),
            dates: text.optional(),
            details: z.array(text).default([]),
          }),
        )
        .default([]),
      athletics: z.array(entryWithBullets).default([]),
      leadership: z.array(entryWithBullets).default([]),
      skills: z
        .strictObject({
          core: z.array(text).default([]),
          tools: z.array(text).default([]),
          languages: z.array(text).default([]),
        })
        .optional(),
      honors: z.array(z.strictObject({ title: text, year: when.optional() })).default([]),
    })
    .optional(),
  hamzaQuote: z
    .strictObject({
      text: text,
      attribution: text.default(DEFAULT_HAMZA_ATTRIBUTION),
    })
    .optional(),
  /** File names inside src/assets/photos/. Missing ones fall back to neutral placeholders. */
  images: z
    .strictObject({
      hero: text.optional(),
      portrait: text.optional(),
      action: z.array(text).default([]),
      /** What each action photo shows, in the same order (alt text). Omitted = "<name> competing". */
      actionAlt: z.array(text).default([]),
      og: text.optional(),
      /**
       * How the resume photo is framed from `hero`. The frame is cut from the photo's top square (full width,
       * as tall as it is wide): `x` and `y` are the point of that square that sits at the center of the frame
       * (0 to 1 from its top left) and `zoom` is how far in it goes (1 = the whole square). Omitted = the whole square.
       */
      resumeCrop: z
        .strictObject({
          x: z.number().min(0).max(1).default(0.5),
          y: z.number().min(0).max(1).default(0.5),
          zoom: z.number().min(1).max(2).default(1),
        })
        .optional(),
      /**
       * The tall photo beside the strengths cards. Omitted = the most upright action photo when there are two
       * or more (it then leaves the gallery, so no photo shows twice), otherwise `portrait`.
       */
      feature: text.optional(),
      /** The point of `feature` kept in view when it is cropped to the tall frame (0 to 1 from its top left). */
      featureFocus: z
        .strictObject({
          x: z.number().min(0).max(1).default(0.5),
          y: z.number().min(0).max(1).default(0.4),
        })
        .optional(),
    })
    .optional(),
  /**
   * How the portraits were made. "ai": AI-assisted edits of the official headshot (light studio, captioned as
   * such). "original": the untouched official photo, shown framed, with no AI caption.
   */
  imagery: z.enum(IMAGERY).default('ai'),
  photoCredits: z.array(text).default([]),
  /** Where this site lives (canonical, OG, resume header). */
  site: z.strictObject({ url: z.url() }).optional(),
  seo: z
    .strictObject({
      title: text.max(70).optional(),
      description: text.max(170).optional(),
    })
    .optional(),
  /** true = hidden from Google and other search engines. Omitted = site.json noindexDefault (true). */
  noindex: z.boolean().optional(),
});

export const siteSchema = z.strictObject({
  $schema: z.string().optional(),
  noindexDefault: z.boolean(),
  feniex: z.strictObject({ name: text, url: z.url(), blurb: text }),
  hamza: z.strictObject({ name: text, title: text }),
});

export type Athlete = z.output<typeof athleteSchema>;
export type AthleteInput = z.input<typeof athleteSchema>;
export type SiteConfig = z.output<typeof siteSchema>;
export type EventGroup = (typeof EVENT_GROUPS)[number];
export type ResumeEntry = z.output<typeof entryWithBullets>;

/** Readable one-line-per-problem message for a failed parse. */
export function formatIssues(error: z.ZodError, label: string): string {
  return error.issues
    .map((i) => `  ${label}: ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
    .join('\n');
}
