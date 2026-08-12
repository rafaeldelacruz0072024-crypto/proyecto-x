const { chromium } = require('playwright');

async function run() {
    try {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto('http://localhost:3001/login');

        await page.fill('input[type="email"]', 'admin@geminix.com');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');

        await page.waitForURL('**/dashboard', { timeout: 8000 });
        console.log('Logged in successfully!');

        page.on('dialog', async dialog => {
            console.log('Dialog msg:', dialog.message());
            await dialog.accept();
        });

        await page.click('text=Fix DB Comisiones Dobles');
        await page.waitForTimeout(3000);
        console.log('Click realizado, alert aceptado. Revisando logs...');

        await browser.close();
    } catch (err) {
        console.error("Playwright failed:", err);
        process.exit(1);
    }
}
run();
