/**
 * Cloudflare R2 存储模块
 * 用于上传生成的视频到 R2 对象存储
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// R2 配置
const R2_CONFIG = {
  endpoint: process.env.R2_ENDPOINT, // https://<account_id>.r2.cloudflarestorage.com
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  bucket: process.env.R2_BUCKET_NAME,
  publicUrl: process.env.R2_PUBLIC_URL, // R2 公开访问 URL
};

// 创建 S3 客户端 (R2 兼容 S3 API)
let r2Client = null;

function getR2Client() {
  if (!r2Client && R2_CONFIG.endpoint) {
    r2Client = new S3Client({
      endpoint: R2_CONFIG.endpoint,
      region: R2_CONFIG.region,
      credentials: R2_CONFIG.credentials,
    });
  }
  return r2Client;
}

/**
 * 检查 R2 是否配置
 */
function isR2Configured() {
  return !!(R2_CONFIG.endpoint && R2_CONFIG.credentials.accessKeyId && R2_CONFIG.bucket);
}

/**
 * 上传视频到 R2
 * @param {string} localPath - 本地视频路径
 * @param {string} key - R2 存储键名 (如: videos/clickcast.tech/landscape.mp4)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadVideo(localPath, key) {
  if (!isR2Configured()) {
    return { success: false, error: 'R2 not configured' };
  }

  try {
    const client = getR2Client();
    const fileStream = fs.createReadStream(localPath);
    const stats = fs.statSync(localPath);

    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: key,
      Body: fileStream,
      ContentLength: stats.size,
      ContentType: 'video/mp4',
    });

    await client.send(command);

    const publicUrl = R2_CONFIG.publicUrl
      ? `${R2_CONFIG.publicUrl}/${key}`
      : `https://${R2_CONFIG.bucket}.${R2_CONFIG.endpoint.replace('https://', '')}/${key}`;

    console.log(`   ✅ R2 上传成功: ${key}`);
    return { success: true, url: publicUrl };
  } catch (error) {
    console.error(`   ❌ R2 上传失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 上传网站的所有视频到 R2
 * @param {string} domain - 网站域名
 * @param {string} websitesDir - 网站目录路径
 * @returns {Promise<{success: boolean, urls: object}>}
 */
async function uploadWebsiteVideos(domain, websitesDir) {
  const results = { success: true, urls: {} };
  const outDir = path.join(websitesDir, domain, 'out');

  if (!fs.existsSync(outDir)) {
    return { success: false, urls: {} };
  }

  const videoFiles = ['landscape.mp4', 'portrait.mp4'];

  for (const videoFile of videoFiles) {
    const localPath = path.join(outDir, videoFile);
    if (fs.existsSync(localPath)) {
      const key = `videos/${domain}/${videoFile}`;
      const result = await uploadVideo(localPath, key);
      if (result.success) {
        results.urls[videoFile] = result.url;
      } else {
        results.success = false;
      }
    }
  }

  return results;
}

/**
 * 列出 R2 中的所有视频
 */
async function listVideos(prefix = 'videos/') {
  if (!isR2Configured()) {
    return [];
  }

  try {
    const client = getR2Client();
    const command = new ListObjectsV2Command({
      Bucket: R2_CONFIG.bucket,
      Prefix: prefix,
    });

    const response = await client.send(command);
    return (response.Contents || []).map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      url: R2_CONFIG.publicUrl
        ? `${R2_CONFIG.publicUrl}/${item.Key}`
        : null,
    }));
  } catch (error) {
    console.error('R2 list error:', error.message);
    return [];
  }
}

/**
 * 删除 R2 中的视频
 */
async function deleteVideo(key) {
  if (!isR2Configured()) {
    return false;
  }

  try {
    const client = getR2Client();
    const command = new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error('R2 delete error:', error.message);
    return false;
  }
}

module.exports = {
  isR2Configured,
  uploadVideo,
  uploadWebsiteVideos,
  listVideos,
  deleteVideo,
};