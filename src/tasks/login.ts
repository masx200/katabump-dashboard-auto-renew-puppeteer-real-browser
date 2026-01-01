/**
 * 登录处理器
 */

import { Page } from 'puppeteer';
import { LoginCredentials } from '../types';
import { logger } from '../utils/logger';
import { RenewalError, ErrorType } from '../types';

/**
 * 等待指定毫秒数
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class LoginProcessor {
  constructor(private page: Page) {}

  /**
   * 执行登录操作
   */
  async login(credentials: LoginCredentials): Promise<boolean> {
    try {
      logger.info('LoginProcessor', '开始登录流程...');

      // 等待页面加载
      const pageLoaded = await this.waitForPageLoad();

      // 如果页面已经登录成功,直接返回
      if (pageLoaded === 'already_logged_in') {
        logger.info('LoginProcessor', '检测到已登录状态,跳过登录流程');
        return true;
      }

      // 检测并填写登录表单
      await this.fillLoginForm(credentials);

      // 提交登录
      await this.submitLogin();

      // 等待登录结果
      const success = await this.waitForLoginResult();

      if (success) {
        logger.info('LoginProcessor', '登录成功');
        return true;
      } else {
        logger.error('LoginProcessor', '登录失败');
        throw new RenewalError(ErrorType.VERIFY_ERROR, '登录失败: 未检测到登录成功的标志');
      }
    } catch (error) {
      logger.error('LoginProcessor', '登录过程出错', error);
      if (error instanceof RenewalError) {
        throw error;
      }
      throw new RenewalError(
        ErrorType.VERIFY_ERROR,
        `登录过程出错: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 等待页面加载完成
   * @returns 'needs_login' | 'already_logged_in'
   */
  private async waitForPageLoad(): Promise<'needs_login' | 'already_logged_in'> {
    logger.info('LoginProcessor', '等待页面加载完成...');

    // 等待页面稳定
    await delay(2000);

    // 通过 URL 判断是否已登录
    // 如果 URL 不是以 /login 结尾,说明已经登录
    const currentUrl = this.page.url();
    logger.info('LoginProcessor', `当前页面 URL: ${currentUrl}`);

    if (!currentUrl.endsWith('/login')) {
      logger.info('LoginProcessor', 'URL 不以 /login 结尾,检测到已登录状态');
      return 'already_logged_in';
    }

    // URL 以 /login 结尾,需要登录
    logger.info('LoginProcessor', 'URL 以 /login 结尾,需要执行登录');
    return 'needs_login';
  }

  /**
   * 填写登录表单
   */
  private async fillLoginForm(credentials: LoginCredentials): Promise<void> {
    logger.info('LoginProcessor', '正在填写登录表单...');

    // 查找用户名输入框
    const usernameSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[id="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="邮箱" i]',
    ];

    let usernameInput = await this.findElement(usernameSelectors);

    if (!usernameInput) {
      throw new RenewalError(
        ErrorType.PARSE_ERROR,
        '未找到用户名/邮箱输入框'
      );
    }

    // 清空并输入用户名
    await usernameInput.click();
    await usernameInput.type('', { delay: 0 });
    await this.page.evaluate((el) => (el as HTMLInputElement).value = '', usernameInput);
    await usernameInput.type(credentials.username, { delay: 50 });

    logger.info('LoginProcessor', '用户名已填写');

    // 查找密码输入框
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[id="password"]',
      'input[placeholder*="password" i]',
      'input[placeholder*="密码" i]',
    ];

    let passwordInput = await this.findElement(passwordSelectors);

    if (!passwordInput) {
      throw new RenewalError(
        ErrorType.PARSE_ERROR,
        '未找到密码输入框'
      );
    }

    // 清空并输入密码
    await passwordInput.click();
    await passwordInput.type('', { delay: 0 });
    await this.page.evaluate((el) => (el as HTMLInputElement).value = '', passwordInput);
    await passwordInput.type(credentials.password, { delay: 50 });

    logger.info('LoginProcessor', '密码已填写');

    // 点击 "Remember me" 复选框
    try {
      const rememberCheckbox = await this.page.$('input[name="remember"]');
      if (rememberCheckbox) {
        // 检查是否已选中,如果未选中则点击
        const isChecked = await this.page.evaluate((el) => (el as HTMLInputElement).checked, rememberCheckbox);
        if (!isChecked) {
          await rememberCheckbox.click();
          logger.info('LoginProcessor', '已勾选 "Remember me"');
        }
      }
    } catch (error) {
      logger.warn('LoginProcessor', '未找到 "Remember me" 复选框,跳过');
    }
  }

  /**
   * 提交登录表单
   */
  private async submitLogin(): Promise<void> {
    logger.info('LoginProcessor', '正在提交登录表单...');

    // 查找登录按钮
    const loginButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("登录")',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button:has-text("登录")',
      'input[type="submit"]',
    ];

    let loginButton = await this.findElement(loginButtonSelectors);

    if (!loginButton) {
      // 如果没找到按钮,尝试按回车提交
      logger.info('LoginProcessor', '未找到登录按钮,尝试按回车键提交');
      await this.page.keyboard.press('Enter');
    } else {
      await loginButton.click();
    }

    logger.info('LoginProcessor', '登录表单已提交');
  }

  /**
   * 等待登录结果
   */
  private async waitForLoginResult(): Promise<boolean> {
    logger.info('LoginProcessor', '等待登录结果...');

    try {
      // 等待页面导航或元素变化
      await delay(3000);

      // 检查是否登录成功 (检查是否有常见的登录后元素)
      const successIndicators = [
        '.dashboard',
        '.user-info',
        '.avatar',
        '[data-testid="user-menu"]',
      ];

      const success = await this.page.evaluate((selectors) => {
        return selectors.some((selector) => {
          const element = document.querySelector(selector);
          return element !== null;
        });
      }, successIndicators);

      // 也可以检查 URL 是否变化
      const currentUrl = this.page.url();
      const urlChanged = !currentUrl.includes('login') && !currentUrl.includes('signin');

      return success || urlChanged;
    } catch (error) {
      logger.warn('LoginProcessor', '检测登录状态时出错', error);
      return false;
    }
  }

  /**
   * 查找元素 (尝试多个选择器)
   */
  private async findElement(selectors: string[]): Promise<any> {
    for (const selector of selectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          return element;
        }
      } catch (error) {
        // 继续尝试下一个选择器
      }
    }
    return null;
  }
}
