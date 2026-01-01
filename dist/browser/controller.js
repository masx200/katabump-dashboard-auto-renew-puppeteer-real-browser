"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserController = void 0;
exports.smoothMouseMove = smoothMouseMove;
const puppeteer_real_browser_1 = require("puppeteer-real-browser");
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const random = (min, max) => Math.random() * (max - min) + min;
async function smoothMouseMove(page, startX, startY, endX, endY, steps) {
    const numSteps = steps ?? Math.floor(random(20, 50));
    const controlPoints = [];
    const numControlPoints = Math.random() > 0.5 ? 1 : 2;
    for (let i = 0; i < numControlPoints; i++) {
        const t = (i + 1) / (numControlPoints + 1);
        const cpX = startX + (endX - startX) * t + random(-100, 100);
        const cpY = startY + (endY - startY) * t + random(-100, 100);
        controlPoints.push({ x: cpX, y: cpY });
    }
    for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        let x, y;
        if (controlPoints.length === 1) {
            const cp = controlPoints[0];
            x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cp.x + t * t * endX;
            y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * cp.y + t * t * endY;
        }
        else {
            const cp1 = controlPoints[0];
            const cp2 = controlPoints[1];
            x =
                (1 - t) * (1 - t) * (1 - t) * startX +
                    3 * (1 - t) * (1 - t) * t * cp1.x +
                    3 * (1 - t) * t * t * cp2.x +
                    t * t * t * endX;
            y =
                (1 - t) * (1 - t) * (1 - t) * startY +
                    3 * (1 - t) * (1 - t) * t * cp1.y +
                    3 * (1 - t) * t * t * cp2.y +
                    t * t * t * endY;
        }
        const jitterX = random(-1, 1);
        const jitterY = random(-1, 1);
        await page.mouse.move(x + jitterX, y + jitterY);
        await delay(random(5, 15));
    }
}
class BrowserController {
    constructor(config) {
        this.browser = null;
        this.currentPage = null;
        this.DEFAULT_DOH_URL = 'https://doh.pub/dns-query';
        this.config = config;
    }
    getDoHArgs() {
        const dohUrl = this.config.dohUrl || this.DEFAULT_DOH_URL;
        const encodedUrl = encodeURIComponent(dohUrl);
        return [
            '--enable-features=DnsOverHttps',
            '--force-fieldtrials=DoHTrial/Group1',
            `--force-fieldtrial-params=DoHTrial.Group1:Templates/${encodedUrl}/Fallback/true`
        ];
    }
    async launch() {
        try {
            logger_1.logger.info('BrowserController', '正在启动浏览器...');
            const { browser, page } = await (0, puppeteer_real_browser_1.connect)({
                headless: this.config.headless ?? false,
                turnstile: true,
                args: [
                    '--window-size=1920,1080',
                    '--start-maximized',
                    '--window-position=0,0',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--enable-gpu',
                    '--enable-webgl',
                    '--enable-webgl2-compute-context',
                    '--enable-gpu-rasterization',
                    '--enable-zero-copy',
                    '--ignore-gpu-blocklist',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-infobars',
                    '--no-first-run',
                    '--no-default-browser-check',
                    ...this.getDoHArgs(),
                ],
                customConfig: {
                    userDataDir: this.config.userDataDir,
                    chromePath: this.config.executablePath,
                },
                connectOption: {
                    defaultViewport: {
                        width: this.config.windowWidth ?? 1920,
                        height: this.config.windowHeight ?? 1080,
                    },
                },
            });
            this.browser = browser;
            this.currentPage = page;
            const dohUrl = this.config.dohUrl || this.DEFAULT_DOH_URL;
            logger_1.logger.info('BrowserController', `浏览器启动成功 (DoH: ${dohUrl})`);
            await this.configurePage(page);
        }
        catch (error) {
            logger_1.logger.error('BrowserController', '浏览器启动失败', error);
            throw new types_1.RenewalError(types_1.ErrorType.BROWSER_ERROR, `浏览器启动失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async configurePage(page) {
        try {
            page.on('console', (msg) => {
                const type = msg.type();
                const text = msg.text();
                if (type === 'error') {
                    logger_1.logger.error('BrowserConsole', text, new Error(text));
                }
                else if (type === 'warn') {
                    logger_1.logger.warn('BrowserConsole', text);
                }
                else if (type === 'log' || type === 'info' || type === 'debug') {
                    if (text.match(/Turnstile|Cloudflare|challenge|captcha|turnstile/i)) {
                        logger_1.logger.info('BrowserConsole', text);
                    }
                }
            });
            page.on('pageerror', (error) => {
                const err = error instanceof Error ? error : new Error(String(error));
                logger_1.logger.error('PageError', err.message, err);
            });
            page.on('requestfailed', (request) => {
                const failure = request.failure();
                const url = request.url();
                if (failure && url.includes('challenges.cloudflare.com')) {
                    logger_1.logger.error('RequestFailed', `${url} - ${failure.errorText}`);
                }
            });
            page.setDefaultTimeout(this.config.timeout ?? 30000);
            page.setDefaultNavigationTimeout(this.config.timeout ?? 30000);
            await this.configureLocale(page);
            logger_1.logger.info('BrowserController', '页面配置完成');
        }
        catch (error) {
            logger_1.logger.error('BrowserController', '配置页面失败', error);
            throw error;
        }
    }
    async newPage() {
        if (!this.browser) {
            throw new types_1.RenewalError(types_1.ErrorType.BROWSER_ERROR, '浏览器未启动,请先调用 launch() 方法');
        }
        if (this.currentPage) {
            logger_1.logger.info('BrowserController', '返回已创建的页面');
            return this.currentPage;
        }
        try {
            const page = await this.browser.newPage();
            await this.configurePage(page);
            this.currentPage = page;
            logger_1.logger.info('BrowserController', '新页面创建成功');
            return page;
        }
        catch (error) {
            logger_1.logger.error('BrowserController', '创建页面失败', error);
            throw new types_1.RenewalError(types_1.ErrorType.BROWSER_ERROR, `创建页面失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async configureLocale(page) {
        try {
            await page.emulateTimezone('Asia/Shanghai');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
            });
            logger_1.logger.debug('BrowserController', '已配置时区和语言设置');
        }
        catch (error) {
            logger_1.logger.warn('BrowserController', '配置时区失败', error);
        }
    }
    getCurrentPage() {
        if (!this.currentPage) {
            throw new types_1.RenewalError(types_1.ErrorType.BROWSER_ERROR, '当前没有活动页面,请先调用 newPage() 方法');
        }
        return this.currentPage;
    }
    async navigate(url) {
        const page = this.getCurrentPage();
        try {
            logger_1.logger.info('BrowserController', `正在导航到: ${url}`);
            await page.goto(url, {
                waitUntil: this.config.waitUntil ?? 'networkidle0',
                timeout: this.config.timeout ?? 30000,
            });
            logger_1.logger.info('BrowserController', '页面加载完成');
        }
        catch (error) {
            logger_1.logger.error('BrowserController', '页面导航失败', error);
            throw new types_1.RenewalError(types_1.ErrorType.NETWORK_ERROR, `页面导航失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async waitForCloudflareVerification() {
        const page = this.getCurrentPage();
        try {
            logger_1.logger.info('BrowserController', '等待 Cloudflare 验证完成...');
            const cloudflareInfo = await page.evaluate(() => {
                const turnstileContainer = document.querySelector('#turnstile-container');
                const sitekeyElement = document.querySelector('[data-sitekey]');
                const hasChallengeUrl = window.location.href.includes('challenge-platform');
                const iframes = Array.from(document.querySelectorAll('iframe'));
                const turnstileIframe = iframes.find(iframe => iframe.src && iframe.src.includes('challenges.cloudflare.com'));
                const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
                const errors = Array.from(errorElements).map(el => el.textContent).filter(Boolean);
                return {
                    hasCloudflare: !!(turnstileContainer || sitekeyElement || hasChallengeUrl || turnstileIframe),
                    hasTurnstileContainer: !!turnstileContainer,
                    hasSitekeyElement: !!sitekeyElement,
                    hasChallengeUrl: hasChallengeUrl,
                    hasTurnstileIframe: !!turnstileIframe,
                    turnstileIframeSrc: turnstileIframe?.src || null,
                    errors: errors,
                    url: window.location.href,
                };
            });
            logger_1.logger.info('BrowserController', `Cloudflare 检测结果: ${JSON.stringify(cloudflareInfo, null, 2)}`);
            if (!cloudflareInfo.hasCloudflare) {
                logger_1.logger.info('BrowserController', '未检测到 Cloudflare 验证');
                return;
            }
            if (cloudflareInfo.errors && cloudflareInfo.errors.length > 0) {
                logger_1.logger.error('BrowserController', `检测到页面错误: ${cloudflareInfo.errors.join(', ')}`);
            }
            await page.waitForFunction(() => {
                const turnstileInput = document.querySelector('[name="cf-turnstile-response"]');
                if (turnstileInput && turnstileInput.value && turnstileInput.value.length > 500) {
                    return true;
                }
                const errorElements = document.querySelectorAll('[class*="error"], [role="alert"]');
                for (const el of Array.from(errorElements)) {
                    const text = el.textContent || '';
                    if (text.includes('Error') || text.includes('错误') || text.includes('failed')) {
                        return false;
                    }
                }
                const container = document.querySelector('#turnstile-container');
                const sitekey = document.querySelector('[data-sitekey]');
                const hasChallengeUrl = window.location.href.includes('challenge-platform');
                if (!container && !sitekey && !hasChallengeUrl) {
                    return true;
                }
                return false;
            }, {
                timeout: 60000,
                polling: 200,
            });
            logger_1.logger.info('BrowserController', 'Cloudflare 验证完成');
        }
        catch (error) {
            logger_1.logger.error('BrowserController', '等待 Cloudflare 验证超时', error);
            throw new types_1.RenewalError(types_1.ErrorType.VERIFY_ERROR, `Cloudflare 验证超时: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async diagnoseEnvironment() {
        const page = this.getCurrentPage();
        try {
            logger_1.logger.info('BrowserController', '正在诊断浏览器环境...');
            const diagnostics = await page.evaluate(() => {
                const webdriver = navigator.webdriver;
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                const hasWebGL = !!gl;
                let webGLVendor = null;
                let webGLRenderer = null;
                if (gl) {
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (debugInfo) {
                        webGLVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                        webGLRenderer = gl.getContextAttributes();
                    }
                }
                const ctx2d = canvas.getContext('2d');
                const hasCanvas2D = !!ctx2d;
                const plugins = Array.from(navigator.plugins).map(p => p.name);
                const languages = navigator.languages;
                const platform = navigator.platform;
                const hardwareConcurrency = navigator.hardwareConcurrency;
                const deviceMemory = navigator.deviceMemory;
                const connection = navigator.connection;
                const hasChrome = !!window.chrome;
                const hasPermissions = !!navigator.permissions;
                return {
                    webdriver,
                    hasWebGL,
                    webGLVendor,
                    webGLRenderer,
                    hasCanvas2D,
                    pluginsCount: plugins.length,
                    plugins: plugins.slice(0, 3),
                    languages,
                    platform,
                    hardwareConcurrency,
                    deviceMemory,
                    connection: connection ? {
                        effectiveType: connection.effectiveType,
                        rtt: connection.rtt,
                        downlink: connection.downlink,
                    } : null,
                    hasChrome,
                    hasPermissions,
                    userAgent: navigator.userAgent.substring(0, 50) + '...',
                };
            });
            logger_1.logger.info('BrowserController', `浏览器环境诊断结果:\n${JSON.stringify(diagnostics, null, 2)}`);
            const issues = [];
            if (diagnostics.webdriver === true) {
                issues.push('❌ navigator.webdriver = true (应该为 false)');
            }
            else {
                logger_1.logger.info('BrowserController', '✅ navigator.webdriver = false');
            }
            if (!diagnostics.hasWebGL) {
                issues.push('❌ WebGL 不可用');
            }
            else {
                logger_1.logger.info('BrowserController', '✅ WebGL 可用');
            }
            if (!diagnostics.hasChrome) {
                issues.push('❌ window.chrome 不存在');
            }
            else {
                logger_1.logger.info('BrowserController', '✅ window.chrome 存在');
            }
            if (issues.length > 0) {
                logger_1.logger.warn('BrowserController', `发现环境问题:\n${issues.join('\n')}`);
            }
            else {
                logger_1.logger.info('BrowserController', '✅ 浏览器环境检查通过');
            }
        }
        catch (error) {
            logger_1.logger.error('BrowserController', '环境诊断失败', error);
        }
    }
    async screenshot(filePath) {
        const page = this.getCurrentPage();
        try {
            if (filePath) {
                await page.screenshot({ path: filePath, fullPage: true });
                logger_1.logger.info('BrowserController', `截图已保存到: ${filePath}`);
                return Buffer.from('');
            }
            const screenshot = await page.screenshot({ fullPage: true });
            logger_1.logger.info('BrowserController', '截图成功');
            return screenshot;
        }
        catch (error) {
            logger_1.logger.error('BrowserController', '截图失败', error);
            throw new types_1.RenewalError(types_1.ErrorType.BROWSER_ERROR, `截图失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async getHtml() {
        const page = this.getCurrentPage();
        return await page.content();
    }
    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.currentPage = null;
                logger_1.logger.info('BrowserController', '浏览器已关闭');
            }
        }
        catch (error) {
            logger_1.logger.error('BrowserController', '关闭浏览器失败', error);
        }
    }
}
exports.BrowserController = BrowserController;
//# sourceMappingURL=controller.js.map