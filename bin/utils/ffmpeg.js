/**
 * ffmpeg 工具函数
 * 用于视频拼接、转码等后处理操作
 */

const { execFile } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execFileAsync = util.promisify(execFile);

/**
 * 用 ffmpeg concat demuxer 拼接两个 MP4 文件
 * 要求两个视频编码参数一致（分辨率、帧率、编码器），使用 -c copy 无需重编码
 * @param {string} video1 - 第一个视频路径
 * @param {string} video2 - 第二个视频路径
 * @param {string} output - 输出视频路径
 * @returns {Promise<void>}
 */
async function concatVideos(video1, video2, output) {
  // 写 concat 文本文件（ffmpeg concat demuxer 要求）
  const concatListPath = path.join(path.dirname(output), 'concat.txt');
  fs.writeFileSync(concatListPath, `file '${video1}'\nfile '${video2}'\n`);

  try {
    await execFileAsync('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      output,
    ], { timeout: 60000 });
  } finally {
    // 清理临时 concat 文件
    if (fs.existsSync(concatListPath)) {
      fs.unlinkSync(concatListPath);
    }
  }
}

module.exports = {
  concatVideos,
};
