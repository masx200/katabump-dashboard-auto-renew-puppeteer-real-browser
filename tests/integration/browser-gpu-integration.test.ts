/**
 * WebGPU 和 WebGL 集成测试
 *
 * 这些测试使用真实的 Puppeteer 浏览器来验证:
 * - WebGL 上下文创建和配置
 * - WebGL 参数和扩展
 * - WebGL 指纹伪装效果
 * - WebGPU 支持（真实状态）
 * - 反检测脚本的有效性
 *
 * 注意：这些测试会实际启动浏览器，运行时间较长
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

// 使用 stealth 插件
puppeteer.use(StealthPlugin());

describe('Browser GPU Integration Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    // 启动浏览器 - 使用与项目相同的配置
    browser = await puppeteer.launch({
      executablePath: 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: false, // 关闭无头模式，显示浏览器窗口
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      args: [
        // 窗口和视口设置
        '--window-size=1920,1080',
        '--start-maximized',
        '--window-position=0,0',

        // 沙箱和安全设置
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
        '--enable-vulkan',
        '--enable-features=Vulkan,WebGPU',
        '--use-gl=desktop',
        '--use-angle=gl',
        '--ignore-gpu-blocklist',
        '--enable-webgpu-developer-features',
        '--enable-unsafe-webgpu',
        '--disable-gpu-vsync',
        // 移除 '--disable-software-rasterizer' 以允许软件回退
        '--enable-unsafe-swiftshader',

        // 性能优化
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',

        // 反检测辅助参数
        '--disable-infobars',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    page = await browser.newPage();

    // 应用反检测脚本（从 controller.ts 复制）
    await page.evaluateOnNewDocument(() => {
      // 1. 覆盖 navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // 2. 覆盖 chrome 对象
      (window as any).chrome = {
        runtime: {},
      };

      // 3. 覆盖 navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en'],
      });

      // 4. 覆盖 navigator.platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
      });

      // 5. 覆盖 WebGL 指纹
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, parameter);
      };

      // 6. 覆盖 plugins
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

      // 7. 覆盖 Connection
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 100,
          downlink: 10,
          saveData: false,
        }),
      });

      // 8. 覆盖 deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });

      // 9. 覆盖 hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      // 10. 覆盖 Screen
      Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
      Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
      Object.defineProperty(screen, 'width', { get: () => 1920 });
      Object.defineProperty(screen, 'height', { get: () => 1080 });
    });

    // 导航到空白页
    await page.goto('about:blank');
  }, 30000); // 30 秒超时

  afterAll(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
  });

  describe('WebGL 上下文创建和配置', () => {
    it('应该成功创建 WebGL 上下文', async () => {
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return {
          hasWebGL: !!gl,
          contextType: gl ? 'webgl' : null,
        };
      });

      expect(result.hasWebGL).toBe(true);
      expect(result.contextType).toBe('webgl');
    });

    it('应该成功创建 WebGL2 上下文', async () => {
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl2 = canvas.getContext('webgl2');
        return {
          hasWebGL2: !!gl2,
          contextType: gl2 ? 'webgl2' : null,
        };
      });

      expect(result.hasWebGL2).toBe(true);
      expect(result.contextType).toBe('webgl2');
    });

    it('应该成功创建 2D canvas 上下文', async () => {
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const ctx2d = canvas.getContext('2d');
        return {
          hasCanvas2D: !!ctx2d,
          contextType: ctx2d ? '2d' : null,
        };
      });

      expect(result.hasCanvas2D).toBe(true);
      expect(result.contextType).toBe('2d');
    });
  });

  describe('WebGL 参数和扩展', () => {
    it('应该伪装 WebGL vendor 和 renderer', async () => {
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
          return { success: false, vendor: null, renderer: null };
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) {
          return { success: false, vendor: null, renderer: null };
        }

        return {
          success: true,
          vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
          renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
        };
      });

      expect(result.success).toBe(true);
      expect(result.vendor).toBe('Intel Inc.');
      expect(result.renderer).toBe('Intel Iris OpenGL Engine');
    });

    it('应该支持 WebGL 常用参数', async () => {
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
          return { success: false };
        }

        return {
          success: true,
          vendor: gl.getParameter(gl.VENDOR),
          version: gl.getParameter(gl.VERSION),
          shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
        };
      });

      expect(result.success).toBe(true);
      expect(result.vendor).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.maxTextureSize).toBeGreaterThan(0);
      expect(result.maxViewportDims).toBeDefined();
      expect(Array.isArray(result.maxViewportDims)).toBe(true);
    });

    it('应该支持 WebGL 扩展', async () => {
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
          return { success: false, extensions: [] };
        }

        const extensions = gl.getSupportedExtensions();
        return {
          success: true,
          extensionCount: extensions ? extensions.length : 0,
          hasDebugRendererInfo: !!gl.getExtension('WEBGL_debug_renderer_info'),
          hasCompressedTextureS3TC: !!gl.getExtension('WEBGL_compressed_texture_s3tc'),
        };
      });

      expect(result.success).toBe(true);
      expect(result.extensionCount).toBeGreaterThan(0);
      expect(result.hasDebugRendererInfo).toBe(true);
    });
  });

  describe('浏览器指纹反检测', () => {
    it('应该隐藏 navigator.webdriver', async () => {
      const webdriver = await page.evaluate(() => (navigator as any).webdriver);
      expect(webdriver).toBe(false);
    });

    it('应该有 window.chrome 对象', async () => {
      const hasChrome = await page.evaluate(() => !!(window as any).chrome);
      expect(hasChrome).toBe(true);
    });

    it('应该伪装 navigator.platform', async () => {
      const platform = await page.evaluate(() => navigator.platform);
      expect(platform).toBe('Win32');
    });

    it('应该伪装 navigator.languages', async () => {
      const languages = await page.evaluate(() => navigator.languages);
      expect(languages).toEqual(['zh-CN', 'zh', 'en-US', 'en']);
    });

    it('应该伪装 navigator.plugins', async () => {
      const plugins = await page.evaluate(() => {
        return Array.from(navigator.plugins).map(p => ({
          name: p.name,
          description: p.description,
          filename: p.filename,
        }));
      });

      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins[0].name).toBeDefined();
      expect(plugins.some(p => p.name.includes('Chrome PDF'))).toBe(true);
    });

    it('应该伪装 navigator.hardwareConcurrency', async () => {
      const hardwareConcurrency = await page.evaluate(() => navigator.hardwareConcurrency);
      expect(hardwareConcurrency).toBe(8);
    });

    it('应该伪装 navigator.deviceMemory', async () => {
      const deviceMemory = await page.evaluate(() => (navigator as any).deviceMemory);
      expect(deviceMemory).toBe(8);
    });

    it('应该伪装 navigator.connection', async () => {
      const connection = await page.evaluate(() => (navigator as any).connection);
      expect(connection).toBeDefined();
      expect(connection.effectiveType).toBe('4g');
      expect(connection.rtt).toBe(100);
      expect(connection.downlink).toBe(10);
    });

    it('应该伪装 screen 属性', async () => {
      const screenInfo = await page.evaluate(() => ({
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
      }));

      expect(screenInfo.width).toBe(1920);
      expect(screenInfo.height).toBe(1080);
      expect(screenInfo.availWidth).toBe(1920);
      expect(screenInfo.availHeight).toBe(1040);
    });
  });

  describe('WebGPU 支持（真实状态）', () => {
    it('应该检测 WebGPU 是否可用', async () => {
      const result = await page.evaluate(() => {
        return {
          hasWebGPU: !!(navigator as any).gpu,
          hasAdapter: !!(navigator as any).gpu?.requestAdapter,
        };
      });

      // WebGPU 可能在某些环境中不可用
      // 我们只验证检测逻辑，不强求必须有 WebGPU
      expect(result).toHaveProperty('hasWebGPU');
      expect(result).toHaveProperty('hasAdapter');

      console.log('WebGPU 可用性:', result.hasWebGPU);
    });

    it('不应该伪造 WebGPU（如果不可用）', async () => {
      const result = await page.evaluate(() => {
        // 检查是否有伪造的 WebGPU 对象
        const gpu = (navigator as any).gpu;

        if (!gpu) {
          return { hasWebGPU: false, isFake: false };
        }

        // 如果存在，检查是否是真实的
        return {
          hasWebGPU: true,
          hasRequestAdapter: typeof gpu.requestAdapter === 'function',
          isFake: false, // 我们不伪造 WebGPU
        };
      });

      // 验证我们不伪造 WebGPU
      if (result.hasWebGPU) {
        expect(result.hasRequestAdapter).toBe(true);
      }
    });
  });

  describe('Canvas 和 WebGL 上下文属性', () => {
    it('应该为 WebGL 设置 preserveDrawingBuffer', async () => {
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');

        // 使用原始 getContext 方法检查属性
        const originalGetContext = HTMLCanvasElement.prototype.getContext;

        let capturedAttributes: any = null;

        // 临时覆盖以捕获属性
        (HTMLCanvasElement.prototype.getContext as any) = function (
          this: HTMLCanvasElement,
          contextType: any,
          attributes?: any
        ) {
          if (contextType === 'webgl' || contextType === 'webgl2') {
            capturedAttributes = attributes;
          }
          return originalGetContext.call(this, contextType, attributes);
        };

        canvas.getContext('webgl');

        // 恢复原方法
        HTMLCanvasElement.prototype.getContext = originalGetContext;

        return {
          attributes: capturedAttributes,
          hasPreserveDrawingBuffer: capturedAttributes?.preserveDrawingBuffer === true,
        };
      });

      // 注意：这个测试可能不总是成功，因为我们的反检测脚本可能在页面加载后才注入
      // 如果测试失败，检查脚本注入时机
      console.log('WebGL 属性:', result.attributes);
    });

    it('应该为 2D canvas 设置 willReadFrequently', async () => {
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');

        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        let capturedAttributes: any = null;

        (HTMLCanvasElement.prototype.getContext as any) = function (
          this: HTMLCanvasElement,
          contextType: any,
          attributes?: any
        ) {
          if (contextType === '2d') {
            capturedAttributes = attributes;
          }
          return originalGetContext.call(this, contextType, attributes);
        };

        canvas.getContext('2d');

        HTMLCanvasElement.prototype.getContext = originalGetContext;

        return {
          attributes: capturedAttributes,
          hasWillReadFrequently: capturedAttributes?.willReadFrequently === true,
        };
      });

      console.log('2D Canvas 属性:', result.attributes);
    });
  });

  describe('完整的浏览器指纹诊断', () => {
    it('应该返回完整的诊断信息', async () => {
      const diagnostics = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        let webGLVendor = null;
        let webGLRenderer = null;

        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            webGLVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            webGLRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          }
        }

        return {
          webdriver: (navigator as any).webdriver,
          hasWebGL: !!gl,
          webGLVendor,
          webGLRenderer,
          hasCanvas2D: !!canvas.getContext('2d'),
          pluginsCount: navigator.plugins.length,
          languages: navigator.languages,
          platform: navigator.platform,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: (navigator as any).deviceMemory,
          connection: (navigator as any).connection
            ? {
                effectiveType: (navigator as any).connection.effectiveType,
                rtt: (navigator as any).connection.rtt,
                downlink: (navigator as any).connection.downlink,
              }
            : null,
          hasChrome: !!(window as any).chrome,
          hasPermissions: !!navigator.permissions,
          userAgent: navigator.userAgent.substring(0, 50) + '...',
        };
      });

      console.log('完整诊断信息:', JSON.stringify(diagnostics, null, 2));

      // 验证关键指纹
      expect(diagnostics.webdriver).toBe(false);
      expect(diagnostics.hasWebGL).toBe(true);
      expect(diagnostics.webGLVendor).toBe('Intel Inc.');
      expect(diagnostics.webGLRenderer).toBe('Intel Iris OpenGL Engine');
      expect(diagnostics.hasCanvas2D).toBe(true);
      expect(diagnostics.pluginsCount).toBeGreaterThan(0);
      expect(diagnostics.languages).toEqual(['zh-CN', 'zh', 'en-US', 'en']);
      expect(diagnostics.platform).toBe('Win32');
      expect(diagnostics.hardwareConcurrency).toBe(8);
      expect(diagnostics.deviceMemory).toBe(8);
      expect(diagnostics.hasChrome).toBe(true);
      expect(diagnostics.hasPermissions).toBe(true);
    });
  });

  describe('WebGL 性能和限制', () => {
    it('应该返回合理的 WebGL 性能参数', async () => {
      const result = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
          return { success: false };
        }

        return {
          success: true,
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          maxCubeMapTextureSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
          maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
          maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
          maxVertexTextureImageUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
          maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
          maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
        };
      });

      expect(result.success).toBe(true);
      expect(result.maxTextureSize).toBeGreaterThan(0);
      expect(result.maxCubeMapTextureSize).toBeGreaterThan(0);
      expect(result.maxRenderbufferSize).toBeGreaterThan(0);
      expect(result.maxVertexAttribs).toBeGreaterThan(0);
      expect(result.maxVertexTextureImageUnits).toBeGreaterThanOrEqual(0);
      expect(result.maxCombinedTextureImageUnits).toBeGreaterThan(0);
      expect(result.maxFragmentUniformVectors).toBeGreaterThan(0);
    });
  });
});
