import { Config } from '@remotion/cli/config';

// Railway/Linux 环境配置
Config.setChromiumHeadlessMode(true);
Config.setConcurrency(1);
Config.setCaching(false);
Config.setPublicDir('./public');