/**
 * 网页结构分析脚本
 * 用于分析 katabump 控制台的页面结构
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';

const CONFIG = {
  targetUrl: 'https://dashboard.katabump.com/dashboard',
  username: 'masx200@qq.com',
  password: '****************',
  chromePath: 'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
};

async function analyzePage() {
  console.log('启动浏览器...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CONFIG.chromePath,
    args: ['--start-maximized'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 1. 访问目标页面
    console.log(`导航到: ${CONFIG.targetUrl}`);
    await page.goto(CONFIG.targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('页面加载完成');

    // 等待一下让用户看到页面
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 截图 - 登录前
    await page.screenshot({ path: 'screenshots/01-before-login.png', fullPage: true });
    console.log('截图: 01-before-login.png');

    // 保存登录页面 HTML
    const loginHtml = await page.content();
    fs.writeFileSync('screenshots/01-login-page.html', loginHtml);
    console.log('保存 HTML: 01-login-page.html');

    // 2. 分析登录表单
    console.log('\n=== 分析登录表单 ===');
    const loginFormAnalysis = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      const inputs = document.querySelectorAll('input');
      const buttons = document.querySelectorAll('button');

      return {
        formsCount: forms.length,
        forms: Array.from(forms).map((form, i) => ({
          index: i,
          action: form.action,
          method: form.method,
          inputs: Array.from(form.querySelectorAll('input')).map((input) => ({
            type: input.type,
            name: input.name,
            id: input.id,
            className: input.className,
            placeholder: input.placeholder,
          })),
        })),
        allInputs: Array.from(inputs).map((input) => ({
          type: input.type,
          name: input.name,
          id: input.id,
          className: input.className,
          placeholder: input.placeholder,
        })),
        allButtons: Array.from(buttons).map((btn) => ({
          text: btn.textContent?.trim(),
          type: btn.type,
          className: btn.className,
        })),
      };
    });

    console.log('登录表单分析结果:', JSON.stringify(loginFormAnalysis, null, 2));
    fs.writeFileSync('screenshots/02-login-form-analysis.json', JSON.stringify(loginFormAnalysis, null, 2));

    // 3. 填写登录表单并登录
    console.log('\n=== 开始登录流程 ===');

    // 查找用户名输入框
    const usernameSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[id="email"]',
      'input[placeholder*="email" i]',
    ];

    let usernameInput = null;
    for (const selector of usernameSelectors) {
      try {
        usernameInput = await page.$(selector);
        if (usernameInput) {
          console.log(`找到用户名输入框: ${selector}`);
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }

    if (!usernameInput) {
      console.error('未找到用户名输入框');
      return;
    }

    await usernameInput.click();
    await page.evaluate((el) => (el as HTMLInputElement).value = '', usernameInput);
    await usernameInput.type(CONFIG.username, { delay: 100 });
    console.log('已输入用户名');

    // 查找密码输入框
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[id="password"]',
    ];

    let passwordInput = null;
    for (const selector of passwordSelectors) {
      try {
        passwordInput = await page.$(selector);
        if (passwordInput) {
          console.log(`找到密码输入框: ${selector}`);
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }

    if (!passwordInput) {
      console.error('未找到密码输入框');
      return;
    }

    await passwordInput.click();
    await page.evaluate((el) => (el as HTMLInputElement).value = '', passwordInput);
    await passwordInput.type(CONFIG.password, { delay: 100 });
    console.log('已输入密码');

    // 截图 - 登录信息已填写
    await page.screenshot({ path: 'screenshots/02-login-filled.png', fullPage: true });
    console.log('截图: 02-login-filled.png');

    // 查找并点击登录按钮
    const loginButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("登录")',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'input[type="submit"]',
    ];

    let loginButton = null;
    for (const selector of loginButtonSelectors) {
      try {
        loginButton = await page.$(selector);
        if (loginButton) {
          console.log(`找到登录按钮: ${selector}`);
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }

    if (!loginButton) {
      // 尝试通过文本查找
      console.log('尝试通过文本内容查找登录按钮...');
      const found = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('登录') || text.includes('login') || text.includes('sign in')) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (!found) {
        console.error('未找到登录按钮');
        return;
      }
    } else {
      await loginButton.click();
    }

    console.log('已点击登录按钮');

    // 等待登录完成
    console.log('等待登录完成...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 4. 分析登录后的页面
    console.log('\n=== 分析登录后页面 ===');
    await page.screenshot({ path: 'screenshots/03-after-login.png', fullPage: true });
    console.log('截图: 03-after-login.png');

    // 保存登录后页面 HTML
    const afterLoginHtml = await page.content();
    fs.writeFileSync('screenshots/03-after-login.html', afterLoginHtml);
    console.log('保存 HTML: 03-after-login.html');

    // 分析页面结构
    const dashboardAnalysis = await page.evaluate(() => {
      const url = window.location.href;
      const title = document.title;

      // 查找所有表格
      const tables = document.querySelectorAll('table');
      const tablesInfo = Array.from(tables).map((table, i) => {
        const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent?.trim());
        const rows = table.querySelectorAll('tbody tr');
        const firstRowData = Array.from(rows).slice(0, 3).map((row) => {
          return Array.from(row.querySelectorAll('td')).map((td) => ({
            text: td.textContent?.trim(),
            className: td.className,
            tagName: td.tagName,
          }));
        });

        return {
          index: i,
          headers,
          firstRowData,
          rowCount: rows.length,
        };
      });

      // 查找所有卡片
      const cards = document.querySelectorAll('.card, [class*="card"], [class*="server"], [class*="instance"]');
      const cardsInfo = Array.from(cards).slice(0, 5).map((card, i) => ({
        index: i,
        className: card.className,
        textContent: card.textContent?.trim().substring(0, 200),
      }));

      // 查找所有链接
      const links = document.querySelectorAll('a');
      const linksInfo = Array.from(links)
        .filter((link) => link.textContent?.trim())
        .map((link) => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim(),
          className: link.className,
        }))
        .slice(0, 10);

      return {
        url,
        title,
        tables: tablesInfo,
        cards: cardsInfo,
        links: linksInfo,
      };
    });

    console.log('页面分析结果:', JSON.stringify(dashboardAnalysis, null, 2));
    fs.writeFileSync('screenshots/04-dashboard-analysis.json', JSON.stringify(dashboardAnalysis, null, 2));

    // 5. 查找目标服务器
    console.log('\n=== 查找目标服务器 ===');
    const serverId = '189646';
    const serverName = 'ubuntu-3x-ui-warp';

    const serverFound = await page.evaluate(({ id, name }) => {
      // 在表格中查找
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const text = row.textContent || '';
          if (text.includes(id) || text.includes(name)) {
            const cells = row.querySelectorAll('td');
            return {
              found: true,
              location: 'table',
              rowData: Array.from(cells).map((cell) => ({
                text: cell.textContent?.trim(),
                className: cell.className,
                tagName: cell.tagName,
              })),
            };
          }
        }
      }

      // 在卡片中查找
      const cards = document.querySelectorAll('[class*="card"], [class*="server"], [class*="instance"]');
      for (const card of cards) {
        const text = card.textContent || '';
        if (text.includes(id) || text.includes(name)) {
          return {
            found: true,
            location: 'card',
            className: card.className,
            text: text.substring(0, 200),
          };
        }
      }

      return { found: false };
    }, { id: serverId, name: serverName });

    console.log('服务器查找结果:', JSON.stringify(serverFound, null, 2));
    fs.writeFileSync('screenshots/05-server-search-result.json', JSON.stringify(serverFound, null, 2));

    // 6. 等待用户手动操作
    console.log('\n=== 分析完成 ===');
    console.log('浏览器将保持打开状态,您可以手动操作查看页面');
    console.log('按 Ctrl+C 退出...');

    // 保持浏览器打开
    await new Promise(() => { });
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    await browser.close();
  }
}

// 创建截图目录
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

// 运行分析
analyzePage().catch(console.error);
