import type { APIRoute } from 'astro';
import { loadSite } from '../lib/athlete.ts';
import { monogramSvg } from '../lib/monogram.ts';

export const GET: APIRoute = async () => {
  const data = await loadSite();
  return new Response(monogramSvg(data.initials), { headers: { 'Content-Type': 'image/svg+xml' } });
};
