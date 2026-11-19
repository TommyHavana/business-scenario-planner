import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const ROUTES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/src/app.js', ['src/app.js', 'text/javascript; charset=utf-8']],
  ['/src/styles.css', ['src/styles.css', 'text/css; charset=utf-8']],
  ['/src/model.js', ['src/model.js', 'text/javascript; charset=utf-8']],
  ['/src/storage.js', ['src/storage.js', 'text/javascript; charset=utf-8']],
  ['/src/presentation.js', ['src/presentation.js', 'text/javascript; charset=utf-8']],
  ['/docs/MODELO.md', ['docs/MODELO.md', 'text/plain; charset=utf-8']],
]);

/** Serve only the local planner's public files, without a build or dependencies. */
export function createServer({ rootDir = DEFAULT_ROOT } = {}) {
  return createHttpServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    function send(status, content, contentType = 'text/plain; charset=utf-8') {
      response.writeHead(status, {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(content),
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      send(405, 'Método no permitido.');
      return;
    }

    // Match the raw path: never decode or normalize traversal into an allowed URL.
    const pathname = (request.url ?? '').split('?', 1)[0];
    const route = ROUTES.get(pathname);
    if (!route) {
      send(404, 'No encontrado.');
      return;
    }

    const [relativePath, contentType] = route;
    try {
      const content = await readFile(resolve(rootDir, relativePath));
      send(200, content, contentType);
    } catch (error) {
      const missing = error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'EISDIR';
      send(missing ? 404 : 500, missing ? 'No encontrado.' : 'No se pudo leer el archivo.');
    }
  });
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const rawPort = process.env.PORT ?? '4174';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    console.error('PORT debe ser un número entero entre 1 y 65535.');
    process.exitCode = 1;
  } else {
    const port = Number(rawPort);
    const server = createServer();
    server.on('error', (error) => {
      console.error(`No se pudo iniciar el servidor local: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Servidor local: http://127.0.0.1:${port}`);
    });
  }
}
