# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based automated server renewal system for KataBump dashboard (https://dashboard.katabump.com). It uses Puppeteer Real Browser to automate the login and server renewal process, including handling Cloudflare Turnstile CAPTCHA challenges.

**CRITICAL REQUIREMENT**: This project MUST use `puppeteer-real-browser` with `headless: false` to successfully pass Cloudflare verification. Standard Puppeteer or Puppeteer Extra WILL FAIL Cloudflare's bot detection.

The system is specifically designed to:
- Automatically log into KataBump dashboard
- Navigate to specific server detail pages
- Handle Cloudflare Turnstile verification using coordinate-based clicking
- Execute server renewal operations
- Support batch processing of multiple servers

## Key Commands

### Development
```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Run in development mode
pnpm run dev

# Run tests
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Generate coverage report
pnpm test:ui           # Run Vitest UI

# Run production build
pnpm start             # Run from dist/
pnpm start:config      # Run with config.json

# Run test scripts
npx ts-node scripts/test-full-renewal.ts
npx ts-node scripts/test-fingerprint-detection.ts  # Test browser fingerprint anti-detection
```

### Cleanup
```bash
pnpm run clean         # Remove dist/ directory
```

## Architecture

### Core Components

**RenewalTask** (`src/index.ts`)
- Main orchestrator that coordinates the entire renewal workflow
- Manages browser lifecycle and executes renewal operations
- Supports both single-server and batch renewal modes
- Entry point for programmatic API usage

**BrowserController** (`src/browser/controller.ts`)
- Manages Puppeteer Real Browser instance lifecycle using `puppeteer-real-browser`
- **CRITICAL**: MUST use `headless: false` configuration
- The library uses rebrowser patches to bypass Cloudflare detection
- Configures DNS over HTTPS (DoH) using Chrome fieldtrial parameters
- Handles page navigation and Cloudflare verification detection
- Supports persistent user data directory for caching (`userDataDir`)
- Automatically handles Turnstile CAPTCHAs with `turnstile: true` option

**LoginProcessor** (`src/tasks/login.ts`)
- Automates the login process for KataBump dashboard
- Detects if user is already logged in (when using `userDataDir`)
- Fills login form and optionally clicks "Remember me" checkbox
- Handles login result verification

**ServerLocator** (`src/tasks/locator.ts`)
- Locates servers within the dashboard interface
- Supports direct URL navigation to server detail pages
- Alternative fallback: navigate by clicking through the UI

**RenewalExecutor** (`src/tasks/renewal.ts`)
- Executes the actual server renewal operation
- Handles the renewal modal and Cloudflare Turnstile CAPTCHA
- Uses coordinate-based clicking to bypass shadow-root(closed)
- Implements random mouse movement to simulate human behavior
- Validates CAPTCHA completion by checking token length (>500 chars)

### Important Implementation Details

#### Cloudflare Turnstile Handling

**IMPORTANT**: This system uses `puppeteer-real-browser` which automatically handles Cloudflare Turnstile CAPTCHAs when the `turnstile: true` option is enabled.

The library uses rebrowser patches to:
- Patch Puppeteer-core to avoid detection
- Simulate realistic mouse movements with ghost-cursor
- Bypass Cloudflare's bot detection systems

Manual coordinate-based clicking approach (fallback):
1. **Detection**: Checks for `input[name="cf-turnstile-response"]` element
2. **Coordinate-based clicking**: Uses `page.mouse.click(x, y)` to bypass shadow-root(closed)
3. **Human behavior simulation**: Performs 3-5 random mouse movements before clicking
4. **Token validation**: Checks if token value length > 500 characters (successful tokens are very long, failed tokens start with "0.")

The clicking strategy:
- Locates "Captcha" label element
- Calculates click position: `label.x + 200px, label.y + (label.height / 2)`
- Uses Puppeteer's mouse API which can penetrate Shadow DOM

**CRITICAL**: For successful Cloudflare verification:
- MUST use `puppeteer-real-browser` package (NOT standard `puppeteer` or `puppeteer-extra`)
- MUST set `headless: false` in configuration
- The library works best when headless is false (as per documentation)

#### Login State Detection

When `userDataDir` is configured, the system detects if already logged in by:
- Checking URL for `/dashboard` or `/servers`
- Searching page content for "Dashboard", "Servers", or "服务器"
- Skipping login form if already authenticated

#### Browser Configuration

Key browser settings:
- **DoH**: Uses https://doh.pub/dns-query by default
- **Viewport**: 1920x1080 (configurable)
- **User Data Directory**: Enables session persistence and caching
- **Executable Path**: Can specify custom Chrome installation path

### Configuration Structure

Located in `config.json` (see `config.example.json` for template):

```typescript
interface RenewalConfig {
  targetUrl: string;              // Dashboard URL
  credentials: {
    username: string;
    password: string;
  };
  servers: Array<{
    id: string;
    name?: string;
  }>;
  browser: {
    headless?: boolean;           // CRITICAL: MUST be false for Cloudflare!
    executablePath?: string;
    userDataDir?: string;         // For persistence and caching
    dohUrl?: string;              // DNS over HTTPS URL
    timeout?: number;
    waitUntil?: string;
    windowWidth?: number;
    windowHeight?: number;
    turnstile?: boolean;          // Auto-handle Turnstile CAPTCHAs (default: true)
  };
  retry: {
    maxRetries: number;
    retryInterval: number;
    retryOnTimeout: boolean;
  };
  notifications: {
    enableEmail: boolean;
    enableWebhook: boolean;
    enableStdout: boolean;
  };
}
```

**IMPORTANT**: The `headless` option MUST be set to `false` in the browser configuration. Setting it to `true` or any other value will cause Cloudflare verification to fail.

### Error Handling

The system defines specific error types in `src/types/index.ts`:
- `CONFIG_ERROR`: Missing or invalid configuration
- `NETWORK_ERROR`: Network connectivity issues
- `BROWSER_ERROR`: Browser launch or page load failures
- `PARSE_ERROR`: Page structure changes, element not found
- `VERIFY_ERROR`: Login or CAPTCHA verification failures
- `BUSINESS_ERROR`: Server not found, renewal failed

All errors extend `RenewalError` class with type, message, and optional code.

### Browser Fingerprint Anti-Detection

**CRITICAL**: This project uses `puppeteer-real-browser` which is specifically designed to pass Cloudflare bot detection. It is NOT the same as standard `puppeteer-extra` with stealth plugins.

The `puppeteer-real-browser` library:

#### Why Puppeteer Real Browser is Required

Standard Puppeteer and Puppeteer Extra with stealth plugins are **INSUFFICIENT** to pass modern Cloudflare detection. The `puppeteer-real-browser` library:

1. **Uses patched Puppeteer-core**: Applies rebrowser patches that fix detection vectors (Runtime.enable issues, etc.)
2. **Launches Chrome naturally**: Uses Chrome launcher library to start Chrome in its most natural state
3. **Patches mouse events**: Fixes MouseEvent.screenX/screenY discrepancies that give away automation
4. **Includes ghost-cursor**: Provides realistic human-like mouse movement simulation
5. **Auto-handles Turnstile**: Automatically clicks on Cloudflare Turnstile CAPTCHAs when `turnstile: true` is set

#### Critical Configuration Requirements

```javascript
import { connect } from 'puppeteer-real-browser';

const { browser, page } = await connect({
  headless: false,      // MUST be false - REQUIRED for Cloudflare
  turnstile: true,      // Auto-handle Turnstile CAPTCHAs
  args: [],
  customConfig: {
    userDataDir: './user-data',  // For session persistence
  }
});
```

**The `headless: false` requirement is NON-NEGOTIABLE**:
- Cloudflare can detect headless browsers through various fingerprinting techniques
- The library documentation explicitly states "it works most stable when false is used"
- Values like `"new"`, `true`, or `"shell"` will likely fail Cloudflare verification
- The library can still run in a virtual display on Linux using xvfb

#### Additional Anti-Detection Features

The library also implements browser launch arguments and JavaScript context overrides:

1. **Browser Launch Arguments**:
```typescript
'--disable-blink-features=AutomationControlled'  // Most important
'--disable-extensions-except=/dev/null'
'--disable-infobars'
'--disable-gpu'
'--disable-accelerated-2d-canvas'
// ... and 20+ more flags
```

2. **JavaScript Context Overrides**:
The following properties are overridden in each page:

- **`navigator.webdriver`**: Set to `false` (most important)
- **`window.chrome`**: Faked to exist with `runtime: {}`
- **`navigator.plugins`**: Returns realistic plugin list (Chrome PDF Plugin, etc.)
- **`navigator.languages`**: Returns `['zh-CN', 'zh', 'en-US', 'en']`
- **`navigator.platform`**: Returns `'Win32'`
- **`navigator.hardwareConcurrency`**: Returns `8`
- **`navigator.deviceMemory`**: Returns `8`
- **`navigator.connection`**: Returns realistic 4G connection info

3. **WebGL Fingerprint Masking**:
```javascript
WebGLRenderingContext.prototype.getParameter = function(parameter) {
  if (parameter === 37445) return 'Intel Inc.';
  if (parameter === 37446) return 'Intel Iris OpenGL Engine';
  return getParameter.call(this, parameter);
};
```

4. **Canvas Fingerprint Noise**:
Adds tiny random noise to canvas rendering to make each fingerprint unique:
```javascript
// Randomly modifies 0.1% of pixels' alpha channel
if (Math.random() < 0.001) {
  imageData.data[i + 3] = imageData.data[i + 3] ^ 1;
}
```

5. **Timezone and Locale Configuration**:
- **Timezone**: Set to `'Asia/Shanghai'` (UTC+8)
- **Accept-Language**: `'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'`
- **Date.getTimezoneOffset()**: Returns `-480` (UTC+8)
- **Intl.DateTimeFormat().timeZone**: Returns `'Asia/Shanghai'`

6. **Screen Properties**:
```javascript
screen.width = 1920
screen.height = 1080
screen.availWidth = 1920
screen.availHeight = 1040
```

#### Testing Anti-Detection

Run the fingerprint detection test script:
```bash
npx ts-node scripts/test-fingerprint-detection.ts
```

This will:
1. Launch browser with anti-detection measures using `puppeteer-real-browser`
2. Visit multiple bot detection websites (sannysoft.com, antoinevastel.com, etc.)
3. Take screenshots of results
4. Display current fingerprint data in a table
5. Save fingerprint data to JSON

Expected results on good detection sites:
- **Sannysoft**: Mostly green (passed), some yellow may appear
- **AHS Headless**: Should show "Non-headless browser detected" (even though headless is false)
- **navigator.webdriver**: Should be `false`
- **WebGL Vendor**: Should show "Intel Inc." or similar

**IMPORTANT**: The library's effectiveness against Cloudflare specifically depends on using `headless: false`.

#### Known Limitations

Even with `puppeteer-real-browser`, there are some limitations:

1. **TLS/JA3 Fingerprint**: Puppeteer's TLS handshake differs from real Chrome
   - Solution: Use curl-impersonate or commercial proxy services
2. **HTTP/2 Fingerprint**: May differ from real browser
3. **Behavioral Analysis**: Mouse movement patterns, typing speed
   - Mitigation: The library includes ghost-cursor for realistic mouse movements
4. **Headless Operation**: As mentioned, `headless: false` is REQUIRED for Cloudflare

For production use against sophisticated detection, consider:
- Using residential proxies
- Implementing request delay randomization
- Adding more realistic user behavior simulation
- Using curl-impersonate for network-level fingerprint matching

### Testing

- **Framework**: Vitest (not Jest)
- **Location**: `tests/unit/` and `tests/integration/`
- **Test scripts**: Located in `scripts/` directory for manual testing
- **Coverage goal**: 80% line coverage, 70% branch coverage

## Workflow for Single Server Renewal

1. BrowserController launches browser with DoH configuration
2. Navigate to target URL (dashboard)
3. Wait for Cloudflare verification (if present)
4. LoginProcessor checks login state, fills form if needed
5. ServerLocator navigates directly to server detail page using URL: `https://dashboard.katabump.com/servers/edit?id={serverId}`
6. RenewalExecutor opens renewal modal by clicking "Renew" button
7. Handle Cloudflare Turnstile:
   - Wait 20 seconds for page load
   - Perform random mouse movements (3-5 times)
   - Click verification area using coordinates
   - Poll for token completion (up to 60 seconds)
   - Validate token length > 500 chars
8. Click "Renew" button in modal
9. Verify renewal result
10. Close browser

## Important Gotchas

1. **Puppeteer Real Browser Requirement**: This project MUST use `puppeteer-real-browser` package, NOT standard `puppeteer` or `puppeteer-extra`. The library's rebrowser patches are specifically designed to bypass Cloudflare detection.

2. **Headless Mode**: The `headless` option MUST be set to `false`. This is a non-negotiable requirement for passing Cloudflare verification. Even though the library supports headless modes like `"new"`, they will likely fail Cloudflare's bot detection.

3. **Shadow DOM Access**: The Turnstile iframe is hidden in shadow-root(closed). You cannot access it via DOM queries. Use coordinate-based clicking with `page.mouse.click()`.

4. **CAPTCHA Token Validation**: Successful Turnstile tokens are >500 characters. Failed tokens start with "0." and are much shorter. Always check `value.length > 500`.

5. **Login State**: When `userDataDir` is set, the browser remembers login sessions. Always check if already logged in before attempting to fill login forms.

6. **Direct URL Navigation**: Server detail pages can be accessed directly via `https://dashboard.katabump.com/servers/edit?id={serverId}`. This is more reliable than clicking through the UI.

7. **Mouse Movement Timing**: Random mouse movements use variable steps based on distance. The `steps` parameter in `page.mouse.move()` controls smoothness.

8. **DoH Configuration**: The system uses Chrome fieldtrial parameters to enable DNS over HTTPS, not command-line flags.

9. **Linux Usage**: On Linux systems, xvfb must be installed for `puppeteer-real-browser` to work correctly with `headless: false`. The library creates a virtual display automatically.

## File Structure Notes

- `src/index.ts`: Main entry point, exports `RenewalTask` class
- `src/config/`: Configuration schema and loader
- `src/browser/`: Browser control and page operations
- `src/tasks/`: Business logic (login, locate, renew)
- `src/utils/logger.ts`: Centralized logging with timestamps and levels
- `src/types/index.ts`: All TypeScript type definitions
- `scripts/`: Manual test scripts for development
- `tests/`: Unit and integration tests
- `screenshots/`: Debug screenshots saved during development
