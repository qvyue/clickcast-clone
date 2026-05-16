/**
 * =============================================================================
 * Zustand 编辑器状态管理单元测试
 * 
 * 测试目标：frontend/src/store/editorStore.ts
 * 测试框架：Vitest
 * 
 * 测试覆盖范围：
 * 1. setDomain - 设置域名（同时重置 timeline）
 * 2. setTimeline - 设置时间线
 * 3. selectScene - 选择场景
 * 4. updateScene - 更新场景（包含边界检查）
 * 5. deleteScene - 删除场景（重新计算帧数、调整选中索引）
 * 6. deleteSceneImage - 删除场景图片
 * 7. setCurrentFrame - 设置当前帧
 * 8. setRendering - 设置渲染状态
 * 9. save - 保存时间线
 * 
 * 测试策略：
 * - 使用 useEditorStore.setState() 重置状态
 * - 使用 vi.mock 模拟 API 调用
 * - 验证状态变更和副作用
 * 
 * Zustand 概念：
 * - store 是一个 hook，通过 getState() 获取当前状态
 * - actions 是返回 void 的函数，修改状态后自动更新 UI
 * - setState 用于编程式修改状态
 * =============================================================================
 */

import { describe, it, expect, vi } from 'vitest'
import { useEditorStore } from './editorStore'
import { Timeline } from '../types'

// Mock the saveTimeline function
// 重要性：避免在测试中发送真实的 API 请求
vi.mock('../api/client', () => ({
  saveTimeline: vi.fn().mockResolvedValue(undefined)
}))

/**
 * 创建示例 Timeline 数据
 * 
 * 功能：生成一个模拟的完整 Timeline 对象
 * 用途：作为测试的输入数据
 */
function createSampleTimeline(): Timeline {
  return {
    product: 'Test Product',
    tagline: 'Test Tagline',
    fps: 30,
    totalFrames: 300,
    scenes: [
      // 场景 1
      {
        id: 'scene-0',
        layout: 'center',
        title: 'Scene 1',
        subTitle: 'Description 1',
        img: 'image1.png',
        startFrame: 0,
        durationInFrames: 100
      },
      // 场景 2
      {
        id: 'scene-1',
        layout: 'left',
        title: 'Scene 2',
        subTitle: 'Description 2',
        img: 'image2.png',
        startFrame: 100,
        durationInFrames: 100
      },
      // 场景 3
      {
        id: 'scene-2',
        layout: 'right',
        title: 'Scene 3',
        startFrame: 200,
        durationInFrames: 100
      }
    ],
    style: {
      name: 'default',
      colors: {
        primary: '#9b4dff',
        secondary: '#6b21a8',
        accent: '#d480ff',
        background: '#05010d',
        text: '#ffffff'
      },
      animation: {
        speed: 'normal',
        style: 'smooth'
      }
    }
  }
}

// =============================================================================
// 测试用例：setDomain
// =============================================================================

describe('setDomain', () => {
  
  /**
   * 测试：setDomain 应设置域名并重置 timeline
   * 
   * 验证点：
   * - domain 被正确设置
   * - timeline 被重置为 null
   * - selectedSceneIndex 被重置为 null
   * - isDirty 被重置为 false
   * 
   * 重要性：
   * - 切换域名时需要清空旧数据
   * - 避免显示错误网站的内容
   */
  it('should set domain and reset timeline', () => {
    const store = useEditorStore.getState()

    store.setDomain('example.com')

    const state = useEditorStore.getState()
    expect(state.domain).toBe('example.com')
    expect(state.timeline).toBeNull()
    expect(state.selectedSceneIndex).toBeNull()
    expect(state.isDirty).toBe(false)
  })

  /**
   * 测试：setDomain 应清除 isDirty 状态
   * 
   * 验证点：
   * - 即使之前有未保存的更改
   * - 切换域名后也应清除脏标记
   */
  it('should clear isDirty when setting new domain', () => {
    useEditorStore.setState({ isDirty: true })

    const store = useEditorStore.getState()
    store.setDomain('newdomain.com')

    expect(useEditorStore.getState().isDirty).toBe(false)
  })
})

// =============================================================================
// 测试用例：setTimeline
// =============================================================================

describe('setTimeline', () => {
  
  /**
   * 测试：setTimeline 应设置时间线并清除 isDirty
   * 
   * 验证点：
   * - timeline 被正确设置
   * - isDirty 被重置为 false
   */
  it('should set timeline and clear isDirty', () => {
    const store = useEditorStore.getState()
    const timeline = createSampleTimeline()

    // 先设置脏标记
    useEditorStore.setState({ isDirty: true })
    store.setTimeline(timeline)

    const state = useEditorStore.getState()
    expect(state.timeline).toEqual(timeline)
    expect(state.isDirty).toBe(false)
  })
})

// =============================================================================
// 测试用例：selectScene
// =============================================================================

describe('selectScene', () => {
  
  /**
   * 测试：selectScene 应按索引选择场景
   */
  it('should select scene by index', () => {
    const store = useEditorStore.getState()

    store.selectScene(1)

    expect(useEditorStore.getState().selectedSceneIndex).toBe(1)
  })

  /**
   * 测试：selectScene(null) 应取消选择
   */
  it('should deselect scene with null', () => {
    const store = useEditorStore.getState()
    useEditorStore.setState({ selectedSceneIndex: 2 })

    store.selectScene(null)

    expect(useEditorStore.getState().selectedSceneIndex).toBeNull()
  })
})

// =============================================================================
// 测试用例：updateScene
// =============================================================================

describe('updateScene', () => {
  
  /**
   * 测试：updateScene 应支持部分更新
   * 
   * 验证点：
   * - 只更新传入的字段
   * - 其他字段保持不变
   * - isDirty 被设置为 true
   */
  it('should update scene with partial updates', () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ timeline })

    const store = useEditorStore.getState()
    store.updateScene(1, { title: 'Updated Title' })

    const state = useEditorStore.getState()
    expect(state.timeline?.scenes[1].title).toBe('Updated Title')
    expect(state.timeline?.scenes[1].layout).toBe('left') // unchanged
    expect(state.isDirty).toBe(true)
  })

  /**
   * 测试：无效索引（负数）应记录警告
   * 
   * 验证点：
   * - 负数索引不应更新任何场景
   * - 应调用 console.warn
   */
  it('should handle invalid index (negative)', () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ timeline })

    const store = useEditorStore.getState()
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    store.updateScene(-1, { title: 'Should not update' })

    const state = useEditorStore.getState()
    expect(state.timeline?.scenes[0].title).toBe('Scene 1') // unchanged
    expect(consoleSpy).toHaveBeenCalledWith('updateScene: invalid index -1')

    consoleSpy.mockRestore()
  })

  /**
   * 测试：无效索引（超出范围）应记录警告
   */
  it('should handle invalid index (out of bounds)', () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ timeline })

    const store = useEditorStore.getState()
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    store.updateScene(10, { title: 'Should not update' })

    const state = useEditorStore.getState()
    expect(state.timeline?.scenes[0].title).toBe('Scene 1') // unchanged
    expect(consoleSpy).toHaveBeenCalledWith('updateScene: invalid index 10')

    consoleSpy.mockRestore()
  })

  /**
   * 测试：timeline 为 null 时应记录警告
   */
  it('should handle missing timeline', () => {
    useEditorStore.setState({ timeline: null })

    const store = useEditorStore.getState()
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    store.updateScene(0, { title: 'Should not update' })

    expect(consoleSpy).toHaveBeenCalledWith('updateScene: invalid index 0')

    consoleSpy.mockRestore()
  })
})

// =============================================================================
// 测试用例：deleteScene
// =============================================================================

describe('deleteScene', () => {
  
  /**
   * 测试：deleteScene 应删除场景并重新计算帧数
   * 
   * 验证点：
   * - 场景数量减少 1
   * - 剩余场景的 startFrame 重新计算
   * - totalFrames 更新
   * - isDirty 设置为 true
   */
  it('should delete scene and recalculate startFrames', () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ timeline })

    const store = useEditorStore.getState()
    store.deleteScene(1) // 删除中间场景

    const state = useEditorStore.getState()
    expect(state.timeline?.scenes.length).toBe(2)
    expect(state.timeline?.scenes[0].id).toBe('scene-0')
    expect(state.timeline?.scenes[1].id).toBe('scene-2')
    expect(state.timeline?.scenes[0].startFrame).toBe(0)
    expect(state.timeline?.scenes[1].startFrame).toBe(100)
    expect(state.timeline?.totalFrames).toBe(200)
    expect(state.isDirty).toBe(true)
  })

  /**
   * 测试：只有一个场景时不应删除
   * 
   * 验证点：
   * - 保留最后一个场景
   * - 不允许删除到只剩 0 个场景
   */
  it('should not delete if only one scene remains', () => {
    const timeline = createSampleTimeline()
    timeline.scenes = [timeline.scenes[0]]  // 只保留一个场景
    useEditorStore.setState({ timeline })

    const store = useEditorStore.getState()
    store.deleteScene(0)

    const state = useEditorStore.getState()
    expect(state.timeline?.scenes.length).toBe(1)
  })

  /**
   * 测试：删除选中的场景应取消选择
   */
  it('should deselect scene if deleted scene was selected', () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ timeline, selectedSceneIndex: 1 })

    const store = useEditorStore.getState()
    store.deleteScene(1)

    const state = useEditorStore.getState()
    expect(state.selectedSceneIndex).toBeNull()
  })

  /**
   * 测试：删除选中场景之前的场景应调整选中索引
   */
  it('should adjust selected index if deleted scene was before it', () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ timeline, selectedSceneIndex: 2 })

    const store = useEditorStore.getState()
    store.deleteScene(0) // 删除第一个场景

    const state = useEditorStore.getState()
    expect(state.selectedSceneIndex).toBe(1) // 调整为 1（原 2 - 1）
  })

  /**
   * 测试：删除选中场景之后的场景应保持选中索引
   */
  it('should keep selected index if deleted scene was after it', () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ timeline, selectedSceneIndex: 0 })

    const store = useEditorStore.getState()
    store.deleteScene(2) // 删除最后一个场景

    const state = useEditorStore.getState()
    expect(state.selectedSceneIndex).toBe(0)
  })

  /**
   * 测试：timeline 为 null 时应优雅处理
   */
  it('should handle missing timeline gracefully', () => {
    useEditorStore.setState({ timeline: null })

    const store = useEditorStore.getState()
    // 不应抛出错误
    store.deleteScene(0)

    const state = useEditorStore.getState()
    expect(state.timeline).toBeNull()
  })
})

// =============================================================================
// 测试用例：deleteSceneImage
// =============================================================================

describe('deleteSceneImage', () => {
  
  /**
   * 测试：deleteSceneImage 应删除场景的图片
   * 
   * 验证点：
   * - 移除 scene.img 属性（设为 undefined）
   * - isDirty 设置为 true
   */
  it('should remove img property from scene', () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ timeline })

    const store = useEditorStore.getState()
    store.deleteSceneImage(0)

    const state = useEditorStore.getState()
    expect(state.timeline?.scenes[0].img).toBeUndefined()
    expect(state.isDirty).toBe(true)
  })

  /**
   * 测试：无效索引应记录警告
   */
  it('should handle invalid index', () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ timeline })

    const store = useEditorStore.getState()
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    store.deleteSceneImage(10)

    expect(consoleSpy).toHaveBeenCalledWith('deleteSceneImage: invalid index 10')

    consoleSpy.mockRestore()
  })
})

// =============================================================================
// 测试用例：setCurrentFrame
// =============================================================================

describe('setCurrentFrame', () => {
  
  /**
   * 测试：setCurrentFrame 应更新当前帧
   */
  it('should update current frame', () => {
    const store = useEditorStore.getState()

    store.setCurrentFrame(150)

    expect(useEditorStore.getState().currentFrame).toBe(150)
  })
})

// =============================================================================
// 测试用例：setRendering
// =============================================================================

describe('setRendering', () => {
  
  /**
   * 测试：setRendering 应更新渲染状态
   */
  it('should update isRendering state', () => {
    const store = useEditorStore.getState()

    store.setRendering(true)
    expect(useEditorStore.getState().isRendering).toBe(true)

    store.setRendering(false)
    expect(useEditorStore.getState().isRendering).toBe(false)
  })
})

// =============================================================================
// 测试用例：save
// =============================================================================

describe('save', () => {
  
  /**
   * 测试：无域名时返回 false
   */
  it('should return false if no domain', async () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ domain: null, timeline })

    const store = useEditorStore.getState()
    const result = await store.save()

    expect(result).toBe(false)
  })

  /**
   * 测试：无 timeline 时返回 false
   */
  it('should return false if no timeline', async () => {
    useEditorStore.setState({ domain: 'test.com', timeline: null })

    const store = useEditorStore.getState()
    const result = await store.save()

    expect(result).toBe(false)
  })

  /**
   * 测试：成功时应更新状态
   * 
   * 验证点：
   * - 调用 saveTimeline API
   * - isDirty 设为 false
   * - isSaving 设为 false
   * - 返回 true
   */
  it('should call saveTimeline and update states on success', async () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ domain: 'test.com', timeline, isDirty: true })

    const store = useEditorStore.getState()
    const result = await store.save()

    expect(result).toBe(true)
    expect(useEditorStore.getState().isDirty).toBe(false)
    expect(useEditorStore.getState().isSaving).toBe(false)
  })

  /**
   * 测试：保存失败时应正确处理
   * 
   * 验证点：
   * - saveTimeline 拒绝时
   * - 函数应返回 false
   * - isSaving 应设为 false
   * - isDirty 应保持为 true（更改未保存）
   * 
   * 重要性：
   * - 网络错误、服务器错误是常见场景
   * - 必须正确处理，避免 UI 卡死在 "Saving..." 状态
   */
  it('should handle save failure', async () => {
    const timeline = createSampleTimeline()
    useEditorStore.setState({ domain: 'test.com', timeline, isDirty: true })

    // 模拟 saveTimeline 失败
    const { saveTimeline } = await import('../api/client')
    vi.mocked(saveTimeline).mockRejectedValueOnce(new Error('Save failed'))

    const store = useEditorStore.getState()
    const result = await store.save()

    expect(result).toBe(false)
    expect(useEditorStore.getState().isSaving).toBe(false)
    expect(useEditorStore.getState().isDirty).toBe(true) // 保存失败，仍为脏数据
  })
})
