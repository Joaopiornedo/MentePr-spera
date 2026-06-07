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

  console.log("Calling setLang('en')...");
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate(() => setLang('en'))
  ]);
  console.log("URL after setLang('en'):", page.url());
  
  if (page.url().includes('ebook-cardss-en.html')) {
     console.log("SUCCESS: ebook-cardss-pt.html navigates to en ebook");
  } else {
     console.log("FAIL: ebook-cardss-pt.html did not navigate to en ebook");
  }

  console.log("Calling setLang('es')...");
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate(() => setLang('es'))
  ]);
  console.log("URL after setLang('es'):", page.url());

  if (page.url().includes('ebook-cardss-es.html')) {
     console.log("SUCCESS: ebook-cardss-en.html navigates to es ebook");
  } else {
     console.log("FAIL: ebook-cardss-en.html did not navigate to es ebook");
  }
  
  await browser.close();
})();
