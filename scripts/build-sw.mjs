import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../dist/', import.meta.url);
async function walk(dir = '') {
  const entries = await readdir(new URL(dir, root), { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.name === 'sw.js') continue;
    if (e.isDirectory()) files.push(...(await walk(`${dir}${e.name}/`)));
    else files.push(`${dir}${e.name}`);
  }
  return files;
}
const files = await walk(),
  hash = createHash('sha256');
for (const f of files) hash.update(await readFile(new URL(f, root)));
const revision = hash.digest('hex').slice(0, 16);
const sw = `const PREFIX='investanalytics-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+'${revision}';
const FILES=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(p=>new URL(p,self.registration.scope).href))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(self.registration.scope))return;e.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(e.request);if(cached)return cached;try{return await fetch(e.request);}catch(error){if(e.request.mode==='navigate')return await cache.match(new URL('index.html',self.registration.scope))||Response.error();throw error;}}));});
`;
await writeFile(new URL('sw.js', root), sw);
console.log(`Offline: ${files.length} файлов, ревизия ${revision}`);
