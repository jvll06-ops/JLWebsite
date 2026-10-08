// Astro settings for this site. The web address comes from
// src/content/profile.json (site.url), so there is nothing to change here.
import fs from 'node:fs';
import { defineConfig } from 'astro/config';

const profile = JSON.parse(fs.readFileSync(new URL('./src/content/profile.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: profile.site?.url?.replace(/\/+$/, ''),
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // The whole stylesheet rides in the HTML (about 9 KB compressed): one
    // round trip less before the first paint, on a two-page site.
    inlineStylesheets: 'always',
  },
  devToolbar: { enabled: false },
  vite: {
    // Which browsers the CSS is written for. Named here so a prefixed pair
    // survives the minifier: with the default it kept only the last of
    // backdrop-filter / -webkit-backdrop-filter, and the header lost its blur in
    // Chrome (only -webkit- was left).
    build: { cssTarget: ['chrome109', 'edge109', 'firefox115', 'safari15'] },
  },
});
