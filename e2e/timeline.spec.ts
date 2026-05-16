/**
 * Timeline E2E 测试套件
 * 
 * 测试目标：视频编辑器中的时间轴组件
 * 测试环境：Playwright + TypeScript
 * 路由：/editor/:domain
 * 
 * 测试覆盖范围：
 * 1. 时间轴基础结构（轨道、块、头部）
 * 2. 场景选择与切换
 * 3. 时间轴与侧边栏的联动
 * 
 * 依赖组件：
 * - Timeline.tsx：时间轴核心组件
 * - editorStore.ts：Zustand 状态管理
 * - SceneEditor.tsx：场景编辑器侧边栏
 */

import { test, expect } from '@playwright/test';

/**
 * Timeline 测试套件
 * 
 * beforeEach: 每次测试前访问编辑器页面
 * 时间轴组件依赖 timeline 数据加载完成后才渲染
 */
test.describe('Timeline', () => {
  
  test.beforeEach(async ({ page }) => {
    // 访问编辑器页面
    await page.goto('/editor/clickcast.tech');
    // 等待编辑器加载完成（包含 timeline 数据）
    await page.waitForSelector('.editor-container', { timeout: 15000 });
  });

  // ============================================================================
  // 基础结构测试 (Basic Structure Tests)
  // 验证时间轴组件的核心 DOM 结构
  // ============================================================================

  /**
   * 测试：时间轴轨道可见
   * 
   * 验证点：
   * - .timeline-track 元素可见
   * 
   * 重要性：timeline-track 是时间轴的主容器，包含所有场景块
   * 时间轴轨道定义了时间轴的视觉边界
   */
  test('timeline track is visible', async ({ page }) => {
    await expect(page.locator('.timeline-track')).toBeVisible();
  });

  /**
   * 测试：场景块存在
   * 
   * 验证点：
   * - 至少有 2 个 .timeline-block 元素
   * 
   * 重要性：每个时间轴场景对应一个时间块
   * 通常包含：Intro（开头）、中间场景、Outro（结尾）
   * 少于 2 个块可能表示数据加载失败或配置错误
   */
  test('timeline blocks exist for scenes', async ({ page }) => {
    const blocks = page.locator('.timeline-block');
    const count = await blocks.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  /**
   * 测试：默认选中第一个场景块
   * 
   * 验证点：
   * - 存在 .timeline-block.selected 元素
   * - 表示有场景被选中
   * 
   * 重要性：默认选中状态引导用户开始编辑
   * 选中块应该有视觉区分（高亮、边框等）
   */
  test('a timeline block is selected by default', async ({ page }) => {
    const selected = page.locator('.timeline-block.selected');
    await expect(selected).toBeVisible();
  });

  /**
   * 测试：时间轴头部显示时长信息
   * 
   * 验证点：
   * - .timeline-header 可见（头部区域）
   * - .timeline-duration 可见（时长显示）
   * 
   * 重要性：用户需要知道视频总时长
   * 时长通常格式化为 MM:SS 或显示总帧数
   */
  test('timeline header shows duration', async ({ page }) => {
    await expect(page.locator('.timeline-header')).toBeVisible();
    await expect(page.locator('.timeline-duration')).toBeVisible();
  });

  // ============================================================================
  // 场景交互测试 (Scene Interaction Tests)
  // 测试用户与时间轴块的基本交互
  // ============================================================================

  /**
   * 测试：点击时间轴块可以选中它
   * 
   * 验证点：
   * - 获取当前块数量（至少 2 个才测试）
   * - 点击第二个块
   * - 验证第二个块获得 'selected' class
   * 
   * 重要性：时间轴交互的核心 - 用户通过点击选择要编辑的场景
   * 
   * 实现细节：
   * - 使用 .click() 点击元素
   * - 通过 class 名称 /selected/ 判断选中状态
   */
  test('clicking a timeline block selects it', async ({ page }) => {
    const blocks = page.locator('.timeline-block');
    const count = await blocks.count();
    if (count >= 2) {
      // 点击第二个块
      await blocks.nth(1).click();
      // 验证第二个块被选中
      await expect(blocks.nth(1)).toHaveClass(/selected/);
    }
  });

  /**
   * 测试：切换场景时侧边栏内容更新
   * 
   * 验证点：
   * - 获取当前选中的场景索引（#scene-index）
   * - 点击第二个时间轴块
   * - 验证索引文本发生变化
   * 
   * 重要性：时间轴与侧边栏的联动是编辑器的基本 UX
   * 选中不同场景时，侧边栏应显示对应场景的编辑内容
   * 
   * 依赖组件：
   * - .scene-index：显示当前场景编号的元素
   */
  test('selecting different scene updates the sidebar', async ({ page }) => {
    const blocks = page.locator('.timeline-block');
    const count = await blocks.count();
    if (count >= 2) {
      // 获取当前场景索引（"#0" 或 "#1" 等格式）
      const initialIndex = await page.locator('.scene-index').textContent();
      
      // 点击第二个块
      await blocks.nth(1).click();
      
      // 获取新的场景索引
      const newIndex = await page.locator('.scene-index').textContent();
      
      // 索引应该发生变化
      expect(newIndex).not.toEqual(initialIndex);
    }
  });
});
