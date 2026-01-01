/**
 * 浏览器控制器
 */
import { connect } from 'puppeteer-real-browser';
import { BrowserConfig } from '../types';
import { logger } from '../utils/logger';
import { RenewalError, ErrorType } from '../types';

// 使用 any 避免类型冲突（puppeteer-real-browser 的类型与 puppeteer 不兼容）
type Browser = any;
type Page = any;

/**
 * 等待指定毫秒数
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 生成随机数（在指定范围内）
 */
const random = (min: number, max: number) => Math.random() * (max - min) + min;

/**
 * 使用 Bézier 曲线模拟真实的鼠标移动
 * 导出此函数供其他模块（如 RenewalExecutor）使用
 * @param page Puppeteer Page 实例
 * @param startX 起始 X 坐标
 * @param startY 起始 Y 坐标
 * @param endX 结束 X 坐标
 * @param endY 结束 Y 坐标
 * @param steps 移动步数（默认 20-50 之间随机）
 */
export async function smoothMouseMove(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps?: number
): Promise<void> {
  // 如果未指定步数，随机生成 20-50 之间的值
  const numSteps = steps ?? Math.floor(random(20, 50));

  // 生成 1-2 个控制点（二次或三次 Bézier 曲线）
  const controlPoints = [];
  const numControlPoints = Math.random() > 0.5 ? 1 : 2; // 随机选择二次或三次曲线

  for (let i = 0; i < numControlPoints; i++) {
    // 控制点在起点和终点之间，但带有随机偏移
    const t = (i + 1) / (numControlPoints + 1);
    const cpX = startX + (endX - startX) * t + random(-100, 100);
    const cpY = startY + (endY - startY) * t + random(-100, 100);
    controlPoints.push({ x: cpX, y: cpY });
  }

  // 沿着 Bézier 曲线移动鼠标
  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;

    let x: number, y: number;

    if (controlPoints.length === 1) {
      // 二次 Bézier 曲线
      const cp = controlPoints[0];
      x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cp.x + t * t * endX;
      y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * cp.y + t * t * endY;
    } else {
      // 三次 Bézier 曲线
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

    // 添加微小的随机抖动（模拟手部震颤）
    const jitterX = random(-1, 1);
    const jitterY = random(-1, 1);

    await page.mouse.move(x + jitterX, y + jitterY);
    await delay(random(5, 15)); // 每步之间随机延迟 5-15ms
  }
}

export class BrowserController {
  private browser: Browser | null = null;
  private currentPage: Page | null = null;
  private config: BrowserConfig;
  private readonly DEFAULT_DOH_URL = 'https://doh.pub/dns-query';

  constructor(config: BrowserConfig) {
    this.config = config;
  }

  /**
   * 生成 DoH (DNS over HTTPS) 参数
   * 使用 Chrome fieldtrial 方式配置
   */
  private getDoHArgs(): string[] {
    const dohUrl = this.config.dohUrl || this.DEFAULT_DOH_URL;
    const encodedUrl = encodeURIComponent(dohUrl);

    return [
      '--enable-features=DnsOverHttps',
      '--force-fieldtrials=DoHTrial/Group1',
      `--force-fieldtrial-params=DoHTrial.Group1:Templates/${encodedUrl}/Fallback/true`
    ];
  }

  /**
   * 启动浏览器
   */
  async launch(): Promise<void> {
    try {
      logger.info('BrowserController', '正在启动浏览器...');

      // 使用 puppeteer-real-browser 的 connect API
      const { browser, page } = await connect({
        headless: this.config.headless ?? false,
        turnstile: true, // 自动处理 Cloudflare Turnstile
        args: [
          // 窗口和视口设置
          '--window-size=1920,1080',
          '--start-maximized',
          '--window-position=0,0',

          // 沙箱和安全设置 (必需)
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',

          // 反检测 - 核心参数
          '--disable-blink-features=AutomationControlled',

          // GPU 和硬件加速
          '--enable-gpu',
          '--enable-webgl',
          '--enable-webgl2-compute-context',
          '--enable-gpu-rasterization',
          '--enable-zero-copy',
          '--ignore-gpu-blocklist',

          // 性能优化参数
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',

          // 反检测辅助参数
          '--disable-infobars',
          '--no-first-run',
          '--no-default-browser-check',

          // DNS over HTTPS (DoH) 配置
          ...this.getDoHArgs(),
        ],
        customConfig: {
          // userDataDir 在这里设置
          userDataDir: this.config.userDataDir,
          // executablePath 需要通过 chromePath 设置
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
      logger.info('BrowserController', `浏览器启动成功 (DoH: ${dohUrl})`);

      // 配置页面
      await this.configurePage(page);
    } catch (error) {
      logger.error('BrowserController', '浏览器启动失败', error);
      throw new RenewalError(
        ErrorType.BROWSER_ERROR,
        `浏览器启动失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 配置页面（仅在 launch() 时调用一次）
   */
  private async configurePage(page: Page): Promise<void> {
    try {
      // 添加控制台日志监听
      page.on('console', (msg: any) => {
        const type = msg.type();
        const text = msg.text();

        if (type === 'error') {
          logger.error('BrowserConsole', text, new Error(text));
        } else if (type === 'warn') {
          logger.warn('BrowserConsole', text);
        } else if (type === 'log' || type === 'info' || type === 'debug') {
          if (text.match(/Turnstile|Cloudflare|challenge|captcha|turnstile/i)) {
            logger.info('BrowserConsole', text);
          }
        }
      });

      // 监听页面错误
      page.on('pageerror', (error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('PageError', err.message, err);
      });

      // 监听请求失败
      page.on('requestfailed', (request: any) => {
        const failure = request.failure();
        const url = request.url();
        if (failure && url.includes('challenges.cloudflare.com')) {
          logger.error('RequestFailed', `${url} - ${failure.errorText}`);
        }
      });

      // 设置超时
      page.setDefaultTimeout(this.config.timeout ?? 30000);
      page.setDefaultNavigationTimeout(this.config.timeout ?? 30000);

      // 设置时区和语言
      await this.configureLocale(page);

      logger.info('BrowserController', '页面配置完成');
    } catch (error) {
      logger.error('BrowserController', '配置页面失败', error);
      throw error;
    }
  }

  /**
   * 获取或创建页面
   * 注意: puppeteer-real-browser 在 connect() 时已经创建了第一个页面
   */
  async newPage(): Promise<Page> {
    if (!this.browser) {
      throw new RenewalError(
        ErrorType.BROWSER_ERROR,
        '浏览器未启动,请先调用 launch() 方法'
      );
    }

    // 如果已经有页面（在 launch() 时创建的），直接返回
    if (this.currentPage) {
      logger.info('BrowserController', '返回已创建的页面');
      return this.currentPage;
    }

    // 否则创建新页面
    try {
      const page = await this.browser.newPage();

      // 配置页面
      await this.configurePage(page);

      this.currentPage = page;
      logger.info('BrowserController', '新页面创建成功');

      return page;
    } catch (error) {
      logger.error('BrowserController', '创建页面失败', error);
      throw new RenewalError(
        ErrorType.BROWSER_ERROR,
        `创建页面失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 配置时区和语言
   */
  private async configureLocale(page: Page): Promise<void> {
    try {
      // 设置时区为中国时区
      await page.emulateTimezone('Asia/Shanghai');

      // 设置 Accept-Language 头
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      });

      logger.debug('BrowserController', '已配置时区和语言设置');
    } catch (error) {
      logger.warn('BrowserController', '配置时区失败', error);
    }
  }

  /**
   * 获取当前页面
   */
  getCurrentPage(): Page {
    if (!this.currentPage) {
      throw new RenewalError(
        ErrorType.BROWSER_ERROR,
        '当前没有活动页面,请先调用 newPage() 方法'
      );
    }
    return this.currentPage;
  }

  /**
   * 导航到指定 URL
   */
  async navigate(url: string): Promise<void> {
    const page = this.getCurrentPage();

    try {
      logger.info('BrowserController', `正在导航到: ${url}`);

      await page.goto(url, {
        waitUntil: this.config.waitUntil ?? 'networkidle0',
        timeout: this.config.timeout ?? 30000,
      });

      logger.info('BrowserController', '页面加载完成');
    } catch (error) {
      logger.error('BrowserController', '页面导航失败', error);
      throw new RenewalError(
        ErrorType.NETWORK_ERROR,
        `页面导航失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 等待 Cloudflare 验证完成
   */
  async waitForCloudflareVerification(): Promise<void> {
    const page = this.getCurrentPage();

    try {
      logger.info('BrowserController', '等待 Cloudflare 验证完成...');

      // 检测是否有 Cloudflare 验证
      const cloudflareInfo = await page.evaluate(() => {
        const turnstileContainer = document.querySelector('#turnstile-container');
        const sitekeyElement = document.querySelector('[data-sitekey]');
        const hasChallengeUrl = window.location.href.includes('challenge-platform');

        // 检查 Turnstile iframe
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const turnstileIframe = iframes.find(iframe =>
          iframe.src && iframe.src.includes('challenges.cloudflare.com')
        );

        // 检查是否有错误信息
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

      logger.info('BrowserController', `Cloudflare 检测结果: ${JSON.stringify(cloudflareInfo, null, 2)}`);

      if (!cloudflareInfo.hasCloudflare) {
        logger.info('BrowserController', '未检测到 Cloudflare 验证');
        return;
      }

      // 如果有错误,记录并抛出异常
      if (cloudflareInfo.errors && cloudflareInfo.errors.length > 0) {
        logger.error('BrowserController', `检测到页面错误: ${cloudflareInfo.errors.join(', ')}`);
      }

      // 等待 Turnstile 验证完成 - 改进版：监听 Turnstile 回调
      // Turnstile 成功后会填充 input[name="cf-turnstile-response"]，且值长度 > 500
      await page.waitForFunction(
        () => {
          // 检查 Turnstile response input 是否已填充
          const turnstileInput = document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement;
          if (turnstileInput && turnstileInput.value && turnstileInput.value.length > 500) {
            // 成功的 Turnstile token 长度通常 > 500 字符
            return true;
          }

          // 检查是否有可见的错误消息
          const errorElements = document.querySelectorAll('[class*="error"], [role="alert"]');
          for (const el of Array.from(errorElements)) {
            const text = el.textContent || '';
            if (text.includes('Error') || text.includes('错误') || text.includes('failed')) {
              // 发现错误，不应该继续等待
              return false;
            }
          }

          // 检查容器是否消失（备选条件）
          const container = document.querySelector('#turnstile-container');
          const sitekey = document.querySelector('[data-sitekey]');
          const hasChallengeUrl = window.location.href.includes('challenge-platform');

          // 如果都没有了，说明验证已完成
          if (!container && !sitekey && !hasChallengeUrl) {
            return true;
          }

          return false;
        },
        {
          timeout: 60000, // 最多等待 60 秒（Turnstile 通常在 20-30 秒内完成）
          polling: 200,   // 每 200ms 检查一次
        }
      );

      logger.info('BrowserController', 'Cloudflare 验证完成');
    } catch (error) {
      logger.error('BrowserController', '等待 Cloudflare 验证超时', error);
      throw new RenewalError(
        ErrorType.VERIFY_ERROR,
        `Cloudflare 验证超时: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 诊断浏览器环境 - 检查关键的浏览器指纹
   */
  async diagnoseEnvironment(): Promise<void> {
    const page = this.getCurrentPage();

    try {
      logger.info('BrowserController', '正在诊断浏览器环境...');

      const diagnostics = await page.evaluate(() => {
        // 检查 navigator.webdriver
        const webdriver = (navigator as any).webdriver;

        // 检查 WebGPU 支持
        // const hasWebGPU = !!(navigator as any).gpu;

        // 检查 WebGL 支持
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
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

        // 检查 Canvas 支持
        const ctx2d = canvas.getContext('2d');
        const hasCanvas2D = !!ctx2d;

        // 检查 plugins
        const plugins = Array.from(navigator.plugins).map(p => p.name);

        // 检查 languages
        const languages = navigator.languages;

        // 检查 platform
        const platform = navigator.platform;

        // 检查 hardwareConcurrency
        const hardwareConcurrency = navigator.hardwareConcurrency;

        // 检查 deviceMemory
        const deviceMemory = (navigator as any).deviceMemory;

        // 检查 connection
        const connection = (navigator as any).connection;

        // 检查 chrome 对象
        const hasChrome = !!(window as any).chrome;

        // 检查 permissions
        const hasPermissions = !!navigator.permissions;

        return {
          webdriver,
          // hasWebGPU,
          hasWebGL,
          webGLVendor,
          webGLRenderer,
          hasCanvas2D,
          pluginsCount: plugins.length,
          plugins: plugins.slice(0, 3), // 只返回前3个
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
          userAgent: navigator.userAgent.substring(0, 50) + '...', // 截断
        };
      });

      logger.info('BrowserController', `浏览器环境诊断结果:\n${JSON.stringify(diagnostics, null, 2)}`);

      // 检查是否有问题
      const issues: string[] = [];
      if (diagnostics.webdriver === true) {
        issues.push('❌ navigator.webdriver = true (应该为 false)');
      } else {
        logger.info('BrowserController', '✅ navigator.webdriver = false');
      }

      // if (!diagnostics.hasWebGPU) {
      //   issues.push('⚠️  WebGPU 不可用 (已启用伪造)');
      // } else {
      //   logger.info('BrowserController', '✅ WebGPU 可用');
      // }

      if (!diagnostics.hasWebGL) {
        issues.push('❌ WebGL 不可用');
      } else {
        logger.info('BrowserController', '✅ WebGL 可用');
      }

      if (!diagnostics.hasChrome) {
        issues.push('❌ window.chrome 不存在');
      } else {
        logger.info('BrowserController', '✅ window.chrome 存在');
      }

      if (issues.length > 0) {
        logger.warn('BrowserController', `发现环境问题:\n${issues.join('\n')}`);
      } else {
        logger.info('BrowserController', '✅ 浏览器环境检查通过');
      }
    } catch (error) {
      logger.error('BrowserController', '环境诊断失败', error);
    }
  }

  /**
   * 截图
   */
  async screenshot(filePath?: string): Promise<Buffer | Uint8Array> {
    const page = this.getCurrentPage();

    try {
      if (filePath) {
        await page.screenshot({ path: filePath, fullPage: true });
        logger.info('BrowserController', `截图已保存到: ${filePath}`);
        return Buffer.from('');
      }

      const screenshot = await page.screenshot({ fullPage: true });
      logger.info('BrowserController', '截图成功');
      return screenshot;
    } catch (error) {
      logger.error('BrowserController', '截图失败', error);
      throw new RenewalError(
        ErrorType.BROWSER_ERROR,
        `截图失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取页面 HTML
   */
  async getHtml(): Promise<string> {
    const page = this.getCurrentPage();
    return await page.content();
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.currentPage = null;
        logger.info('BrowserController', '浏览器已关闭');
      }
    } catch (error) {
      logger.error('BrowserController', '关闭浏览器失败', error);
    }
  }
}
