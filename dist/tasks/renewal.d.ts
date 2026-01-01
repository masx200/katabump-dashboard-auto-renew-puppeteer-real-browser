/**
 * 续期执行器
 */
import { Page } from 'puppeteer';
import { RenewalResult } from '../types';
export declare class RenewalExecutor {
    private page;
    constructor(page: Page);
    /**
     * 执行续期操作
     */
    executeRenewal(serverId: string): Promise<RenewalResult>;
    /**
     * 查找并点击续期按钮
     * KataBump 续期流程:
     * 1. 点击页面上的 "Renew" 按钮 (button[data-bs-target="#renew-modal"])
     * 2. 打开续期模态框
     */
    private findAndClickRenewalButton;
    /**
     * 处理续期确认对话框(模态框)
     * KataBump 的续期模态框包含:
     * - Cloudflare Turnstile iframe 验证码
     * - Close 按钮
     * - Renew 按钮(在验证码右侧或下方)
     */
    private handleRenewalConfirmation;
    /**
     * 点击验证码区域来触发 Cloudflare Turnstile 验证
     * 通过定位 "Captcha" label 并在其右侧约 200px 处使用坐标点击
     * 使用 Puppeteer 的 page.mouse.click() 可以穿透 Shadow DOM (closed)
     */
    private clickCaptchaArea;
    /**
     * 执行随机鼠标移动,模拟真实用户行为
     * 在点击验证码之前进行随机方向的平滑移动
     */
    private performRandomMouseMovement;
    /**
     * 点击模态框中的 Renew 按钮
     */
    private clickModalRenewButton;
    /**
     * 等待续期处理完成
     */
    private waitForRenewalCompletion;
    /**
     * 验证续期结果
     */
    private verifyRenewalResult;
}
//# sourceMappingURL=renewal.d.ts.map