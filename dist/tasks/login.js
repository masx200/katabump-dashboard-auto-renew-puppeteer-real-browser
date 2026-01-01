"use strict";
/**
 * 登录处理器
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginProcessor = void 0;
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
/**
 * 等待指定毫秒数
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class LoginProcessor {
    constructor(page) {
        this.page = page;
    }
    /**
     * 执行登录操作
     */
    async login(credentials) {
        try {
            logger_1.logger.info('LoginProcessor', '开始登录流程...');
            // 等待页面加载
            await this.waitForPageLoad();
            // 检测并填写登录表单
            await this.fillLoginForm(credentials);
            // 提交登录
            await this.submitLogin();
            // 等待登录结果
            const success = await this.waitForLoginResult();
            if (success) {
                logger_1.logger.info('LoginProcessor', '登录成功');
                return true;
            }
            else {
                logger_1.logger.error('LoginProcessor', '登录失败');
                throw new types_1.RenewalError(types_1.ErrorType.VERIFY_ERROR, '登录失败: 未检测到登录成功的标志');
            }
        }
        catch (error) {
            logger_1.logger.error('LoginProcessor', '登录过程出错', error);
            if (error instanceof types_1.RenewalError) {
                throw error;
            }
            throw new types_1.RenewalError(types_1.ErrorType.VERIFY_ERROR, `登录过程出错: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * 等待页面加载完成
     */
    async waitForPageLoad() {
        logger_1.logger.info('LoginProcessor', '等待页面加载完成...');
        // 等待常见的登录表单元素出现
        try {
            await this.page.waitForSelector('input[type="email"], input[name="email"], input[type="text"]', {
                timeout: 10000,
            });
        }
        catch (error) {
            throw new types_1.RenewalError(types_1.ErrorType.PARSE_ERROR, '未找到登录表单,可能页面结构已变化或不是登录页面');
        }
    }
    /**
     * 填写登录表单
     */
    async fillLoginForm(credentials) {
        logger_1.logger.info('LoginProcessor', '正在填写登录表单...');
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
            throw new types_1.RenewalError(types_1.ErrorType.PARSE_ERROR, '未找到用户名/邮箱输入框');
        }
        // 清空并输入用户名
        await usernameInput.click();
        await usernameInput.type('', { delay: 0 });
        await this.page.evaluate((el) => el.value = '', usernameInput);
        await usernameInput.type(credentials.username, { delay: 50 });
        logger_1.logger.info('LoginProcessor', '用户名已填写');
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
            throw new types_1.RenewalError(types_1.ErrorType.PARSE_ERROR, '未找到密码输入框');
        }
        // 清空并输入密码
        await passwordInput.click();
        await passwordInput.type('', { delay: 0 });
        await this.page.evaluate((el) => el.value = '', passwordInput);
        await passwordInput.type(credentials.password, { delay: 50 });
        logger_1.logger.info('LoginProcessor', '密码已填写');
        // 点击 "Remember me" 复选框
        try {
            const rememberCheckbox = await this.page.$('input[name="remember"]');
            if (rememberCheckbox) {
                // 检查是否已选中,如果未选中则点击
                const isChecked = await this.page.evaluate((el) => el.checked, rememberCheckbox);
                if (!isChecked) {
                    await rememberCheckbox.click();
                    logger_1.logger.info('LoginProcessor', '已勾选 "Remember me"');
                }
            }
        }
        catch (error) {
            logger_1.logger.warn('LoginProcessor', '未找到 "Remember me" 复选框,跳过');
        }
    }
    /**
     * 提交登录表单
     */
    async submitLogin() {
        logger_1.logger.info('LoginProcessor', '正在提交登录表单...');
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
            logger_1.logger.info('LoginProcessor', '未找到登录按钮,尝试按回车键提交');
            await this.page.keyboard.press('Enter');
        }
        else {
            await loginButton.click();
        }
        logger_1.logger.info('LoginProcessor', '登录表单已提交');
    }
    /**
     * 等待登录结果
     */
    async waitForLoginResult() {
        logger_1.logger.info('LoginProcessor', '等待登录结果...');
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
        }
        catch (error) {
            logger_1.logger.warn('LoginProcessor', '检测登录状态时出错', error);
            return false;
        }
    }
    /**
     * 查找元素 (尝试多个选择器)
     */
    async findElement(selectors) {
        for (const selector of selectors) {
            try {
                const element = await this.page.$(selector);
                if (element) {
                    return element;
                }
            }
            catch (error) {
                // 继续尝试下一个选择器
            }
        }
        return null;
    }
}
exports.LoginProcessor = LoginProcessor;
//# sourceMappingURL=login.js.map