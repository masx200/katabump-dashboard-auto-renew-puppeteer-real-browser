"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenewalExecutor = void 0;
const logger_1 = require("../utils/logger");
const types_1 = require("../types");
const controller_1 = require("../browser/controller");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class RenewalExecutor {
    constructor(page) {
        this.page = page;
    }
    async executeRenewal(serverId) {
        try {
            logger_1.logger.info('RenewalExecutor', `开始执行服务器续期: ${serverId}`);
            await this.findAndClickRenewalButton();
            await this.handleRenewalConfirmation();
            await this.waitForRenewalCompletion();
            const result = await this.verifyRenewalResult(serverId);
            logger_1.logger.info('RenewalExecutor', `服务器续期${result.success ? '成功' : '失败'}: ${serverId}`);
            return result;
        }
        catch (error) {
            logger_1.logger.error('RenewalExecutor', '续期操作失败', error);
            return {
                success: false,
                serverId,
                message: `续期操作失败: ${error instanceof Error ? error.message : String(error)}`,
                error: {
                    code: error instanceof types_1.RenewalError ? error.type : 'UNKNOWN',
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
            };
        }
    }
    async findAndClickRenewalButton() {
        logger_1.logger.info('RenewalExecutor', '正在查找续期按钮...');
        let buttonFound = false;
        try {
            const renewButton = await this.page.$('button[data-bs-target="#renew-modal"]');
            if (renewButton) {
                await renewButton.click();
                buttonFound = true;
                logger_1.logger.info('RenewalExecutor', '已点击 Renew 按钮(通过 data-bs-target)');
            }
        }
        catch (error) {
            logger_1.logger.warn('RenewalExecutor', '方法1失败', error);
        }
        if (!buttonFound) {
            try {
                const renewButton = await this.page.$('button.btn-outline-primary');
                if (renewButton) {
                    const buttonText = await renewButton.evaluate((el) => el.textContent?.trim());
                    if (buttonText === 'Renew') {
                        await renewButton.click();
                        buttonFound = true;
                        logger_1.logger.info('RenewalExecutor', '已点击 Renew 按钮(通过 class 和文本)');
                    }
                }
            }
            catch (error) {
                logger_1.logger.warn('RenewalExecutor', '方法2失败', error);
            }
        }
        if (!buttonFound) {
            const found = await this.page.evaluate(() => {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.textContent?.trim().toLowerCase() || '';
                    if (text === 'renew') {
                        btn.click();
                        return true;
                    }
                }
                return false;
            });
            if (found) {
                buttonFound = true;
                logger_1.logger.info('RenewalExecutor', '已点击 Renew 按钮(通过文本内容)');
            }
        }
        if (!buttonFound) {
            throw new types_1.RenewalError(types_1.ErrorType.PARSE_ERROR, '未找到 Renew 按钮,可能页面结构已变化');
        }
        await delay(1000);
        logger_1.logger.info('RenewalExecutor', 'Renew 按钮已点击,等待模态框打开');
    }
    async handleRenewalConfirmation() {
        logger_1.logger.info('RenewalExecutor', '等待续期模态框出现...');
        try {
            await this.page.waitForSelector('#renew-modal, .modal.show', {
                timeout: 5000
            }).catch(() => {
                logger_1.logger.warn('RenewalExecutor', '未检测到模态框,可能已经自动关闭');
            });
            await delay(1000);
            const modalExists = await this.page.evaluate(() => {
                const modal = document.querySelector('#renew-modal');
                if (!modal)
                    return false;
                const modalElement = modal;
                return modalElement.classList.contains('show') ||
                    window.getComputedStyle(modalElement).display !== 'none';
            });
            if (!modalExists) {
                logger_1.logger.info('RenewalExecutor', '模态框未显示,可能续期已完成或不需要确认');
                return;
            }
            logger_1.logger.info('RenewalExecutor', '续期模态框已打开');
            var hasCaptcha = await this.page.evaluate(() => {
                const captchaInput = document.querySelector('input[name="cf-turnstile-response"]');
                return !!captchaInput;
            });
            if (hasCaptcha) {
                logger_1.logger.info('RenewalExecutor', '检测到 Cloudflare Turnstile 验证码');
                logger_1.logger.info('RenewalExecutor', '尝试触发 Cloudflare 自动验证...');
                await delay(20000);
                const captchaClicked = await this.clickCaptchaArea();
                if (captchaClicked) {
                    logger_1.logger.info('RenewalExecutor', '✅ 已点击验证码区域,等待验证完成...');
                }
                else {
                    logger_1.logger.warn('RenewalExecutor', '⚠️ 未能点击验证码区域,等待自动验证...');
                }
                logger_1.logger.info('RenewalExecutor', '等待 60 秒供验证码完成...');
                let captchaCompleted = false;
                for (let i = 0; i < 60; i++) {
                    await delay(1000);
                    captchaCompleted = await this.page.evaluate(() => {
                        const successToken = document.querySelector('input[name="cf-turnstile-response"]');
                        if (!successToken)
                            return false;
                        const value = successToken.value;
                        return Boolean(value && value.length > 500);
                    });
                    if (captchaCompleted) {
                        logger_1.logger.info('RenewalExecutor', `✅ 验证码已完成 (耗时: ${i}s)`);
                        break;
                    }
                    await delay(10000);
                    const captchaClicked = await this.clickCaptchaArea();
                    if (captchaClicked) {
                        logger_1.logger.info('RenewalExecutor', '✅ 已点击验证码区域,等待验证完成...');
                    }
                    else {
                        logger_1.logger.warn('RenewalExecutor', '⚠️ 未能点击验证码区域,等待自动验证...');
                    }
                    if (i > 0 && i % 10 === 0) {
                        logger_1.logger.info('RenewalExecutor', `仍在等待验证码完成... (${i}s/60s)`);
                    }
                }
                if (!captchaCompleted) {
                    logger_1.logger.warn('RenewalExecutor', '⚠️ 验证码超时未完成,尝试继续...');
                }
                logger_1.logger.info('RenewalExecutor', '验证码已完成,等待 10 秒让 Cloudflare 处理...');
                await delay(10000);
                logger_1.logger.info('RenewalExecutor', '✅ Cloudflare 处理完成');
            }
            else {
                logger_1.logger.info('RenewalExecutor', '未检测到验证码,等待 60 秒...');
                await delay(60000);
            }
            var hasCaptcha = await this.page.evaluate(() => {
                const captchaInput = document.querySelector('input[name="cf-turnstile-response"]');
                return !!captchaInput;
            });
            if (hasCaptcha) {
                logger_1.logger.info('RenewalExecutor', '检测到 Cloudflare Turnstile 验证码');
                logger_1.logger.info('RenewalExecutor', '尝试触发 Cloudflare 自动验证...');
                await delay(20000);
                const captchaClicked = await this.clickCaptchaArea();
                if (captchaClicked) {
                    logger_1.logger.info('RenewalExecutor', '✅ 已点击验证码区域,等待验证完成...');
                }
                else {
                    logger_1.logger.warn('RenewalExecutor', '⚠️ 未能点击验证码区域,等待自动验证...');
                }
                logger_1.logger.info('RenewalExecutor', '等待 60 秒供验证码完成...');
                let captchaCompleted = false;
                for (let i = 0; i < 60; i++) {
                    await delay(1000);
                    captchaCompleted = await this.page.evaluate(() => {
                        const successToken = document.querySelector('input[name="cf-turnstile-response"]');
                        if (!successToken)
                            return false;
                        const value = successToken.value;
                        return Boolean(value && value.length > 500);
                    });
                    if (captchaCompleted) {
                        logger_1.logger.info('RenewalExecutor', `✅ 验证码已完成 (耗时: ${i}s)`);
                        break;
                    }
                    await delay(10000);
                    const captchaClicked = await this.clickCaptchaArea();
                    if (captchaClicked) {
                        logger_1.logger.info('RenewalExecutor', '✅ 已点击验证码区域,等待验证完成...');
                    }
                    else {
                        logger_1.logger.warn('RenewalExecutor', '⚠️ 未能点击验证码区域,等待自动验证...');
                    }
                    if (i > 0 && i % 10 === 0) {
                        logger_1.logger.info('RenewalExecutor', `仍在等待验证码完成... (${i}s/60s)`);
                    }
                }
                if (!captchaCompleted) {
                    logger_1.logger.warn('RenewalExecutor', '⚠️ 验证码超时未完成,尝试继续...');
                }
                logger_1.logger.info('RenewalExecutor', '验证码已完成,等待 10 秒让 Cloudflare 处理...');
                await delay(10000);
                logger_1.logger.info('RenewalExecutor', '✅ Cloudflare 处理完成');
            }
            else {
                logger_1.logger.info('RenewalExecutor', '未检测到验证码,等待 60 秒...');
                await delay(60000);
            }
            logger_1.logger.info('RenewalExecutor', '查找模态框中的 Renew 按钮...');
            const confirmButtonClicked = await this.clickModalRenewButton();
            if (confirmButtonClicked) {
                logger_1.logger.info('RenewalExecutor', '✅ 已点击模态框中的 Renew 按钮');
            }
            else {
                logger_1.logger.warn('RenewalExecutor', '未找到模态框中的 Renew 按钮');
            }
            await delay(2000);
        }
        catch (error) {
            logger_1.logger.warn('RenewalExecutor', '处理续期确认对话框时出错', error);
        }
    }
    async clickCaptchaArea() {
        try {
            logger_1.logger.info('RenewalExecutor', '查找 Captcha label 并计算点击坐标...');
            await this.performRandomMouseMovement();
            const rect = await this.page.evaluate(() => {
                const labels = Array.from(document.querySelectorAll('label'));
                const captchaLabel = labels.find(label => label.textContent?.trim().toLowerCase() === 'captcha');
                if (!captchaLabel) {
                    return null;
                }
                const { x, y, width, height } = captchaLabel.getBoundingClientRect();
                return { x, y, width, height };
            });
            if (!rect) {
                logger_1.logger.warn('RenewalExecutor', '未找到 Captcha label');
                return false;
            }
            const clickX = rect.x + 200;
            const clickY = rect.y + (rect.height / 2);
            logger_1.logger.info('RenewalExecutor', `计算点击坐标: (${clickX.toFixed(0)}, ${clickY.toFixed(0)})`);
            const currentX = 960;
            const currentY = 540;
            logger_1.logger.info('RenewalExecutor', '使用 Bézier 曲线平滑移动鼠标...');
            await (0, controller_1.smoothMouseMove)(this.page, currentX, currentY, clickX, clickY);
            await this.page.mouse.click(clickX, clickY);
            logger_1.logger.info('RenewalExecutor', '✅ 已使用坐标点击验证码区域');
            return true;
        }
        catch (error) {
            logger_1.logger.warn('RenewalExecutor', '点击验证码区域失败', error);
            return false;
        }
    }
    async performRandomMouseMovement() {
        try {
            logger_1.logger.info('RenewalExecutor', '执行随机鼠标移动 (使用 Bézier 曲线)...');
            let currentX = 960;
            let currentY = 540;
            const moves = Math.floor(Math.random() * 3) + 3;
            for (let i = 0; i < moves; i++) {
                const targetX = Math.floor(Math.random() * 400) + 760;
                const targetY = Math.floor(Math.random() * 300) + 390;
                await (0, controller_1.smoothMouseMove)(this.page, currentX, currentY, targetX, targetY);
                currentX = targetX;
                currentY = targetY;
                await delay(Math.floor(Math.random() * 200) + 100);
            }
            logger_1.logger.info('RenewalExecutor', `✅ 已完成 ${moves} 次随机鼠标移动`);
        }
        catch (error) {
            logger_1.logger.warn('RenewalExecutor', '随机鼠标移动失败,继续执行', error);
        }
    }
    async clickModalRenewButton() {
        try {
            const selectors = [
                '#renew-modal button.btn-primary',
                '#renew-modal button:has-text("Renew")',
                '.modal.show button.btn-primary',
                '.modal.show button:has-text("Renew")',
            ];
            for (const selector of selectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        const isVisible = await button.isIntersectingViewport();
                        if (isVisible) {
                            const buttonText = await button.evaluate((el) => el.textContent?.trim().toLowerCase());
                            if (buttonText === 'renew') {
                                await button.click();
                                return true;
                            }
                        }
                    }
                }
                catch (error) {
                }
            }
            const found = await this.page.evaluate(() => {
                const modal = document.querySelector('#renew-modal, .modal.show');
                if (!modal)
                    return false;
                const buttons = modal.querySelectorAll('button:not([data-bs-dismiss])');
                for (const btn of buttons) {
                    const text = btn.textContent?.trim().toLowerCase() || '';
                    if (text === 'renew' && btn.offsetParent !== null) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            });
            return found;
        }
        catch (error) {
            logger_1.logger.warn('RenewalExecutor', '点击模态框 Renew 按钮失败', error);
            return false;
        }
    }
    async waitForRenewalCompletion() {
        logger_1.logger.info('RenewalExecutor', '等待续期处理完成...');
        try {
            await this.page.waitForNavigation({
                waitUntil: 'networkidle0',
                timeout: 15000,
            }).catch(() => {
            });
            await delay(2000);
            logger_1.logger.info('RenewalExecutor', '续期处理完成');
        }
        catch (error) {
            logger_1.logger.warn('RenewalExecutor', '等待续期完成超时,尝试继续验证', error);
        }
    }
    async verifyRenewalResult(serverId) {
        logger_1.logger.info('RenewalExecutor', '验证续期结果...');
        try {
            const successIndicators = [
                '续期成功',
                'renewal successful',
                'renewed successfully',
                '操作成功',
                'success',
            ];
            const hasSuccessMessage = await this.page.evaluate((indicators) => {
                const pageText = document.body.textContent?.toLowerCase() || '';
                return indicators.some((indicator) => pageText.includes(indicator.toLowerCase()));
            }, successIndicators);
            const errorIndicators = [
                '续期失败',
                'renewal failed',
                'error',
                '错误',
                'failed',
            ];
            const hasErrorMessage = await this.page.evaluate((indicators) => {
                const pageText = document.body.textContent?.toLowerCase() || '';
                return indicators.some((indicator) => pageText.includes(indicator.toLowerCase()));
            }, errorIndicators);
            if (hasSuccessMessage && !hasErrorMessage) {
                return {
                    success: true,
                    serverId,
                    message: '续期成功',
                };
            }
            if (hasErrorMessage) {
                return {
                    success: false,
                    serverId,
                    message: '续期失败: 页面显示错误信息',
                };
            }
            const expiryInfo = await this.page.evaluate(() => {
                const expirySelectors = [
                    '.expiry-date',
                    '.renewal-date',
                    '[data-expiry]',
                    'td:has-text("到期")',
                    'td:has-text("Expire")',
                ];
                for (const selector of expirySelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        return element.textContent?.trim();
                    }
                }
                return null;
            });
            if (expiryInfo) {
                return {
                    success: true,
                    serverId,
                    message: '续期成功',
                    details: {
                        newExpiryDate: expiryInfo,
                    },
                };
            }
            return {
                success: true,
                serverId,
                message: '续期操作已执行,未检测到错误',
            };
        }
        catch (error) {
            logger_1.logger.error('RenewalExecutor', '验证续期结果时出错', error);
            return {
                success: false,
                serverId,
                message: `验证续期结果失败: ${error instanceof Error ? error.message : String(error)}`,
                error: {
                    code: types_1.ErrorType.VERIFY_ERROR,
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
            };
        }
    }
}
exports.RenewalExecutor = RenewalExecutor;
//# sourceMappingURL=renewal.js.map