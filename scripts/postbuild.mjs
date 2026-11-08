// Inject the precache list and a content hash version into dist/sw.js.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const dist = new URL('../dist/', import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(dist);

const skip = new Set(['sw.js', 'version.json']);
const precache = files
  .map((f) => relative(dist, f).split('\\').join('/'))
  .filter((f) => !skip.has(f) && !f.endsWith('.map'))
  .sort();

const hash = createHash('sha256');
for (const f of precache) {
  hash.update(f);
  hash.update(readFileSync(join(dist, f)));
}
const version = hash.digest('hex').slice(0, 12);
const list = ['./', ...precache.map((f) => './' + f)];

const swPath = join(dist, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
sw = sw.replace("'__VERSION__'", JSON.stringify(version));
sw = `self.__PRECACHE = ${JSON.stringify(list)};\n` + sw;
writeFileSync(swPath, sw);
writeFileSync(join(dist, 'version.json'), JSON.stringify({ version, builtAt: new Date().toISOString() }));
// let the app know its own version
const idx = join(dist, 'index.html');
writeFileSync(idx, readFileSync(idx, 'utf8').replace('</head>', `  <meta name="app-version" content="${version}" />\n  </head>`));
console.log(`sw.js: ${list.length} files precached, version ${version}`);
