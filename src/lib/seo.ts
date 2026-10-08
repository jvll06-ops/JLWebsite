// Structured data for search engines and link unfurlers.
import { abs, type SiteData } from './athlete.ts';

const UT_AUSTIN = 'The University of Texas at Austin';

export function personJsonLd(data: SiteData): Record<string, unknown> {
  const { a, site } = data;
  const school = a.school?.name ?? UT_AUSTIN;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: a.name.full,
    givenName: a.name.first,
    familyName: a.name.last,
    url: data.url + '/',
    image: abs(data, '/og.jpg'),
    description: data.description,
    alumniOf: { '@type': 'CollegeOrUniversity', name: school },
    affiliation: {
      '@type': 'Organization',
      name: site.feniex.name,
      url: site.feniex.url,
    },
    hasOccupation: {
      '@type': 'Occupation',
      name: 'Project Manager Intern',
      description: `Project Manager Intern at ${site.feniex.name}, 2026`,
    },
  };
  if (a.hometown) ld.homeLocation = { '@type': 'Place', name: a.hometown };
  if (a.events.length) ld.knowsAbout = a.events;
  if (data.socials.length) ld.sameAs = data.socials.map((s) => s.url);
  return ld;
}
