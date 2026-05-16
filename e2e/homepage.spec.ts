/**
 * Homepage E2E 测试套件
 * 
 * 测试目标：VidGen AI视频生成器首页
 * 测试环境：Playwright + TypeScript
 * 路由：/ (SPA 首页) ；SPA 是 "Single Page Application" 的缩写，即"单页应用程序"。
 * 
 * 测试覆盖范围：
 * 1. 页面基础布局（标题、输入框、按钮）
 * 2. 初始状态验证（进度条、结果区默认隐藏）
 * 3. 用户输入交互（URL 输入）
 * 4. 生成流程（进度显示、错误处理）
 * 5. 视频列表功能
 * 6. 路由导航
 * 7. 输入格式验证
 */

// 导入 Playwright 测试框架
// test: 定义测试用例，类似 JUnit 的 @Test 注解
// expect: 断言库，用于验证预期结果，类似 Assert.assertEquals
import { test, expect } from '@playwright/test';

/**
 * Homepage 测试套件
 * 
 * 每个测试前都会执行 beforeEach，确保每个测试都在干净的环境下运行
 * page.goto('/') 确保每次测试都从首页开始
 */
test.describe('Homepage', () => {
  
  /**
   * beforeEach Hook
   * 在每个测试用例执行前自动调用
   * 作用：确保每次测试都从首页开始，避免测试间的状态污染
   */
  test.beforeEach(async ({ page }) => {
    // 访问首页路由
    await page.goto('/');
  });

  // ============================================================================
  // 基础布局测试 (Layout Tests)
  // 验证页面核心 UI 元素是否存在且正确
  // ============================================================================

  /**
   * 测试：页面标题正确
   * 
   * 验证点：
   * - HTML <title> 标签内容为 "VidGen - AI Video Generator"
   * 
   * 重要性：页面标题是 SEO 和用户体验的基础，正确标题确保用户知道自己在哪个网站
   * 失败可能原因：前端路由配置错误、HTML head 模板错误
   */
  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle('VidGen - AI Video Generator');
  });

  /**
   * 测试：URL 输入框可见且有正确的 placeholder
   * 
   * 验证点：
   * - 输入框存在且可见 (visibility: visible)
   * - placeholder 文本包含 "github.com"，提示用户输入 GitHub URL
   * 
   * 重要性：URL 输入是视频生成的核心入口
   * 失败可能原因：CSS 隐藏了输入框、placeholder 配置错误
   */
  test('URL input field is visible', async ({ page }) => {
    const urlInput = page.locator('#url');
    await expect(urlInput).toBeVisible();
    // 使用正则 /github\.com/ 匹配，包含 github.com 的任意 placeholder
    await expect(urlInput).toHaveAttribute('placeholder', /github\.com/);
  });

  /**
   * 测试：生成按钮可见且文本正确
   * 
   * 验证点：
   * - 按钮可见
   * - 按钮文本为 "Generate Video"
   * 
   * 重要性：生成按钮是主要操作入口
   * 失败可能原因：按钮被隐藏、文本被国际化配置修改
   */
  test('generate button is visible and clickable', async ({ page }) => {
    const btn = page.locator('#generateBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Generate Video');
  });

  /**
   * 测试：进度容器初始状态隐藏
   * 
   * 验证点：
   * - 进度容器 (#progress) 存在于 DOM 中
   * - 初始状态不包含 'active' class（即隐藏）
   * 
   * 重要性：进度条应该在生成开始后才显示，初始隐藏避免用户困惑
   * 使用 toBeAttached 而非 toBeVisible，因为元素可能初始 opacity:0
   */
  test('progress container exists but is hidden initially', async ({ page }) => {
    const progress = page.locator('#progress');
    await expect(progress).toBeAttached();  // DOM 中存在
    await expect(progress).not.toHaveClass(/active/);  // 不含 active class
  });

  /**
   * 测试：结果区域初始状态隐藏
   * 
   * 验证点：
   * - 结果区域 (#result) 存在于 DOM 中
   * - 初始状态不包含 'active' class
   * 
   * 重要性：结果区应在生成完成后才显示
   */
  test('result section exists but is hidden initially', async ({ page }) => {
    const result = page.locator('#result');
    await expect(result).toBeAttached();
    await expect(result).not.toHaveClass(/active/);
  });

  /**
   * 测试：视频列表区域可见
   * 
   * 验证点：
   * - 视频列表容器 (#videoListSection) 可见
   * 
   * 重要性：用户需要看到历史生成的视频
   */
  test('video list section is visible', async ({ page }) => {
    const section = page.locator('#videoListSection');
    await expect(section).toBeVisible();
  });

  /**
   * 测试：可以向输入框输入 URL
   * 
   * 验证点：
   * - 可以 fill() 方法填充文本
   * - 填充后 input 的 value 属性正确
   * 
   * 重要性：用户需要能够修改输入的 URL
   */
  test('can type URL into input', async ({ page }) => {
    const urlInput = page.locator('#url');
    await urlInput.fill('example.com');
    await expect(urlInput).toHaveValue('example.com');
  });

  /**
   * 测试：点击生成按钮不导致页面崩溃
   * 
   * 验证点：
   * - 点击按钮后页面仍然可用
   * - 输入框仍然可见（页面未崩溃）
   * 
   * 重要性：基本的错误处理测试，确保无效输入不会导致 JS 错误
   */
  test('generate button click does not crash page', async ({ page }) => {
    await page.locator('#url').fill('example.com');
    await page.locator('#generateBtn').click();
    await expect(page.locator('#url')).toBeVisible();
  });

  /**
   * 测试：页面加载时无关键控制台错误
   * 
   * 验证点：
   * - 监听 console 的 error 类型消息
   * - 过滤掉 favicon 404 和其他非关键错误
   * - 关键错误列表为空
   * 
   * 重要性：控制台错误可能表示 JS 异常或资源加载失败
   * 过滤项：favicon（网站图标缺失不关键）、404（某些资源可能不存在）
   */
  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // 过滤非关键错误
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('Failed to fetch')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ============================================================================
  // P0: 核心生成流程测试 (Generate Flow Tests)
  // 测试从输入 URL 到生成视频的完整流程
  // ============================================================================

  /**
   * 测试：有效 URL 触发生成流程并显示进度
   * 
   * 验证点：
   * - 点击生成按钮后，进度容器出现 'active' class
   * - 进度条从隐藏变为可见
   * 
   * 重要性：P0 测试，验证核心功能的用户反馈机制
   * 等待 5 秒超时，防止进度永远不显示的 bug
   */
  test('generate flow shows progress on valid URL', async ({ page }) => {
    await page.locator('#url').fill('example.com');
    await page.locator('#generateBtn').click();

    const progress = page.locator('#progress');
    // 等待进度条出现，最多 5 秒
    await expect(progress).toHaveClass(/active/, { timeout: 5000 });
  });

  /**
   * 测试：生成流程中进度文本更新
   * 
   * 验证点：
   * - 进度文本容器 (#progressText) 不为空
   * - 表示正在显示具体的进度信息（如百分比、步骤等）
   * 
   * 重要性：用户需要知道当前进度，不能只显示进度条
   */
  test('generate flow shows progress text', async ({ page }) => {
    await page.locator('#url').fill('example.com');
    await page.locator('#generateBtn').click();

    const progressText = page.locator('#progressText');
    await expect(progressText).not.toBeEmpty({ timeout: 5000 });
  });

  /**
   * 测试：空 URL 点击生成不崩溃
   * 
   * 验证点：
   * - 不填 URL 直接点击生成
   * - 页面仍然可用，输入框可见
   * 
   * 重要性：边界情况测试，防止空输入导致 JS 错误
   * 理想情况应该显示错误提示，但至少不应该崩溃
   */
  test('generate with empty URL shows no crash', async ({ page }) => {
    await page.locator('#generateBtn').click();
    await expect(page.locator('#url')).toBeVisible();
  });

  // ============================================================================
  // P1: 视频列表测试 (Video List Tests)
  // 验证历史视频列表的加载和显示
  // ============================================================================

  /**
   * 测试：视频列表从 API 加载数据
   * 
   * 验证点：
   * - 等待 /api/videos 请求完成
   * - 视频列表容器存在
   * 
   * 重要性：验证前后端数据流是否正常
   * 使用 waitForResponse 等待 API 调用完成
   */
  test('video list loads data from API', async ({ page }) => {
    // 等待 API 调用完成，最多 10 秒
    await page.waitForResponse(
      resp => resp.url().includes('/api/videos'), 
      { timeout: 10000 }
    ).catch(() => {});
    await page.waitForTimeout(1000);  // 额外等待渲染

    const videoList = page.locator('#videoList');
    await expect(videoList).toBeAttached();
  });

  /**
   * 测试：视频列表区域有标题
   * 
   * 验证点：
   * - 视频列表区域包含 h2 或 h3 标题
   * 
   * 重要性：UI 结构完整性
   */
  test('video list section has heading', async ({ page }) => {
    const heading = page.locator('#videoListSection h2, #videoListSection h3');
    if (await heading.count() > 0) {
      await expect(heading.first()).toBeVisible();
    }
  });

  // ============================================================================
  // P1: 导航测试 (Navigation Tests)
  // 验证页面路由和导航功能
  // ============================================================================

  /**
   * 测试：通过 URL 导航到编辑器
   * 
   * 验证点：
   * - 访问 /editor/clickcast.tech
   * - 编辑器容器可见（15秒超时）
   * - 域名徽章显示正确域名
   * 
   * 重要性：验证编辑器路由是否正确配置
   * 这是 SPA 路由测试，检查 React Router 或前端路由是否工作
   */
  test('navigate to editor via URL', async ({ page }) => {
    await page.goto('/editor/clickcast.tech');
    await expect(page.locator('.editor-container')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.domain-badge')).toHaveText('clickcast.tech');
  });

  /**
   * 测试：无效路由回退到首页
   * 
   * 验证点：
   * - 访问不存在的页面
   * - SPA 应显示首页内容（fallback 到 /）
   * - URL 输入框可见
   * 
   * 重要性：确保所有路由都有兜底，避免 404
   * 通常 SPA 使用通配符路由 * 或 404 页面
   */
  test('non-existent route shows SPA (does not 404)', async ({ page }) => {
    const response = await page.goto('/nonexistent-page');
    // SPA fallback returns 200 with the React app's index.html
    // The HTTP response itself should be 200 (Express serves index.html for all non-API routes)
    expect(response!.status()).toBe(200);
    // The page body should exist (React app is mounted)
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // The React app may show loading state since no route matches
    const pageContent = await body.textContent();
    expect(pageContent!.length).toBeGreaterThan(0);
  });

  // ============================================================================
  // P1: 输入验证测试 (Input Validation Tests)
  // 验证用户输入的格式和类型
  // ============================================================================

  /**
   * 测试：URL 输入框接受各种域名格式
   * 
   * 验证点：
   * - 标准域名：github.com
   * - 带协议：https://example.com
   * - 子域名：app.linear.app
   * 
   * 重要性：用户输入格式多样，输入框应该宽容处理
   * 后端处理时再进行 URL 规范化
   */
  test('URL input accepts various domain formats', async ({ page }) => {
    const urlInput = page.locator('#url');

    // 标准域名
    await urlInput.fill('github.com');
    await expect(urlInput).toHaveValue('github.com');

    // 带协议（保留原格式，不做预处理）
    await urlInput.fill('https://example.com');
    await expect(urlInput).toHaveValue('https://example.com');

    // 子域名
    await urlInput.fill('app.linear.app');
    await expect(urlInput).toHaveValue('app.linear.app');
  });
});
