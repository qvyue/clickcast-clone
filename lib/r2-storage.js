/**
 * Cloudflare R2 存储模块
 * 用于上传生成的视频到 R2 对象存储
 * 支持视频文件和网站资源（截图、音频、timeline.json 等）的上传/下载
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

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
  timeout: 5000, // 5秒超时
};

// 并发下载控制：防止同一资源被多次并发下载
const inflightDownloads = new Map(); // key -> Promise

// Content-Type 映射表
const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
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
 * 带超时的 Promise 包装器
 * @param {Promise} promise - 原始 Promise
 * @param {number} ms - 超时时间(毫秒)
 * @param {string} errorMsg - 超时错误信息
 */
function withTimeout(promise, ms, errorMsg = 'Request timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), ms)
    )
  ]);
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

    await withTimeout(client.send(command), 30000, 'R2 upload timeout');

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
 * 列出 R2 中的所有视频 (带超时保护)
 * @param {string} prefix - 对象前缀
 * @returns {Promise<Array>} 视频列表
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

    // 添加5秒超时保护，防止卡死
    const response = await withTimeout(
      client.send(command),
      R2_CONFIG.timeout,
      'R2 list request timeout'
    );

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

    await withTimeout(client.send(command), R2_CONFIG.timeout, 'R2 delete timeout');
    return true;
  } catch (error) {
    console.error('R2 delete error:', error.message);
    return false;
  }
}

/**
 * 根据 R2 配置生成公开访问 URL
 * @param {string} key - R2 对象键名
 * @returns {string} 公开访问 URL
 */
function getPublicUrl(key) {
  return R2_CONFIG.publicUrl
    ? `${R2_CONFIG.publicUrl}/${key}`
    : `https://${R2_CONFIG.bucket}.${R2_CONFIG.endpoint.replace('https://', '')}/${key}`;
}

/**
 * 通用资源上传到 R2（自动检测 Content-Type）
 * @param {string} localPath - 本地文件路径
 * @param {string} key - R2 存储键名 (如: resources/example.com/public/timeline.json)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadResource(localPath, key) {
  if (!isR2Configured()) {
    return { success: false, error: 'R2 not configured' };
  }

  try {
    const client = getR2Client();
    const fileStream = fs.createReadStream(localPath);
    const stats = fs.statSync(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: key,
      Body: fileStream,
      ContentLength: stats.size,
      ContentType: contentType,
    });

    await withTimeout(client.send(command), 30000, 'R2 upload timeout');

    const publicUrl = getPublicUrl(key);
    console.log(`   ✅ R2 上传成功: ${key}`);
    return { success: true, url: publicUrl };
  } catch (error) {
    console.error(`   ❌ R2 上传失败: ${key} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 上传网站的所有资源文件到 R2
 * 扫描 publicDir 目录，上传每个文件到 resources/{domain}/public/{filename}
 * @param {string} domain - 网站域名
 * @param {string} publicDir - 本地 public 目录路径 (如: websites/example.com/public)
 * @returns {Promise<{uploaded: number, failed: number, errors: string[]}>}
 */
async function uploadDomainResources(domain, publicDir) {
  const result = { uploaded: 0, failed: 0, errors: [] };

  if (!isR2Configured() || !fs.existsSync(publicDir)) {
    return result;
  }

  const files = fs.readdirSync(publicDir).filter(f => {
    // 只上传文件，跳过子目录（如 _debug）
    const filePath = path.join(publicDir, f);
    return fs.statSync(filePath).isFile();
  });

  for (const filename of files) {
    const localPath = path.join(publicDir, filename);
    const key = `resources/${domain}/public/${filename}`;
    const uploadResult = await uploadResource(localPath, key);
    if (uploadResult.success) {
      result.uploaded++;
    } else {
      result.failed++;
      result.errors.push(`${filename}: ${uploadResult.error}`);
    }
  }

  console.log(`   📦 R2 资源上传完成: ${domain} - ${result.uploaded} 成功, ${result.failed} 失败`);
  return result;
}

/**
 * 从 R2 下载文件到本地
 * @param {string} key - R2 对象键名
 * @param {string} localPath - 本地保存路径
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function downloadResource(key, localPath) {
  if (!isR2Configured()) {
    return { success: false, error: 'R2 not configured' };
  }

  try {
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: key,
    });

    const response = await withTimeout(client.send(command), 30000, 'R2 download timeout');

    // 确保父目录存在
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 将响应体写入本地文件
    const writeStream = fs.createWriteStream(localPath);
    await pipeline(response.Body, writeStream);

    return { success: true };
  } catch (error) {
    // 对象不存在时 R2 返回 NoSuchKey，不是严重错误
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return { success: false, error: 'Not found in R2' };
    }
    console.error(`   ❌ R2 下载失败: ${key} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 列出 R2 中指定前缀的所有对象
 * @param {string} prefix - 对象前缀 (如: resources/example.com/public/)
 * @returns {Promise<Array<{key: string, size: number, lastModified: Date}>>}
 */
async function listResources(prefix) {
  if (!isR2Configured()) {
    return [];
  }

  try {
    const client = getR2Client();
    const allObjects = [];
    let continuationToken = undefined;

    // 处理分页
    do {
      const command = new ListObjectsV2Command({
        Bucket: R2_CONFIG.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const response = await withTimeout(client.send(command), R2_CONFIG.timeout, 'R2 list request timeout');
      const contents = response.Contents || [];
      allObjects.push(...contents.map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
      })));
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return allObjects;
  } catch (error) {
    console.error('R2 list error:', error.message);
    return [];
  }
}

/**
 * 确保单个资源文件在本地可用
 * - 本地已存在 → 直接返回 true
 * - 不存在 + R2 已配置 → 从 R2 下载到本地 → 返回 true/false
 * - 不存在 + R2 未配置 → 返回 false
 * 使用 inflightDownloads Map 防止并发重复下载
 * @param {string} domain - 网站域名
 * @param {string} filename - 文件名 (如: timeline.json, shot1.png)
 * @param {string} publicDir - 本地 public 目录路径
 * @returns {Promise<boolean>}
 */
async function ensureLocalResource(domain, filename, publicDir) {
  const localPath = path.join(publicDir, filename);

  // 本地已存在
  if (fs.existsSync(localPath)) {
    return true;
  }

  // R2 未配置
  if (!isR2Configured()) {
    return false;
  }

  const r2Key = `resources/${domain}/public/${filename}`;

  // 检查是否已有正在进行的下载
  if (inflightDownloads.has(r2Key)) {
    return inflightDownloads.get(r2Key);
  }

  // 启动下载
  const downloadPromise = (async () => {
    try {
      const result = await downloadResource(r2Key, localPath);
      return result.success;
    } catch (err) {
      console.error(`R2 ensure resource error (${r2Key}):`, err.message);
      return false;
    } finally {
      inflightDownloads.delete(r2Key);
    }
  })();

  inflightDownloads.set(r2Key, downloadPromise);
  return downloadPromise;
}

/**
 * 确保域名下所有资源在本地可用
 * 调用 listResources 获取 R2 文件列表，下载本地缺失的文件
 * @param {string} domain - 网站域名
 * @param {string} publicDir - 本地 public 目录路径
 * @returns {Promise<{synced: number, failed: number}>}
 */
async function ensureLocalResources(domain, publicDir) {
  const result = { synced: 0, failed: 0 };

  if (!isR2Configured()) {
    return result;
  }

  try {
    // 确保本地目录存在
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // 列出 R2 中的所有资源
    const prefix = `resources/${domain}/public/`;
    const r2Objects = await listResources(prefix);

    if (r2Objects.length === 0) {
      console.log(`   ⚠️ R2 中没有 ${domain} 的资源`);
      return result;
    }

    // 下载本地缺失的文件
    for (const obj of r2Objects) {
      const filename = obj.key.replace(prefix, '');
      if (!filename) continue; // 跳过目录本身

      const localPath = path.join(publicDir, filename);
      if (fs.existsSync(localPath)) continue; // 本地已有

      const downloadResult = await downloadResource(obj.key, localPath);
      if (downloadResult.success) {
        result.synced++;
      } else {
        result.failed++;
      }
    }

    console.log(`   📥 R2 资源同步完成: ${domain} - ${result.synced} 下载, ${result.failed} 失败`);
  } catch (error) {
    console.error(`   ❌ R2 资源同步错误 (${domain}):`, error.message);
  }

  return result;
}

module.exports = {
  isR2Configured,
  uploadVideo,
  uploadWebsiteVideos,
  listVideos,
  deleteVideo,
  uploadResource,
  uploadDomainResources,
  downloadResource,
  listResources,
  ensureLocalResource,
  ensureLocalResources,
};
