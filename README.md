# 🔄 KataBump Dashboard Auto Renew

> 自动续期 KataBump 服务器的 TypeScript 应用，使用 Puppeteer Real Browser 绕过 Cloudflare Turnstile 验证

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-Real%20Browser-red)](https://github.com/zfcsoftware/puppeteer-real-browser)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

## ✨ 特性

- 🤖 **全自动续期** - 无需手动操作，自动完成服务器续期流程
- 🛡️ **绕过 Cloudflare** - 使用 `puppeteer-real-browser` 成功绕过 Cloudflare Turnstile 验证
- 🔐 **智能登录检测** - 自动识别登录状态，支持会话持久化
- 📊 **批量处理** - 支持同时续期多个服务器
- ⏰ **续期时间检测** - 智能识别"还未到续期时间"的提示，避免不必要的操作
- 🎯 **精确控制** - 使用 Bézier 曲线模拟真实鼠标移动轨迹
- 📝 **详细日志** - 完整的操作日志记录，便于调试和监控

## 🚀 快速开始

### 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd katabump-dashboard-auto-renew

# 使用 pnpm 安装依赖（推荐）
pnpm install

# 或使用 npm
npm install
```

### 配置文件

创建 `config.json` 文件（参考 `config.example.json`）：

```json
{
  "targetUrl": "https://dashboard.katabump.com/dashboard",
  "credentials": {
    "username": "your-email@example.com",
    "password": "your-password"
  },
  "servers": [
    {
      "id": "189646",
      "name": "my-server-name"
    }
  ],
  "browser": {
    "headless": false,
    "executablePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "userDataDir": "./.chrome-data",
    "dohUrl": "https://doh.pub/dns-query",
    "timeout": 30000,
    "windowWidth": 1920,
    "windowHeight": 1080
  },
  "retry": {
    "maxRetries": 3,
    "retryInterval": 5000,
    "retryOnTimeout": true
  },
  "notifications": {
    "enableEmail": false,
    "enableWebhook": false,
    "enableStdout": true
  }
}
```

### 运行测试

```bash
# 测试完整续期流程
pnpm run test-full-renewal

# 或直接使用 npx
npx ts-node scripts/test-full-renewal.ts
```

### 生产环境运行

```bash
# 编译 TypeScript
pnpm run build

# 运行编译后的程序
pnpm start

# 使用配置文件运行
pnpm start:config
```

## 📖 配置说明

### 服务器配置 (`servers`)

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 服务器 ID |
| `name` | string | ❌ | 服务器名称（仅用于日志） |

### 浏览器配置 (`browser`)

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `headless` | boolean | `false` | 是否使用无头模式 |
| `executablePath` | string | - | Chrome 可执行文件路径 |
| `userDataDir` | string | - | Chrome 用户数据目录（用于持久化会话） |
| `dohUrl` | string | `https://doh.pub/dns-query` | DNS over HTTPS 服务器 |
| `timeout` | number | `30000` | 页面加载超时时间（毫秒） |
| `windowWidth` | number | `1920` | 浏览器窗口宽度 |
| `windowHeight` | number | `1080` | 浏览器窗口高度 |

### 重试策略 (`retry`)

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxRetries` | number | `3` | 最大重试次数 |
| `retryInterval` | number | `5000` | 重试间隔（毫秒） |
| `retryOnTimeout` | boolean | `true` | 超时时是否重试 |

## 🏗️ 项目架构

```
katabump-dashboard-auto-renew/
├── src/
│   ├── browser/
│   │   └── controller.ts          # 浏览器控制器（使用 puppeteer-real-browser）
│   ├── tasks/
│   │   ├── login.ts               # 登录任务
│   │   ├── locator.ts             # 服务器定位器
│   │   └── renewal.ts             # 续期执行器
│   ├── config/
│   │   └── schema.ts              # 配置验证
│   ├── utils/
│   │   └── logger.ts              # 日志工具
│   ├── types/
│   │   └── index.ts               # TypeScript 类型定义
│   └── index.ts                   # 主入口
├── scripts/
│   ├── test-full-renewal.ts       # 完整续期测试
│   └── test-puppeteer-real-browser.ts  # Cloudflare 绕过测试
├── tests/
│   ├── unit/                      # 单元测试
│   └── integration/               # 集成测试
├── config.json                    # 配置文件
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript 5.9
- **浏览器自动化**: [puppeteer-real-browser](https://github.com/zfcsoftware/puppeteer-real-browser)
  - 基于 rebrowser-patches，有效绕过 Cloudflare 检测
  - 内置 Turnstile 自动验证功能
- **测试框架**: Vitest
- **包管理器**: pnpm

## 🎯 核心功能

### 1. Cloudflare Turnstile 绕过

使用 `puppeteer-real-browser` 自动处理 Cloudflare 验证：

- ✅ 自动检测并触发 Turnstile 验证
- ✅ 使用真实浏览器指纹，避免被识别为机器人
- ✅ 支持 CAPTCHA 自动点击和验证

### 2. 智能续期检测

系统会智能识别以下情况：

- ✅ **续期成功** - 显示成功提示或更新到期时间
- ⏳ **还未到续期时间** - 检测到 "You can't renew your server yet" 等提示
- ❌ **续期失败** - 显示错误信息

### 3. 鼠标轨迹模拟

使用 Bézier 曲线生成自然的鼠标移动轨迹：

```typescript
// 二次或三次 Bézier 曲线
// 随机控制点和抖动模拟真实用户行为
await smoothMouseMove(page, startX, startY, endX, endY);
```

### 4. 会话持久化

通过 `userDataDir` 配置：

- 保存登录状态，避免重复登录
- 缓存浏览器数据，提高访问速度
- 减少 Cloudflare 验证触发频率

## 📝 使用示例

### 编程式 API

```typescript
import { RenewalTask } from './src/index';

const config = {
  targetUrl: 'https://dashboard.katabump.com/dashboard',
  credentials: {
    username: 'your-email@example.com',
    password: 'your-password'
  },
  servers: [
    { id: '189646', name: 'my-server' }
  ],
  browser: {
    headless: false,
    userDataDir: './.chrome-data'
  },
  retry: {
    maxRetries: 3,
    retryInterval: 5000,
    retryOnTimeout: true
  },
  notifications: {
    enableStdout: true
  }
};

const task = new RenewalTask(config);

// 单个服务器续期
const result = await task.renewSingle('189646');
console.log(result);

// 批量续期
const batchResult = await task.renewBatch();
console.log(`成功: ${batchResult.successCount}, 失败: ${batchResult.failureCount}`);
```

## 🧪 测试

### 运行所有测试

```bash
pnpm test
```

### 运行特定测试

```bash
# 单元测试
pnpm test -- tests/unit

# 集成测试
pnpm test -- tests/integration

# 覆盖率报告
pnpm run test:coverage

# Vitest UI
pnpm run test:ui
```

### Cloudflare 绕过测试

测试 `puppeteer-real-browser` 是否能成功绕过 Cloudflare：

```bash
npx ts-node scripts/test-puppeteer-real-browser.ts
```

预期结果：

```
✅ 成功绕过 Cloudflare 挑战！
```

## ⚠️ 注意事项

### 安全建议

1. **不要提交配置文件** - 将 `config.json` 添加到 `.gitignore`
2. **使用环境变量** - 敏感信息可以通过环境变量传递
3. **限制访问权限** - 设置 `config.json` 文件权限为 `600`

### 使用限制

- ⚠️ 仅用于合法的服务器续期目的
- ⚠️ 遵守 KataBump 的服务条款
- ⚠️ 不要过于频繁地触发续期操作
- ⚠️ 建议使用 `userDataDir` 避免频繁登录

### 已知问题

1. **续期时间检测**
   - 系统会检测 "You can't renew your server yet" 消息
   - 此类消息会被视为成功（无需续期），而非失败

2. **Cloudflare 验证**
   - 首次访问可能需要完成 Cloudflare 验证
   - 使用 `userDataDir` 可以减少验证频率
   - `turnstile: true` 选项会自动处理验证

## 📊 日志示例

```
🚀 开始完整续期测试...

📦 步骤 1: 启动浏览器
2026-01-01T19:16:40.180Z [INFO] [BrowserController] 浏览器启动成功 (DoH: https://doh.pub/dns-query)
✅ 浏览器启动成功

🔐 步骤 2: 登录账户
2026-01-01T19:16:49.904Z [INFO] [LoginProcessor] 检测到已登录状态,跳过登录流程
✅ 登录成功

🖥️  步骤 3.1: 处理服务器 ubuntu-3x-ui-warp
   直接访问服务器详情页: https://dashboard.katabump.com/servers/edit?id=189646
   ✅ 已进入服务器详情页

2026-01-01T19:18:27.842Z [INFO] [RenewalExecutor] ✅ 已点击模态框中的 Renew 按钮
2026-01-01T19:18:29.854Z [INFO] [RenewalExecutor] 等待续期处理完成...

   ⏳ 服务器还未到续期时间
   信息: You can't renew your server yet. You will be able to as of 02 January (in 1 day(s)).

✨ 所有服务器续期测试完成!
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[ISC](LICENSE)

## 🔗 相关链接

- [KataBump Dashboard](https://dashboard.katabump.com)
- [puppeteer-real-browser](https://github.com/zfcsoftware/puppeteer-real-browser)
- [rebrowser-patches](https://github.com/rebrowser/rebrowser-patches)

---

**免责声明**: 本项目仅用于学习和研究目的。使用本项目时，请遵守相关服务的使用条款和法律法规。
