import { cp, mkdir, rm } from 'node:fs/promises';
// The generated folder is deliberately fixed; never remove user-supplied paths.
await mkdir('dist', { recursive: true });
await rm('dist/replamma', { recursive: true, force: true });
await cp('extension', 'dist/replamma', { recursive: true });
console.log(
  'Load dist/replamma as an unpacked extension. The extension also runs directly from extension/.',
);
