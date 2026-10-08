// Rewrites root-absolute URLs ("/_astro/x.css", "/resume/") in a built site
// into relative ones ("./_astro/x.css", "../resume/") so dist/<slug>/ works
// from any folder: its own domain, a sub-path, or a local static server.
//
// 404.html is left alone: Vercel serves it at arbitrary depths, where only
// root-absolute links resolve.
import fs from 'node:fs';
import path from 'node:path';

const URL_ATTRS = ['href', 'src', 'poster', 'action', 'data-src'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === '.vercel' ? [] : walk(p);
    return [p];
  });
}

function prefixFor(siteDir, file) {
  const depth = path.relative(siteDir, path.dirname(file)).split(path.sep).filter(Boolean).length;
  return depth === 0 ? './' : '../'.repeat(depth);
}

const isRootPath = (v) => v.startsWith('/') && !v.startsWith('//');

function rewriteUrl(value, prefix) {
  return isRootPath(value) ? prefix + value.slice(1) : value;
}

function rewriteCssUrls(css, prefix) {
  return css.replace(/url\(\s*(['"]?)(\/(?!\/)[^'")]*)\1\s*\)/g, (_, q, url) => `url(${q}${prefix}${url.slice(1)}${q})`);
}

export function relativizeHtml(html, prefix) {
  let out = html.replace(
    new RegExp(`(\\s(?:${URL_ATTRS.join('|')})=)("([^"]*)"|'([^']*)')`, 'g'),
    (m, attr, _quoted, dq, sq) => {
      const v = dq ?? sq;
      const q = dq !== undefined ? '"' : "'";
      return `${attr}${q}${rewriteUrl(v, prefix)}${q}`;
    },
  );
  out = out.replace(/(\ssrcset=)"([^"]*)"/g, (m, attr, value) => {
    const parts = value.split(',').map((part) => {
      const [url, ...rest] = part.trim().split(/\s+/);
      return [rewriteUrl(url, prefix), ...rest].join(' ');
    });
    return `${attr}"${parts.join(', ')}"`;
  });
  // Inline <style> blocks and style="" attributes.
  out = out.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, css, close) => open + rewriteCssUrls(css, prefix) + close);
  out = out.replace(/(\sstyle=)"([^"]*)"/g, (m, attr, css) => `${attr}"${rewriteCssUrls(css, prefix)}"`);
  return out;
}

/** Rewrite every HTML (except 404.html) and CSS file under siteDir in place. */
export function relativizeSite(siteDir) {
  let count = 0;
  for (const file of walk(siteDir)) {
    const rel = path.relative(siteDir, file);
    if (file.endsWith('.html') && rel !== '404.html') {
      const before = fs.readFileSync(file, 'utf8');
      const after = relativizeHtml(before, prefixFor(siteDir, file));
      if (after !== before) fs.writeFileSync(file, after), count++;
    } else if (file.endsWith('.css')) {
      const before = fs.readFileSync(file, 'utf8');
      const after = rewriteCssUrls(before, prefixFor(siteDir, file));
      if (after !== before) fs.writeFileSync(file, after), count++;
    }
  }
  return count;
}
