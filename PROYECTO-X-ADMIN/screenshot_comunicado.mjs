import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 2 });

const filePath = 'file:///' + path.join(__dirname, 'comunicado_nova_digital_card.html').replace(/\\/g, '/');
await page.goto(filePath, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));

const element = await page.$('.card');
await element.screenshot({ path: path.join(__dirname, 'comunicado_nova_digital_card.png') });

await browser.close();
console.log('Screenshot guardado: comunicado_nova_digital_card.png');
