// Serve the finished site in dist/ on your computer, exactly as it goes
// online (run npm run build first). Ctrl+C to stop.
//   npm run preview [-- --port 4400]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './lib/serve.mjs';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const i = process.argv.indexOf('--port');
const port = i >= 0 ? Number(process.argv[i + 1]) : 4400;

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('Nothing to preview yet. Run npm run build first.');
  process.exit(1);
}
const { url } = await serve(DIST, port);
console.log(`Your finished site: ${url}`);
console.log(`Resume:             ${url}resume/`);
console.log('Press Ctrl+C to stop.');
