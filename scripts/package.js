import { cp, mkdir, rm } from 'node:fs/promises';
// The generated folder is deliberately fixed; never remove user-supplied paths.
await mkdir('dist', { recursive: true });
await rm('dist/replay', { recursive: true, force: true });
await cp('extension', 'dist/replay', { recursive: true });
console.log(
  'Load dist/replay as an unpacked extension. The extension also runs directly from extension/.',
);
