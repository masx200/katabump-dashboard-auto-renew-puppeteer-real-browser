/**
 * 测试续期模态框流程
 */

import puppeteer from 'puppeteer';

const CONFIG = {
  targetUrl: 'https://dashboard.katabump.com/dashboard',
  serverDetailUrl: 'https://dashboard.katabump.com/servers/edit?id=189646',
  username: 'masx200@qq.com',
  password: '****************',
  chromePath: 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  dohUrl: 'https://doh.pub/dns-query',
};

// 生成 DoH 参数
function getDoHArgs(dohUrl: string): string[] {
  const encodedUrl = encodeURIComponent(dohUrl);
  return [
    '--enable-features=DnsOverHttps',
    '--force-fieldtrials=DoHTrial/Group1',
    `--force-fieldtrial-params=DoHTrial.Group1:Templates/${encodedUrl}/Fallback/true`
  ];
}

async function testRenewalModal() {
  console.log('🚀 启动浏览器...');
  console.log(`🌐 配置 DoH: ${CONFIG.dohUrl}`);

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CONFIG.chromePath,
    args: [
      '--start-maximized',
      ...getDoHArgs(CONFIG.dohUrl),
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 步骤1: 登录
    console.log('\n📝 步骤1: 登录');
    console.log('正在访问登录页面...');
    await page.goto(CONFIG.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {
      console.log('⚠️  页面加载超时,但继续尝试...');
    });
    console.log('✅ 页面加载完成');

    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.type('input[name="email"]', CONFIG.username, { delay: 50 });
    await page.type('input[name="password"]', CONFIG.password, { delay: 50 });
    console.log('✅ 登录信息已填写');

    const loginButton = await page.$('button[type="submit"]');
    if (loginButton) {
      await loginButton.click();
      console.log('✅ 已点击登录按钮');
    }

    // 等待登录完成
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('✅ 登录完成');

    // 步骤2: 直接访问服务器详情页
    console.log('\n🔗 步骤2: 访问服务器详情页面');
    console.log(`URL: ${CONFIG.serverDetailUrl}`);
    await page.goto(CONFIG.serverDetailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ 已进入服务器详情页面');

    // 步骤3: 查找并点击 Renew 按钮
    console.log('\n🔍 步骤3: 查找并点击 Renew 按钮');

    // 等待页面稳定
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 查找 Renew 按钮
    const renewButton = await page.$('button[data-bs-target="#renew-modal"]');
    if (renewButton) {
      console.log('✅ 找到 Renew 按钮 (data-bs-target="#renew-modal")');
      await renewButton.click();
      console.log('✅ 已点击 Renew 按钮');
    } else {
      console.log('❌ 未找到 Renew 按钮');
      throw new Error('未找到 Renew 按钮');
    }

    // 步骤4: 等待模态框出现
    console.log('\n📋 步骤4: 等待模态框出现');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const modalExists = await page.evaluate(() => {
      const modal = document.querySelector('#renew-modal');
      if (!modal) return false;
      const modalElement = modal as HTMLElement;
      return modalElement.classList.contains('show') ||
        window.getComputedStyle(modalElement).display !== 'none';
    });

    if (modalExists) {
      console.log('✅ 模态框已打开');

      // 检查是否有验证码
      const hasCaptcha = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
        return !!iframe;
      });

      if (hasCaptcha) {
        console.log('⚠️  检测到 Cloudflare Turnstile 验证码');
        console.log('📝 请在浏览器中手动完成验证码...');

        // 等待验证码完成
        console.log('⏳ 等待 60 秒供手动完成验证码...');

        for (let i = 0; i < 60; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const captchaCompleted = await page.evaluate(() => {
            const successToken = document.querySelector('input[name="cf-turnstile-response"]');
            return successToken ? (successToken as HTMLInputElement).value.length > 0 : false;
          });

          if (captchaCompleted) {
            console.log('✅ 验证码已完成!');
            break;
          }

          if (i % 10 === 0 && i > 0) {
            console.log(`⏳ 仍在等待验证码完成... (${i}s)`);
          }
        }

        // 额外等待一下
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // 步骤5: 点击模态框中的 Renew 按钮
      console.log('\n✅ 步骤5: 点击模态框中的 Renew 按钮');

      const modalRenewButton = await page.$('#renew-modal button.btn-primary');
      if (modalRenewButton) {
        await modalRenewButton.click();
        console.log('✅ 已点击模态框中的 Renew 按钮');
      } else {
        console.log('❌ 未找到模态框中的 Renew 按钮');
      }

      // 等待处理
      await new Promise((resolve) => setTimeout(resolve, 5000));

      console.log('\n✨ 续期流程测试完成!');
    } else {
      console.log('❌ 模态框未出现');
    }

    console.log('\n✨ 测试完成!浏览器保持打开');
    console.log('按 Ctrl+C 退出\n');

    // 保持浏览器打开
    await new Promise((resolve) => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('\n❌ 发生错误:', error);
  } finally {
    await browser.close();
    console.log('✅ 浏览器已关闭');
  }
}

testRenewalModal().catch((error) => {
  console.error('未捕获的错误:', error);
  process.exit(1);
});
