#!/usr/bin/env node
/**
 * 一次性脚本：上传宣传片尾视频到 R2
 *
 * 用法:
 *   node bin/upload-promo-outro.js <landscape.mp4> <portrait.mp4>
 *
 * 将两个宣传片尾视频上传到 R2 的 assets/ 前缀下:
 *   assets/promo-outro-landscape.mp4
 *   assets/promo-outro-portrait.mp4
 */

const fs = require('fs');
const path = require('path');

// 检查参数
const [landscapePath, portraitPath] = process.argv.slice(2);

if (!landscapePath || !portraitPath) {
  console.error('Usage: node bin/upload-promo-outro.js <landscape.mp4> <portrait.mp4>');
  process.exit(1);
}

if (!fs.existsSync(landscapePath)) {
  console.error(`File not found: ${landscapePath}`);
  process.exit(1);
}

if (!fs.existsSync(portraitPath)) {
  console.error(`File not found: ${portraitPath}`);
  process.exit(1);
}

async function main() {
  const { isR2Configured, uploadResource } = require('../lib/r2-storage.js');

  if (!isR2Configured()) {
    console.error('R2 is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.');
    process.exit(1);
  }

  console.log('Uploading promo outro videos to R2...\n');

  const landscapeResult = await uploadResource(
    path.resolve(landscapePath),
    'assets/promo-outro-landscape.mp4'
  );
  console.log(`Landscape: ${landscapeResult.success ? 'OK' : 'FAILED'}`);

  const portraitResult = await uploadResource(
    path.resolve(portraitPath),
    'assets/promo-outro-portrait.mp4'
  );
  console.log(`Portrait: ${portraitResult.success ? 'OK' : 'FAILED'}`);

  if (landscapeResult.success && portraitResult.success) {
    console.log('\nDone! Promo outro videos are now available in R2.');
    console.log('Free users will see the promo outro appended to their rendered videos.');
  } else {
    console.error('\nSome uploads failed. Check errors above.');
    process.exit(1);
  }
}

main();
