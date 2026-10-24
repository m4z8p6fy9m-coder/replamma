import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
export async function startDemo(port = 4173) {
  const html = await readFile(new URL('../docs/demo.html', import.meta.url));
  const server = createServer((req, res) => {
    if (req.url !== '/' && req.url !== '/demo') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return server;
}
if (process.argv[1]?.endsWith('demo.js')) {
  await startDemo();
  console.log('Practice page: http://127.0.0.1:4173 — Ctrl+C to stop');
}
