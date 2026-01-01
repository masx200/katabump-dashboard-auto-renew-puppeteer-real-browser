/**
 * 真实的 WebGPU 和 WebGL 测试脚本
 *
 * 这个脚本会启动一个可见的浏览器窗口，访问真实的网页，
 * 并显示 WebGPU 和 WebGL 的详细信息。
 *
 * 运行方式:
 * npx ts-node scripts/test-webgpu-webgl-real.ts
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// 使用 stealth 插件
puppeteer.use(StealthPlugin());

async function testWebGL() {
  console.log('正在启动浏览器...');

  const browser = await puppeteer.launch({
    executablePath: 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false, // 显示浏览器窗口
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
    args: [
      '--window-size=1920,1080',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
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
    ],
  });

  const page = await browser.newPage();

  // 应用反检测脚本（必须在 setContent 之前）
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    (window as any).chrome = {
      runtime: {},
    };

    Object.defineProperty(navigator, 'languages', {
      get: () => ['zh-CN', 'zh', 'en-US', 'en'],
    });

    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });

    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });

    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });

    // WebGL 指纹伪装
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, parameter);
    };
  });

  // 访问一个 WebGL 测试页面
  console.log('正在访问 WebGL 测试页面...');

  // 创建一个包含 WebGL 测试代码的 HTML 页面
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>WebGL & WebGPU 测试</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          padding: 20px;
          background: #1e1e1e;
          color: #d4d4d4;
        }
        h1 {
          color: #4ec9b0;
        }
        h2 {
          color: #569cd6;
          margin-top: 30px;
        }
        .success {
          color: #4ec9b0;
          font-weight: bold;
        }
        .failure {
          color: #f48771;
          font-weight: bold;
        }
        .info {
          color: #dcdcaa;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        th, td {
          border: 1px solid #3e3e42;
          padding: 8px;
          text-align: left;
        }
        th {
          background: #252526;
        }
        canvas {
          border: 2px solid #3e3e42;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <h1>🎨 WebGL & WebGPU 测试页面</h1>

      <h2>WebGL 支持</h2>
      <div id="webgl-status">检测中...</div>

      <h2>WebGL 信息</h2>
      <table id="webgl-info">
        <tr><th>属性</th><th>值</th></tr>
      </table>

      <h2>WebGL Canvas</h2>
      <canvas id="webgl-canvas" width="400" height="300"></canvas>

      <h2>WebGPU 支持</h2>
      <div id="webgpu-status">检测中...</div>

      <h2>浏览器指纹</h2>
      <table id="fingerprint">
        <tr><th>属性</th><th>值</th></tr>
      </table>

      <script>
        // 测试 WebGL
        function testWebGL() {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

          const statusDiv = document.getElementById('webgl-status');
          const infoTable = document.getElementById('webgl-info');

          if (!gl) {
            statusDiv.innerHTML = '<span class="failure">❌ WebGL 不可用</span>';
            return;
          }

          statusDiv.innerHTML = '<span class="success">✅ WebGL 可用</span>';

          // 获取 WebGL 信息
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

          const info = [
            ['Vendor', gl.getParameter(gl.VENDOR)],
            ['Renderer', gl.getParameter(gl.RENDERER)],
            ['Version', gl.getParameter(gl.VERSION)],
            ['Shading Language Version', gl.getParameter(gl.SHADING_LANGUAGE_VERSION)],
            ['Unmasked Vendor', debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'N/A'],
            ['Unmasked Renderer', debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'N/A'],
            ['Max Texture Size', gl.getParameter(gl.MAX_TEXTURE_SIZE)],
            ['Max Viewport Dims', gl.getParameter(gl.MAX_VIEWPORT_DIMS).join(' x ')],
            ['Max Vertex Attribs', gl.getParameter(gl.MAX_VERTEX_ATTRIBS)],
            ['Max Vertex Texture Units', gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)],
            ['Max Combined Texture Units', gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)],
          ];

          info.forEach(([key, value]) => {
            const row = infoTable.insertRow();
            row.insertCell(0).textContent = key;
            row.insertCell(1).textContent = value;
          });
        }

        // 绘制 WebGL 内容
        function drawWebGL() {
          const canvas = document.getElementById('webgl-canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

          if (!gl) return;

          // 清空画布
          gl.clearColor(0.1, 0.1, 0.15, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);

          // 创建简单的着色器程序
          const vsSource = \`
            attribute vec4 aVertexPosition;
            void main() {
              gl_Position = aVertexPosition;
            }
          \`;

          const fsSource = \`
            void main() {
              gl_FragColor = vec4(0.3, 0.8, 0.9, 1.0);
            }
          \`;

          const vertexShader = gl.createShader(gl.VERTEX_SHADER);
          gl.shaderSource(vertexShader, vsSource);
          gl.compileShader(vertexShader);

          const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
          gl.shaderSource(fragmentShader, fsSource);
          gl.compileShader(fragmentShader);

          const shaderProgram = gl.createProgram();
          gl.attachShader(shaderProgram, vertexShader);
          gl.attachShader(shaderProgram, fragmentShader);
          gl.linkProgram(shaderProgram);
          gl.useProgram(shaderProgram);

          // 绘制三角形
          const vertices = new Float32Array([
            0.0,  0.5,
           -0.5, -0.5,
            0.5, -0.5,
          ]);

          const vertexBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

          const vertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
          gl.enableVertexAttribArray(vertexPosition);
          gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0);

          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        // 测试 WebGPU
        function testWebGPU() {
          const statusDiv = document.getElementById('webgpu-status');

          if (!navigator.gpu) {
            statusDiv.innerHTML = '<span class="failure">❌ WebGPU 不可用</span>';
            return;
          }

          statusDiv.innerHTML = '<span class="success">✅ WebGPU 可用</span>';
          statusDiv.innerHTML += '<p class="info">navigator.gpu.requestAdapter = ' + (typeof navigator.gpu.requestAdapter) + '</p>';
        }

        // 显示浏览器指纹
        function showFingerprint() {
          const table = document.getElementById('fingerprint');

          const info = [
            ['User Agent', navigator.userAgent],
            ['Platform', navigator.platform],
            ['Languages', navigator.languages.join(', ')],
            ['Webdriver', (navigator.webdriver !== undefined ? navigator.webdriver : 'N/A')],
            ['Hardware Concurrency', navigator.hardwareConcurrency],
            ['Device Memory', navigator.deviceMemory || 'N/A'],
            ['Chrome Object', (window.chrome ? 'Yes' : 'No')],
            ['Plugins Count', navigator.plugins.length],
          ];

          info.forEach(([key, value]) => {
            const row = table.insertRow();
            row.insertCell(0).textContent = key;
            row.insertCell(1).textContent = value;
          });
        }

        // 运行所有测试
        testWebGL();
        drawWebGL();
        testWebGPU();
        showFingerprint();
      </script>
    </body>
    </html>
  `;

  // 设置页面内容
  await page.setContent(htmlContent);

  // 等待一段时间，让你看到结果
  console.log('浏览器已打开，测试页面已加载。');
  console.log('请查看浏览器窗口中的测试结果。');
  console.log('按 Ctrl+C 退出...');

  // 保持浏览器打开
  await new Promise(resolve => {
    process.on('SIGINT', resolve);
  });

  console.log('正在关闭浏览器...');
  await browser.close();
  console.log('测试完成！');
}

// 运行测试
testWebGL().catch(console.error);
