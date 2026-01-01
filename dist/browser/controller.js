"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserController = void 0;
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
            const launchOptions = {
                defaultViewport: {
                    width: 1920,
                    height: 1080,
                },
                headless: this.config.headless ?? true,
                args: [
                    '--window-size=1920,1080',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-extensions-except=/dev/null',
                    '--disable-extensions',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-background-networking',
                    '--disable-breakpad',
                    '--disable-component-update',
                    '--disable-default-apps',
                    '--disable-domain-reliability',
                    '--disable-sync',
                    '--disable-features=site-per-process',
                    '--disable-hang-monitor',
                    '--disable-ipc-flooding-protection',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-infobars',
                    '--window-position=0,0',
                    '--hide-scrollbars',
                    '--mute-audio',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-features=Translate',
                    '--disable-features=media-router',
                    '--disable-features=CalculateNativeWinOcclusion',
                    '--disable-features=InterestFeedContentSuggestions',
                    '--enable-webgl',
                    '--enable-webgl2-compute-context',
                    '--enable-gpu-rasterization',
                    '--enable-zero-copy',
                    '--use-gl=desktop',
                    '--use-angle=gl',
                    '--ignore-gpu-blocklist',
                    ...this.getDoHArgs(),
                ],
            };
            if (this.config.executablePath) {
                launchOptions.executablePath = this.config.executablePath;
            }
            if (this.config.userDataDir) {
                launchOptions.userDataDir = this.config.userDataDir;
                logger_1.logger.info('BrowserController', `使用用户数据目录: ${this.config.userDataDir}`);
            }
            this.browser = await puppeteer_extra_1.default.launch(launchOptions);
            const dohUrl = this.config.dohUrl || this.DEFAULT_DOH_URL;
            logger_1.logger.info('BrowserController', `浏览器启动成功 (DoH: ${dohUrl})`);
        }
        catch (error) {
            logger_1.logger.error('BrowserController', '浏览器启动失败', error);
            throw new types_1.RenewalError(types_1.ErrorType.BROWSER_ERROR, `浏览器启动失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async newPage() {
        if (!this.browser) {
            throw new types_1.RenewalError(types_1.ErrorType.BROWSER_ERROR, '浏览器未启动,请先调用 launch() 方法');
        }
        try {
            const page = await this.browser.newPage();
            page.on('console', (msg) => {
                const type = msg.type();
                const text = msg.text();
                if (type === 'error') {
                    logger_1.logger.error('BrowserConsole', text, new Error(text));
                    msg.args().forEach(arg => {
                        arg.jsonValue().then((val) => {
                            if (val && val.stack) {
                                logger_1.logger.error('BrowserConsoleStack', val.stack);
                            }
                        }).catch(() => { });
                    });
                }
                else if (type === 'warn') {
                    logger_1.logger.warn('BrowserConsole', text);
                }
                else if (type === 'log' || type === 'info' || type === 'debug') {
                    if (text.match(/Turnstile|Cloudflare|WebGPU|challenge|captcha|turnstile/i)) {
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
            await page.setViewport({
                width: this.config.windowWidth ?? 1920,
                height: this.config.windowHeight ?? 1080,
            });
            if (this.config.userAgent) {
                await page.setUserAgent(this.config.userAgent);
            }
            page.setDefaultTimeout(this.config.timeout ?? 30000);
            page.setDefaultNavigationTimeout(this.config.timeout ?? 30000);
            await this.applyAntiDetectionScripts(page);
            await this.configureLocale(page);
            this.currentPage = page;
            logger_1.logger.info('BrowserController', '新页面创建成功 (已应用反检测脚本)');
            await this.diagnoseEnvironment();
            return page;
        }
        catch (error) {
            logger_1.logger.error('BrowserController', '创建页面失败', error);
            throw new types_1.RenewalError(types_1.ErrorType.BROWSER_ERROR, `创建页面失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async applyAntiDetectionScripts(page) {
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
            window.chrome = {
                runtime: {},
            };
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters);
            Object.defineProperty(navigator, 'languages', {
                get: () => ['zh-CN', 'zh', 'en-US', 'en'],
            });
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32',
            });
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter.call(this, parameter);
            };
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (contextType, attributes) {
                if (contextType === '2d') {
                    attributes = attributes || {};
                    attributes.willReadFrequently = true;
                }
                if (contextType === 'webgl' || contextType === 'webgl2') {
                    attributes = attributes || {};
                    attributes.preserveDrawingBuffer = true;
                }
                try {
                    const ctx = originalGetContext.call(this, contextType, attributes);
                    if (ctx && (contextType === 'webgl' || contextType === 'webgl2')) {
                        const canvas = this;
                        canvas.addEventListener('webglcontextlost', (e) => {
                            e.preventDefault();
                            console.warn('WebGL context lost, attempting restoration...');
                            setTimeout(() => {
                                const restoreCtx = originalGetContext.call(canvas, contextType, attributes);
                                if (restoreCtx) {
                                    const extension = restoreCtx.getExtension('WEBGL_lose_context');
                                    if (extension) {
                                        extension.restoreContext();
                                    }
                                }
                            }, 100);
                        }, false);
                    }
                    return ctx;
                }
                catch (e) {
                    return null;
                }
            };
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function (type) {
                const context = this.getContext('2d');
                if (context) {
                    const imageData = context.getImageData(0, 0, this.width, this.height);
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        if (Math.random() < 0.001) {
                            imageData.data[i + 3] = imageData.data[i + 3] ^ 1;
                        }
                    }
                    context.putImageData(imageData, 0, 0);
                }
                return originalToDataURL.apply(this, [type]);
            };
            if (!navigator.gpu) {
                navigator.gpu = {
                    requestAdapter: async () => ({
                        requestAdapter: async () => null,
                        requestDevice: async () => ({
                            features: [],
                            limits: {},
                            destroy: () => { },
                            queue: {
                                submit: () => { },
                                onSubmittedWorkDone: async () => { },
                            },
                        }),
                    }),
                };
            }
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {
                        0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                        description: 'Portable Document Format',
                        filename: 'internal-pdf-viewer',
                        length: 1,
                        name: 'Chrome PDF Plugin',
                    },
                    {
                        0: { type: 'application/pdf', suffixes: 'pdf', description: '' },
                        description: '',
                        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                        length: 1,
                        name: 'Chrome PDF Viewer',
                    },
                    {
                        0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
                        1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
                        description: '',
                        filename: 'internal-nacl-plugin',
                        length: 2,
                        name: 'Native Client',
                    },
                ],
            });
            Object.defineProperty(navigator, 'connection', {
                get: () => ({
                    effectiveType: '4g',
                    rtt: 100,
                    downlink: 10,
                    saveData: false,
                }),
            });
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8,
            });
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 8,
            });
            delete navigator.__proto__.webdriver;
            const originalPermissionQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalPermissionQuery(parameters));
            Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
            Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
            Object.defineProperty(screen, 'width', { get: () => 1920 });
            Object.defineProperty(screen, 'height', { get: () => 1080 });
            Date.prototype.getTimezoneOffset = function () {
                return -480;
            };
            const originalDateTimeFormat = Intl.DateTimeFormat;
            Intl.DateTimeFormat = function (...args) {
                const instance = new originalDateTimeFormat(...args);
                const originalResolvedOptions = instance.resolvedOptions;
                instance.resolvedOptions = function () {
                    const options = originalResolvedOptions.call(this);
                    options.timeZone = 'Asia/Shanghai';
                    return options;
                };
                return instance;
            };
            const originalGetBBox = Element.prototype.getBoundingClientRect;
            Element.prototype.getBoundingClientRect = function () {
                if (!this.isConnected) {
                    return {
                        x: 0,
                        y: 0,
                        width: 0,
                        height: 0,
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        toJSON: () => ({}),
                    };
                }
                return originalGetBBox.call(this);
            };
            const originalQuerySelector = Element.prototype.querySelector;
            Element.prototype.querySelector = function (selectors) {
                try {
                    return originalQuerySelector.call(this, selectors);
                }
                catch (e) {
                    return null;
                }
            };
            const originalCreateObjectURL = URL.createObjectURL;
            URL.createObjectURL = function (object) {
                try {
                    return originalCreateObjectURL.call(this, object);
                }
                catch (e) {
                    return 'blob:' + window.location.origin + '/' + Math.random().toString(36).substring(7);
                }
            };
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function (type, listener, options) {
                try {
                    return originalAddEventListener.call(this, type, listener, options);
                }
                catch (e) {
                    return;
                }
            };
            const originalFetch = window.fetch;
            window.fetch = function (input, init) {
                const url = typeof input === 'string' ? input : input.url;
                if (url.includes('challenges.cloudflare.com')) {
                    console.log('[Fetch] Turnstile request:', url);
                }
                return originalFetch.call(this, input, init).then(response => {
                    if (response.status === 401 && url.includes('challenges.cloudflare.com')) {
                        console.warn('[Fetch] PAT challenge returned 401 for:', url);
                    }
                    return response;
                }).catch(error => {
                    if (url.includes('challenges.cloudflare.com')) {
                        console.error('[Fetch] Turnstile request failed:', url, error);
                    }
                    throw error;
                });
            };
            const originalError = console.error;
            console.error = function (...args) {
                const message = args[0];
                if (typeof message === 'string') {
                    if (message.includes('TurnstileError') && message.includes('106010')) {
                        return;
                    }
                    if (message.includes('font-size:0;color:transparent')) {
                        return;
                    }
                }
                originalError.apply(console, args);
            };
        });
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
                return (document.querySelector('#turnstile-container') === null &&
                    !document.querySelector('[data-sitekey]') &&
                    !window.location.href.includes('challenge-platform'));
            }, { timeout: 300000 });
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
                const hasWebGPU = !!navigator.gpu;
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
                    hasWebGPU,
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
            if (!diagnostics.hasWebGPU) {
                issues.push('⚠️  WebGPU 不可用 (已启用伪造)');
            }
            else {
                logger_1.logger.info('BrowserController', '✅ WebGPU 可用');
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