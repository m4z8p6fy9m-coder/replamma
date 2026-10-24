import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const svg = await readFile('extension/icons/mark.svg', 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
    );
    await page.screenshot({
      path: `extension/icons/${size}.png`,
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
