const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:8000/index.html');

    // Switch to Orçamento page if not already active
    await page.evaluate(() => switchPage('orcamento'));

    // Switch to the Lazer sub-tab so the select element becomes visible. Wait for display.
    await page.evaluate(() => switchSubTab('lazer'));
    await page.waitForTimeout(500);

    console.log("Adding fraction via script...");
    await page.selectOption('#fracoes-lazer .fraction-select', '2');

    // Wait a bit to render fractions
    await page.waitForTimeout(500);

    const fractionsCount = await page.$$eval('#fracoes-lazer-list input[type="text"]', els => els.length);
    console.log(`Lazer fractions rendered: ${fractionsCount}`);
    if (fractionsCount !== 2) {
      throw new Error("Lazer fractions not split correctly.");
    }

    // Check custom names mapping
    await page.fill('#fracoes-lazer-list > div:nth-child(1) input[type="text"]', 'Test Fraction 1');
    await page.waitForTimeout(100);

    // Check checkboxes
    await page.check('#fracoes-lazer-list > div:nth-child(1) input[type="checkbox"]');
    await page.waitForTimeout(100);

    const isChecked = await page.$eval('#fracoes-lazer-list > div:nth-child(1) input[type="checkbox"]', el => el.checked);
    console.log(`Checkbox is checked: ${isChecked}`);
    if (!isChecked) {
      throw new Error("Checkbox state not set correctly.");
    }

    const saldoPill = await page.$eval('#balancePill', el => el.textContent);
    console.log(`Saldo pill value: ${saldoPill}`);

    // Wait for the plano button to be rendered
    const hasPlanoBtn = await page.$$eval('#nav-plano', els => els.length > 0);
    console.log(`Plano button present: ${hasPlanoBtn}`);
    if (!hasPlanoBtn) {
      throw new Error("Plano button not found.");
    }

    console.log("All tests passed.");
  } catch(e) {
    console.error("Test failed: ", e);
    process.exit(1);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
