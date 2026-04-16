import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEditorStore } from './editorStore'
import { Timeline } from '../types'

// Mock the saveTimeline function
vi.mock('../api/client', () => ({
  saveTimeline: vi.fn().mockResolvedValue(undefined)
}))

// Helper to create a sample timeline
function createSampleTimeline(): Timeline {
  return {
    product: 'Test Product',
    tagline: 'Test Tagline',
    fps: 30,
    totalFrames: 300,
    scenes: [
      {
        id: 'scene-0',
        layout: 'center',
        title: 'Scene 1',
        subText: 'Description 1',
        img: 'image1.png',
        startFrame: 0,
        durationInFrames: 100
      },
      {
        id: 'scene-1',
        layout: 'left',
        title: 'Scene 2',
        subText: 'Description 2',
        img: 'image2.png',
        startFrame: 100,
        durationInFrames: 100
      },
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

describe('useEditorStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useEditorStore.setState({
      domain: null,
      timeline: null,
      selectedSceneIndex: null,
      isDirty: false,
      isSaving: false,
      isRendering: false,
      currentFrame: 0
    })
  })

  describe('setDomain', () => {
    it('should set domain and reset timeline', () => {
      const store = useEditorStore.getState()

      store.setDomain('example.com')

      const state = useEditorStore.getState()
      expect(state.domain).toBe('example.com')
      expect(state.timeline).toBeNull()
      expect(state.selectedSceneIndex).toBeNull()
      expect(state.isDirty).toBe(false)
    })

    it('should clear isDirty when setting new domain', () => {
      useEditorStore.setState({ isDirty: true })

      const store = useEditorStore.getState()
      store.setDomain('newdomain.com')

      expect(useEditorStore.getState().isDirty).toBe(false)
    })
  })

  describe('setTimeline', () => {
    it('should set timeline and clear isDirty', () => {
      const store = useEditorStore.getState()
      const timeline = createSampleTimeline()

      useEditorStore.setState({ isDirty: true })
      store.setTimeline(timeline)

      const state = useEditorStore.getState()
      expect(state.timeline).toEqual(timeline)
      expect(state.isDirty).toBe(false)
    })
  })

  describe('selectScene', () => {
    it('should select scene by index', () => {
      const store = useEditorStore.getState()

      store.selectScene(1)

      expect(useEditorStore.getState().selectedSceneIndex).toBe(1)
    })

    it('should deselect scene with null', () => {
      const store = useEditorStore.getState()
      useEditorStore.setState({ selectedSceneIndex: 2 })

      store.selectScene(null)

      expect(useEditorStore.getState().selectedSceneIndex).toBeNull()
    })
  })

  describe('updateScene', () => {
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

    it('should handle missing timeline', () => {
      useEditorStore.setState({ timeline: null })

      const store = useEditorStore.getState()
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      store.updateScene(0, { title: 'Should not update' })

      expect(consoleSpy).toHaveBeenCalledWith('updateScene: invalid index 0')

      consoleSpy.mockRestore()
    })
  })

  describe('deleteScene', () => {
    it('should delete scene and recalculate startFrames', () => {
      const timeline = createSampleTimeline()
      useEditorStore.setState({ timeline })

      const store = useEditorStore.getState()
      store.deleteScene(1) // Delete middle scene

      const state = useEditorStore.getState()
      expect(state.timeline?.scenes.length).toBe(2)
      expect(state.timeline?.scenes[0].id).toBe('scene-0')
      expect(state.timeline?.scenes[1].id).toBe('scene-2')
      expect(state.timeline?.scenes[0].startFrame).toBe(0)
      expect(state.timeline?.scenes[1].startFrame).toBe(100)
      expect(state.timeline?.totalFrames).toBe(200)
      expect(state.isDirty).toBe(true)
    })

    it('should not delete if only one scene remains', () => {
      const timeline = createSampleTimeline()
      timeline.scenes = [timeline.scenes[0]]
      useEditorStore.setState({ timeline })

      const store = useEditorStore.getState()
      store.deleteScene(0)

      const state = useEditorStore.getState()
      expect(state.timeline?.scenes.length).toBe(1)
    })

    it('should deselect scene if deleted scene was selected', () => {
      const timeline = createSampleTimeline()
      useEditorStore.setState({ timeline, selectedSceneIndex: 1 })

      const store = useEditorStore.getState()
      store.deleteScene(1)

      const state = useEditorStore.getState()
      expect(state.selectedSceneIndex).toBeNull()
    })

    it('should adjust selected index if deleted scene was before it', () => {
      const timeline = createSampleTimeline()
      useEditorStore.setState({ timeline, selectedSceneIndex: 2 })

      const store = useEditorStore.getState()
      store.deleteScene(0) // Delete first scene

      const state = useEditorStore.getState()
      expect(state.selectedSceneIndex).toBe(1) // Adjusted from 2 to 1
    })

    it('should keep selected index if deleted scene was after it', () => {
      const timeline = createSampleTimeline()
      useEditorStore.setState({ timeline, selectedSceneIndex: 0 })

      const store = useEditorStore.getState()
      store.deleteScene(2) // Delete last scene

      const state = useEditorStore.getState()
      expect(state.selectedSceneIndex).toBe(0)
    })

    it('should handle missing timeline gracefully', () => {
      useEditorStore.setState({ timeline: null })

      const store = useEditorStore.getState()
      // Should not throw
      store.deleteScene(0)

      const state = useEditorStore.getState()
      expect(state.timeline).toBeNull()
    })
  })

  describe('deleteSceneImage', () => {
    it('should remove img property from scene', () => {
      const timeline = createSampleTimeline()
      useEditorStore.setState({ timeline })

      const store = useEditorStore.getState()
      store.deleteSceneImage(0)

      const state = useEditorStore.getState()
      expect(state.timeline?.scenes[0].img).toBeUndefined()
      expect(state.isDirty).toBe(true)
    })

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

  describe('setCurrentFrame', () => {
    it('should update current frame', () => {
      const store = useEditorStore.getState()

      store.setCurrentFrame(150)

      expect(useEditorStore.getState().currentFrame).toBe(150)
    })
  })

  describe('setRendering', () => {
    it('should update isRendering state', () => {
      const store = useEditorStore.getState()

      store.setRendering(true)

      expect(useEditorStore.getState().isRendering).toBe(true)

      store.setRendering(false)

      expect(useEditorStore.getState().isRendering).toBe(false)
    })
  })

  describe('save', () => {
    it('should return false if no domain', async () => {
      const timeline = createSampleTimeline()
      useEditorStore.setState({ domain: null, timeline })

      const store = useEditorStore.getState()
      const result = await store.save()

      expect(result).toBe(false)
    })

    it('should return false if no timeline', async () => {
      useEditorStore.setState({ domain: 'test.com', timeline: null })

      const store = useEditorStore.getState()
      const result = await store.save()

      expect(result).toBe(false)
    })

    it('should call saveTimeline and update states on success', async () => {
      const timeline = createSampleTimeline()
      useEditorStore.setState({ domain: 'test.com', timeline, isDirty: true })

      const store = useEditorStore.getState()
      const result = await store.save()

      expect(result).toBe(true)
      expect(useEditorStore.getState().isDirty).toBe(false)
      expect(useEditorStore.getState().isSaving).toBe(false)
    })
  })
})
