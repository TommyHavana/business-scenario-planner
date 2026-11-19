import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createServer } from '../scripts/server.mjs';

let rootDir;
let server;
let port;

before(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'scenario-planner-server-'));
  await Promise.all([
    mkdir(join(rootDir, 'src')),
    mkdir(join(rootDir, 'docs')),
  ]);
  await Promise.all([
    writeFile(join(rootDir, 'index.html'), '<!doctype html><title>Escenarios</title>'),
    writeFile(join(rootDir, 'src/app.js'), 'export const app = true;'),
    writeFile(join(rootDir, 'src/model.js'), 'export const model = true;'),
    writeFile(join(rootDir, 'src/storage.js'), 'export const storage = true;'),
    writeFile(join(rootDir, 'src/presentation.js'), 'export const presentation = true;'),
    writeFile(join(rootDir, 'src/styles.css'), 'body { color: black; }'),
    writeFile(join(rootDir, 'docs/MODELO.md'), '# Modelo de inversión'),
    writeFile(join(rootDir, 'README.md'), 'This file must not be public.'),
    writeFile(join(rootDir, '.env'), 'This file must not be public.'),
  ]);
  server = createServer({ rootDir });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  port = server.address().port;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  if (rootDir) await rm(rootDir, { recursive: true, force: true });
});

// node:http keeps raw traversal paths intact so the server itself must reject them.
function get(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('root and explicit index serve the planner with caching disabled', async () => {
  for (const path of ['/', '/index.html', '/?scenario=conservador']) {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.match(response.body, /<title>Escenarios<\/title>/);
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
    assert.match(response.headers['cache-control'], /no-store/);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  }
});

test('public modules, styles and model documentation have correct MIME types', async () => {
  const routes = [
    ['/src/app.js', 'text/javascript; charset=utf-8'],
    ['/src/model.js', 'text/javascript; charset=utf-8'],
    ['/src/storage.js', 'text/javascript; charset=utf-8'],
    ['/src/presentation.js', 'text/javascript; charset=utf-8'],
    ['/src/styles.css', 'text/css; charset=utf-8'],
    ['/docs/MODELO.md', 'text/plain; charset=utf-8'],
  ];
  for (const [path, type] of routes) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers['content-type'], type, path);
    assert.ok(response.body.length > 0, path);
    assert.equal(Number(response.headers['content-length']), Buffer.byteLength(response.body), path);
  }
});

test('HEAD returns GET headers and no body, including a missing route', async () => {
  for (const path of ['/', '/docs/MODELO.md', '/missing']) {
    const full = await get(path);
    const head = await get(path, 'HEAD');
    assert.equal(head.status, full.status, path);
    assert.equal(head.headers['content-length'], full.headers['content-length'], path);
    assert.equal(head.headers['content-type'], full.headers['content-type'], path);
    assert.equal(head.body, '', path);
  }
});

test('private files, traversal and encoded path aliases are not served', async () => {
  const paths = [
    '/README.md', '/STATUS.md', '/.env', '/.git/config', '/package.json',
    '/scripts/server.mjs', '/src/', '/does-not-exist',
    '/../index.html', '/src/../index.html', '/%2e%2e/index.html',
    '/src/%2e%2e/index.html', '/%69ndex.html', '//index.html',
  ];
  for (const path of paths) {
    const response = await get(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.body, 'No encontrado.', path);
  }
});

test('writes and other unsupported methods return 405', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await get('/', method);
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.allow, 'GET, HEAD', method);
  }
});
