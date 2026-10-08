import type { APIRoute } from 'astro';
import { loadSite } from '../lib/athlete.ts';

// Crawlers are always let in. A noindex site stays out of search results
// through the robots meta tag on every page, which a crawler only sees if it
// may fetch the page: "Disallow: /" would hide the noindex itself. Only an
// indexable site names a sitemap.
export const GET: APIRoute = async () => {
  const data = await loadSite();
  const body = data.noindex
    ? 'User-agent: *\nAllow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${data.url}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
