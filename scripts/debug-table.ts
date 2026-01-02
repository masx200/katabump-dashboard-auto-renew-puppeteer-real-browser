/**
 * 调试服务器列表表格结构
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';

const CONFIG = {
  targetUrl: 'https://dashboard.katabump.com/dashboard',
  username: 'masx200@qq.com',
  password: '****************',
  chromePath: 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
};

async function debugTableStructure() {
  console.log('🚀 启动浏览器...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CONFIG.chromePath,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 登录
    console.log('📝 登录中...');
    await page.goto(CONFIG.targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.type('input[name="email"]', CONFIG.username);
    await page.type('input[name="password"]', CONFIG.password);
    await page.click('button[type="submit"]');

    console.log('⏳ 等待登录...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('✅ 登录完成');

    // 调试表格结构
    console.log('\n🔍 分析表格结构...');

    const tableDebug = await page.evaluate(() => {
      const result: any = {
        tables: [],
        allText: document.body.textContent?.substring(0, 5000),
      };

      const tables = document.querySelectorAll('table');

      tables.forEach((table, tableIndex) => {
        const tableInfo: any = {
          index: tableIndex,
          rowCount: 0,
          headers: [],
          rows: [],
        };

        // 获取表头
        const headers = table.querySelectorAll('th');
        tableInfo.headers = Array.from(headers).map(th => th.textContent?.trim());

        // 获取所有行
        const tbody = table.querySelector('tbody');
        if (tbody) {
          const rows = tbody.querySelectorAll('tr');
          tableInfo.rowCount = rows.length;

          Array.from(rows).forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td');
            const rowData = Array.from(cells).map((cell, cellIndex) => ({
              index: cellIndex,
              text: cell.textContent?.trim(),
              html: cell.innerHTML.substring(0, 200),
              className: cell.className,
              tagName: cell.tagName,
              hasLink: cell.querySelector('a') !== null,
              links: Array.from(cell.querySelectorAll('a')).map(a => ({
                href: a.getAttribute('href'),
                text: a.textContent?.trim(),
              })),
            }));

            tableInfo.rows.push(rowData);
          });
        }

        result.tables.push(tableInfo);
      });

      return result;
    });

    console.log('\n📊 表格结构分析:');
    console.log(JSON.stringify(tableDebug, null, 2));

    // 保存到文件
    fs.writeFileSync(
      'screenshots/08-table-structure-debug.json',
      JSON.stringify(tableDebug, null, 2)
    );

    // 查找包含服务器ID的文本
    console.log('\n🔎 搜索服务器ID "189646"...');
    const searchResult = await page.evaluate(() => {
      const searchText = '189646';
      const bodyText = document.body.textContent || '';

      const index = bodyText.indexOf(searchText);
      if (index !== -1) {
        // 获取前后文
        const contextStart = Math.max(0, index - 200);
        const contextEnd = Math.min(bodyText.length, index + 200);
        const context = bodyText.substring(contextStart, contextEnd);

        return {
          found: true,
          context,
          index,
        };
      }

      return { found: false };
    });

    console.log(JSON.stringify(searchResult, null, 2));

    console.log('\n✨ 调试完成，浏览器保持打开');
    await new Promise(() => { });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await browser.close();
  }
}

debugTableStructure().catch(console.error);
