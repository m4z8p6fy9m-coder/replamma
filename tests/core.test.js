import test from 'node:test';
import assert from 'node:assert/strict';
import '../extension/core.js';
const { validate, samePage, webUrl } = globalThis.ReplayCore;
const flow = (steps = []) => ({
  schemaVersion: 1,
  name: 'Example',
  url: 'https://example.com/reports',
  steps,
});
test('accepts supported actions and strips unknown data', () => {
  const data = validate({
    ...flow([
      {
        type: 'input',
        selector: '#name',
        value: 'Example',
        label: 'Name',
        extra: 'discard',
      },
      { type: 'click', selector: '#save' },
      { type: 'select', selector: '#format', value: 'csv' },
      { type: 'wait', ms: 100 },
    ]),
    secret: 'discard',
  });
  assert.equal(data.steps.length, 4);
  assert.equal(data.secret, undefined);
  assert.equal(data.steps[0].extra, undefined);
});
test('rejects unsafe URLs, credentials and schemes', () => {
  for (const url of [
    'javascript:alert(1)',
    'file:///tmp/test',
    'chrome://settings',
    'https://user:pass@example.com',
  ])
    assert.throws(() => validate({ ...flow(), url }));
  assert.equal(webUrl('http://localhost:4173').protocol, 'http:');
});
test('rejects arbitrary execution and malformed inputs', () => {
  for (const step of [
    { type: 'eval', code: 'alert(1)' },
    { type: 'click', selector: '' },
    { type: 'input', selector: '#x', value: 42 },
    { type: 'wait', ms: 30001 },
    { type: 'wait', ms: -1 },
    { type: 'wait', ms: 1.5 },
  ])
    assert.throws(() => validate(flow([step])));
  assert.throws(() => validate({ ...flow(), schemaVersion: 2 }));
  assert.throws(() => validate({ ...flow(), name: '' }));
});
test('limits import resource usage', () => {
  assert.throws(() =>
    validate(
      flow(Array.from({ length: 251 }, () => ({ type: 'wait', ms: 0 }))),
    ),
  );
  assert.throws(() =>
    validate(
      flow([{ type: 'input', selector: '#x', value: 'x'.repeat(10001) }]),
    ),
  );
});
test('pins origin, pathname and query; permits fragment changes', () => {
  assert.equal(
    samePage('https://a.test/x?q=1', 'https://a.test/x?q=1#section'),
    true,
  );
  for (const url of [
    'https://b.test/x?q=1',
    'http://a.test/x?q=1',
    'https://a.test/y?q=1',
    'https://a.test/x?q=2',
  ])
    assert.equal(samePage('https://a.test/x?q=1', url), false);
});
