import { create } from 'zustand'
import { Timeline, Scene } from '../types'
import { saveTimeline } from '../api/client'

/**
 * EditorState - 编辑器全局状态管理接口
 *
 * 使用 Zustand 进行状态管理，包含当前编辑网站、时间轴数据、
 * 场景选择、保存状态等核心状态，以及相关的操作方法。
 */
interface EditorState {
  // ========== 状态字段 ==========

  /** 当前选中的网站域名 */
  domain: string | null

  /** 时间轴数据，包含所有场景、样式、BGM等信息 */
  timeline: Timeline | null

  /** 当前选中的场景索引，null表示未选中任何场景 */
  selectedSceneIndex: number | null

  /** 是否有未保存的更改，用于提示用户保存 */
  isDirty: boolean

  /** 是否正在保存中，用于显示保存状态 */
  isSaving: boolean

  /** 是否正在渲染视频中，用于显示渲染进度 */
  isRendering: boolean

  /** 播放器当前帧数，用于时间轴同步 */
  currentFrame: number

  // ========== Actions 操作方法 ==========

  /** 设置当前编辑的网站域名，同时重置时间轴和选中状态 */
  setDomain: (domain: string) => void

  /** 设置时间轴数据，同时清除脏标记 */
  setTimeline: (timeline: Timeline) => void

  /** 选中指定索引的场景 */
  selectScene: (index: number | null) => void

  /** 更新指定场景的部分属性 */
  updateScene: (index: number, updates: Partial<Scene>) => void

  /** 删除指定索引的场景 */
  deleteScene: (index: number) => void

  /** 删除指定场景的图片 */
  deleteSceneImage: (index: number) => void

  /** 设置播放器当前帧数 */
  setCurrentFrame: (frame: number) => void

  /** 保存当前时间轴到服务器 */
  save: () => Promise<boolean>

  /** 设置渲染状态 */
  setRendering: (isRendering: boolean) => void
}

/**
 * 编辑器状态 Store
 *
 * 管理整个视频编辑器的状态，包括：
 * - 当前编辑的网站
 * - 时间轴数据和场景列表
 * - 场景选择和编辑操作
 * - 保存和渲染状态
 */
export const useEditorStore = create<EditorState>((set, get) => ({
  // ========== 初始状态 ==========

  domain: null,
  timeline: null,
  selectedSceneIndex: null,
  isDirty: false,
  isSaving: false,
  isRendering: false,
  currentFrame: 0,

  // ========== Actions 实现 ==========

  /**
   * 设置当前编辑的网站域名
   * 切换网站时会重置时间轴、选中状态和脏标记
   */
  setDomain: (domain) => set({ domain, timeline: null, selectedSceneIndex: null, isDirty: false }),

  /**
   * 设置时间轴数据
   * 加载新的时间轴数据时清除脏标记
   */
  setTimeline: (timeline) => set({ timeline, isDirty: false }),

  /**
   * 选中指定索引的场景
   * 传入null取消选中
   */
  selectScene: (index) => set({ selectedSceneIndex: index }),

  /**
   * 更新指定场景的部分属性
   * 使用浅合并方式更新，同时设置脏标记
   */
  updateScene: (index, updates) => {
    const { timeline } = get()
    // 边界检查
    if (!timeline || index < 0 || index >= timeline.scenes.length) {
      console.warn(`updateScene: invalid index ${index}`)
      return
    }

    const newScenes = [...timeline.scenes]
    newScenes[index] = { ...newScenes[index], ...updates }

    set({
      timeline: { ...timeline, scenes: newScenes },
      isDirty: true
    })
  },

  /**
   * 删除指定索引的场景
   * - 如果只剩一个场景则不允许删除
   * - 删除后重新计算所有场景的 startFrame
   * - 如果删除的是当前选中的场景，则取消选中
   * - 如果删除的场景在选中场景之前，则调整选中索引
   */
  deleteScene: (index) => {
    const { timeline, selectedSceneIndex } = get()
    if (!timeline || timeline.scenes.length <= 1) return

    const newScenes = timeline.scenes.filter((_, i) => i !== index)

    // 重新计算每个场景的起始帧
    let currentFrame = 0
    newScenes.forEach((scene) => {
      scene.startFrame = currentFrame
      currentFrame += scene.durationInFrames
    })

    // 处理选中索引的调整
    const newSelectedIndex = selectedSceneIndex === index ? null :
      selectedSceneIndex !== null && selectedSceneIndex > index ? selectedSceneIndex - 1 : selectedSceneIndex

    set({
      timeline: { ...timeline, scenes: newScenes, totalFrames: currentFrame },
      selectedSceneIndex: newSelectedIndex,
      isDirty: true
    })
  },

  /**
   * 删除指定场景的图片
   * 移除场景的 img 属性
   */
  deleteSceneImage: (index) => {
    const { timeline } = get()
    // 边界检查
    if (!timeline || index < 0 || index >= timeline.scenes.length) {
      console.warn(`deleteSceneImage: invalid index ${index}`)
      return
    }

    const newScenes = [...timeline.scenes]
    delete newScenes[index].img

    set({
      timeline: { ...timeline, scenes: newScenes },
      isDirty: true
    })
  },

  /**
   * 设置播放器当前帧数
   * 用于时间轴和播放器同步
   */
  setCurrentFrame: (frame) => set({ currentFrame: frame }),

  /**
   * 保存当前时间轴到服务器
   * @returns 保存成功返回 true，失败返回 false
   */
  save: async () => {
    const { domain, timeline } = get()
    if (!domain || !timeline) return false

    set({ isSaving: true })
    try {
      await saveTimeline(domain, timeline)
      set({ isDirty: false, isSaving: false })
      return true
    } catch (error) {
      console.error('Save failed:', error)
      set({ isSaving: false })
      return false
    }
  },

  /**
   * 设置渲染状态
   * 用于显示渲染进度或禁用相关操作
   */
  setRendering: (isRendering) => set({ isRendering })
}))
