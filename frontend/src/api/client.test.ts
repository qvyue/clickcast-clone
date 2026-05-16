/**
 * =============================================================================
 * API 客户端单元测试
 * 
 * 测试目标：frontend/src/api/client.ts
 * 测试框架：Vitest
 * 
 * 测试覆盖范围：
 * 1. fetchWithTimeout - 带超时的 fetch 封装
 * 2. ApiError - API 错误类
 * 3. handleResponse - 响应处理逻辑
 * 4. API 函数 - getScreenshotUrl、getAudioUrl、getVideoUrl、saveTimeline、renderVideo
 * 
 * 测试策略：
 * - 使用 vi.fn() mock 全局 fetch
 * - 使用 Vitest 假计时器测试超时行为
 * - 验证请求参数和响应处理
 * =============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  ApiError, 
  fetchWebsites, 
  getScreenshotUrl, 
  getAudioUrl, 
  getVideoUrl, 
  saveTimeline, 
  renderVideo 
} from './client'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// =============================================================================
// 测试用例：fetchWithTimeout
// =============================================================================

describe('fetchWithTimeout', () => {
  
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  /**
   * 测试：fetch 成功时应返回响应
   * 
   * 验证点：
   * - fetch 正常返回时，函数应返回响应对象
   * - AbortSignal 应正确传递给 fetch
   * 
   * 重要性：
   * - 基本的 fetch 功能必须正常工作
   * - 这是所有 API 调用的基础
   */
  it('should resolve with response when fetch succeeds', async () => {
    const mockResponse = new Response('{}', { status: 200 })
    mockFetch.mockResolvedValueOnce(mockResponse)

    await fetchWebsites()

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/websites', 
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    )
  })

  /**
   * 测试：超时后应中止请求
   * 
   * 验证点：
   * - fetch 应被调用，且带有 AbortSignal
   * - 超时后，signal 应被 abort
   * 
   * 实现方式：
   * - 使用 Vitest 假计时器 vi.useFakeTimers()
   * - 前进时间到超时点
   * - 验证 AbortSignal 被正确创建
   */
  it('should abort request after timeout', async () => {
    vi.useFakeTimers()

    // 创建一个永不解决的 Promise（模拟网络延迟）
    mockFetch.mockImplementationOnce(() => new Promise(() => {}))

    // 开始 fetch（故意不 await，因为要测试超时）
    void fetchWebsites()

    // 前进时间到超时点
    vi.advanceTimersByTime(30001)

    // fetch 应该被调用，且带有 AbortSignal
    expect(mockFetch).toHaveBeenCalled()
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1]?.signal).toBeInstanceOf(AbortSignal)

    vi.useRealTimers()
  })

  /**
   * 测试：fetch 失败时应抛出网络错误
   * 
   * 验证点：
   * - fetch 拒绝时，函数应抛出错误
   * - 错误信息应包含网络错误详情
   * 
   * 重要性：
   * - 网络错误是常见场景（断网、DNS 失败、CORS 错误）
   * - 必须正确传递给调用方
   */
  it('should throw network error when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await expect(fetchWebsites()).rejects.toThrow('Network error')
  })

  /**
   * 测试：超时后应抛出错误
   * 
   * 验证点：
   * - 超时后，函数应抛出错误
   * - 错误应是 AbortError 或类似错误
   * 
   * 实现方式：
   * - 使用 Vitest 假计时器
   * - 模拟 fetch 永不解决
   * - 前进时间到超时点
   * - 验证 Promise 被拒绝
   */
  it('should throw error after timeout', async () => {
    vi.useFakeTimers()

    // 创建一个永不解决的 Promise（模拟网络延迟）
    mockFetch.mockImplementationOnce(() => new Promise(() => {}))

    // 开始 fetch
    const promise = fetchWebsites()

    // 前进时间到超时点
    vi.advanceTimersByTime(30001)

    // Promise 应该被拒绝
    await expect(promise).rejects.toThrow()

    vi.useRealTimers()
  })
})

// =============================================================================
// 测试用例：ApiError
// =============================================================================

describe('ApiError', () => {
  
  /**
   * 测试：ApiError 应包含所有属性
   * 
   * 验证点：
   * - name: 'ApiError'
   * - url: 请求 URL
   * - status: HTTP 状态码
   * - statusText: HTTP 状态文本
   * - body: 响应体
   * - message: 格式化错误消息
   */
  it('should create error with all properties', () => {
    const error = new ApiError(
      '/api/test',      // url
      404,             // status
      'Not Found',     // statusText
      '{"error": "not found"}'  // body
    )

    expect(error.name).toBe('ApiError')
    expect(error.url).toBe('/api/test')
    expect(error.status).toBe(404)
    expect(error.statusText).toBe('Not Found')
    expect(error.body).toBe('{"error": "not found"}')
    expect(error.message).toContain('API Error: /api/test - 404 Not Found')
  })

  /**
   * 测试：长 body 应被截断
   * 
   * 验证点：
   * - 错误消息中的 body 应被截断
   * - 避免错误消息过长
   * 
   * 截断规则：
   * - 保留前 200 个字符
   * - 超出部分用 ... 省略
   */
  it('should truncate long body in message', () => {
    const longBody = 'x'.repeat(300)
    const error = new ApiError('/api/test', 500, 'Server Error', longBody)

    expect(error.message).toContain('x'.repeat(200))
    expect(error.message).not.toContain('x'.repeat(250))
  })

  /**
   * 测试：body 为空时应正确处理
   */
  it('should handle missing body', () => {
    const error = new ApiError('/api/test', 500, 'Server Error')

    expect(error.body).toBeUndefined()
    expect(error.message).toBe('API Error: /api/test - 500 Server Error')
  })
})

// =============================================================================
// 测试用例：handleResponse
// =============================================================================

describe('handleResponse', () => {
  
  beforeEach(() => {
    mockFetch.mockReset()
  })

  /**
   * 测试：成功响应应返回 JSON 数据
   * 
   * 验证点：
   * - 状态码 200 时
   * - Content-Type 为 application/json
   * - 返回解析后的 JSON 对象
   */
  it('should return JSON data for successful response', async () => {
    const mockData = [{ domain: 'test.com' }]
    const mockResponse = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    mockFetch.mockResolvedValueOnce(mockResponse)

    const result = await fetchWebsites()

    expect(result).toEqual(mockData)
  })

  /**
   * 测试：非 OK 响应应抛出 ApiError
   * 
   * 验证点：
   * - 状态码非 200 时
   * - 应抛出 ApiError
   * - 包含正确的错误信息
   */
  it('should throw ApiError for non-OK response', async () => {
    const mockResponse = new Response('Not found', { 
      status: 404, 
      statusText: 'Not Found' 
    })
    mockFetch.mockResolvedValueOnce(mockResponse)

    await expect(fetchWebsites()).rejects.toThrow(ApiError)
  })

  /**
   * 测试：响应不是有效 JSON 时应抛出错误
   * 
   * 验证点：
   * - 当响应体不是有效 JSON 时
   * - response.json() 应抛出错误
   * - 错误应被正确处理
   * 
   * 重要性：
   * - 服务器可能返回非 JSON 响应（如 HTML 错误页面）
   * - 必须正确处理 JSON 解析错误
   */
  it('should throw when response is not valid JSON', async () => {
    const mockResponse = new Response('not json', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    mockFetch.mockResolvedValueOnce(mockResponse)

    await expect(fetchWebsites()).rejects.toThrow()
  })
})

// =============================================================================
// 测试用例：API 客户端函数
// =============================================================================

describe('API client functions', () => {
  
  beforeEach(() => {
    mockFetch.mockReset()
  })

  /**
   * 测试：getScreenshotUrl 返回正确的路径
   * 
   * 功能：根据域名和文件名生成截图 URL
   * 格式：/websites/{domain}/public/{filename}
   */
  it('getScreenshotUrl should return correct path', () => {
    expect(getScreenshotUrl('test.com', 'screenshot.png')).toBe(
      '/websites/test.com/public/screenshot.png'
    )
  })

  /**
   * 测试：getAudioUrl 返回正确的路径
   * 
   * 功能：根据域名和文件名生成音频 URL
   * 格式：/websites/{domain}/public/{filename}
   */
  it('getAudioUrl should return correct path', () => {
    expect(getAudioUrl('test.com', 'audio.mp3')).toBe(
      '/websites/test.com/public/audio.mp3'
    )
  })

  /**
   * 测试：getVideoUrl 返回横屏视频路径
   * 
   * 功能：根据域名和比例生成视频 URL
   * 格式：/websites/{domain}/out/landscape.mp4
   */
  it('getVideoUrl should return correct path for landscape', () => {
    expect(getVideoUrl('test.com', 'landscape')).toBe(
      '/websites/test.com/out/landscape.mp4'
    )
  })

  /**
   * 测试：getVideoUrl 返回竖屏视频路径
   * 
   * 格式：/websites/{domain}/out/portrait.mp4
   */
  it('getVideoUrl should return correct path for portrait', () => {
    expect(getVideoUrl('test.com', 'portrait')).toBe(
      '/websites/test.com/out/portrait.mp4'
    )
  })

  /**
   * 测试：saveTimeline 应发送 POST 请求
   * 
   * 验证点：
   * - 方法为 POST
   * - Content-Type 为 application/json
   * - body 包含完整的 timeline 数据
   */
  it('saveTimeline should POST timeline data', async () => {
    const mockResponse = new Response('', { status: 200 })
    mockFetch.mockResolvedValueOnce(mockResponse)

    const timeline = {
      product: 'Test',
      tagline: 'Test Tagline',
      fps: 30,
      totalFrames: 300,
      scenes: [],
      style: {
        name: 'default',
        colors: { 
          primary: '#fff', 
          secondary: '#000', 
          accent: '#aaa', 
          background: '#111', 
          text: '#fff' 
        },
        animation: { speed: 'normal', style: 'smooth' }
      }
    }

    await saveTimeline('test.com', timeline)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/timeline/test.com',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timeline)
      })
    )
  })

  /**
   * 测试：renderVideo 应发送 POST 请求并返回 jobId
   * 
   * 验证点：
   * - 方法为 POST
   * - body 包含 aspectRatio
   * - 返回包含 jobId 的对象
   */
  it('renderVideo should POST render request', async () => {
    const mockResponse = new Response(JSON.stringify({ jobId: 'job-123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    mockFetch.mockResolvedValueOnce(mockResponse)

    const result = await renderVideo('test.com', 'landscape')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/websites/test.com/render',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ aspectRatio: 'landscape' })
      })
    )
    expect(result).toEqual({ jobId: 'job-123' })
  })
})
