// Prints every deck and card in this folder to pdf/ using Chromium.
// Run from the bp555 folder: node tools/export-pdf.js
// Needs Playwright installed globally (npm i -g playwright). Not a dependency of the site itself.
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const PAGES = [
  ['training.html', 'bp555-operator-training.pdf'],
  ['controls.html', 'bp555-button-guide.pdf'],
  ['cleaning.html', 'bp555-cleaning-guide.pdf'],
  ['control-map.html', 'bp555-control-map.pdf'],
  ['start-card.html', 'bp555-start-card.pdf'],
  ['settings-sheet.html', 'bp555-settings-sheet.pdf'],
  ['cleaning-card.html', 'bp555-cleaning-card.pdf'],
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
