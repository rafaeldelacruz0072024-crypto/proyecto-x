import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 1200, deviceScaleFactor: 2 });

const filePath = 'file:///' + path.join(__dirname, 'comunicado_bootcamp.html').replace(/\\/g, '/');
await page.goto(filePath, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2500));

const element = await page.$('.wrap');
await element.screenshot({ path: path.join(__dirname, 'comunicado_bootcamp.png') });
await browser.close();
console.log('Done: comunicado_bootcamp.png');
