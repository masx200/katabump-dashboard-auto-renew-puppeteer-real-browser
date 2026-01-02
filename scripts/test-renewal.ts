/**
 * 完整的续期流程测试脚本
 */

import puppeteer from 'puppeteer';

const CONFIG = {
  targetUrl: 'https://dashboard.katabump.com/dashboard',
  username: 'masx200@qq.com',
  password: '****************',
  chromePath: 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  serverId: '189646',
  serverName: 'ubuntu-3x-ui-warp',
};

async function testRenewalFlow() {
  console.log('🚀 启动浏览器...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CONFIG.chromePath,
    args: ['--start-maximized'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // ===== 第1步: 登录 =====
    console.log(`\n📝 步骤 1: 访问并登录`);
    console.log(`URL: ${CONFIG.targetUrl}`);

    await page.goto(CONFIG.targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ 页面加载完成');

    // 填写登录表单
    console.log('📧 填写登录信息...');

    await page.click('input[name="email"]');
    await page.evaluate(() => {
      (document.querySelector('input[name="email"]') as HTMLInputElement).value = '';
    });
    await page.type('input[name="email"]', CONFIG.username, { delay: 100 });
    console.log('  ✓ 用户名已填写');

    await page.click('input[name="password"]');
    await page.evaluate(() => {
      (document.querySelector('input[name="password"]') as HTMLInputElement).value = '';
    });
    await page.type('input[name="password"]', CONFIG.password, { delay: 100 });
    console.log('  ✓ 密码已填写');

    // 点击登录按钮
    await page.click('button[type="submit"]');
    console.log('  ✓ 已点击登录按钮');

    // 等待登录完成
    console.log('⏳ 等待登录完成...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
      console.log('  (可能没有页面跳转)');
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('✅ 登录成功');

    // ===== 第2步: 定位服务器 =====
    console.log(`\n🔍 步骤 2: 定位服务器`);
    console.log(`服务器ID: ${CONFIG.serverId}`);
    console.log(`服务器名称: ${CONFIG.serverName}`);

    // 等待表格加载
    await page.waitForSelector('table', { timeout: 10000 });
    console.log('✅ 服务器列表已加载');

    // 在表格中查找服务器
    const serverInfo = await page.evaluate(({ id, name }) => {
      const tables = document.querySelectorAll('table');

      for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr');

        for (const row of rows) {
          const text = row.textContent || '';

          if (text.includes(id) || text.includes(name)) {
            const cells = row.querySelectorAll('td');

            // 提取服务器信息
            // 表格结构: #, Name, Location, Type, RAM, Disk, CPU, Action
            const serverIdCell = cells[0]?.textContent?.trim();
            const nameCell = cells[1];
            const locationCell = cells[2]?.textContent?.trim();
            const typeCell = cells[3]?.textContent?.trim();
            const ramCell = cells[4]?.textContent?.trim();
            const diskCell = cells[5]?.textContent?.trim();
            const cpuCell = cells[6]?.textContent?.trim();
            const actionCell = cells[7];

            let serverName = '';
            let actionHref = null;
            let actionText = '';

            if (nameCell) {
              const link = nameCell.querySelector('a');
              if (link) {
                serverName = link.textContent?.trim() || '';
                actionHref = link.getAttribute('href');
              } else {
                serverName = nameCell.textContent?.trim() || '';
              }
            }

            if (actionCell) {
              const actionLink = actionCell.querySelector('a');
              if (actionLink) {
                actionText = actionLink.textContent?.trim() || '';
                if (!actionHref) {
                  actionHref = actionLink.getAttribute('href');
                }
              }
            }

            return {
              found: true,
              id: serverIdCell,
              name: serverName,
              location: locationCell,
              type: typeCell,
              ram: ramCell,
              disk: diskCell,
              cpu: cpuCell,
              actionHref,
              actionText,
            };
          }
        }
      }

      return { found: false };
    }, { id: CONFIG.serverId, name: CONFIG.serverName });

    if (!serverInfo.found) {
      console.error('❌ 未找到服务器');
      return;
    }

    console.log('✅ 找到服务器:');
    console.log(`   ID: ${serverInfo.id}`);
    console.log(`   名称: ${serverInfo.name}`);
    console.log(`   位置: ${serverInfo.location}`);
    console.log(`   类型: ${serverInfo.type}`);
    console.log(`   RAM: ${serverInfo.ram}`);
    console.log(`   磁盘: ${serverInfo.disk}`);
    console.log(`   CPU: ${serverInfo.cpu}`);
    console.log(`   操作链接: ${serverInfo.actionText} -> ${serverInfo.actionHref}`);

    // ===== 第3步: 进入服务器详情页 =====
    console.log(`\n🔗 步骤 3: 进入服务器详情页`);

    if (!serverInfo.actionHref) {
      console.error('❌ 未找到操作链接');
      return;
    }

    // 构建完整URL
    const detailUrl = serverInfo.actionHref.startsWith('http')
      ? serverInfo.actionHref
      : `https://dashboard.katabump.com${serverInfo.actionHref}`;

    console.log(`跳转到: ${detailUrl}`);
    await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('✅ 已进入服务器详情页');

    // 截图
    await page.screenshot({ path: 'screenshots/06-server-detail.png', fullPage: true });
    console.log('📸 截图: 06-server-detail.png');

    // 分析详情页结构
    const detailAnalysis = await page.evaluate(() => {
      const url = window.location.href;
      const title = document.title;

      // 查找所有按钮
      const buttons = Array.from(document.querySelectorAll('button')).map((btn) => ({
        text: btn.textContent?.trim(),
        type: btn.type,
        className: btn.className,
      }));

      // 查找所有链接
      const links = Array.from(document.querySelectorAll('a')).map((link) => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim(),
      })).filter(link => link.text);

      // 查找所有表单
      const forms = Array.from(document.querySelectorAll('form')).map((form) => ({
        action: form.action,
        method: form.method,
      }));

      return {
        url,
        title,
        buttons: buttons.slice(0, 10),
        links: links.slice(0, 15),
        forms,
      };
    });

    console.log('📊 详情页分析:');
    console.log(JSON.stringify(detailAnalysis, null, 2));

    // 保存分析结果
    const fs = require('fs');
    fs.writeFileSync(
      'screenshots/07-server-detail-analysis.json',
      JSON.stringify(detailAnalysis, null, 2)
    );

    // ===== 第4步: 查找续期按钮 =====
    console.log(`\n🔄 步骤 4: 查找续期功能`);

    const renewButtonFound = await page.evaluate(() => {
      // 查找包含 "renew", "extend", "续期" 等关键词的按钮或链接
      const buttons = document.querySelectorAll('button, a');
      const renewKeywords = ['renew', 'extend', '续期', 'renewal', '延长'];

      for (const btn of buttons) {
        const text = (btn.textContent || '').toLowerCase();
        const href = (btn.getAttribute('href') || '').toLowerCase();

        for (const keyword of renewKeywords) {
          if (text.includes(keyword) || href.includes(keyword)) {
            return {
              found: true,
              text: btn.textContent?.trim(),
              tagName: btn.tagName,
              href: btn.getAttribute('href'),
              className: btn.className,
            };
          }
        }
      }

      return { found: false };
    });

    if (renewButtonFound.found) {
      console.log('✅ 找到续期按钮/链接:');
      console.log(`   文本: ${renewButtonFound.text}`);
      console.log(`   标签: ${renewButtonFound.tagName}`);
      console.log(`   链接: ${renewButtonFound.href}`);
      console.log(`   类名: ${renewButtonFound.className}`);
    } else {
      console.log('⚠️  未找到明显的续期按钮');
      console.log('可能需要手动操作才能续期');
    }

    // 保持浏览器打开以便手动操作
    console.log('\n✨ 分析完成！');
    console.log('浏览器将保持打开，您可以手动进行续期操作');
    console.log('按 Ctrl+C 退出...');

    await new Promise(() => { });

  } catch (error) {
    console.error('❌ 发生错误:', error);
  } finally {
    await browser.close();
  }
}

testRenewalFlow().catch(console.error);
