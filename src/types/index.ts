/**
 * 登录凭证
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * 服务器配置
 */
export interface ServerConfig {
  id: string;
  name?: string;
  customOptions?: Record<string, unknown>;
}

/**
 * 浏览器配置
 */
export interface BrowserConfig {
  headless?: boolean;
  proxyUrl?: string;
  userAgent?: string;
  windowWidth?: number;
  windowHeight?: number;
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  executablePath?: string;
  /** DNS over HTTPS (DoH) 服务器 URL */
  dohUrl?: string;
  /** Chrome 用户数据目录路径,用于缓存和持久化数据 */
  userDataDir?: string;
}

/**
 * 重试策略
 */
export interface RetryPolicy {
  maxRetries: number;
  retryInterval: number;
  retryOnTimeout: boolean;
  exponentialBackoff?: boolean;
  maxRetryInterval?: number;
  retryableErrors?: string[];
}

/**
 * 通知配置
 */
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

/**
 * 续期配置
 */
export interface RenewalConfig {
  credentials: LoginCredentials;
  servers: ServerConfig[];
  targetUrl: string;
  browser: BrowserConfig;
  retry: RetryPolicy;
  notifications: NotificationConfig;
}

/**
 * 续期结果
 */
export interface RenewalResult {
  success: boolean;
  serverId: string;
  message: string;
  details?: {
    oldExpiryDate?: string;
    newExpiryDate?: string;
    renewalDuration?: string;
    /** 额外信息（如"还未到续期时间"的详细消息） */
    info?: string;
  };
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

/**
 * 批量续期结果
 */
export interface BatchRenewalResult {
  totalCount: number;
  successCount: number;
  failureCount: number;
  results: RenewalResult[];
  executionTime: number;
}

/**
 * 错误类型
 */
export enum ErrorType {
  CONFIG_ERROR = 'CONFIG_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  BROWSER_ERROR = 'BROWSER_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  VERIFY_ERROR = 'VERIFY_ERROR',
  BUSINESS_ERROR = 'BUSINESS_ERROR',
}

/**
 * 自定义错误类
 */
export class RenewalError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'RenewalError';
  }
}
