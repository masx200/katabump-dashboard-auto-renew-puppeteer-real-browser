import { Page } from 'puppeteer';
import { BrowserConfig } from '../types';
export declare class BrowserController {
    private browser;
    private currentPage;
    private config;
    private readonly DEFAULT_DOH_URL;
    constructor(config: BrowserConfig);
    private getDoHArgs;
    launch(): Promise<void>;
    newPage(): Promise<Page>;
    private applyAntiDetectionScripts;
    private configureLocale;
    getCurrentPage(): Page;
    navigate(url: string): Promise<void>;
    waitForCloudflareVerification(): Promise<void>;
    diagnoseEnvironment(): Promise<void>;
    screenshot(filePath?: string): Promise<Buffer | Uint8Array>;
    getHtml(): Promise<string>;
    close(): Promise<void>;
}
//# sourceMappingURL=controller.d.ts.map