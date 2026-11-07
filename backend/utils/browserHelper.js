const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

let browserInstance = null;

async function getBrowser() {
    if (!browserInstance || !browserInstance.isConnected()) {
        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-default-apps',
                '--no-first-run',
                '--memory-pressure-off',
                '--js-flags=--max-old-space-size=256',
                '--window-size=1280,720'
            ]
        });
    }
    return browserInstance;
}

async function waitForCloudflare(page, maxWaitMs = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        const title = await page.title();
        const isChallenge =
            title.includes('Bir dakika') ||
            title.includes('Just a moment') ||
            title.includes('Checking') ||
            title.includes('Attention Required');

        if (!isChallenge) return true;
        await new Promise(r => setTimeout(r, 2000));
    }
    return false;
}

async function getPageHtml(url, timeout = 18000) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1280, height: 720 });

        await page.setExtraHTTPHeaders({
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        });

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            const url = req.url();
            if (
                ['image', 'stylesheet', 'font', 'media', 'ping'].includes(type) ||
                url.includes('google-analytics') ||
                url.includes('googletagmanager') ||
                url.includes('facebook.net') ||
                url.includes('doubleclick')
            ) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

        const passed = await waitForCloudflare(page, 10000);
        if (!passed) {
            console.log(`   ⚠️ Cloudflare challenge aşılamadı: ${url}`);
        }

        await new Promise(r => setTimeout(r, 500));
        return await page.content();
    } finally {
        await page.close();
    }
}

async function closeBrowser() {
    if (browserInstance && browserInstance.isConnected()) {
        await browserInstance.close();
        browserInstance = null;
    }
}

module.exports = { getPageHtml, closeBrowser };
