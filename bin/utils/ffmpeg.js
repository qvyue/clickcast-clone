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
 * 用 ffmpeg concat demuxer 拼接两个 MP4 文件
 *
 * 优先尝试 -c copy（无重编码，速度快），
 * 如果两个视频编码参数不一致则自动 fallback 到重编码拼接。
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
    // 先尝试 -c copy（无重编码）
    await execFileAsync('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      '-y',
      output,
    ], { timeout: 120000 });

    // 验证输出文件：如果 -c copy 拼接但文件异常小，说明拼接可能失败
    const stat1 = fs.statSync(video1);
    const stat2 = fs.statSync(video2);
    const statOut = fs.statSync(output);
    const expectedMin = (stat1.size + stat2.size) * 0.7; // 至少应有总和的 70%（编码后可能略小）
    if (statOut.size < expectedMin) {
      console.warn(`concatVideos: -c copy output suspiciously small (${Math.round(statOut.size/1024)}KB vs expected ~${Math.round(expectedMin/1024)}KB), retrying with re-encode`);
      fs.unlinkSync(output);
      throw new Error('Output too small, likely corrupt');
    }
  } catch (copyError) {
    // -c copy 失败或输出异常，fallback 到重编码拼接
    console.warn(`concatVideos: -c copy failed (${copyError.message}), falling back to re-encode`);
    // 日志：两个视频的编码信息，帮助诊断
    const info1 = await getVideoInfo(video1);
    const info2 = await getVideoInfo(video2);
    console.log(`concatVideos: video1 info: ${info1}`);
    console.log(`concatVideos: video2 info: ${info2}`);

    // 重新生成 concat 文件
    if (!fs.existsSync(concatListPath)) {
      fs.writeFileSync(concatListPath, `file '${video1}'\nfile '${video2}'\n`);
    }

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
