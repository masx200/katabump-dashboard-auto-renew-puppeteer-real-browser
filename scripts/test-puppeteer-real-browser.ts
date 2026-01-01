/**
 * 测试 puppeteer-real-browser
 * 访问 https://www.scrapingcourse.com/cloudflare-challenge 验证是否通过 Cloudflare 检测
 */

import { connect } from 'puppeteer-real-browser';

async function test() {
  console.log('🚀 启动 puppeteer-real-browser...\n');

  const { browser, page } = await connect({
    headless: false,
    turnstile: true, // 自动处理 Cloudflare Turnstile
    args: [
      '--window-size=1920,1080',
      '--start-maximized',
    ],
  });

  console.log('✅ 浏览器启动成功\n');

  try {
    console.log('📄 正在访问 Cloudflare 挑战页面...');
    console.log('   URL: https://www.scrapingcourse.com/cloudflare-challenge\n');

    await page.goto('https://www.scrapingcourse.com/cloudflare-challenge', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('⏳ 等待页面加载完成 (30秒)...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 检查页面内容
    const pageContent = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      return {
        hasBypassed: body.includes('bypassed') || body.includes('You bypassed'),
        title: document.title,
        url: window.location.href,
      };
    });

    console.log('\n📊 页面检测结果:');
    console.log(`   标题: ${pageContent.title}`);
    console.log(`   URL: ${pageContent.url}`);
    console.log(`   是否通过: ${pageContent.hasBypassed ? '✅ 是' : '❌ 否'}`);

    if (pageContent.hasBypassed) {
      console.log('\n🎉 成功绕过 Cloudflare 挑战！');
    } else {
      console.log('\n⚠️ 未能确定是否通过挑战，请手动检查页面。');
    }

    console.log('\n浏览器将保持打开 60 秒供您查看...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
  } finally {
    await browser.close();
    console.log('\n✅ 浏览器已关闭');
  }
}

test().catch((error) => {
  console.error('未捕获的错误:', error);
  process.exit(1);
});
