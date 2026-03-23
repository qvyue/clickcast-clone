import { Config } from '@remotion/cli/config';

// Railway/Linux 环境配置 - 内存优化
Config.setChromiumHeadlessMode(true);

// 减少内存使用
Config.setWebKitAnimationFrameCacheSizeInBytes(500000);

// 并行渲染优化 - 减少同时渲染的帧数
Config.setConcurrency(1);