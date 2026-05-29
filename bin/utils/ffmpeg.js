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
 * 获取视频时长（秒）
 * @param {string} filePath - 视频文件路径
 * @returns {Promise<number|null>} 时长（秒），获取失败返回 null
 */
async function getVideoDuration(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filePath,
    ], { timeout: 10000 });
    const dur = parseFloat(stdout.trim());
    return isNaN(dur) ? null : dur;
  } catch (e) {
    return null;
  }
}

/**
 * 获取视频文件的编码信息（用于诊断）
 * @param {string} filePath - 视频文件路径
 * @returns {Promise<string>} ffprobe 输出
 */
async function getVideoInfo(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height,r_frame_rate,duration',
      '-of', 'csv=p=0',
      filePath,
    ], { timeout: 10000 });
    return stdout.trim();
  } catch (e) {
    return `ffprobe error: ${e.message}`;
  }
}

/**
 * 用 ffmpeg 拼接两个 MP4 文件
 *
 * 策略：直接使用重编码拼接（libx264+aac），
 * 确保不同编码参数的视频也能正确拼接并正常播放。
 * -c copy 方式在编码参数不一致时会产生播放器无法解码的文件。
 *
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
    // 日志：两个视频的编码信息，便于诊断
    const info1 = await getVideoInfo(video1);
    const info2 = await getVideoInfo(video2);
    console.log(`concatVideos: video1 info: ${info1}`);
    console.log(`concatVideos: video2 info: ${info2}`);

    // 重编码拼接，确保兼容性
    await execFileAsync('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-y',
      output,
    ], { timeout: 300000 });

    // 验证拼接结果：检查输出视频时长是否约等于两个输入之和
    const dur1 = await getVideoDuration(video1);
    const dur2 = await getVideoDuration(video2);
    const durOut = await getVideoDuration(output);
    if (dur1 && dur2 && durOut) {
      console.log(`concatVideos: duration check: ${dur1.toFixed(1)}s + ${dur2.toFixed(1)}s = ${(dur1+dur2).toFixed(1)}s, output: ${durOut.toFixed(1)}s`);
      if (durOut < (dur1 + dur2) * 0.8) {
        console.warn(`concatVideos: output duration (${durOut.toFixed(1)}s) much shorter than expected (${(dur1+dur2).toFixed(1)}s), concat may be corrupt`);
      }
    }
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
