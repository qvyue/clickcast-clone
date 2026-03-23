import { Config } from '@remotion/cli/config';

// Railway/Linux 环境配置
Config.setChromiumHeadlessMode(true);

// 使用系统安装的 Chromium (Playwright)
Config.setChromiumExecutablePath('/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome');

// 内存优化
Config.setWebKitAnimationFrameCacheSizeInBytes(1000000);