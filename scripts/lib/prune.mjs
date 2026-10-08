// Deletes files in _astro/ that no HTML, CSS or JS file references.
// Astro emits the original of every imported image (and the neutral
// placeholders) even when pages only use resized copies, and the /og/ page's
// image is orphaned once og.jpg is rendered. Full-size photos would otherwise
// ride along in every deploy.
import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === '.vercel' ? [] : walk(p);
    return [p];
  });
}

/** Files under siteDir/_astro that nothing references. */
export function unreferencedAssets(siteDir) {
  const assets = path.join(siteDir, '_astro');
  if (!fs.existsSync(assets)) return [];
  const corpus = walk(siteDir)
    .filter((f) => /\.(html|css|js|mjs)$/.test(f))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
  return walk(assets).filter((f) => !corpus.includes(path.basename(f)));
}

export function pruneUnreferenced(siteDir) {
  const orphans = unreferencedAssets(siteDir);
  for (const f of orphans) fs.rmSync(f);
  return orphans.length;
}
