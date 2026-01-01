import { BrowserConfig } from '../types';
type Page = any;
export declare function smoothMouseMove(page: Page, startX: number, startY: number, endX: number, endY: number, steps?: number): Promise<void>;
export declare class BrowserController {
    private browser;
    private currentPage;
    private config;
    private readonly DEFAULT_DOH_URL;
    constructor(config: BrowserConfig);
    private getDoHArgs;
    launch(): Promise<void>;
    private configurePage;
    newPage(): Promise<Page>;
    private configureLocale;
    getCurrentPage(): Page;
    navigate(url: string): Promise<void>;
    waitForCloudflareVerification(): Promise<void>;
    diagnoseEnvironment(): Promise<void>;
    screenshot(filePath?: string): Promise<Buffer | Uint8Array>;
    getHtml(): Promise<string>;
    close(): Promise<void>;
}
export {};
//# sourceMappingURL=controller.d.ts.map