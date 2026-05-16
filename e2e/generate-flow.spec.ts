/**
 * 完整生成流程 E2E 测试
 *
 * 模拟真实用户操作：首页输入网址 → 点击生成 → 等待完成 → 跳转编辑器 → 验证场景字段
 *
 * 测试覆盖：
 * 1. 首页输入 URL 并点击生成
 * 2. 进度条正确显示和更新
 * 3. 生成完成后自动跳转到编辑器
 * 4. 编辑器加载正确的域名数据
 * 5. 所有场景（包括 intro/outro）的 Sub Title 和 Sub Voiceover 不为空
 */

import { test, expect } from '@playwright/test';

test.describe('Generate Flow: Homepage → Editor', () => {

  // 超时设置：generate 涉及 AI 分析 + 配音，可能需要较长时间
  test.setTimeout(180000);

  /**
   * 测试：完整生成流程 — 从首页到编辑器验证
   *
   * 用户操作流程：
   * 1. 访问首页
   * 2. 输入 URL
   * 3. 点击 Generate Video
   * 4. 等待进度完成
   * 5. 自动跳转到编辑器
   * 6. 验证场景字段不为空
   */
  test('complete generate flow: input URL → generate → editor → verify all subVoiceover not empty', async ({ page }) => {
    // ===== Step 1: 访问首页 =====
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 验证首页核心元素
    const urlInput = page.locator('#url');
    const generateBtn = page.locator('#generateBtn');
    await expect(urlInput).toBeVisible();
    await expect(generateBtn).toBeVisible();

    // ===== Step 2: 输入 URL =====
    // 使用已有截图数据的域名，跳过截图步骤加速测试
    await urlInput.fill('clickcast.tech');
    await expect(urlInput).toHaveValue('clickcast.tech');

    // ===== Step 3: 点击生成 =====
    await generateBtn.click();

    // 验证进度条出现
    const progress = page.locator('#progress');
    await expect(progress).toHaveClass(/active/, { timeout: 10000 });

    // 截图：生成开始
    await page.screenshot({ path: '/tmp/generate-flow-started.png' });

    // ===== Step 4: 等待生成完成并跳转 =====
    // 等待页面跳转到编辑器（generate 完成后 JS 会执行 window.location.href = '/editor/' + domain）
    await page.waitForURL(/\/editor\//, { timeout: 180000 });

    // 截图：跳转到编辑器
    await page.screenshot({ path: '/tmp/generate-flow-redirected.png' });

    // ===== Step 5: 验证编辑器加载 =====
    await page.waitForSelector('.editor-container', { timeout: 30000 });
    await page.waitForSelector('.timeline-block', { timeout: 15000 });

    // 验证域名正确
    await expect(page.locator('.domain-badge')).toHaveText('clickcast.tech');

    // ===== Step 6: 逐个点击场景，验证 Sub Title 和 Sub Voiceover =====
    const blockCount = await page.locator('.timeline-block').count();
    expect(blockCount).toBeGreaterThanOrEqual(2); // 至少有 intro + outro

    const emptyFields: string[] = [];

    for (let i = 0; i < blockCount; i++) {
      // 点击时间轴场景块
      await page.locator('.timeline-block').nth(i).click();
      await page.waitForTimeout(500);

      // 获取场景 ID 和文本字段
      const sceneData = await page.evaluate(() => {
        const header = document.querySelector('.scene-editor-header h3')?.textContent || '';
        const textareas = document.querySelectorAll('.scene-editor textarea');
        const fields: { label: string; value: string }[] = [];
        textareas.forEach(t => {
          const group = t.closest('.scene-editor-group');
          const label = group?.querySelector('label')?.textContent || '';
          fields.push({ label: label.trim(), value: t.value || '' });
        });
        return { header, fields };
      });

      const sceneId = sceneData.header;

      for (const field of sceneData.fields) {
        const isSubTitle = field.label.toLowerCase().includes('sub title');
        const isSubVoiceover = field.label.toLowerCase().includes('sub voiceover');

        if (isSubTitle || isSubVoiceover) {
          if (!field.value.trim()) {
            emptyFields.push(`${sceneId} → ${field.label}`);
          }
        }
      }
    }

    // 截图：最终编辑器状态
    await page.screenshot({ path: '/tmp/generate-flow-editor-final.png', fullPage: true });

    // 断言：所有场景（包括 intro/outro）的 Sub Title 和 Sub Voiceover 不为空
    expect(
      emptyFields,
      `These fields should not be empty: ${emptyFields.join(', ')}`
    ).toHaveLength(0);
  });
});
