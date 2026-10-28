import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
const root = resolve('dist'),
  prefix = '/arbitrary-repository/';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};
createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost'),
      path = u.pathname;
    if (!path.startsWith(prefix)) {
      res.writeHead(404).end();
      return;
    }
    let target = resolve(root, decodeURIComponent(path.slice(prefix.length)) || 'index.html');
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
    res.writeHead(200, {
      'Content-Type': types[extname(target)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(await readFile(target));
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(4174, '127.0.0.1', () =>
  console.log('Production test: http://127.0.0.1:4174/arbitrary-repository/'),
);
