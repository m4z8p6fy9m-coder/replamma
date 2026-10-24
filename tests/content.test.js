import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const source = await readFile(
  new URL('../extension/content.js', import.meta.url),
  'utf8',
);
const core = await readFile(
  new URL('../extension/core.js', import.meta.url),
  'utf8',
);
function harness() {
  const dom = new JSDOM(
    '<input id="name"><input id="password" type="password"><div data-replay-private><input id="private"></div><button class="dup">A</button><button class="dup">B</button><select id="format"><option value="csv">CSV</option></select>',
    { url: 'https://example.com/reports', runScripts: 'outside-only' },
  );
  const w = dom.window;
  let listener;
  w.chrome = {
    runtime: {
      id: 'test',
      onMessage: {
        addListener: (fn) => {
          listener = fn;
        },
      },
    },
  };
  w.HTMLElement.prototype.getClientRects = () => [1];
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.eval(core);
  w.eval(source);
  const send = (message) =>
    new Promise((resolve) => listener(message, { id: 'test' }, resolve));
  return {
    dom,
    w,
    send,
    execute: (step) =>
      send({ type: 'EXECUTE', url: 'https://example.com/reports', step }),
  };
}
test('native value setter dispatches input and change events', async () => {
  const { dom, w, execute } = harness();
  let inputs = 0,
    changes = 0;
  w.document.querySelector('#name').addEventListener('input', () => inputs++);
  w.document.querySelector('#name').addEventListener('change', () => changes++);
  assert.equal(
    (await execute({ type: 'input', selector: '#name', value: 'Hello' })).ok,
    true,
  );
  assert.equal(w.document.querySelector('#name').value, 'Hello');
  assert.equal(inputs, 1);
  assert.equal(changes, 1);
  dom.window.close();
});
test('blocks sensitive, private, ambiguous and mismatched targets', async () => {
  const { dom, execute } = harness();
  for (const selector of ['#password', '#private', '.dup'])
    assert.equal(
      (await execute({ type: 'input', selector, value: 'no' })).ok,
      false,
    );
  assert.equal(
    (await execute({ type: 'select', selector: '#name', value: 'csv' })).ok,
    false,
  );
  assert.equal(
    (await execute({ type: 'select', selector: '#format', value: 'missing' }))
      .ok,
    false,
  );
  dom.window.close();
});
test('stops after URL changes', async () => {
  const { dom, w, execute } = harness();
  w.history.pushState({}, '', '/other');
  assert.match(
    (await execute({ type: 'click', selector: '#name' })).error,
    /Page changed/,
  );
  dom.window.close();
});
test('cancels a pending selector wait without clicking later', async () => {
  const { dom, send, execute } = harness();
  const waiting = execute({ type: 'click', selector: '#missing' });
  await send({ type: 'CANCEL' });
  assert.match((await waiting).error, /stopped/);
  dom.window.close();
});
test('injection is idempotent and recording has a session identifier', async () => {
  const { dom, w, send } = harness();
  w.eval(source);
  await send({ type: 'RECORD_START', session: 'one' });
  const data = await send({ type: 'RECORD_POLL' });
  assert.equal(data.session, 'one');
  assert.equal(data.recording, true);
  assert.equal((await send({ type: 'RECORD_STOP' })).ok, true);
  dom.window.close();
});
test('recording expires when the panel heartbeat stops', async () => {
  const { dom, w, send } = harness();
  let now = 1000;
  w.Date.now = () => now;
  await send({ type: 'RECORD_START', session: 'lease' });
  now += 2001;
  assert.equal((await send({ type: 'RECORD_POLL' })).recording, false);
  dom.window.close();
});
test('recording heartbeat renews while the panel is present', async () => {
  const { dom, w, send } = harness();
  let now = 1000;
  w.Date.now = () => now;
  await send({ type: 'RECORD_START', session: 'lease' });
  for (let i = 0; i < 6; i++) {
    now += 500;
    assert.equal((await send({ type: 'RECORD_POLL' })).recording, true);
  }
  dom.window.close();
});
