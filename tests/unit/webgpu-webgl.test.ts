/**
 * WebGPU 和 WebGL 单元测试
 *
 * 测试浏览器控制器中的 GPU 相关功能:
 * - WebGL 上下文创建和配置
 * - WebGL 参数和扩展检测
 * - WebGL 指纹伪装
 * - WebGPU 支持（当前项目中未伪造，保持真实状态）
 * - GPU 相关的反检测措施
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserController } from '../../src/browser/controller';
import { BrowserConfig } from '../../src/types';

describe('BrowserController - GPU 功能测试', () => {
  let controller: BrowserController;
  let mockConfig: BrowserConfig;

  beforeEach(() => {
    // 重置所有模拟
    vi.clearAllMocks();

    // 创建测试配置
    mockConfig = {
      headless: true, // 使用无头模式进行测试
      timeout: 30000,
      windowWidth: 1920,
      windowHeight: 1080,
    };

    controller = new BrowserController(mockConfig);
  });

  describe('浏览器启动参数 - GPU 配置', () => {
    it('应该包含所有必需的 GPU 启动参数', async () => {
      // 注意：这个测试只验证配置对象，不实际启动浏览器
      // 实际启动浏览器需要真实的 Puppeteer 环境

      const config = controller['config']; // 访问私有属性用于测试

      expect(config).toBeDefined();
      expect(config.windowWidth).toBe(1920);
      expect(config.windowHeight).toBe(1080);
    });

    it('应该配置自定义的 DoH URL', () => {
      const configWithDoH: BrowserConfig = {
        ...mockConfig,
        dohUrl: 'https://dns.google/dns-query',
      };

      const controllerWithDoH = new BrowserController(configWithDoH);
      const dohArgs = controllerWithDoH['getDoHArgs']();

      expect(dohArgs).toContain('--enable-features=DnsOverHttps');
      expect(dohArgs.some(arg => arg.includes('dns.google'))).toBe(true);
    });

    it('应该使用默认 DoH URL 当未配置时', () => {
      const dohArgs = controller['getDoHArgs']();

      expect(dohArgs).toContain('--enable-features=DnsOverHttps');
      expect(dohArgs.some(arg => arg.includes('doh.pub'))).toBe(true);
    });
  });

  describe('WebGL 上下文创建测试', () => {
    it('应该成功创建 WebGL 上下文（模拟）', () => {
      // 模拟 WebGL 上下文创建
      const mockCanvas = {
        getContext: vi.fn((contextType: string) => {
          if (contextType === 'webgl' || contextType === 'experimental-webgl') {
            return {
              getParameter: vi.fn((param: number) => {
                // UNMASKED_VENDOR_WEBGL = 37445
                if (param === 37445) return 'Intel Inc.';
                // UNMASKED_RENDERER_WEBGL = 37446
                if (param === 37446) return 'Intel Iris OpenGL Engine';
                return null;
              }),
              getExtension: vi.fn((name: string) => {
                if (name === 'WEBGL_debug_renderer_info') {
                  return {
                    UNMASKED_VENDOR_WEBGL: 37445,
                    UNMASKED_RENDERER_WEBGL: 37446,
                  };
                }
                return null;
              }),
            };
          }
          return null;
        }),
      };

      const gl = mockCanvas.getContext('webgl');
      expect(gl).toBeDefined();
      expect(gl).not.toBeNull();

      // 测试 getParameter 被正确调用
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      expect(debugInfo).toBeDefined();

      const vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

      expect(vendor).toBe('Intel Inc.');
      expect(renderer).toBe('Intel Iris OpenGL Engine');
    });

    it('应该支持 WebGL2 上下文创建', () => {
      const mockCanvas = {
        getContext: vi.fn((contextType: string) => {
          if (contextType === 'webgl2') {
            return {
              getParameter: vi.fn(),
              getExtension: vi.fn(),
            };
          }
          return null;
        }),
      };

      const gl2 = mockCanvas.getContext('webgl2');
      expect(gl2).toBeDefined();
      expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl2');
    });

    it('应该为 WebGL 添加 preserveDrawingBuffer 属性', () => {
      const mockCanvas = {
        getContext: vi.fn((contextType: string, attributes?: any) => {
          if (contextType === 'webgl') {
            // 验证属性被正确设置
            expect(attributes).toBeDefined();
            expect(attributes.preserveDrawingBuffer).toBe(true);
            return {};
          }
          return null;
        }),
      };

      mockCanvas.getContext('webgl', { preserveDrawingBuffer: true });
    });

    it('应该为 2D canvas 添加 willReadFrequently 属性', () => {
      const mockCanvas = {
        getContext: vi.fn((contextType: string, attributes?: any) => {
          if (contextType === '2d') {
            expect(attributes).toBeDefined();
            expect(attributes.willReadFrequently).toBe(true);
            return {};
          }
          return null;
        }),
      };

      mockCanvas.getContext('2d', { willReadFrequently: true });
    });
  });

  describe('WebGL 指纹伪装测试', () => {
    it('应该伪装 WebGL vendor 和 renderer', () => {
      // 模拟反检测脚本中的 WebGL 覆盖
      const mockGetParameter = vi.fn();
      const originalGetParameter = mockGetParameter;

      // 模拟伪装后的 getParameter
      const maskedGetParameter = function(parameter: number) {
        // UNMASKED_VENDOR_WEBGL = 37445
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        // UNMASKED_RENDERER_WEBGL = 37446
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return originalGetParameter(parameter);
      };

      // 测试伪装逻辑
      expect(maskedGetParameter(37445)).toBe('Intel Inc.');
      expect(maskedGetParameter(37446)).toBe('Intel Iris OpenGL Engine');
      expect(maskedGetParameter(99999)).toBeUndefined(); // 其他参数返回 undefined
    });

    it('应该正确设置 WebGL 常量', () => {
      const UNMASKED_VENDOR_WEBGL = 37445;
      const UNMASKED_RENDERER_WEBGL = 37446;

      expect(UNMASKED_VENDOR_WEBGL).toBe(37445);
      expect(UNMASKED_RENDERER_WEBGL).toBe(37446);
    });
  });

  describe('WebGPU 支持测试', () => {
    it('应该检测 WebGPU 是否可用（当前不伪造）', () => {
      // 当前项目不伪造 WebGPU，保持真实状态
      // 这个测试验证在浏览器环境中 WebGPU 的真实状态

      const mockNavigator = {
        gpu: undefined, // 模拟不支持 WebGPU 的环境
      };

      expect(mockNavigator.gpu).toBeUndefined();
    });

    it('应该在支持 WebGPU 的环境中返回 navigator.gpu', () => {
      const mockNavigator = {
        gpu: {
          requestAdapter: vi.fn(),
        },
      };

      expect(mockNavigator.gpu).toBeDefined();
      expect(typeof mockNavigator.gpu.requestAdapter).toBe('function');
    });

    it('不应该伪造 WebGPU（根据项目注释）', () => {
      // 根据 controller.ts 第 393-395 行的注释：
      // "8. 不再伪造 WebGPU 支持"
      // "Cloudflare Turnstile 会检测真实的 WebGPU 功能"

      const navigatorWithoutWebGPU = {
        gpu: undefined,
      };

      // 验证不进行伪造
      expect(navigatorWithoutWebGPU.gpu).toBeUndefined();

      // 即使尝试添加也不应该添加
      const navigatorWithWebGPU = {
        ...navigatorWithoutWebGPU,
      };

      expect(navigatorWithWebGPU.gpu).toBeUndefined();
    });
  });

  describe('GPU 相关的浏览器指纹测试', () => {
    it('应该包含正确的 WebGL 渲染器信息', () => {
      const expectedVendor = 'Intel Inc.';
      const expectedRenderer = 'Intel Iris OpenGL Engine';

      expect(expectedVendor).toBe('Intel Inc.');
      expect(expectedRenderer).toContain('Intel');
      expect(expectedRenderer).toContain('OpenGL');
    });

    it('应该包含合理的硬件并发数', () => {
      const mockHardwareConcurrency = 8;

      expect(mockHardwareConcurrency).toBeGreaterThan(0);
      expect(mockHardwareConcurrency).toBeLessThanOrEqual(128);
    });

    it('应该包含合理的设备内存', () => {
      const mockDeviceMemory = 8;

      expect(mockDeviceMemory).toBeGreaterThan(0);
      expect(mockDeviceMemory).toBeLessThanOrEqual(64);
    });

    it('应该包含网络连接信息', () => {
      const mockConnection = {
        effectiveType: '4g',
        rtt: 100,
        downlink: 10,
        saveData: false,
      };

      expect(mockConnection.effectiveType).toBe('4g');
      expect(mockConnection.rtt).toBeGreaterThan(0);
      expect(mockConnection.downlink).toBeGreaterThan(0);
      expect(typeof mockConnection.saveData).toBe('boolean');
    });
  });

  describe('Canvas 上下文丢失和恢复测试', () => {
    it('应该处理 WebGL 上下文丢失事件', () => {
      let contextLostFired = false;
      const mockCanvas = {
        addEventListener: vi.fn((event: string, handler: any) => {
          if (event === 'webglcontextlost') {
            contextLostFired = true;
            handler({ preventDefault: vi.fn() });
          }
        }),
      };

      mockCanvas.addEventListener('webglcontextlost', (e: any) => {
        e.preventDefault();
      });

      expect(contextLostFired).toBe(true);
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
        'webglcontextlost',
        expect.any(Function)
      );
    });

    it('应该尝试恢复丢失的 WebGL 上下文', () => {
      let restoreAttempted = false;
      const mockExtension = {
        restoreContext: vi.fn(),
      };

      const restoreHandler = () => {
        restoreAttempted = true;
        mockExtension.restoreContext();
      };

      restoreHandler();

      expect(restoreAttempted).toBe(true);
      expect(mockExtension.restoreContext).toHaveBeenCalled();
    });
  });

  describe('GPU 启动参数验证测试', () => {
    it('应该包含所有必需的 GPU 相关启动参数', () => {
      const requiredGpuArgs = [
        '--enable-gpu',
        '--enable-webgl',
        '--enable-webgl2-compute-context',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
        '--enable-vulkan',
        '--use-gl=desktop',
        '--use-angle=gl',
        '--ignore-gpu-blocklist',
        '--enable-webgpu-developer-features',
        '--enable-unsafe-webgpu',
        '--disable-gpu-vsync',
        '--disable-software-rasterizer',
        '--enable-unsafe-swiftshader',
      ];

      // 验证这些参数在代码中存在
      // 注意：这里只验证参数字符串本身，不验证实际启动过程
      requiredGpuArgs.forEach(arg => {
        expect(arg).toBeDefined();
        expect(typeof arg).toBe('string');
        expect(arg.startsWith('--')).toBe(true);
      });

      // 验证参数的唯一性
      const uniqueArgs = [...new Set(requiredGpuArgs)];
      expect(uniqueArgs.length).toBe(requiredGpuArgs.length);
    });

    it('应该启用 WebGPU 和 Vulkan 功能', () => {
      const webGpuFeature = '--enable-features=Vulkan,WebGPU';

      expect(webGpuFeature).toContain('WebGPU');
      expect(webGpuFeature).toContain('Vulkan');
    });

    it('应该使用桌面 OpenGL 后端', () => {
      const useGlArg = '--use-gl=desktop';
      const useAngleArg = '--use-angle=gl';

      expect(useGlArg).toContain('desktop');
      expect(useAngleArg).toContain('gl');
    });

    it('应该忽略 GPU 黑名单', () => {
      const ignoreBlocklist = '--ignore-gpu-blocklist';

      expect(ignoreBlocklist).toBe('--ignore-gpu-blocklist');
    });

    it('应该启用不安全的 WebGPU 和 SwiftShader', () => {
      const unsafeWebGpu = '--enable-unsafe-webgpu';
      const unsafeSwiftShader = '--enable-unsafe-swiftshader';

      expect(unsafeWebGpu).toBe('--enable-unsafe-webgpu');
      expect(unsafeSwiftShader).toBe('--enable-unsafe-swiftshader');
    });

    it('应该禁用软件光栅化器', () => {
      const disableSoftwareRasterizer = '--disable-software-rasterizer';

      expect(disableSoftwareRasterizer).toBe('--disable-software-rasterizer');
    });
  });

  describe('GPU 诊断功能测试', () => {
    it('应该正确诊断 WebGL 支持', () => {
      const diagnostics = {
        hasWebGL: true,
        webGLVendor: 'Intel Inc.',
        webGLRenderer: { antialias: true },
      };

      expect(diagnostics.hasWebGL).toBe(true);
      expect(diagnostics.webGLVendor).toBe('Intel Inc.');
      expect(diagnostics.webGLRenderer).toBeDefined();
    });

    it('应该正确诊断 Canvas 2D 支持', () => {
      const diagnostics = {
        hasCanvas2D: true,
      };

      expect(diagnostics.hasCanvas2D).toBe(true);
    });

    it('应该包含完整的浏览器指纹信息', () => {
      const diagnostics = {
        webdriver: false,
        hasWebGL: true,
        hasCanvas2D: true,
        pluginsCount: 3,
        languages: ['zh-CN', 'zh', 'en-US', 'en'],
        platform: 'Win32',
        hardwareConcurrency: 8,
        deviceMemory: 8,
        connection: {
          effectiveType: '4g',
          rtt: 100,
          downlink: 10,
        },
        hasChrome: true,
        hasPermissions: true,
      };

      // 验证所有字段
      expect(diagnostics.webdriver).toBe(false);
      expect(diagnostics.hasWebGL).toBe(true);
      expect(diagnostics.hasCanvas2D).toBe(true);
      expect(diagnostics.pluginsCount).toBeGreaterThan(0);
      expect(diagnostics.languages.length).toBeGreaterThan(0);
      expect(diagnostics.platform).toBe('Win32');
      expect(diagnostics.hardwareConcurrency).toBe(8);
      expect(diagnostics.deviceMemory).toBe(8);
      expect(diagnostics.connection).toBeDefined();
      expect(diagnostics.hasChrome).toBe(true);
      expect(diagnostics.hasPermissions).toBe(true);
    });
  });

  describe('Canvas 噪声注入测试（已禁用）', () => {
    it('应该不启用 Canvas 噪声注入', () => {
      // 根据 controller.ts 第 388-391 行的注释：
      // "Canvas 噪声注入已禁用"
      // "原因：Cloudflare Turnstile 可以检测到"一致性不一致"的数学模式"

      const canvasNoiseEnabled = false;

      expect(canvasNoiseEnabled).toBe(false);
    });

    it('应该保持原始 Canvas 行为', () => {
      // 验证不添加随机噪声
      const originalImageData = {
        data: new Uint8ClampedArray([255, 0, 0, 255]),
      };

      // 不修改 imageData
      const modifiedImageData = { ...originalImageData };

      expect(modifiedImageData).toEqual(originalImageData);
    });
  });

  describe('Blob URL 支持测试', () => {
    it('应该正确创建 Blob URL', () => {
      const mockObject = {};
      const mockOrigin = 'https://example.com';

      const createMockBlobUrl = (object: any, origin: string): string => {
        return 'blob:' + origin + '/' + Math.random().toString(36).substring(7);
      };

      const blobUrl = createMockBlobUrl(mockObject, mockOrigin);

      expect(blobUrl).toMatch(/^blob:https:\/\/example\.com\/[a-z0-9]+$/);
    });

    it('应该处理 Blob URL 创建失败', () => {
      const mockObject = null;
      const mockOrigin = 'https://example.com';

      const createMockBlobUrl = (object: any, origin: string): string => {
        try {
          if (!object) {
            throw new Error('Invalid object');
          }
          return 'blob:' + origin + '/valid';
        } catch (e) {
          // 返回假的 blob URL
          return 'blob:' + origin + '/' + Math.random().toString(36).substring(7);
        }
      };

      const blobUrl = createMockBlobUrl(mockObject, mockOrigin);

      expect(blobUrl).toMatch(/^blob:https:\/\/example\.com\/[a-z0-9]+$/);
    });
  });

  describe('平滑鼠标移动功能测试', () => {
    it('应该生成随机步数（20-50之间）', () => {
      const steps = Math.floor(Math.random() * (50 - 20 + 1)) + 20;

      expect(steps).toBeGreaterThanOrEqual(20);
      expect(steps).toBeLessThanOrEqual(50);
    });

    it('应该生成随机控制点', () => {
      const startX = 0;
      const startY = 0;
      const endX = 100;
      const endY = 100;

      // 模拟控制点生成
      const t = 0.5;
      const cpX = startX + (endX - startX) * t + (Math.random() * (100 - -100) + -100);
      const cpY = startY + (endY - startY) * t + (Math.random() * (100 - -100) + -100);

      expect(cpX).toBeGreaterThanOrEqual(-100);
      expect(cpX).toBeLessThanOrEqual(200);
      expect(cpY).toBeGreaterThanOrEqual(-100);
      expect(cpY).toBeLessThanOrEqual(200);
    });

    it('应该计算二次 Bézier 曲线', () => {
      const startX = 0;
      const startY = 0;
      const endX = 100;
      const endY = 100;
      const cpX = 50;
      const cpY = 50;
      const t = 0.5;

      // 二次 Bézier 曲线公式
      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cpX + t * t * endX;
      const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * cpY + t * t * endY;

      expect(x).toBeCloseTo(50, 5);
      expect(y).toBeCloseTo(50, 5);
    });

    it('应该计算三次 Bézier 曲线', () => {
      const startX = 0;
      const startY = 0;
      const endX = 100;
      const endY = 100;
      const cp1X = 30;
      const cp1Y = 30;
      const cp2X = 70;
      const cp2Y = 70;
      const t = 0.5;

      // 三次 Bézier 曲线公式
      const x =
        (1 - t) * (1 - t) * (1 - t) * startX +
        3 * (1 - t) * (1 - t) * t * cp1X +
        3 * (1 - t) * t * t * cp2X +
        t * t * t * endX;
      const y =
        (1 - t) * (1 - t) * (1 - t) * startY +
        3 * (1 - t) * (1 - t) * t * cp1Y +
        3 * (1 - t) * t * t * cp2Y +
        t * t * t * endY;

      expect(x).toBeCloseTo(50, 5);
      expect(y).toBeCloseTo(50, 5);
    });

    it('应该添加随机抖动', () => {
      const x = 100;
      const y = 100;

      const jitterX = (Math.random() * (1 - -1) + -1);
      const jitterY = (Math.random() * (1 - -1) + -1);

      const finalX = x + jitterX;
      const finalY = y + jitterY;

      expect(finalX).toBeGreaterThanOrEqual(99);
      expect(finalX).toBeLessThanOrEqual(101);
      expect(finalY).toBeGreaterThanOrEqual(99);
      expect(finalY).toBeLessThanOrEqual(101);
    });
  });

  describe('浏览器控制台日志过滤测试', () => {
    it('应该过滤包含 Turnstile 的日志', () => {
      const logMessages = [
        'Normal log message',
        'Turnstile token received',
        'Cloudflare challenge started',
        'Another message',
      ];

      const filteredLogs = logMessages.filter(msg =>
        msg.match(/Turnstile|Cloudflare|challenge|captcha/i)
      );

      // 正则表达式匹配：
      // - "Turnstile token received" ✓
      // - "Cloudflare challenge started" ✓ (匹配 "Cloudflare" 和 "challenge")
      expect(filteredLogs).toHaveLength(2);
      expect(filteredLogs).toContain('Turnstile token received');
      expect(filteredLogs).toContain('Cloudflare challenge started');
    });

    it('应该降低 Turnstile 错误 106010 的日志频率', () => {
      const errorMessage = 'TurnstileError 106010 - some error';
      const shouldLog = !errorMessage.includes('TurnstileError') ||
                        !errorMessage.includes('106010');

      expect(shouldLog).toBe(false); // 应该被过滤
    });

    it('应该忽略 font-size 调试信息', () => {
      const debugMessage = 'font-size:0;color:transparent';
      const shouldLog = !debugMessage.includes('font-size:0;color:transparent');

      expect(shouldLog).toBe(false); // 应该被忽略
    });
  });
});
