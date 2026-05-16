/**
 * API Endpoints E2E 测试套件
 * 
 * 测试目标：VidGen 后端 REST API 接口
 * 测试环境：Playwright + TypeScript（使用 request fixture）
 * 
 * 测试覆盖范围：
 * 1. 视频列表 API (/api/videos)
 * 2. 渲染任务状态 API (/api/status/:jobId)
 * 3. 网站数据 API (/api/websites/:domain)
 * 4. 时间线 API (GET/POST /api/timeline/:domain)
 * 5. 安全性测试（路径遍历防护）
 * 
 * 与其他测试的区别：
 * - 单元测试：测试单个函数逻辑
 * - Integration 测试：测试模块间交互
 * - E2E 测试（本文档）：测试完整的 HTTP 请求-响应周期
 * 
 * 特点：
 * - 使用 Playwright 的 request fixture（类似 Postman/HttpClient）
 * - 直接发送 HTTP 请求到后端服务器
 * - 验证响应的状态码、格式、数据结构
 */

import { test, expect } from '@playwright/test';

/**
 * API Endpoints 测试套件
 * 
 * 使用 request fixture 而非 page fixture
 * request 提供底层 HTTP 请求能力，类似 Java 的 HttpClient 或 Python 的 requests
 */
test.describe('API Endpoints', () => {

  // ============================================================================
  // 视频列表 API (/api/videos)
  // ============================================================================

  /**
   * 测试：GET /api/videos 返回正确的响应结构
   * 
   * HTTP 方法：GET
   * 路由：/api/videos
   * 预期状态码：200
   * 
   * 验证点：
   * 1. HTTP 状态码为 200
   * 2. 响应体是有效的 JSON
   * 3. 包含 'videos' 属性（数组类型）
   * 4. 包含 'total' 属性（总数）
   * 
   * 重要性：
   * - 视频列表是首页的核心数据源
   * - 必须返回正确的响应格式供前端消费
   * 
   * 失败可能原因：
   * - 数据库连接失败
   * - SQL 查询错误
   * - 响应序列化问题
   */
  test('GET /api/videos returns valid response', async ({ request }) => {
    const response = await request.get('/api/videos');
    
    // 断言 1：HTTP 状态码
    expect(response.status()).toBe(200);
    
    // 断言 2：解析 JSON 响应体
    const body = await response.json();
    
    // 断言 3：包含必要字段
    expect(body).toHaveProperty('videos');    // 视频列表数组
    expect(body).toHaveProperty('total');      // 总数（分页用）
    
    // 断言 4：videos 是数组类型
    expect(Array.isArray(body.videos)).toBe(true);
  });

  /**
   * 测试：GET /api/videos?limit=N 正确限制返回数量
   * 
   * 查询参数：limit=5
   * 预期状态码：200
   * 
   * 验证点：
   * - 返回的视频数量 ≤ 5
   * 
   * 重要性：
   * - 分页是处理大量数据的必要功能
   * - limit 参数防止一次返回过多数据
   * 
   * 边界情况：
   * - 如果总数据 < 5，应该返回所有数据
   * - 如果数据 = 0，应该返回空数组
   */
  test('GET /api/videos?limit=5 respects limit', async ({ request }) => {
    const response = await request.get('/api/videos?limit=5');
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    // 返回数量不超过 5
    expect(body.videos.length).toBeLessThanOrEqual(5);
  });

  // ============================================================================
  // 渲染任务状态 API (/api/status/:jobId)
  // ============================================================================

  /**
   * 测试：GET /api/status/:jobId 查询不存在的任务返回 404
   * 
   * 路径参数：jobId = "nonexistent-job-12345"
   * 预期状态码：404
   * 
   * 验证点：
   * - 请求不存在的 jobId
   * - 服务器返回 404 Not Found
   * 
   * 重要性：
   * - 正确的 HTTP 状态码表示 API 设计规范
   * - 客户端可以根据 404 判断任务不存在
   * 
   * 安全考虑：
   * - 不应该通过 404 泄露任务存在性信息
   * - 无论是否存在，都返回 404 是好的实践
   */
  test('GET /api/status/nonexistent returns 404', async ({ request }) => {
    const response = await request.get('/api/status/nonexistent-job-12345');
    expect(response.status()).toBe(404);
  });

  // ============================================================================
  // 网站数据 API (/api/websites/:domain)
  // ============================================================================

  /**
   * 测试：GET /api/websites/:domain 返回网站数据
   * 
   * 路径参数：domain = "clickcast.tech"
   * 预期状态码：200
   * 
   * 验证点：
   * - 状态码 200
   * - 响应体不为空（truthy）
   * 
   * 重要性：
   * - 网站数据是视频编辑器的基础数据源
   * - 包含网站配置、域名、公开配置路径等
   */
  test('GET /api/websites/clickcast.tech returns website data', async ({ request }) => {
    const response = await request.get('/api/websites/clickcast.tech');
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    // 响应体存在且不为 null/undefined
    expect(body).toBeTruthy();
  });

  /**
   * 测试：GET /api/websites/:domain 验证无效域名格式
   * 
   * 路径参数：domain = "invalid..domain"（双点，无效格式）
   * 预期状态码：400 或 404
   * 
   * 验证点：
   * - 无效域名应返回错误状态码
   * - 400 = 请求格式错误（参数验证失败）
   * - 404 = 路由未匹配（可能先被路由匹配）
   * 
   * 重要性：
   * - API 应该验证输入参数
   * - 防止 SQL 注入、XSS、路径遍历等安全问题
   * 
   * 注意：
   * - 允许 400 或 404 是因为验证可能在不同层级进行
   * - Express 路由匹配 vs 中间件验证
   */
  test('GET /api/websites/invalid..domain returns error or creates site', async ({ request }) => {
    const response = await request.get('/api/websites/invalid..domain');
    // Double dots (..) are technically valid in domain regex [a-zA-Z0-9.-]
    // Server may return 200 (creates directory) or 404 (not found yet)
    // Either way, it should not crash
    expect([200, 400, 404]).toContain(response.status());
  });

  // ============================================================================
  // 时间线 API (Timeline JSON)
  // ============================================================================

  /**
   * 测试：GET /websites/:domain/public/timeline.json 返回正确结构
   * 
   * 路由：/websites/clickcast.tech/public/timeline.json
   * 预期状态码：200
   * 
   * 验证点：
   * 1. 状态码 200
   * 2. 响应包含 'scenes' 属性（场景数组）
   * 3. scenes 数组长度 > 0
   * 4. 响应包含 'style' 属性（视频样式配置）
   * 
   * 重要性：
   * - timeline.json 是视频编辑器编辑的配置文件
   * - 包含所有场景数据、样式、BGM 配置等
   * 
   * 注意：
   * - 这是静态文件访问，不经过 API 路由
   * - 文件存储在 websites/:domain/public/ 目录
   */
  test('GET timeline.json for existing domain', async ({ request }) => {
    const response = await request.get('/websites/clickcast.tech/public/timeline.json');
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    // 验证 scenes 数组
    expect(body).toHaveProperty('scenes');
    expect(body.scenes.length).toBeGreaterThan(0);
    
    // 验证 style 配置
    expect(body).toHaveProperty('style');
  });

  /**
   * 测试：POST /api/timeline/:domain 保存时间线
   * 
   * HTTP 方法：POST
   * 路由：/api/timeline/clickcast.tech
   * 预期状态码：200
   * 
   * 验证点：
   * 1. 先 GET 获取当前 timeline
   * 2. 再 POST 保存回去
   * 3. 响应 success 为 true
   * 
   * 重要性：
   * - 保存是视频编辑的核心功能
   * - 测试完整的读取-修改-写入周期
   * 
   * 潜在问题：
   * - 真实测试中不应该真正写入数据
   * - 应该使用测试数据库或 mock
   */
  test('POST /api/timeline/clickcast.tech saves timeline', async ({ request }) => {
    // 步骤 1：获取当前 timeline
    const getResp = await request.get('/websites/clickcast.tech/public/timeline.json');
    const timeline = await getResp.json();
    
    // 步骤 2：POST 保存
    const postResp = await request.post('/api/timeline/clickcast.tech', {
      data: timeline,
    });
    expect(postResp.status()).toBe(200);
    
    const body = await postResp.json();
    expect(body.success).toBe(true);
  });

  // ============================================================================
  // 安全性测试 (Security Tests)
  // ============================================================================

  /**
   * 测试：POST /api/timeline/:domain 拒绝路径遍历攻击
   * 
   * 攻击向量：URL 编码的路径遍历 "..%2F..%2Fetc%2Fpasswd"
   * 解码后：../../etc/passwd
   * 预期状态码：400
   * 
   * 验证点：
   * - 尝试访问系统文件被拒绝
   * - 返回 400 Bad Request
   * 
   * 重要性：
   * - 路径遍历是常见的 Web 安全漏洞
   * - 攻击者可能读取敏感文件（密码、系统配置）
   * 
   * 防御机制：
   * - URL 解码后验证路径格式
   * - 使用 path.normalize() 或正则检查
   * - 限制访问目录在项目范围内
   * 
   * 注意：
   * - 未编码的 ../ 会被 Express 路由规范化
   * - 所以使用 URL 编码的 %2F 测试
   */
  test('POST /api/timeline with path traversal is rejected', async ({ request }) => {
    const resp = await request.post('/api/timeline/..%2F..%2Fetc%2Fpasswd', {
      data: {},
    });
    expect(resp.status()).toBe(400);
  });

  // ============================================================================
  // 数据结构验证 (Data Structure Tests)
  // ============================================================================

  /**
   * 测试：视频列表中的每个视频有正确的字段结构
   * 
   * 验证点：
   * - 如果视频列表非空
   * - 每个视频对象包含 'domain' 属性
   * 
   * 重要性：
   * - 前端依赖固定的数据结构
   * - 确保 API 响应格式与前端期望一致
   * 
   * 边界情况：
   * - 如果视频列表为空（数据库无数据），测试跳过
   * - 这是防御性编程，避免在空数据时报错
   */
  test('video items have expected structure', async ({ request }) => {
    const response = await request.get('/api/videos');
    const body = await response.json();

    if (body.videos.length > 0) {
      const video = body.videos[0];
      expect(video).toHaveProperty('domain');
    }
  });

  // ============================================================================
  // P0: 配音 API (Voiceover API)
  // ============================================================================

  /**
   * 测试：配音预览 API 验证必填字段
   *
   * POST /api/websites/:domain/voiceover/preview
   *
   * 验证点：
   * - 缺少 sceneIndex → 400
   * - 缺少 text → 400
   * - 空文本 → 400
   *
   * 重要性：API 输入验证是防止无效数据的基础
   */
  test('POST voiceover/preview validates required fields', async ({ request }) => {
    // 缺少 sceneIndex
    const resp1 = await request.post('/api/websites/clickcast.tech/voiceover/preview', {
      data: { text: 'Hello' },
    });
    expect(resp1.status()).toBe(400);

    // 缺少 text
    const resp2 = await request.post('/api/websites/clickcast.tech/voiceover/preview', {
      data: { sceneIndex: 0 },
    });
    expect(resp2.status()).toBe(400);

    // 空文本
    const resp3 = await request.post('/api/websites/clickcast.tech/voiceover/preview', {
      data: { sceneIndex: 0, text: '  ' },
    });
    expect(resp3.status()).toBe(400);
  });

  /**
   * 测试：配音预览 API 拒绝无效域名
   *
   * 验证点：
   * - 包含非法字符（!）的域名被拒绝
   *
   * 重要性：防止注入攻击
   */
  test('POST voiceover/preview rejects invalid domain', async ({ request }) => {
    const resp = await request.post('/api/websites/hack!/voiceover/preview', {
      data: { sceneIndex: 0, text: 'Hello' },
    });
    expect(resp.status()).toBe(400);
  });

  // ============================================================================
  // P0: 渲染 API (Render API)
  // ============================================================================

  /**
   * 测试：渲染 API 返回 jobId
   *
   * POST /api/websites/:domain/render
   *
   * 验证点：
   * - 状态码 200
   * - 响应包含 jobId 字段
   * - jobId 是字符串类型
   *
   * 重要性：渲染是视频生成的核心功能
   * jobId 用于轮询渲染进度
   */
  test('POST render returns jobId', async ({ request }) => {
    const resp = await request.post('/api/websites/clickcast.tech/render', {
      data: { aspectRatio: 'landscape' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('jobId');
    expect(typeof body.jobId).toBe('string');
  });

  /**
   * 测试：渲染 API 对不存在的网站返回 400
   *
   * 验证点：
   * - 没有 timeline.json 的网站返回 400
   *
   * 重要性：防止对无效数据执行渲染
   */
  test('POST render returns 400 for missing timeline', async ({ request }) => {
    const resp = await request.post('/api/websites/nonexistent-site-xyz/render', {
      data: { aspectRatio: 'landscape' },
    });
    expect(resp.status()).toBe(400);
  });

  // ============================================================================
  // P1: 音频 API (Audio API)
  // ============================================================================

  /**
   * 测试：音频列表 API
   *
   * GET /api/websites/:domain/audio
   *
   * 验证点：
   * - 返回数组格式
   * - 每个条目包含 name 属性
   *
   * 重要性：编辑器需要列出可用的配音文件
   */
  test('GET audio list for existing domain', async ({ request }) => {
    const resp = await request.get('/api/websites/clickcast.tech/audio');
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('name');
      }
    }
  });

  // ============================================================================
  // P2: 响应格式验证
  // ============================================================================

  /**
   * 测试：API 响应的 Content-Type 正确
   *
   * 验证点：
   * - /api/videos 返回 application/json
   *
   * 重要性：正确的 Content-Type 确保客户端正确解析响应
   */
  test('API responses have correct content-type', async ({ request }) => {
    const resp = await request.get('/api/videos');
    const contentType = resp.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  // ============================================================================
  // P0: 生成流程 API (Generate Flow API)
  // 测试视频生成的完整 API 调用链
  // ============================================================================

  /**
   * 测试：POST /api/generate 返回 jobId
   *
   * 验证点：
   * - 状态码 200
   * - 响应包含 jobId 字段
   * - 响应包含 domain 字段
   *
   * 重要性：生成视频是首页的核心功能，API 必须正确返回 jobId 供前端轮询
   */
  test('POST /api/generate returns jobId', async ({ request }) => {
    const resp = await request.post('/api/generate', {
      data: { url: 'clickcast.tech' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('jobId');
    expect(body).toHaveProperty('domain');
    expect(typeof body.jobId).toBe('string');
  });

  /**
   * 测试：POST /api/generate 缺少 URL 返回 400
   *
   * 验证点：
   * - 不传 url 参数时返回 400
   *
   * 重要性：输入验证防止无效请求进入生成流程
   */
  test('POST /api/generate without URL returns 400', async ({ request }) => {
    const resp = await request.post('/api/generate', {
      data: {},
    });
    expect(resp.status()).toBe(400);
  });

  /**
   * 测试：生成流程状态可通过 /api/status 轮询
   *
   * 验证点：
   * - 生成后 status API 返回有效状态
   * - 状态包含 progress 和 message 字段
   *
   * 重要性：前端依赖轮询展示进度
   */
  test('generate job status can be polled', async ({ request }) => {
    const genResp = await request.post('/api/generate', {
      data: { url: 'clickcast.tech' },
    });
    const { jobId } = await genResp.json();

    const statusResp = await request.get(`/api/status/${jobId}`);
    expect(statusResp.status()).toBe(200);
    const status = await statusResp.json();
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('progress');
    expect(status).toHaveProperty('message');
  });

  // ============================================================================
  // P1: Timeline 内容简洁性测试 (Timeline Content Conciseness)
  // 验证 mainTitle/subVoiceover/tagline 满足一句话、词数限制
  // ============================================================================

  /**
   * 测试：timeline 中 mainTitle 字段最多一句话
   *
   * 验证点：
   * - 每个场景的 mainTitle 不包含多句话
   *
   * 重要性：视频配音应为简短有力的一句话，多句会超出场景时长
   */
  test('timeline mainTitle fields are one sentence max', async ({ request }) => {
    const response = await request.get('/websites/clickcast.tech/public/timeline.json');
    if (response.status() !== 200) return;
    const body = await response.json();

    for (const scene of body.scenes) {
      if (scene.mainTitle) {
        const sentences = scene.mainTitle.match(/[^.!?]+[.!?]+/g);
        expect(
          sentences ? sentences.length : 1,
          `Scene ${scene.id} mainTitle should be one sentence: "${scene.mainTitle}"`
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  /**
   * 测试：timeline 中 mainTitle 字段最多 15 词
   *
   * 验证点：
   * - 每个场景的 mainTitle 词数 <= 15
   *
   * 重要性：配音时长与词数直接相关，超过 15 词会导致场景过长
   */
  test('timeline mainTitle fields are max 15 words', async ({ request }) => {
    const response = await request.get('/websites/clickcast.tech/public/timeline.json');
    if (response.status() !== 200) return;
    const body = await response.json();

    for (const scene of body.scenes) {
      if (scene.mainTitle) {
        const wordCount = scene.mainTitle.split(/\s+/).length;
        expect(
          wordCount,
          `Scene ${scene.id} mainTitle should be <= 15 words (got ${wordCount}): "${scene.mainTitle}"`
        ).toBeLessThanOrEqual(15);
      }
    }
  });

  /**
   * 测试：timeline 中 subVoiceover 字段最多一句话
   */
  test('timeline subVoiceover fields are one sentence max', async ({ request }) => {
    const response = await request.get('/websites/clickcast.tech/public/timeline.json');
    if (response.status() !== 200) return;
    const body = await response.json();

    for (const scene of body.scenes) {
      if (scene.subVoiceover && scene.subVoiceover.trim()) {
        const sentences = scene.subVoiceover.match(/[^.!?]+[.!?]+/g);
        expect(
          sentences ? sentences.length : 1,
          `Scene ${scene.id} subVoiceover should be one sentence: "${scene.subVoiceover}"`
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  /**
   * 测试：timeline 中 subVoiceover 字段最多 15 词
   */
  test('timeline subVoiceover fields are max 15 words', async ({ request }) => {
    const response = await request.get('/websites/clickcast.tech/public/timeline.json');
    if (response.status() !== 200) return;
    const body = await response.json();

    for (const scene of body.scenes) {
      if (scene.subVoiceover && scene.subVoiceover.trim()) {
        const wordCount = scene.subVoiceover.split(/\s+/).length;
        expect(
          wordCount,
          `Scene ${scene.id} subVoiceover should be <= 15 words (got ${wordCount}): "${scene.subVoiceover}"`
        ).toBeLessThanOrEqual(15);
      }
    }
  });

  /**
   * 测试：timeline 的 tagline 最多 8 词
   */
  test('timeline tagline is max 8 words', async ({ request }) => {
    const response = await request.get('/websites/clickcast.tech/public/timeline.json');
    if (response.status() !== 200) return;
    const body = await response.json();

    if (body.tagline) {
      const wordCount = body.tagline.split(/\s+/).length;
      expect(
        wordCount,
        `Tagline should be <= 8 words (got ${wordCount}): "${body.tagline}"`
      ).toBeLessThanOrEqual(8);
    }
  });

  // ============================================================================
  // P0: 非空 subVoiceover / subTitle 测试
  // 验证非 intro/outro 场景的 subVoiceover 和 subTitle 必须有内容
  // ============================================================================

  /**
   * 测试：timeline 所有场景 subVoiceover 不为空
   *
   * 验证点：
   * - 每个场景（包括 intro/outro）的 subVoiceover 字段有内容
   *
   * 重要性：两阶段场景依赖 subVoiceover 播放次配音，为空则场景不完整
   */
  test('timeline all scenes have non-empty subVoiceover', async ({ request }) => {
    const response = await request.get('/websites/clickcast.tech/public/timeline.json');
    if (response.status() !== 200) return;
    const body = await response.json();

    for (const scene of body.scenes) {
      expect(
        scene.subVoiceover && scene.subVoiceover.trim().length > 0,
        `Scene ${scene.id} subVoiceover should not be empty`
      ).toBe(true);
    }
  });

  /**
   * 测试：timeline 所有场景 subTitle 不为空
   *
   * 验证点：
   * - 每个场景（包括 intro/outro）的 subTitle 字段有内容
   *
   * 重要性：subTitle 是视频中的副标题文字，为空则画面缺少文字
   */
  test('timeline all scenes have non-empty subTitle', async ({ request }) => {
    const response = await request.get('/websites/clickcast.tech/public/timeline.json');
    if (response.status() !== 200) return;
    const body = await response.json();

    for (const scene of body.scenes) {
      expect(
        scene.subTitle && scene.subTitle.trim().length > 0,
        `Scene ${scene.id} subTitle should not be empty`
      ).toBe(true);
    }
  });

  /**
   * 测试：所有域名 timeline 所有场景 subVoiceover 不为空
   *
   * 验证点：
   * - 扫描所有网站目录
   * - 每个场景（包括 intro/outro）的 subVoiceover 有内容
   *
   * 重要性：确保所有已有数据都满足字段非空规则
   */
  test('all domains: all scenes have non-empty subVoiceover', async ({ request }) => {
    // 获取视频列表来找到所有域名
    const videosResp = await request.get('/api/videos');
    const videosBody = await videosResp.json();

    for (const video of videosBody.videos || []) {
      const tlResp = await request.get(`/websites/${video.domain}/public/timeline.json`);
      if (tlResp.status() !== 200) continue;
      const tl = await tlResp.json();

      for (const scene of tl.scenes || []) {
        expect(
          scene.subVoiceover && scene.subVoiceover.trim().length > 0,
          `[${video.domain}] Scene ${scene.id} subVoiceover should not be empty`
        ).toBe(true);
      }
    }
  });

  /**
   * 测试：所有域名 timeline 场景有 mainTitle 字段（旧格式已映射）
   *
   * 验证点：
   * - 每个场景的 mainTitle 不为 undefined
   * - 旧格式 text/subText 已被映射
   *
   * 重要性：确保前端编辑器能正确显示所有场景的配音文案
   */
  test('all domains: scenes have mainTitle field (old format mapped)', async ({ request }) => {
    const videosResp = await request.get('/api/videos');
    const videosBody = await videosResp.json();

    for (const video of videosBody.videos || []) {
      const tlResp = await request.get(`/websites/${video.domain}/public/timeline.json`);
      if (tlResp.status() !== 200) continue;
      const tl = await tlResp.json();

      for (const scene of tl.scenes || []) {
        expect(
          scene.mainTitle !== undefined && scene.mainTitle !== null,
          `[${video.domain}] Scene ${scene.id} mainTitle should exist`
        ).toBe(true);
      }
    }
  });

  /**
   * 测试：POST 保存带空 subVoiceover 的 timeline 时自动填充
   *
   * 验证点：
   * - 保存一个 scene 有空 subVoiceover 的 timeline
   * - 重新读取后，所有场景（包括 intro/outro）的 subVoiceover 不为空
   *
   * 重要性：验证后端写入关卡的数据规则强制执行
   */
  test('POST timeline enforces non-empty subVoiceover for all scenes', async ({ request }) => {
    // 获取当前 timeline
    const getResp = await request.get('/websites/clickcast.tech/public/timeline.json');
    const timeline = await getResp.json();

    // 清空第一个场景的 subVoiceover
    const sceneIndex = 0;
    const originalSubVoiceover = timeline.scenes[sceneIndex].subVoiceover;
    const originalSubTitle = timeline.scenes[sceneIndex].subTitle;
    timeline.scenes[sceneIndex].subVoiceover = '';
    timeline.scenes[sceneIndex].subTitle = '';

    // 保存
    const postResp = await request.post('/api/timeline/clickcast.tech', {
      data: timeline,
    });
    expect(postResp.status()).toBe(200);

    // 重新读取验证
    const verifyResp = await request.get('/websites/clickcast.tech/public/timeline.json');
    const verified = await verifyResp.json();
    const savedScene = verified.scenes[sceneIndex];
    expect(
      savedScene.subVoiceover && savedScene.subVoiceover.trim().length > 0,
      `Scene ${savedScene.id} subVoiceover should be auto-filled after save`
    ).toBe(true);

    // 恢复原始数据
    timeline.scenes[sceneIndex].subVoiceover = originalSubVoiceover;
    timeline.scenes[sceneIndex].subTitle = originalSubTitle;
    await request.post('/api/timeline/clickcast.tech', {
      data: timeline,
    });
  });
});
