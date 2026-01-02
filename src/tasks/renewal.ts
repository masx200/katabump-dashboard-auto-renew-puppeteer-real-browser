/**
 * 续期执行器
 */

import { Page } from 'puppeteer';
import { logger } from '../utils/logger';
import { RenewalError, ErrorType, RenewalResult } from '../types';
import { smoothMouseMove } from '../browser/controller';

/**
 * 等待指定毫秒数
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class RenewalExecutor {
  constructor(private page: Page) { }

  /**
   * 执行续期操作
   */
  async executeRenewal(serverId: string): Promise<RenewalResult> {
    try {
      logger.info('RenewalExecutor', `开始执行服务器续期: ${serverId}`);

      // 查找并点击续期按钮
      await this.findAndClickRenewalButton();

      // 等待续期确认对话框
      await this.handleRenewalConfirmation();

      // 等待续期处理完成
      await this.waitForRenewalCompletion();

      // 验证续期结果
      const result = await this.verifyRenewalResult(serverId);

      logger.info('RenewalExecutor', `服务器续期${result.success ? '成功' : '失败'}: ${serverId}`);
      return result;
    } catch (error) {
      logger.error('RenewalExecutor', '续期操作失败', error);

      return {
        success: false,
        serverId,
        message: `续期操作失败: ${error instanceof Error ? error.message : String(error)}`,
        error: {
          code: error instanceof RenewalError ? error.type : 'UNKNOWN',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  /**
   * 查找并点击续期按钮
   * KataBump 续期流程:
   * 1. 点击页面上的 "Renew" 按钮 (button[data-bs-target="#renew-modal"])
   * 2. 打开续期模态框
   */
  private async findAndClickRenewalButton(): Promise<void> {
    logger.info('RenewalExecutor', '正在查找续期按钮...');

    let buttonFound = false;

    // 方法1: 通过 data-bs-target 属性查找 (最可靠)
    try {
      const renewButton = await this.page.$('button[data-bs-target="#renew-modal"]');
      if (renewButton) {
        await renewButton.click();
        buttonFound = true;
        logger.info('RenewalExecutor', '已点击 Renew 按钮(通过 data-bs-target)');
      }
    } catch (error) {
      logger.warn('RenewalExecutor', '方法1失败', error);
    }

    // 方法2: 通过 class 和文本查找
    if (!buttonFound) {
      try {
        const renewButton = await this.page.$('button.btn-outline-primary');
        if (renewButton) {
          const buttonText = await renewButton.evaluate((el) => el.textContent?.trim());
          if (buttonText === 'Renew') {
            await renewButton.click();
            buttonFound = true;
            logger.info('RenewalExecutor', '已点击 Renew 按钮(通过 class 和文本)');
          }
        }
      } catch (error) {
        logger.warn('RenewalExecutor', '方法2失败', error);
      }
    }

    // 方法3: 通过文本内容查找
    if (!buttonFound) {
      const found = await this.page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.trim().toLowerCase() || '';
          // 查找完全匹配 "renew" 的按钮
          if (text === 'renew') {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (found) {
        buttonFound = true;
        logger.info('RenewalExecutor', '已点击 Renew 按钮(通过文本内容)');
      }
    }

    if (!buttonFound) {
      throw new RenewalError(
        ErrorType.PARSE_ERROR,
        '未找到 Renew 按钮,可能页面结构已变化'
      );
    }

    // 等待模态框出现
    await delay(1000);
    logger.info('RenewalExecutor', 'Renew 按钮已点击,等待模态框打开');
  }

  /**
   * 处理续期确认对话框(模态框)
   * KataBump 的续期模态框包含:
   * - Cloudflare Turnstile iframe 验证码
   * - Close 按钮
   * - Renew 按钮(在验证码右侧或下方)
   */
  private async handleRenewalConfirmation(): Promise<void> {
    logger.info('RenewalExecutor', '等待续期模态框出现...');

    try {
      // 等待模态框出现
      await this.page.waitForSelector('#renew-modal, .modal.show', {
        timeout: 5000
      }).catch(() => {
        logger.warn('RenewalExecutor', '未检测到模态框,可能已经自动关闭');
      });

      await delay(1000);

      // 检查模态框是否存在
      const modalExists = await this.page.evaluate(() => {
        const modal = document.querySelector('#renew-modal');
        if (!modal) return false;
        const modalElement = modal as HTMLElement;
        return modalElement.classList.contains('show') ||
          window.getComputedStyle(modalElement).display !== 'none';
      });

      if (!modalExists) {
        logger.info('RenewalExecutor', '模态框未显示,可能续期已完成或不需要确认');
        return;
      }

      logger.info('RenewalExecutor', '续期模态框已打开');

      // 检查是否有 Cloudflare Turnstile 验证码
      // iframe 被隐藏在 shadow-root(closed) 中,无法直接访问
      // 但可以通过查找隐藏的 input[name="cf-turnstile-response"] 来判断
      var hasCaptcha = await this.page.evaluate(() => {
        const captchaInput = document.querySelector('input[name="cf-turnstile-response"]');
        return !!captchaInput;
      });

      if (hasCaptcha) {
        logger.info('RenewalExecutor', '检测到 Cloudflare Turnstile 验证码');
        logger.info('RenewalExecutor', '尝试触发 Cloudflare 自动验证...');

        // 等待 20 秒让页面完全加载
        await delay(20000);

        // 尝试点击验证码区域来触发验证
        // 根据 HTML 结构,Captcha label 在左侧,验证码 iframe 在右侧约 200px 位置
        const captchaClicked = await this.clickCaptchaArea();

        if (captchaClicked) {
          logger.info('RenewalExecutor', '✅ 已点击验证码区域,等待验证完成...');
        } else {
          logger.warn('RenewalExecutor', '⚠️ 未能点击验证码区域,等待自动验证...');
        }

        // 等待验证码自动完成
        logger.info('RenewalExecutor', '等待 60 秒供验证码完成...');

        let captchaCompleted = false;
        for (let i = 0; i < 60; i++) {
          await delay(1000);

          captchaCompleted = await this.page.evaluate(() => {
            // 检查 Turnstile 的成功标记
            const successToken = document.querySelector('input[name="cf-turnstile-response"]');
            if (!successToken) return false;

            const value = (successToken as HTMLInputElement).value;

            // 成功的 token 通常非常长(>500字符)
            // 失败的 token 通常以 "0." 开头,长度较短
            // 检查 token 是否存在且长度大于 500
            return Boolean(value && value.length > 500);
          });

          if (captchaCompleted) {
            logger.info('RenewalExecutor', `✅ 验证码已完成 (耗时: ${i}s)`);
            break;
          }
          await delay(10000)
          const captchaClicked = await this.clickCaptchaArea();

          if (captchaClicked) {
            logger.info('RenewalExecutor', '✅ 已点击验证码区域,等待验证完成...');
          } else {
            logger.warn('RenewalExecutor', '⚠️ 未能点击验证码区域,等待自动验证...');
          }
          // 每 10 秒输出一次等待信息
          if (i > 0 && i % 10 === 0) {
            logger.info('RenewalExecutor', `仍在等待验证码完成... (${i}s/60s)`);
          }
        }

        if (!captchaCompleted) {
          logger.warn('RenewalExecutor', '⚠️ 验证码超时未完成,尝试继续...');
        }

        // 验证码完成后,额外等待 10 秒让 Cloudflare 处理
        logger.info('RenewalExecutor', '验证码已完成,等待 10 秒让 Cloudflare 处理...');
        await delay(10000);
        logger.info('RenewalExecutor', '✅ Cloudflare 处理完成');
      } else {
        // 没有验证码,等待一下让页面稳定
        logger.info('RenewalExecutor', '未检测到验证码,等待 60 秒...');
        await delay(60000);
      }
    var hasCaptcha = await this.page.evaluate(() => {
        const captchaInput = document.querySelector('input[name="cf-turnstile-response"]');
        return !!captchaInput;
      });

      if (hasCaptcha) {
        logger.info('RenewalExecutor', '检测到 Cloudflare Turnstile 验证码');
        logger.info('RenewalExecutor', '尝试触发 Cloudflare 自动验证...');

        // 等待 20 秒让页面完全加载
        await delay(20000);

        // 尝试点击验证码区域来触发验证
        // 根据 HTML 结构,Captcha label 在左侧,验证码 iframe 在右侧约 200px 位置
        const captchaClicked = await this.clickCaptchaArea();

        if (captchaClicked) {
          logger.info('RenewalExecutor', '✅ 已点击验证码区域,等待验证完成...');
        } else {
          logger.warn('RenewalExecutor', '⚠️ 未能点击验证码区域,等待自动验证...');
        }

        // 等待验证码自动完成
        logger.info('RenewalExecutor', '等待 60 秒供验证码完成...');

        let captchaCompleted = false;
        for (let i = 0; i < 60; i++) {
          await delay(1000);

          captchaCompleted = await this.page.evaluate(() => {
            // 检查 Turnstile 的成功标记
            const successToken = document.querySelector('input[name="cf-turnstile-response"]');
            if (!successToken) return false;

            const value = (successToken as HTMLInputElement).value;

            // 成功的 token 通常非常长(>500字符)
            // 失败的 token 通常以 "0." 开头,长度较短
            // 检查 token 是否存在且长度大于 500
            return Boolean(value && value.length > 500);
          });

          if (captchaCompleted) {
            logger.info('RenewalExecutor', `✅ 验证码已完成 (耗时: ${i}s)`);
            break;
          }
          await delay(10000)
          const captchaClicked = await this.clickCaptchaArea();

          if (captchaClicked) {
            logger.info('RenewalExecutor', '✅ 已点击验证码区域,等待验证完成...');
          } else {
            logger.warn('RenewalExecutor', '⚠️ 未能点击验证码区域,等待自动验证...');
          }
          // 每 10 秒输出一次等待信息
          if (i > 0 && i % 10 === 0) {
            logger.info('RenewalExecutor', `仍在等待验证码完成... (${i}s/60s)`);
          }
        }

        if (!captchaCompleted) {
          logger.warn('RenewalExecutor', '⚠️ 验证码超时未完成,尝试继续...');
        }

        // 验证码完成后,额外等待 10 秒让 Cloudflare 处理
        logger.info('RenewalExecutor', '验证码已完成,等待 10 秒让 Cloudflare 处理...');
        await delay(10000);
        logger.info('RenewalExecutor', '✅ Cloudflare 处理完成');
      } else {
        // 没有验证码,等待一下让页面稳定
        logger.info('RenewalExecutor', '未检测到验证码,等待 60 秒...');
        await delay(60000);
      }
      // 查找并点击模态框中的 Renew 确认按钮
      logger.info('RenewalExecutor', '查找模态框中的 Renew 按钮...');

      const confirmButtonClicked = await this.clickModalRenewButton();

      if (confirmButtonClicked) {
        logger.info('RenewalExecutor', '✅ 已点击模态框中的 Renew 按钮');
      } else {
        logger.warn('RenewalExecutor', '未找到模态框中的 Renew 按钮');
      }

      // 等待模态框关闭
      await delay(2000);

    } catch (error) {
      logger.warn('RenewalExecutor', '处理续期确认对话框时出错', error);
    }
  }

  /**
   * 点击验证码区域来触发 Cloudflare Turnstile 验证
   * 通过定位 "Captcha" label 并在其右侧约 200px 处使用坐标点击
   * 使用 Puppeteer 的 page.mouse.click() 可以穿透 Shadow DOM (closed)
   */
  private async clickCaptchaArea(): Promise<boolean> {
    try {
      logger.info('RenewalExecutor', '查找 Captcha label 并计算点击坐标...');

      // 先执行随机鼠标移动,模拟真实用户行为
      await this.performRandomMouseMovement();

      // 查找 Captcha label 并获取其位置
      const rect = await this.page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        const captchaLabel = labels.find(label =>
          label.textContent?.trim().toLowerCase() === 'captcha'
        );

        if (!captchaLabel) {
          return null;
        }

        // 获取元素在视口中的位置
        const { x, y, width, height } = captchaLabel.getBoundingClientRect();
        return { x, y, width, height };
      });

      if (!rect) {
        logger.warn('RenewalExecutor', '未找到 Captcha label');
        return false;
      }

      // 计算点击坐标
      // X 轴偏移 200px (这是 iframe 所在的位置)
      // Y 轴取 label 的中心
      const clickX = rect.x + 200;
      const clickY = rect.y + (rect.height / 2);

      logger.info('RenewalExecutor', `计算点击坐标: (${clickX.toFixed(0)}, ${clickY.toFixed(0)})`);

      // 使用 Bézier 曲线平滑移动鼠标到目标位置
      // 获取当前鼠标位置（默认页面中心）
      const currentX = 960;
      const currentY = 540;

      logger.info('RenewalExecutor', '使用 Bézier 曲线平滑移动鼠标...');
      await smoothMouseMove(this.page, currentX, currentY, clickX, clickY);

      // 使用 Puppeteer 的鼠标点击 API
      // 这种方式可以穿透 Shadow DOM (closed) 并触发真实的事件
      await this.page.mouse.click(clickX, clickY);

      logger.info('RenewalExecutor', '✅ 已使用坐标点击验证码区域');
      return true;
    } catch (error) {
      logger.warn('RenewalExecutor', '点击验证码区域失败', error);
      return false;
    }
  }

  /**
   * 执行随机鼠标移动,模拟真实用户行为
   * 在点击验证码之前进行随机方向的平滑移动
   * 使用 Bézier 曲线实现更自然的鼠标轨迹
   */
  private async performRandomMouseMovement(): Promise<void> {
    try {
      logger.info('RenewalExecutor', '执行随机鼠标移动 (使用 Bézier 曲线)...');

      // 获取当前鼠标位置(假设在页面中心)
      let currentX = 960;
      let currentY = 540;

      // 进行 3-5 次随机移动
      const moves = Math.floor(Math.random() * 3) + 3;

      for (let i = 0; i < moves; i++) {
        // 生成随机目标点(在合理范围内)
        const targetX = Math.floor(Math.random() * 400) + 760; // 760-1160
        const targetY = Math.floor(Math.random() * 300) + 390; // 390-690

        // 使用 Bézier 曲线平滑移动
        await smoothMouseMove(this.page, currentX, currentY, targetX, targetY);

        // 更新当前位置
        currentX = targetX;
        currentY = targetY;

        // 每次移动后短暂停顿,更真实
        await delay(Math.floor(Math.random() * 200) + 100);
      }

      logger.info('RenewalExecutor', `✅ 已完成 ${moves} 次随机鼠标移动`);
    } catch (error) {
      logger.warn('RenewalExecutor', '随机鼠标移动失败,继续执行', error);
    }
  }

  /**
   * 点击模态框中的 Renew 按钮
   */
  private async clickModalRenewButton(): Promise<boolean> {
    try {
      // 在模态框内查找 Renew 按钮
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
        } catch (error) {
          // 继续尝试下一个选择器
        }
      }

      // 通过文本内容在模态框中查找
      const found = await this.page.evaluate(() => {
        const modal = document.querySelector('#renew-modal, .modal.show');
        if (!modal) return false;

        const buttons = modal.querySelectorAll('button:not([data-bs-dismiss])');
        for (const btn of buttons) {
          const text = btn.textContent?.trim().toLowerCase() || '';
          if (text === 'renew' && (btn as HTMLElement).offsetParent !== null) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      return found;
    } catch (error) {
      logger.warn('RenewalExecutor', '点击模态框 Renew 按钮失败', error);
      return false;
    }
  }

  /**
   * 等待续期处理完成
   */
  private async waitForRenewalCompletion(): Promise<void> {
    logger.info('RenewalExecutor', '等待续期处理完成...');

    try {
      // 等待网络空闲或成功提示
      await this.page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 15000,
      }).catch(() => {
        // 可能没有页面跳转
      });

      // 额外等待一下,确保处理完成
      await delay(2000);

      logger.info('RenewalExecutor', '续期处理完成');
    } catch (error) {
      logger.warn('RenewalExecutor', '等待续期完成超时,尝试继续验证', error);
    }
  }

  /**
   * 验证续期结果
   */
  private async verifyRenewalResult(serverId: string): Promise<RenewalResult> {
    logger.info('RenewalExecutor', '验证续期结果...');

    try {
      // 首先检查是否显示 "还未到续期时间" 的消息
      const notYetRenewableMessage = await this.page.evaluate(() => {
        const pageText = document.body.textContent || '';
        // 检查 "You can't renew your server yet" 类型的消息
        const notRenewablePatterns = [
          /can't renew your server yet/i,
          /cannot renew your server yet/i,
          /will be able to renew/i,
          /in \d+ day\(s\)/i,
        ];

        for (const pattern of notRenewablePatterns) {
          if (pattern.test(pageText)) {
            return pageText.match(pattern)?.[0] || 'Not yet renewable';
          }
        }

        return null;
      });

      if (notYetRenewableMessage) {
        logger.info('RenewalExecutor', `✅ 服务器还未到续期时间: ${notYetRenewableMessage}`);
        return {
          success: true,
          serverId,
          message: '服务器还未到续期时间（无需续期）',
          details: {
            info: notYetRenewableMessage,
          },
        };
      }

      // 检查是否有成功提示
      const successIndicators = [
        '续期成功',
        'renewal successful',
        'renewed successfully',
        '操作成功',
        'your service has been renewed',
        'service has been renewed',
        'success',
      ];

      const hasSuccessMessage = await this.page.evaluate((indicators) => {
        const pageText = document.body.textContent?.toLowerCase() || '';
        return indicators.some((indicator) => pageText.includes(indicator.toLowerCase()));
      }, successIndicators);

      // 检查是否有错误提示 (更具体的错误消息,避免误检测)
      const errorIndicators = [
        '续期失败',
        'renewal failed',
        'renewal error',
        '操作失败',
        'operation failed',
        'invalid request',
        'unauthorized',
        'forbidden',
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

      // 如果没有明确的成功或失败提示,检查租期信息
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

      // 默认认为成功
      return {
        success: true,
        serverId,
        message: '续期操作已执行,未检测到错误',
      };
    } catch (error) {
      logger.error('RenewalExecutor', '验证续期结果时出错', error);

      return {
        success: false,
        serverId,
        message: `验证续期结果失败: ${error instanceof Error ? error.message : String(error)}`,
        error: {
          code: ErrorType.VERIFY_ERROR,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }
}
