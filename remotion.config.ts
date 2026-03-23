import { Config } from '@remotion/cli/config';

// Railway/Linux 环境配置 - 内存优化
Config.setChromiumHeadlessMode(true);
Config.setWebKitAnimationFrameCacheSizeInBytes(500000);
Config.setConcurrency(1);

// 禁用缓存（避免路径问题）
Config.setCaching(false);

// 重要：确保静态文件从 public 目录正确加载
Config.setPublicDir('./public');

// 配置 webpack 确保静态文件被正确复制
Config.setWebpackOverride((currentConfiguration) => {
  return {
    ...currentConfiguration,
    // 确保静态资源被正确处理
  };
});