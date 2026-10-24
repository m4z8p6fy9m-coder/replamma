import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { startDemo } from './demo.js';

// A copied manifest grants loopback access only in the disposable test profile.
// Playwright cannot invoke Chrome's actual toolbar action to grant activeTab.
const root = await mkdtemp(join(tmpdir(), 'replay-e2e-'));
const extension = join(root, 'extension');
await cp(resolve('extension'), extension, { recursive: true });
const manifest = JSON.parse(
  await readFile(join(extension, 'manifest.json'), 'utf8'),
);
manifest.host_permissions = ['http://127.0.0.1/*'];
await writeFile(join(extension, 'manifest.json'), JSON.stringify(manifest));
const server = await startDemo(0);
const url = `http://127.0.0.1:${server.address().port}/`;
let context;
try {
  context = await chromium.launchPersistentContext(join(root, 'profile'), {
    headless: true,
    channel: 'chromium',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
    viewport: { width: 440, height: 1100 },
  });
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).host;
  const demo = await context.newPage();
  await demo.goto(url);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${id}/panel.html`);
  const errors = [];
  panel.on('pageerror', (error) => errors.push(error.message));
  // The panel is opened as an extension tab for automation; keep the target active.
  await demo.bringToFront();
  await panel.getByLabel('Name', { exact: true }).fill('Weekly report');
  await panel.getByRole('button', { name: 'Record page' }).click();
  await panel
    .getByRole('status')
    .filter({ hasText: 'Recording this page' })
    .waitFor();
  await demo.getByLabel('Report name', { exact: true }).fill('Weekly overview');
  await demo.locator('#format').focus();
  await demo.locator('#format').press('ArrowDown');
  await demo.locator('#format').press('Enter');
  await demo
    .getByLabel('Password (Replamma must skip this)', { exact: true })
    .fill('never-store-this');
  await demo
    .getByLabel('Private note (Replamma must skip this)', { exact: true })
    .fill('never-store-this-either');
  await demo.getByRole('button', { name: 'Create report' }).click();
  await panel.getByRole('button', { name: 'Stop', exact: true }).click();
  await panel
    .getByRole('status')
    .filter({ hasText: 'Stopped. Review your steps' })
    .waitFor();
  assert.equal(
    await panel.locator('#steps > li').count(),
    3,
    await panel.locator('#steps').textContent(),
  );
  assert.ok(
    !(await panel.locator('#steps').textContent()).includes('never-store'),
  );
  await panel
    .getByRole('button', { name: 'Save workflow', exact: true })
    .click();
  await panel
    .getByRole('status')
    .filter({ hasText: 'Saved in this browser profile.' })
    .waitFor();
  const stored = await panel.evaluate(() =>
    chrome.storage.local.get('workflows'),
  );
  assert.equal(Object.keys(stored.workflows).length, 1);
  assert.ok(!JSON.stringify(stored).includes('never-store'));
  await demo.reload();
  await demo.bringToFront();
  await panel.getByRole('button', { name: 'Run', exact: true }).click();
  await panel
    .getByRole('button', { name: 'Approve this click', exact: true })
    .waitFor();
  assert.equal(
    await demo.locator('#result').textContent(),
    'Your report will appear here.',
  );
  assert.equal(
    await demo.locator('#report-name').inputValue(),
    'Weekly overview',
  );
  await panel
    .getByRole('button', { name: 'Approve this click', exact: true })
    .click();
  await panel
    .getByRole('status')
    .filter({ hasText: 'Workflow completed.' })
    .waitFor();
  assert.equal(
    await demo.locator('#result').textContent(),
    'Created: Weekly overview (json)',
  );
  await demo.reload();
  await demo.bringToFront();
  await panel.getByRole('button', { name: 'Run', exact: true }).click();
  await panel
    .getByRole('button', { name: 'Approve this click', exact: true })
    .waitFor();
  await panel.getByRole('button', { name: 'Stop', exact: true }).click();
  await panel
    .getByRole('status')
    .filter({ hasText: 'Stopped. Review your steps' })
    .waitFor();
  assert.equal(
    await demo.locator('#result').textContent(),
    'Your report will appear here.',
  );
  assert.equal(await panel.locator('#approval').isVisible(), false);
  const downloaded = panel.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloaded;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(exported.steps.length, 3);
  assert.equal(
    await panel.evaluate(() => getComputedStyle(document.body).userSelect),
    'none',
  );
  assert.equal(
    await panel
      .getByLabel('Name', { exact: true })
      .evaluate((el) => getComputedStyle(el).userSelect),
    'text',
  );
  await panel.reload();
  await panel.locator('#steps > li').first().waitFor();
  assert.equal(await panel.locator('#steps > li').count(), 3);
  // Parameterized input values are resolved only for this run.
  await panel
    .getByLabel('Value for step 1', { exact: true })
    .fill('{{report}}');
  await panel
    .getByLabel('Run input report', { exact: true })
    .fill('Parameterized report');
  await demo.reload();
  await demo.bringToFront();
  await panel.getByRole('button', { name: 'Run', exact: true }).click();
  await panel
    .getByRole('button', { name: 'Approve this click', exact: true })
    .waitFor();
  assert.equal(
    await demo.locator('#report-name').inputValue(),
    'Parameterized report',
  );
  await panel
    .getByRole('button', { name: 'Approve this click', exact: true })
    .click();
  await panel
    .getByRole('status')
    .filter({ hasText: 'Workflow completed.' })
    .waitFor();
  await panel.getByRole('button', { name: 'Activity', exact: true }).click();
  await panel.locator('.history-item').first().waitFor();
  assert.match(await panel.locator('#history-list').textContent(), /completed/);
  const activity = await panel.evaluate(() =>
    chrome.storage.local.get('runHistory'),
  );
  assert.ok(!JSON.stringify(activity).includes('Parameterized report'));
  await panel.getByRole('button', { name: 'Workflows', exact: true }).click();
  // Selecting a replacement target must intercept the click, not submit it.
  await panel.locator('.step-details').first().locator('summary').click();
  await panel
    .getByRole('button', { name: 'Choose target for step 1', exact: true })
    .click();
  await panel
    .getByRole('status')
    .filter({ hasText: 'Click an element on the page' })
    .waitFor();
  await demo.locator('#report-name').click();
  await panel
    .getByRole('status')
    .filter({ hasText: 'Target updated.' })
    .waitFor();
  await panel
    .getByLabel('Value for step 1', { exact: true })
    .fill('Weekly overview');
  await panel
    .getByRole('button', { name: 'Save workflow', exact: true })
    .click();
  await panel
    .getByRole('status')
    .filter({ hasText: 'Saved in this browser profile.' })
    .waitFor();
  await panel.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await panel
    .getByRole('button', { name: 'Save workflow', exact: true })
    .click();
  await panel
    .getByRole('status')
    .filter({ hasText: 'Saved in this browser profile.' })
    .waitFor();
  await panel
    .getByRole('searchbox', { name: 'Search workflows', exact: true })
    .fill('not-a-match');
  assert.equal(await panel.locator('.workflow-item').count(), 0);
  await panel
    .getByRole('searchbox', { name: 'Search workflows', exact: true })
    .fill('');
  assert.equal(await panel.locator('.workflow-item').count(), 2);
  await panel.getByLabel('Name', { exact: true }).click();
  assert.notEqual(
    await panel
      .getByRole('button', { name: 'Remove step 1', exact: true })
      .locator('path')
      .evaluate((el) => getComputedStyle(el).stroke),
    'none',
  );
  await panel.setViewportSize({ width: 320, height: 900 });
  assert.equal(
    await panel.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await panel.setViewportSize({ width: 440, height: 1100 });
  await mkdir('test-results', { recursive: true });
  await panel.screenshot({ path: 'test-results/studio.png', fullPage: true });
  await cp('test-results/studio.png', 'docs/studio.png');
  assert.deepEqual(errors, []);
  console.log(
    'PASS: recording, private fields, playback, approval, cancellation, persistence, export, variables, history, target picker, duplication, search and text selection rules.',
  );
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  // root is a freshly-created disposable directory, never a caller-provided path.
  if (
    dirname(resolve(root)) !== resolve(tmpdir()) ||
    !basename(root).startsWith('replay-e2e-')
  )
    throw new Error('Refusing cleanup outside the test directory.');
  await rm(root, { recursive: true, force: true });
}
