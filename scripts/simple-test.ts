/**
 * 简化版登录和服务器定位测试
 */

import puppeteer from 'puppeteer';

const CONFIG = {
  targetUrl: 'https://dashboard.katabump.com/dashboard',
  username: 'masx200@qq.com',
  password: '****************',
  chromePath: 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  serverId: '189646',
};

async function simpleTest() {
  console.log('🚀 启动浏览器...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CONFIG.chromePath,
    args: [
      '--start-maximized',
      '--dns-over-https-enabled=true',
      '--dns-over-https-url=https://doh.pub/dns-query',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 步骤1: 访问并登录
    console.log('\n📝 步骤1: 访问并登录');
    await page.goto(CONFIG.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('✅ 页面加载完成');

    // 等待登录表单
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    console.log('✅ 登录表单已加载');

    // 填写表单
    await page.type('input[name="email"]', CONFIG.username, { delay: 50 });
    await page.type('input[name="password"]', CONFIG.password, { delay: 50 });
    console.log('✅ 登录信息已填写');

    // 截图 - 登录前
    await page.screenshot({ path: 'screenshots/10-before-login-submit.png' });

    // 提交登录
    await page.click('button[type="submit"]');
    console.log('✅ 已点击登录按钮');

    // 等待导航
    console.log('⏳ 等待登录完成...');
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (e) {
      console.log('  (可能没有页面跳转)');
    }

    // 等待页面稳定
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 截图 - 登录后
    await page.screenshot({ path: 'screenshots/11-after-login.png', fullPage: true });
    console.log('✅ 登录完成');

    // 步骤2: 查找服务器
    console.log('\n🔍 步骤2: 查找服务器');
    console.log(`目标服务器ID: ${CONFIG.serverId}`);

    // 等待表格加载
    try {
      await page.waitForSelector('table', { timeout: 10000 });
      console.log('✅ 找到表格');
    } catch (e) {
      console.log('⚠️  未找到表格元素');
    }

    // 在页面中搜索服务器ID
    const serverFound = await page.evaluate((serverId) => {
      // 搜索所有文本
      const bodyText = document.body.textContent || '';
      const found = bodyText.includes(serverId);

      if (!found) {
        return { found: false, message: '在页面中未找到服务器ID' };
      }

      // 查找所有表格
      const tables = document.querySelectorAll('table');
      const results: any = { found: false, tables: [] };

      tables.forEach((table, tableIndex) => {
        const rows = table.querySelectorAll('tr');
        const tableData: any = { index: tableIndex, rows: [] };

        rows.forEach((row, rowIndex) => {
          const text = row.textContent || '';
          if (text.includes(serverId)) {
            const cells = row.querySelectorAll('td, th');
            const cellData = Array.from(cells).map((cell, i) => ({
              index: i,
              text: cell.textContent?.trim(),
              html: cell.innerHTML.substring(0, 100),
              tagName: cell.tagName,
            }));

            tableData.rows.push({
              rowIndex,
              cellData,
            });

            results.found = true;
          }
        });

        if (tableData.rows.length > 0) {
          results.tables.push(tableData);
        }
      });

      return results;
    }, CONFIG.serverId);

    console.log('搜索结果:', JSON.stringify(serverFound, null, 2));

    if (serverFound.found) {
      console.log(`\n✅ 找到服务器 ${CONFIG.serverId}！`);

      // 显示找到的表格数据
      serverFound.tables.forEach((table: any) => {
        console.log(`\n表格 #${table.index}:`);
        table.rows.forEach((row: any) => {
          console.log(`  行 #${row.rowIndex}:`);
          row.cellData.forEach((cell: any) => {
            console.log(`    [${cell.index}] ${cell.tagName}: ${cell.text}`);
          });
        });
      });
    } else {
      console.log(`\n❌ 未找到服务器 ${CONFIG.serverId}`);
    }

    // 截图 - 最终状态
    await page.screenshot({ path: 'screenshots/12-final-state.png', fullPage: true });

    // 保存页面HTML
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('screenshots/13-final-page.html', html);
    console.log('📄 页面HTML已保存');

    console.log('\n✨ 测试完成！浏览器保持打开以便手动操作');
    console.log('按 Ctrl+C 退出...');

    // 保持浏览器打开
    await new Promise(() => { });

  } catch (error) {
    console.error('\n❌ 发生错误:', error);
  } finally {
    await browser.close();
  }
}

simpleTest().catch(console.error);
