const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to index.html...");
  await page.goto('http://localhost:8000/index.html');
  await page.waitForLoadState('networkidle');
  
  console.log("Calling goToEbook()...");
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate(() => goToEbook())
  ]);
  
  console.log("URL after goToEbook():", page.url());

  if (page.url().includes('ebook-cardss-pt.html')) {
     console.log("SUCCESS: index.html navigates to pt by default");
  } else {
     console.log("FAIL: index.html did not navigate to pt ebook by default");
  }

  // Back to index
  await page.goto('http://localhost:8000/index.html');
  await page.waitForLoadState('networkidle');

  console.log("Calling setLang('en') on index...");
  await page.evaluate(() => setLang('en'));

  console.log("Calling goToEbook()...");
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate(() => goToEbook())
  ]);
  console.log("URL after goToEbook() for EN:", page.url());
  
  if (page.url().includes('ebook-cardss-en.html')) {
     console.log("SUCCESS: index navigates to en ebook");
  } else {
     console.log("FAIL: index did not navigate to en ebook");
  }

  // Back to index
  await page.goto('http://localhost:8000/index.html');
  await page.waitForLoadState('networkidle');

  console.log("Calling setLang('es') on index...");
  await page.evaluate(() => setLang('es'));

  console.log("Calling goToEbook()...");
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate(() => goToEbook())
  ]);
  console.log("URL after goToEbook() for ES:", page.url());

  if (page.url().includes('ebook-cardss-es.html')) {
     console.log("SUCCESS: index navigates to es ebook");
  } else {
     console.log("FAIL: index did not navigate to es ebook");
  }
  
  await browser.close();
})();
