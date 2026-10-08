import type { APIRoute, GetStaticPaths } from 'astro';
import { loadSite } from '../lib/athlete.ts';

// /sitemap.xml exists only when the site is indexable (noindex: false).
export const getStaticPaths = (async () => {
  const data = await loadSite();
  return data.noindex ? [] : [{ params: { sitemap: 'sitemap' } }];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async () => {
  const data = await loadSite();
  const urls = ['/', '/resume/']
    .map((p) => `  <url><loc>${data.url}${p}</loc></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
