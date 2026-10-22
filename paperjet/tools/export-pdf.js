// Prints every deck and card in this folder to pdf/ using Chromium.
// Run from the paperjet folder: node tools/export-pdf.js
// Needs Playwright installed globally (npm i -g playwright). Not a dependency of the site itself.
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const PAGES = [
  ['guide.html', 'paperjet-operator-guide.pdf'],
  ['start-card.html', 'paperjet-start-card.pdf'],
  ['control-card.html', 'paperjet-control-map.pdf'],
  ['maintenance-card.html', 'paperjet-maintenance-card.pdf'],
];

(async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage();
  for (const [src, out] of PAGES) {
    await page.goto('file://' + path.join(root, src));
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print', colorScheme: 'light' });
    await page.pdf({ path: path.join(root, 'pdf', out), preferCSSPageSize: true, printBackground: true });
    console.log('wrote pdf/' + out);
  }
  await browser.close();
})();
