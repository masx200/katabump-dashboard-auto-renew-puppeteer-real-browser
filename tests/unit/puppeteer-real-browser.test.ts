import { describe, it, expect, beforeAll } from 'vitest';
import { connect } from 'puppeteer-real-browser';
import path from 'path';

/**
 * Puppeteer Real Browser Integration Tests
 *
 * Tests the puppeteer-real-browser library's ability to:
 * 1. Navigate to Cloudflare-protected websites
 * 2. Automatically handle Cloudflare Turnstile CAPTCHA
 * 3. Access page content after verification
 */
describe('Puppeteer Real Browser - Cloudflare Tests', () => {
  const screenshotsDir = path.join(process.cwd(), 'screenshots', 'real-browser');

  beforeAll(async () => {
    // Ensure screenshots directory exists
    const fs = await import('fs/promises');
    try {
      await fs.mkdir(screenshots, { recursive: true });
    } catch (error) {
      // Directory may already exist
    }
  });

  it('should navigate to www.scrapingcourse.com and handle Cloudflare verification', async () => {
    const { browser, page } = await connect({
      headless: false, // false is most stable according to docs
      turnstile: true, // Auto-click Cloudflare Turnstile
      args: ['--start-maximized'],
      connectOption: {
        defaultViewport: null,
      },
    });

    try {
      console.log('Navigating to https://www.scrapingcourse.com/cloudflare-challenge...');
      await page.goto('https://www.scrapingcourse.com/cloudflare-challenge', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      // Wait for page to load completely
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Take screenshot after initial load
      const screenshot1 = path.join(screenshotsDir, 'ip-skk-moe-initial.png');
      await page.screenshot({ path: screenshot1, fullPage: true });
      console.log(`Screenshot saved: ${screenshot1}`);

      // Wait additional time for Cloudflare verification to complete
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Get page title and URL
      const title = await page.title();
      const url = page.url();
      console.log('Page title:', title);
      console.log('Current URL:', url);

      // Take final screenshot
      const screenshot2 = path.join(screenshotsDir, 'ip-skk-moe-final.png');
      await page.screenshot({ path: screenshot2, fullPage: true });
      console.log(`Screenshot saved: ${screenshot2}`);

      // Get page text content for verification
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('Page text length:', pageText.length);

      // Verify we can access the page content
      expect(pageText.length).toBeGreaterThan(0);
      expect(title).toBeDefined();
      expect(url).toContain('www.scrapingcourse.com');

      // Check if Cloudflare is still present (should be resolved by now)
      const hasCloudflareElements = await page.evaluate(() => {
        const cloudflareSelectors = [
          'iframe[src*="challenges.cloudflare.com"]',
          'div[class*="cf-"]',
          'div[id*="cf-"]',
        ];
        return cloudflareSelectors.some(selector =>
          document.querySelector(selector)
        );
      });

      console.log('Cloudflare elements still present:', hasCloudflareElements);
      await delay(150000)
    } catch (e) {

      console.error(e)
      await delay(150000)
      throw e
    } finally {
      await browser.close();
      console.log('Browser closed');
    }
  }, 120000); // 2 minute timeout

  it('should access www.scrapingcourse.com with custom configuration', async () => {
    const { browser, page } = await connect({
      headless: false,
      turnstile: true,
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
      ],
      customConfig: {
        // Can add userDataDir here for persistence
        // userDataDir: path.join(process.cwd(), '.chromium-data'),
      },
      connectOption: {
        defaultViewport: null,
      },
    });

    try {
      console.log('Navigating with custom config...');
      await page.goto('https://www.scrapingcourse.com/cloudflare-challenge', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for Cloudflare verification
      console.log('Waiting for Cloudflare verification...');
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Take screenshot
      const screenshotPath = path.join(screenshotsDir, 'ip-skk-moe-custom-config.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);

      // Check if we can see IP information
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('Page text preview:', pageText.substring(0, 200));

      // Verify page loaded successfully
      expect(pageText).toBeDefined();

      // Look for IP-related content
      const hasIPInfo = /(\d{1,3}\.){3}\d{1,3}|IP|address/i.test(pageText);
      console.log('IP information found:', hasIPInfo);
      await delay(150000)
    } catch (e) {

      console.error(e)
      await delay(150000)
       throw e
    } finally {
      await browser.close();
    }
  }, 120000);

  it('should handle multiple navigation attempts to same site', async () => {
    const { browser, page } = await connect({
      headless: false,
      turnstile: true,
      connectOption: {
        defaultViewport: null,
      },
    });

    try {
      // First navigation
      console.log('First navigation...');
      await page.goto('https://www.scrapingcourse.com/cloudflare-challenge', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });
      await new Promise(resolve => setTimeout(resolve, 10000));

      const screenshot1 = path.join(screenshotsDir, 'ip-skk-moe-nav-1.png');
      await page.screenshot({ path: screenshot1 });
      console.log(`Screenshot saved: ${screenshot1}`);

      // Second navigation (should be faster with cached verification)
      console.log('Second navigation...');
      await page.goto('https://www.scrapingcourse.com/cloudflare-challenge', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });
      await new Promise(resolve => setTimeout(resolve, 5000));

      const screenshot2 = path.join(screenshotsDir, 'ip-skk-moe-nav-2.png');
      await page.screenshot({ path: screenshot2 });
      console.log(`Screenshot saved: ${screenshot2}`);

      // Verify both navigations succeeded
      const title = await page.title();
      expect(title).toBeDefined();
      await delay(150000)
    } catch (e) {

      console.error(e)
      await delay(150000)
       throw e
    } finally {
      await browser.close();
    }
  }, 150000);
});
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));