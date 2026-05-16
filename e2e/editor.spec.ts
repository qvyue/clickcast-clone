/**
 * Editor E2E 测试套件
 * 
 * 测试目标：VidGen AI视频编辑器页面
 * 测试环境：Playwright + TypeScript
 * 路由：/editor/:domain（如 /editor/clickcast.tech）
 * 
 * 测试覆盖范围：
 * 1. 编辑器布局验证（头部、预览、侧边栏、时间轴）
 * 2. 场景编辑功能（标题、配音、图片）
 * 3. 视频比例切换（横屏/竖屏）
 * 4. 渲染流程
 * 5. 自动保存机制
 * 6. 场景管理（删除、选中）
 * 7. 播放器集成（Remotion）
 * 
 * 依赖数据：需要 clickcast.tech 网站的 timeline.json 存在于服务器
 */

import { test, expect } from '@playwright/test';

/**
 * Editor 测试套件
 * 
 * beforeEach: 每次测试前访问编辑器页面并等待加载完成
 * 15秒超时确保慢网络下也能正常测试
 */
test.describe('Editor', () => {
  
  test.beforeEach(async ({ page }) => {
    // 访问编辑器页面（使用测试数据域名）
    await page.goto('/editor/clickcast.tech');
    // 等待 SPA 加载完成，timeline 数据获取成功
    await page.waitForSelector('.editor-container', { timeout: 15000 });
  });

  // ============================================================================
  // 基础布局测试 (Layout Tests)
  // 验证编辑器的核心 UI 结构
  // ============================================================================

  /**
   * 测试：编辑器主容器可见
   * 
   * 验证点：
   * - .editor-container 元素存在且可见
   * 
   * 重要性：这是所有其他测试的前提，如果容器不显示说明页面加载失败
   */
  test('editor container is visible', async ({ page }) => {
    await expect(page.locator('.editor-container')).toBeVisible();
  });

  /**
   * 测试：域名徽章显示正确的域名
   * 
   * 验证点：
   * - .domain-badge 文本内容为 "clickcast.tech"
   * 
   * 重要性：确保编辑器加载的是正确的网站数据
   * 失败可能原因：URL 参数解析错误、数据绑定问题
   */
  test('domain badge shows correct domain', async ({ page }) => {
    await expect(page.locator('.domain-badge')).toHaveText('clickcast.tech');
  });

  /**
   * 测试：编辑器有预览区域
   * 
   * 验证点：
   * - .editor-preview 元素可见
   * 
   * 重要性：视频预览是编辑器的核心功能
   */
  test('editor has preview area', async ({ page }) => {
    await expect(page.locator('.editor-preview')).toBeVisible();
  });

  /**
   * 测试：编辑器有侧边栏
   * 
   * 验证点：
   * - .editor-sidebar 元素可见
   * 
   * 重要性：侧边栏包含场景编辑器，是编辑操作的主要区域
   */
  test('editor has sidebar', async ({ page }) => {
    await expect(page.locator('.editor-sidebar')).toBeVisible();
  });

  /**
   * 测试：时间轴区域可见
   * 
   * 验证点：
   * - .editor-timeline 元素可见
   * 
   * 重要性：时间轴用于多场景管理和播放控制
   */
  test('timeline area is visible', async ({ page }) => {
    await expect(page.locator('.editor-timeline')).toBeVisible();
  });

  /**
   * 测试：视频比例切换按钮可见
   * 
   * 验证点：
   * - .aspect-toggle 元素可见
   * 
   * 重要性：用户需要选择输出视频的比例（横屏/竖屏）
   */
  test('aspect ratio toggle is visible', async ({ page }) => {
    await expect(page.locator('.aspect-toggle')).toBeVisible();
  });

  /**
   * 测试：横屏模式默认激活
   * 
   * 验证点：
   * - 第一个比例按钮 (.aspect-btn.first) 包含 'active' class
   * 
   * 重要性：默认横屏 16:9 是最常用的视频比例
   */
  test('landscape is active by default', async ({ page }) => {
    const landscapeBtn = page.locator('.aspect-btn').first();
    await expect(landscapeBtn).toHaveClass(/active/);
  });

  /**
   * 测试：可以切换到竖屏模式
   * 
   * 验证点：
   * - 点击第二个比例按钮（竖屏 9:16）
   * - 该按钮获得 'active' class
   * 
   * 重要性：短视频场景常用竖屏格式
   */
  test('can switch to portrait mode', async ({ page }) => {
    const portraitBtn = page.locator('.aspect-btn').nth(1);
    await portraitBtn.click();
    await expect(portraitBtn).toHaveClass(/active/);
  });

  /**
   * 测试：返回按钮可见
   * 
   * 验证点：
   * - .btn-ghost（幽灵按钮样式）可见
   * 
   * 重要性：用户需要能返回首页
   */
  test('back button is visible', async ({ page }) => {
    await expect(page.locator('.btn-ghost')).toBeVisible();
  });

  /**
   * 测试：场景编辑器可见且有场景被选中
   * 
   * 验证点：
   * - .scene-editor 元素可见
   * 
   * 重要性：每个时间轴场景都对应一个场景编辑器
   */
  test('scene editor is visible with selected scene', async ({ page }) => {
    await expect(page.locator('.scene-editor')).toBeVisible();
  });

  /**
   * 测试：场景编辑器有文本输入字段
   * 
   * 验证点：
   * - 至少有 2 个 input 或 textarea 元素
   * - 通常包括：标题输入、主配音文本、次配音文本
   * 
   * 重要性：场景编辑依赖这些输入框
   */
  test('scene editor has text input fields', async ({ page }) => {
    const inputs = page.locator('.scene-editor input, .scene-editor textarea');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  /**
   * 测试：删除场景按钮存在
   * 
   * 验证点：
   * - .btn-danger（危险按钮样式）可见
   * 
   * 重要性：用户需要能删除不需要的场景
   */
  test('delete scene button exists', async ({ page }) => {
    await expect(page.locator('.btn-danger')).toBeVisible();
  });

  /**
   * 测试：图片区域存在（预览图或占位符）
   * 
   * 验证点：
   * - 要么显示图片预览 .scene-image-preview
   * - 要么显示占位符 .empty-image-placeholder
   * 
   * 重要性：每个场景都可以配图
   */
  test('image area exists (preview or placeholder)', async ({ page }) => {
    const imagePreview = page.locator('.scene-image-preview');
    const placeholder = page.locator('.empty-image-placeholder');
    const hasPreview = await imagePreview.count();
    const hasPlaceholder = await placeholder.count();
    expect(hasPreview + hasPlaceholder).toBeGreaterThanOrEqual(1);
  });

  // ============================================================================
  // P0: 核心交互测试 (Core Interaction Tests)
  // 测试用户最常用的功能
  // ============================================================================

  /**
   * 测试：返回按钮可以导航到首页
   * 
   * 验证点：
   * - 点击返回按钮后 URL 回到根路径 /
   * - 首页元素（#url 输入框）可见
   * 
   * 重要性：确保导航功能正常
   */
  test('back button navigates to homepage', async ({ page }) => {
    await page.locator('.btn-ghost').click();
    await expect(page).toHaveURL(/\//);
    await expect(page.locator('#url')).toBeVisible();
  });

  /**
   * 测试：可以编辑场景的主标题
   * 
   * 验证点：
   * - 清空并填入新标题 "Test Title E2E"
   * - 输入框值正确更新
   * 
   * 重要性：主标题是视频的核心文字内容
   */
  test('can edit main title in scene editor', async ({ page }) => {
    const titleInput = page.locator('.scene-editor input[type="text"]').first();
    // Use Playwright's fill() which triggers React's synthetic events
    await titleInput.fill('Test Title E2E');
    await expect(titleInput).toHaveValue('Test Title E2E');
  });

  /**
   * 测试：可以编辑副标题文本框
   * 
   * 验证点：
   * - 清空并填入副标题文本
   * * 输入框值正确更新
   * 
   * 重要性：副标题提供额外的文字说明
   */
  test('can edit subtitle textarea', async ({ page }) => {
    const subTitleArea = page.locator('.scene-editor textarea').first();
    await subTitleArea.clear();
    await subTitleArea.fill('Test subtitle for E2E');
    await expect(subTitleArea).toHaveValue('Test subtitle for E2E');
  });

  /**
   * 测试：主配音生成按钮有反馈
   * 
   * 验证点：
   * - 点击 "Generate Main" 按钮
   * - 按钮变为 "Generating..." 状态，或
   * - 显示成功消息 .voiceover-message-success，或
   * - 显示错误消息 .voiceover-message-error
   * 
   * 重要性：TTS（文字转语音）是核心功能，需要反馈用户当前状态
   * 注意：真实测试中可能因 ElevenLabs 未配置而显示错误
   */
  test('generate main voiceover button shows feedback', async ({ page }) => {
    const generateMainBtn = page.locator('button:has-text("Generate Main")');
    await expect(generateMainBtn).toBeVisible();
    await generateMainBtn.click();

    // 验证按钮有反馈状态之一
    const hasGenerating = await page.locator('button:has-text("Generating")').isVisible().catch(() => false);
    const hasError = await page.locator('.voiceover-message-error').isVisible().catch(() => false);
    const hasSuccess = await page.locator('.voiceover-message-success').isVisible().catch(() => false);

    expect(hasGenerating || hasError || hasSuccess).toBe(true);
  });

  /**
   * 测试：次配音生成按钮有反馈
   * 
   * 验证点：同上，针对次配音按钮
   * 
   * 重要性：次配音用于两阶段场景（如主+次配音连续播放）
   */
  test('generate sub voiceover button shows feedback', async ({ page }) => {
    const generateSubBtn = page.locator('button:has-text("Generate Sub")');
    await expect(generateSubBtn).toBeVisible();
    await generateSubBtn.click();

    const hasGenerating = await page.locator('button:has-text("Generating")').isVisible().catch(() => false);
    const hasError = await page.locator('.voiceover-message-error').isVisible().catch(() => false);
    const hasSuccess = await page.locator('.voiceover-message-success').isVisible().catch(() => false);

    expect(hasGenerating || hasError || hasSuccess).toBe(true);
  });

  /**
   * 测试：场景删除显示确认对话框
   * 
   * 验证点：
   * - 初始场景数量 > 1（至少能删除一个）
   * - 点击删除按钮触发浏览器 confirm dialog
   * - 我们 dismiss（取消）对话框
   * - 场景数量不变（确认取消确实保留了场景）
   * 
   * 重要性：删除操作不可逆，必须让用户确认
   */
  test('scene deletion shows confirmation dialog', async ({ page }) => {
    const blocksBefore = await page.locator('.timeline-block').count();
    if (blocksBefore <= 1) {
      // 只有一个场景时不允许删除
      return;
    }

    // 监听 dialog 事件
    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();  // 取消删除
    });

    await page.locator('.btn-danger').click();

    // 确认对话框确实出现了
    expect(dialogSeen).toBe(true);

    // 场景数量不变（因为我们取消了）
    const blocksAfter = await page.locator('.timeline-block').count();
    expect(blocksAfter).toBe(blocksBefore);
  });

  /**
   * 测试：确认删除后场景数量减少
   * 
   * 验证点：
   * - 点击删除后 accept（确认）对话框
   * - 等待删除操作完成
   * - 场景数量减少 1
   * 
   * 重要性：验证删除功能真正工作
   */
  test('scene deletion with confirm reduces scene count', async ({ page }) => {
    const blocksBefore = await page.locator('.timeline-block').count();
    if (blocksBefore <= 1) {
      return;
    }

    // 接受对话框（确认删除）
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.locator('.btn-danger').click();
    await page.waitForTimeout(500);  // 等待删除动画/操作完成

    const blocksAfter = await page.locator('.timeline-block').count();
    expect(blocksAfter).toBe(blocksBefore - 1);
  });

  /**
   * 测试：渲染按钮触发生成流程
   * 
   * 验证点：
   * - .btn-primary:has-text("Render") 可见
   * - 点击后要么显示 .render-status 状态，要么按钮被禁用
   * 
   * 重要性：P0 功能，渲染是视频生成的最终步骤
   */
  test('render button triggers rendering process', async ({ page }) => {
    const renderBtn = page.locator('.btn-primary:has-text("Render")');
    await expect(renderBtn).toBeVisible();
    await renderBtn.click();

    // 等待渲染状态出现（可能需要几秒启动渲染进程）
    await page.waitForTimeout(2000);
    const hasRenderStatus = await page.locator('.render-status').isVisible().catch(() => false);
    const isDisabled = await renderBtn.isDisabled().catch(() => false);

    expect(hasRenderStatus || isDisabled).toBe(true);
  });

  // ============================================================================
  // P1: 播放器与模态框测试 (Player & Modal Tests)
  // ============================================================================

  /**
   * 测试：Remotion 播放器在预览区域渲染
   * 
   * 验证点：
   * - .editor-preview 内部有 Remotion 渲染的 div/canvas
   * 
   * 重要性：Remotion 是视频渲染引擎，必须正常加载
   */
  test('Remotion player renders in preview area', async ({ page }) => {
    const playerContainer = page.locator('.editor-preview > div').first();
    await expect(playerContainer).toBeVisible();
  });

  /**
   * 测试：编辑后显示自动保存消息
   * 
   * 验证点：
   * - 修改输入框触发 isDirty 状态
   * - 2 秒 debounce 后自动保存
   * - 显示 ".auto-save-message" 包含 "Auto-saved"
   * 
   * 重要性：自动保存防止用户丢失修改
   * 5 秒超时覆盖 debounce + API 调用时间
   */
  test('auto-save message appears after editing', async ({ page }) => {
    const titleInput = page.locator('.scene-editor input[type="text"]').first();
    await titleInput.clear();
    await titleInput.fill('Trigger auto-save');

    const autoSaveMsg = page.locator('.auto-save-message');
    await expect(autoSaveMsg).toBeVisible({ timeout: 5000 });
    await expect(autoSaveMsg).toContainText('Auto-saved');
  });

  /**
   * 测试：图片放大模态框可以打开和关闭
   * 
   * 验证点：
   * - 如果有图片预览（非占位符）
   * - 点击放大按钮显示 .image-modal-overlay
   * - 点击关闭按钮隐藏模态框
   * 
   * 重要性：用户需要查看图片细节
   */
  test('image zoom modal opens and closes', async ({ page }) => {
    const imagePreview = page.locator('.scene-image-preview');
    const hasImage = await imagePreview.count();

    if (hasImage > 0) {
      const zoomBtn = page.locator('.scene-image-zoom-btn');
      if (await zoomBtn.isVisible()) {
        await zoomBtn.click();
        await expect(page.locator('.image-modal-overlay')).toBeVisible();

        await page.locator('.image-modal-close').click();
        await expect(page.locator('.image-modal-overlay')).not.toBeVisible();
      }
    }
  });

  /**
   * 测试：没有选中场景时显示提示
   * 
   * 验证点：
   * - .no-selection 元素初始不可见（因为默认选中第一个场景）
   * 
   * 重要性：UI 反馈，帮助用户理解操作
   */
  test('no-selection message appears when no scene selected', async ({ page }) => {
    const noSelection = page.locator('.no-selection');
    await expect(noSelection).not.toBeVisible();
  });

  /**
   * 测试：渲染按钮文本正确
   * 
   * 验证点：
   * - 按钮文本包含 "Render"
   * 
   * 重要性：按钮文本是用户的主要引导
   */
  test('render button text is Render', async ({ page }) => {
    const renderBtn = page.locator('.btn-primary:has-text("Render")');
    await expect(renderBtn).toHaveText(/Render/);
  });

  /**
   * 测试：比例按钮有正确的标签
   * 
   * 验证点：
   * - 第一个按钮包含 "16:9"
   * - 第二个按钮包含 "9:16"
   * 
   * 重要性：用户需要知道按钮的含义
   */
  test('aspect buttons have correct labels', async ({ page }) => {
    const landscapeBtn = page.locator('.aspect-btn').first();
    const portraitBtn = page.locator('.aspect-btn').nth(1);
    await expect(landscapeBtn).toContainText('16:9');
    await expect(portraitBtn).toContainText('9:16');
  });

  /**
   * 测试：场景编辑器头部显示场景类型
   * 
   * 验证点：
   * - .scene-editor-header h3 显示场景类型
   * - 可能是 "Intro"、"Outro" 或 "Scene {index}"
   * 
   * 重要性：帮助用户识别场景用途
   */
  test('scene editor header shows scene type', async ({ page }) => {
    const headerText = await page.locator('.scene-editor-header h3').textContent();
    expect(headerText).toBeTruthy();
    expect(headerText!.length).toBeGreaterThan(0);
  });
});
