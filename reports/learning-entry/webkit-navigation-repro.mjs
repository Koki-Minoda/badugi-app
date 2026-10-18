// Isolates the bundled WebKit navigation crash. No MGX code or server is used.
// Run manually: node reports/learning-entry/webkit-navigation-repro.mjs
import { webkit, devices } from '@playwright/test';
const browser = await webkit.launch();
try {
  const page = await browser.newPage({ ...devices['iPhone 13'] });
  await page.route('http://127.0.0.1:4177/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<html><body><button onclick="history.pushState({key:123},\'\',\'/learn/practice?variant=badugi&cards=AS,2H,3D,4C\')">Open practice</button></body></html>',
  }));
  await page.goto('http://127.0.0.1:4177/learn/review');
  await page.getByRole('button').click();
  await page.reload();
  await page.goto('http://127.0.0.1:4177/learn/practice');
  console.log('Navigation succeeded; crash did not reproduce.');
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
}
