import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
async function walk(path) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    const file = `${path}/${item.name}`;
    if (item.isDirectory()) await walk(file);
    else if (file.endsWith('.js'))
      execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    else if (file.endsWith('.json')) JSON.parse(await readFile(file, 'utf8'));
  }
}
await walk('extension');
await walk('scripts');
await walk('tests');
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
if (manifest.host_permissions || manifest.content_scripts)
  throw new Error('Unexpected persistent site access.');
if (
  manifest.version !==
  JSON.parse(await readFile('package.json', 'utf8')).version
)
  throw new Error('Versions differ.');
console.log('Syntax, JSON, version and permission checks passed.');
