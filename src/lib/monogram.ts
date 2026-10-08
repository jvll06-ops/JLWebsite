// Favicon: the header's monogram. Charcoal initials inside a fine bronze ring
// on the studio white. Colors mirror --page / --accent / --text in tokens.css
// (SVG favicons can't read CSS vars).
export const MONOGRAM = { background: '#fafaf8', ring: '#7d5f43', foreground: '#17181b' };

export function monogramSvg(initials: string): string {
  const safe = initials.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${MONOGRAM.background}"/>
  <circle cx="32" cy="32" r="23" fill="none" stroke="${MONOGRAM.ring}" stroke-width="3"/>
  <text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="'Arial Narrow', 'Helvetica Neue', Arial, sans-serif" font-size="23" font-weight="800" fill="${MONOGRAM.foreground}" letter-spacing="0.5">${safe}</text>
</svg>
`;
}
