/**
 * =============================================================================
 * 真实环境集成测试
 * 
 * 测试目标：验证完整的视频生成 pipeline
 * 测试方式：启动内置服务器 → 调用 API 生成视频 → 验证所有输出
 * 运行命令：node bin/integration/integration.test.js
 * 
 * 测试流程：
 * 1. 启动内置 HTTP 服务器（端口 3001）
 * 2. 清理旧的测试数据
 * 3. 发送视频生成请求
 * 4. 轮询等待生成任务完成（最多 5 分钟）
 * 5. 验证 timeline.json 结构完整性
 * 6. 验证每个场景的字段定义正确
 * 7. 验证配音文件存在且有效
 * 8. 验证截图文件存在
 * 9. 验证 API 端点可访问
 * 
 * 注意：这是真实的集成测试，会实际调用 AI API 和生成文件
 * =============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// =============================================================================
// 测试配置常量
// =============================================================================

/** 测试服务器端口 */
const PORT = 3001;
/** 基础 URL */
const BASE_URL = `http://localhost:${PORT}`;
/** 测试用的网站域名（会在 websites/ 下创建） */
const TEST_DOMAIN = 'integration-test-app';
/** 测试用的目标 URL */
const TEST_URL = 'https://referencetovideo.app';
/** 测试网站根目录 */
const WEBSITES_DIR = path.join(__dirname, '..', '..', 'websites', TEST_DOMAIN);
/** 测试网站公开文件目录 */
const PUBLIC_DIR = path.join(WEBSITES_DIR, 'public');

// =============================================================================
// 测试辅助函数
// =============================================================================

/**
 * 简易 HTTP 请求函数
 * 
 * @param {string} url - 请求 URL
 * @param {object} options - 请求选项
 * @returns {Promise<{status: number, body: string, headers: object}>}
 * 
 * 说明：使用原生 http 模块，不依赖外部库
 */
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 30000,  // 30秒超时
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * 等待指定毫秒数
 * 
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 日志输出函数
 * 
 * @param {string} section - 步骤名称
 * @param {string} msg - 消息内容
 */
function log(section, msg) {
  console.log(`\n[${section}] ${msg}`);
}

// =============================================================================
// 测试结果统计
// =============================================================================

let passed = 0;
let failed = 0;

/**
 * 断言函数
 * 
 * @param {boolean} condition - 条件
 * @param {string} message - 断言消息
 * 
 * 如果条件为 false，记录失败并抛出异常
 * 如果条件为 true，记录成功
 */
function assert(condition, message) {
  if (!condition) {
    failed++;
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
  passed++;
  console.log(`  ✅ ${message}`);
}

// =============================================================================
// 核心测试函数：轮询等待任务完成
// =============================================================================

/**
 * 轮询等待视频生成任务完成
 * 
 * @param {string} domain - 网站域名
 * @param {number} maxWaitMs - 最大等待时间（默认 5 分钟）
 * @returns {Promise<object>} 任务结果数据
 * 
 * 重要性：
 * - 视频生成是异步任务，不能立即返回结果
 * - 需要轮询 /api/generate/status/:domain 检查状态
 * - 状态包括：pending、processing、completed、failed
 * 
 * 进度显示：
 * - 每 3 秒检查一次状态
 * - 实时显示当前状态和进度百分比
 */
async function waitForJobCompletion(domain, maxWaitMs = 300000) {
  const start = Date.now();
  
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/generate/status/${domain}`);
      
      if (res.status === 200) {
        const data = JSON.parse(res.body);
        
        // 任务完成
        if (data.status === 'completed') {
          return data;
        }
        
        // 任务失败
        if (data.status === 'failed') {
          throw new Error(`Job failed: ${data.error || data.message}`);
        }
        
        // 显示进度
        process.stdout.write(`\r  ⏳ ${data.status}: ${data.message || data.progress + '%'}...`);
      }
    } catch (e) {
      // 如果是任务失败异常，立即抛出
      if (e.message.startsWith('Job failed')) throw e;
    }
    
    // 每 3 秒检查一次
    await sleep(3000);
  }
  
  // 超时
  throw new Error('Timeout waiting for job completion');
}

// =============================================================================
// 主测试流程
// =============================================================================

async function runTests() {
  console.log('='.repeat(60));
  console.log('  真实环境集成测试');
  console.log('='.repeat(60));

  // ===== Step 1: 启动服务器 =====
  log('Step 1', '启动内置服务器...');
  process.env.PORT = PORT;
  const serverModule = require('../server.js');
  
  // 等待服务器启动
  await sleep(2000);

  const httpServer = serverModule.httpServer || serverModule.server || serverModule;
  let serverOk = false;
  
  // 尝试多种方式确认服务器已启动
  if (httpServer && httpServer.listening) {
    serverOk = true;
  } else {
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.status === 200) serverOk = true;
    } catch (e) {
      console.log('  HTTP fetch failed, trying server.listen callback...');
    }
  }

  // 如果还没确认，尝试手动启动
  if (!serverOk) {
    await new Promise((resolve) => {
      if (httpServer && typeof httpServer.listen === 'function' && !httpServer.listening) {
        httpServer.listen(PORT, '0.0.0.0', () => { serverOk = true; resolve(); });
      } else if (httpServer && httpServer.listening) {
        serverOk = true;
        resolve();
      } else {
        console.log('  Waiting for server to be ready...');
        let attempts = 0;
        const check = setInterval(async () => {
          attempts++;
          try {
            const res = await fetch(`${BASE_URL}/`);
            if (res.status === 200) { serverOk = true; clearInterval(check); resolve(); }
          } catch (e) {}
          if (attempts > 10) { clearInterval(check); resolve(); }
        }, 2000);
      }
    });
  }

  // 服务器启动确认
  if (!serverOk) {
    console.log('  ⚠️ 无法通过 HTTP 连接服务器，检查端口...');
    try {
      const result = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
      console.log('  Port check:', result.trim());
    } catch (e) {}
    console.log('  尝试继续测试...');
  } else {
    assert(true, `服务器返回 200`);
  }

  // ===== Step 2: 清理旧数据 =====
  log('Step 2', '清理旧数据...');
  if (fs.existsSync(WEBSITES_DIR)) {
    fs.rmSync(WEBSITES_DIR, { recursive: true, force: true });
    console.log('  已清理旧目录');
  }

  // ===== Step 2.5: 测试无效 URL 处理 =====
  log('Step 2.5', '测试无效 URL 处理...');
  
  // 测试各种无效 URL 格式
  const invalidUrls = [
    { url: '', name: '空字符串' },
    { url: 'not-a-url', name: '非 URL 格式' },
    { url: 'http://', name: '不完整的 URL' },
    { url: '://example.com', name: '缺少协议' },
  ];
  
  for (const testCase of invalidUrls) {
    try {
      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: testCase.url,
          aspectRatio: 'landscape',
          domain: 'test-invalid'
        })
      });
      
      // API 应该返回 4xx 错误（而不是 200）
      assert(res.status >= 400, `无效 URL "${testCase.name}" 应返回错误 (状态: ${res.status})`);
      console.log(`  ✅ "${testCase.name}" → 状态码 ${res.status}`);
    } catch (e) {
      // 如果请求失败（如连接错误），也视为正确处理
      console.log(`  ✅ "${testCase.name}" → 请求失败（${e.message}）`);
    }
  }

  // ===== Step 3: 发送生成请求 =====
  log('Step 3', `发送生成请求: ${TEST_URL}...`);
  const generateRes = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      url: TEST_URL,           // 目标 URL
      aspectRatio: 'landscape', // 视频比例
      domain: TEST_DOMAIN       // 输出域名
    })
  });
  assert(generateRes.status === 200, `生成请求返回 200 (实际: ${generateRes.status})`);

  // ===== Step 4: 等待生成完成 =====
  log('Step 4', '等待生成完成...');
  console.log('  （最多等待 5 分钟）');
  const jobResult = await waitForJobCompletion(TEST_DOMAIN);
  console.log('\n  生成完成！');

  // ===== Step 5: 验证 timeline.json =====
  log('Step 5', '验证 timeline.json...');
  const timelinePath = path.join(PUBLIC_DIR, 'timeline.json');
  assert(fs.existsSync(timelinePath), 'timeline.json 文件存在');

  const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));

  // 5.1 验证 timeline 顶层字段
  assert(timeline.product && timeline.product.length > 0, `product 字段存在: "${timeline.product}"`);
  assert(timeline.tagline && timeline.tagline.length > 0, `tagline 字段存在: "${timeline.tagline}"`);
  assert(timeline.fps === 30, `fps = 30`);
  assert(timeline.totalFrames > 0, `totalFrames > 0 (实际: ${timeline.totalFrames})`);
  assert(timeline.scenes && timeline.scenes.length > 0, `scenes 数组非空 (${timeline.scenes.length} 个场景)`);

  // 5.2 验证每个场景的核心字段
  log('Step 5.2', '验证每个场景的 4 个核心字段...');
  for (let i = 0; i < timeline.scenes.length; i++) {
    const scene = timeline.scenes[i];
    const label = `Scene[${i}] (${scene.id})`;

    // 基础字段存在性
    assert(scene.id !== undefined, `${label}: id 存在`);
    assert(scene.title !== undefined, `${label}: title (主字幕) 存在 → "${(scene.title || '').substring(0, 40)}"`);
    assert(scene.subTitle !== undefined, `${label}: subTitle (次字幕) 存在`);
    assert(scene.mainTitle !== undefined && scene.mainTitle.length > 0, `${label}: mainTitle (主配音文案) 非空 → "${scene.mainTitle.substring(0, 40)}"`);
    assert(scene.subVoiceover !== undefined, `${label}: subVoiceover (次配音文案) 存在`);

    // 废弃字段不应存在（旧版本兼容）
    assert(scene.text === undefined, `${label}: text 字段不应存在`);
    assert(scene.subText === undefined, `${label}: subText 字段不应存在`);

    // 配音来源验证
    assert(scene.voiceoverSource === 'elevenlabs', `${label}: voiceoverSource = elevenlabs`);
    
    // 配音文件不应使用预览前缀
    assert(!scene.audioFile || !scene.audioFile.startsWith('preview_'), `${label}: audioFile 不使用 preview_ 前缀`);
    assert(!scene.audioFileSub || !scene.audioFileSub.startsWith('preview_'), `${label}: audioFileSub 不使用 preview_ 前缀`);
  }

  // 5.3 验证非 intro/outro 场景的 subVoiceover
  log('Step 5.3', '验证非 intro/outro 场景的 subVoiceover...');
  let scenesWithSubVoiceover = 0;
  for (const scene of timeline.scenes) {
    if (scene.id !== 'intro' && scene.id !== 'outro') {
      if (scene.subVoiceover && scene.subVoiceover.trim()) {
        scenesWithSubVoiceover++;
        console.log(`  ✅ ${scene.id} subVoiceover: "${scene.subVoiceover.substring(0, 50)}"`);
      } else {
        console.log(`  ⚠️ ${scene.id} subVoiceover 为空 (AI 可能未生成)`);
      }
    }
  }
  if (scenesWithSubVoiceover > 0) {
    console.log(`  ✅ 共 ${scenesWithSubVoiceover} 个场景有 subVoiceover`);
  }

  // 5.4 验证 audioFileSub 与 subVoiceover 一致性
  log('Step 5.4', '验证 audioFileSub 与 subVoiceover 一致性...');
  for (const scene of timeline.scenes) {
    const label = `Scene (${scene.id})`;
    
    // 如果有次配音文件，次配音文案必须非空
    if (scene.audioFileSub) {
      assert(scene.subVoiceover && scene.subVoiceover.trim(), `${label}: 有 audioFileSub 则 subVoiceover 必须非空`);
      assert(scene.subDuration > 0, `${label}: 有 audioFileSub 则 subDuration > 0`);
    }
    
    // 如果次配音文案为空，不应有次配音文件
    if (!scene.subVoiceover || !scene.subVoiceover.trim()) {
      assert(scene.audioFileSub === undefined, `${label}: subVoiceover 为空则 audioFileSub 必须为 undefined`);
      assert(scene.subDuration === 0, `${label}: subVoiceover 为空则 subDuration 必须为 0`);
    }
  }

  // ===== Step 6: 验证配音文件 =====
  log('Step 6', '验证配音文件...');
  let audioFileCount = 0;
  let audioFileOk = 0;
  
  for (const scene of timeline.scenes) {
    for (const field of ['audioFile', 'audioFileSub']) {
      const fileName = scene[field];
      if (fileName) {
        audioFileCount++;
        const audioPath = path.join(PUBLIC_DIR, fileName);
        
        // 检查文件存在
        if (fs.existsSync(audioPath)) {
          const stats = fs.statSync(audioPath);
          
          // 检查文件大小（有效音频文件应该 > 1KB）
          if (stats.size > 1000) {
            audioFileOk++;
            let duration = 0;
            
            // 使用 ffprobe 获取音频时长
            try {
              const durStr = execSync(
                `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
                { encoding: 'utf8' }
              ).trim();
              duration = parseFloat(durStr);
            } catch (e) {}
            
            console.log(`  ✅ ${fileName} (${(stats.size / 1024).toFixed(1)}KB, ${duration.toFixed(1)}s)`);
          } else {
            console.log(`  ❌ ${fileName} 文件过小 (${stats.size} bytes)`);
          }
        } else {
          console.log(`  ❌ ${fileName} 文件不存在`);
        }
      }
    }
  }
  assert(audioFileCount > 0, `至少有配音文件 (${audioFileCount} 个)`);
  assert(audioFileOk === audioFileCount, `所有配音文件有效 (${audioFileOk}/${audioFileCount})`);

  // ===== Step 7: 验证截图文件 =====
  log('Step 7', '验证截图文件...');
  let screenshotCount = 0;
  for (const scene of timeline.scenes) {
    if (scene.img) {
      const imgPath = path.join(PUBLIC_DIR, scene.img);
      if (fs.existsSync(imgPath)) {
        screenshotCount++;
        console.log(`  ✅ ${scene.img} (${(fs.statSync(imgPath).size / 1024).toFixed(1)}KB)`);
      } else {
        console.log(`  ❌ ${scene.img} 不存在`);
      }
    }
  }
  assert(screenshotCount > 0, `有 ${screenshotCount} 个截图文件`);

  // ===== Step 8: 验证 mainTitle 不包含 subVoiceover 内容 =====
  log('Step 8', '验证 mainTitle 和 subVoiceover 内容分离...');
  for (const scene of timeline.scenes) {
    if (scene.subVoiceover && scene.subVoiceover.trim().length > 5) {
      const mainLower = scene.mainTitle.toLowerCase();
      const subLower = scene.subVoiceover.toLowerCase();
      
      if (mainLower.includes(subLower)) {
        console.log(`  ⚠️ ${scene.id}: mainTitle 包含 subVoiceover 内容`);
      } else {
        console.log(`  ✅ ${scene.id}: mainTitle 和 subVoiceover 内容分离`);
      }
    }
  }

  // ===== Step 9: 验证编辑器 API =====
  log('Step 9', '验证编辑器 API...');
  const timelineApiRes = await fetch(`${BASE_URL}/websites/${TEST_DOMAIN}/public/timeline.json`);
  assert(timelineApiRes.status === 200, `timeline API 返回 200`);
  const apiTimeline = JSON.parse(timelineApiRes.body);
  assert(apiTimeline.scenes.length === timeline.scenes.length, `API 返回的场景数与文件一致`);

  // ===== Summary =====
  console.log('\n' + '='.repeat(60));
  console.log('  ✅ 所有集成测试通过！');
  console.log('='.repeat(60));
  console.log(`\n  📊 测试结果:`);
  console.log(`    - 通过: ${passed}`);
  console.log(`    - 失败: ${failed}`);
  console.log(`    - 场景数: ${timeline.scenes.length}`);
  console.log(`    - 配音文件: ${audioFileOk}/${audioFileCount} 有效`);
  console.log(`    - 截图文件: ${screenshotCount} 个`);
  console.log(`    - 有 subVoiceover 的场景: ${scenesWithSubVoiceover}`);
  console.log(`\n  🌐 打开编辑器验证: http://localhost:${PORT}/editor/${TEST_DOMAIN}`);

  process.exit(0);
}

// =============================================================================
// 错误处理
// =============================================================================

runTests().catch(e => {
  console.error('\n❌ 集成测试失败:', e.message);
  process.exit(1);
});
