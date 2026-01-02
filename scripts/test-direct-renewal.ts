/**
 * 直接测试续期功能
 * 直接访问服务器详情页面并查找续期按钮
 */

import puppeteer from 'puppeteer';

const CONFIG = {
  targetUrl: 'https://dashboard.katabump.com/dashboard',
  serverDetailUrl: 'https://dashboard.katabump.com/servers/edit?id=189646',
  username: 'masx200@qq.com',
  password: '****************',
  chromePath: 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  serverId: '189646',
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

async function testRenewal() {
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

    await page.click('button[type="submit"]');
    console.log('✅ 已点击登录按钮');

    // 等待登录完成
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('✅ 登录完成');

    // 截图 - 登录后
    await page.screenshot({ path: 'screenshots/20-after-login.png', fullPage: true });

    // 步骤2: 直接访问服务器详情页面
    console.log('\n🔗 步骤2: 访问服务器详情页面');
    console.log(`URL: ${CONFIG.serverDetailUrl}`);

    await page.goto(CONFIG.serverDetailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('✅ 已进入服务器详情页面');

    // 截图 - 服务器详情页
    await page.screenshot({ path: 'screenshots/21-server-detail.png', fullPage: true });

    // 步骤3: 分析页面结构，查找续期按钮
    console.log('\n🔍 步骤3: 查找续期按钮');

    const pageAnalysis = await page.evaluate(() => {
      const url = window.location.href;
      const title = document.title;

      // 查找所有按钮
      const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"]')).map(btn => ({
        text: btn.textContent?.trim(),
        type: btn.getAttribute('type'),
        className: btn.className,
        tagName: btn.tagName,
        id: btn.id,
        name: (btn as HTMLInputElement).name || btn.getAttribute('name'),
      }));

      // 查找所有链接
      const allLinks = Array.from(document.querySelectorAll('a')).map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim(),
        className: link.className,
      })).filter(link => link.text);

      // 查找表单
      const allForms = Array.from(document.querySelectorAll('form')).map(form => ({
        action: form.action,
        method: form.method,
        className: form.className,
      }));

      // 搜索包含续期关键词的元素
      const renewalKeywords = ['renew', 'extend', '续期', 'renewal', '延长', 'prolong'];
      const renewalElements: any[] = [];

      // 搜索按钮
      document.querySelectorAll('button, input[type="submit"]').forEach(btn => {
        const text = (btn.textContent || '').toLowerCase();
        const value = (btn as HTMLInputElement).value?.toLowerCase() || '';
        const id = (btn.id || '').toLowerCase();
        const name = (btn.getAttribute('name') || '').toLowerCase();

        for (const keyword of renewalKeywords) {
          if (text.includes(keyword) || value.includes(keyword) || id.includes(keyword) || name.includes(keyword)) {
            renewalElements.push({
              type: 'button',
              text: btn.textContent?.trim(),
              id: btn.id,
              name: btn.getAttribute('name'),
              className: btn.className,
            });
            break;
          }
        }
      });

      // 搜索链接
      document.querySelectorAll('a').forEach(link => {
        const text = (link.textContent || '').toLowerCase();
        const href = (link.getAttribute('href') || '').toLowerCase();

        for (const keyword of renewalKeywords) {
          if (text.includes(keyword) || href.includes(keyword)) {
            renewalElements.push({
              type: 'link',
              text: link.textContent?.trim(),
              href: link.getAttribute('href'),
              className: link.className,
            });
            break;
          }
        }
      });

      return {
        url,
        title,
        allButtons: allButtons.slice(0, 20),
        allLinks: allLinks.slice(0, 20),
        allForms,
        renewalElements,
      };
    });

    console.log('\n📊 页面分析结果:');
    console.log(JSON.stringify(pageAnalysis, null, 2));

    // 保存分析结果
    const fs = require('fs');
    fs.writeFileSync(
      'screenshots/22-page-analysis.json',
      JSON.stringify(pageAnalysis, null, 2)
    );

    // 步骤4: 如果找到续期按钮，尝试点击
    if (pageAnalysis.renewalElements && pageAnalysis.renewalElements.length > 0) {
      console.log('\n✅ 找到续期元素:');
      pageAnalysis.renewalElements.forEach((element: any, index: number) => {
        console.log(`  [${index}] 类型: ${element.type}`);
        console.log(`      文本: ${element.text}`);
        if (element.href) console.log(`      链接: ${element.href}`);
        if (element.id) console.log(`      ID: ${element.id}`);
      });

      // 尝试点击第一个续期元素
      console.log('\n🔄 尝试点击续期按钮...');

      const firstRenewalElement = pageAnalysis.renewalElements[0];

      if (firstRenewalElement.type === 'link') {
        await page.evaluate((href) => {
          const link = document.querySelector(`a[href="${href}"]`) as HTMLElement;
          if (link) link.click();
        }, firstRenewalElement.href);
      } else if (firstRenewalElement.id) {
        await page.click(`#${firstRenewalElement.id}`);
      } else {
        // 通过文本查找并点击
        await page.evaluate((text) => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.textContent?.trim() === text) {
              (btn as HTMLElement).click();
              return true;
            }
          }
          return false;
        }, firstRenewalElement.text);
      }

      console.log('✅ 已点击续期按钮');

      // 等待页面响应
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 截图 - 点击续期后
      await page.screenshot({ path: 'screenshots/23-after-renewal-click.png', fullPage: true });

      // 检查是否有确认对话框
      console.log('\n⏳ 等待续期处理完成...');

      // 查找确认按钮
      const confirmButton = await page.evaluate(() => {
        const confirmKeywords = ['confirm', 'ok', 'yes', '确认', '确定'];

        for (const keyword of confirmKeywords) {
          const buttons = Array.from(document.querySelectorAll('button')).filter(btn => {
            const text = (btn.textContent || '').toLowerCase();
            return text.includes(keyword);
          });

          if (buttons.length > 0) {
            const btn = buttons[0] as HTMLElement;
            btn.click();
            return {
              found: true,
              text: btn.textContent?.trim(),
            };
          }
        }

        return { found: false };
      });

      if (confirmButton.found) {
        console.log(`✅ 已点击确认按钮: ${confirmButton.text}`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        console.log('未找到确认对话框，可能续期已完成');
      }

      // 最终截图
      await page.screenshot({ path: 'screenshots/24-final-result.png', fullPage: true });
      console.log('✅ 续期流程完成');

    } else {
      console.log('\n⚠️  未找到续期按钮/链接');
      console.log('可能需要手动操作，或者页面结构已改变');
    }

    console.log('\n✨ 测试完成！浏览器保持打开');
    console.log('按 Ctrl+C 退出...');

    // 保持浏览器打开
    await new Promise(() => { });

  } catch (error) {
    console.error('\n❌ 发生错误:', error);
  } finally {
    await browser.close();
  }
}

testRenewal().catch(console.error);
