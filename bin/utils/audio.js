/**
 * Audio utilities
 * 音频处理工具函数
 */

const { execFileSync } = require('child_process');

/**
 * 获取音频文件时长（秒）
 * 使用 ffprobe 读取音频时长
 *
 * @param {string} filePath - 音频文件路径
 * @returns {number} 音频时长（秒），失败返回 0
 */
function getAudioDuration(filePath) {
  try {
    const result = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return parseFloat(result.trim()) || 0;
  } catch (e) {
    console.log(`   ⚠️ 无法读取音频时长: ${e.message}`);
    return 0;
  }
}

module.exports = {
  getAudioDuration
};
