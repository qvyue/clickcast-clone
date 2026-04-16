import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError, fetchWebsites, getScreenshotUrl, getAudioUrl, getVideoUrl, saveTimeline, renderVideo } from './client'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should resolve with response when fetch succeeds', async () => {
    const mockResponse = new Response('{}', { status: 200 })
    mockFetch.mockResolvedValueOnce(mockResponse)

    await fetchWebsites()

    expect(mockFetch).toHaveBeenCalledWith('/api/websites', expect.objectContaining({
      signal: expect.any(AbortSignal)
    }))
  })

  it('should abort request after timeout', async () => {
    vi.useFakeTimers()

    // Create a promise that never resolves
    mockFetch.mockImplementationOnce(() => new Promise(() => {}))

    // Start the fetch
    const fetchPromise = fetchWebsites()

    // Advance timers past the timeout
    vi.advanceTimersByTime(30001)

    // The fetch should have been called with an abort signal
    expect(mockFetch).toHaveBeenCalled()
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1]?.signal).toBeInstanceOf(AbortSignal)

    vi.useRealTimers()
  })
})

describe('ApiError', () => {
  it('should create error with all properties', () => {
    const error = new ApiError('/api/test', 404, 'Not Found', '{"error": "not found"}')

    expect(error.name).toBe('ApiError')
    expect(error.url).toBe('/api/test')
    expect(error.status).toBe(404)
    expect(error.statusText).toBe('Not Found')
    expect(error.body).toBe('{"error": "not found"}')
    expect(error.message).toContain('API Error: /api/test - 404 Not Found')
  })

  it('should truncate long body in message', () => {
    const longBody = 'x'.repeat(300)
    const error = new ApiError('/api/test', 500, 'Server Error', longBody)

    expect(error.message).toContain('x'.repeat(200))
    expect(error.message).not.toContain('x'.repeat(250))
  })

  it('should handle missing body', () => {
    const error = new ApiError('/api/test', 500, 'Server Error')

    expect(error.body).toBeUndefined()
    expect(error.message).toBe('API Error: /api/test - 500 Server Error')
  })
})

describe('handleResponse', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

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

  it('should throw ApiError for non-OK response', async () => {
    const mockResponse = new Response('Not found', { status: 404, statusText: 'Not Found' })
    mockFetch.mockResolvedValueOnce(mockResponse)

    await expect(fetchWebsites()).rejects.toThrow(ApiError)
  })
})

describe('API client functions', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('getScreenshotUrl should return correct path', () => {
    expect(getScreenshotUrl('test.com', 'screenshot.png')).toBe('/websites/test.com/public/screenshot.png')
  })

  it('getAudioUrl should return correct path', () => {
    expect(getAudioUrl('test.com', 'audio.mp3')).toBe('/websites/test.com/public/audio.mp3')
  })

  it('getVideoUrl should return correct path for landscape', () => {
    expect(getVideoUrl('test.com', 'landscape')).toBe('/websites/test.com/out/landscape.mp4')
  })

  it('getVideoUrl should return correct path for portrait', () => {
    expect(getVideoUrl('test.com', 'portrait')).toBe('/websites/test.com/out/portrait.mp4')
  })

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
        colors: { primary: '#fff', secondary: '#000', accent: '#aaa', background: '#111', text: '#fff' },
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

  it('renderVideo should POST render request', async () => {
    const mockResponse = new Response(JSON.stringify({ jobId: 'job-123' }), { status: 200 })
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
