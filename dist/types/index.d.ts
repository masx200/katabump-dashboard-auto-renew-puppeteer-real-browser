export interface LoginCredentials {
    username: string;
    password: string;
}
export interface ServerConfig {
    id: string;
    name?: string;
    customOptions?: Record<string, unknown>;
}
export interface BrowserConfig {
    headless?: boolean;
    proxyUrl?: string;
    userAgent?: string;
    windowWidth?: number;
    windowHeight?: number;
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    executablePath?: string;
    dohUrl?: string;
    userDataDir?: string;
}
export interface RetryPolicy {
    maxRetries: number;
    retryInterval: number;
    retryOnTimeout: boolean;
    exponentialBackoff?: boolean;
    maxRetryInterval?: number;
    retryableErrors?: string[];
}
export interface NotificationConfig {
    enableEmail: boolean;
    emailConfig?: {
        smtpHost: string;
        smtpPort: number;
        fromAddress: string;
        toAddresses: string[];
    };
    enableWebhook: boolean;
    webhookUrl?: string;
    enableStdout?: boolean;
}
export interface RenewalConfig {
    credentials: LoginCredentials;
    servers: ServerConfig[];
    targetUrl: string;
    browser: BrowserConfig;
    retry: RetryPolicy;
    notifications: NotificationConfig;
}
export interface RenewalResult {
    success: boolean;
    serverId: string;
    message: string;
    details?: {
        oldExpiryDate?: string;
        newExpiryDate?: string;
        renewalDuration?: string;
        info?: string;
    };
    error?: {
        code: string;
        message: string;
        stack?: string;
    };
}
export interface BatchRenewalResult {
    totalCount: number;
    successCount: number;
    failureCount: number;
    results: RenewalResult[];
    executionTime: number;
}
export declare enum ErrorType {
    CONFIG_ERROR = "CONFIG_ERROR",
    NETWORK_ERROR = "NETWORK_ERROR",
    BROWSER_ERROR = "BROWSER_ERROR",
    PARSE_ERROR = "PARSE_ERROR",
    VERIFY_ERROR = "VERIFY_ERROR",
    BUSINESS_ERROR = "BUSINESS_ERROR"
}
export declare class RenewalError extends Error {
    type: ErrorType;
    code?: string | undefined;
    constructor(type: ErrorType, message: string, code?: string | undefined);
}
//# sourceMappingURL=index.d.ts.map