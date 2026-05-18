// Remotion 配置 - 平台感知版本
import { Config } from '@remotion/cli/config';
import os from 'os';

Config.setChromiumHeadlessMode(true);

// Windows: concurrency=1 for stability; Linux: let Remotion default (half CPU)
if (process.platform === 'win32') {
  Config.setConcurrency(1);
}

// GL backend: swangle on Linux (ANGLE+SwiftShader, no GPU needed), angle on Windows
Config.setChromiumOpenGlRenderer(
  process.platform === 'linux' ? 'swangle' : 'angle'
);
