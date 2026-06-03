import type { Website, WebsiteData, Timeline, ScrapedData, AudioFile } from '../types';

/** API 基础路径 */
const API_BASE = '/api';

/** 默认请求超时时间（毫秒） */
const DEFAULT_TIMEOUT = 30000;

/**
 * 带超时的 fetch 请求，自动注入 Authorization header
 * @param url - 请求 URL
 * @param options - fetch 选项
 * @param timeout - 超时时间（毫秒）
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Auto-inject auth token if available
    const headers = new Headers(options?.headers);
    const token = getAuthToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Synchronous token cache — updated by authStore on session change
let _cachedToken: string | null = null;

/** Update the cached auth token (called by authStore on session change) */
export function setCachedAuthToken(token: string | null) {
  _cachedToken = token;
}

/** Get the cached auth token */
function getAuthToken(): string | null {
  return _cachedToken;
}

/**
 * API 错误类，包含更多上下文信息
 */
export class ApiError extends Error {
  constructor(
    public url: string,
    public status: number,
    public statusText: string,
    public body?: string
  ) {
    super(`API Error: ${url} - ${status} ${statusText}${body ? `\nResponse: ${body.substring(0, 200)}` : ''}`);
    this.name = 'ApiError';
  }
}

/**
 * 处理 API 响应，统一错误处理
 *
 * @param response - fetch Response 对象
 * @param url - 请求的 URL（用于错误信息）
 * @returns 解析后的 JSON 数据
 * @throws ApiError 当响应状态码非 2xx 时
 */
async function handleResponse<T>(response: Response, url: string): Promise<T> {
  if (!response.ok) {
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '[无法读取响应体]';
    }
    throw new ApiError(url, response.status, response.statusText, body);
  }
  return response.json();
}

/**
 * 获取所有网站列表
 *
 * @returns 网站数组，包含域名、创建时间、状态等信息
 * @throws ApiError 请求失败时抛出错误
 */
export async function fetchWebsites(): Promise<Website[]> {
  const url = `${API_BASE}/websites`;
  const response = await fetchWithTimeout(url);
  return handleResponse<Website[]>(response, url);
}

/**
 * 获取指定网站的详细数据
 *
 * @param domain - 网站域名
 * @returns 网站数据，包含截图、分析、配音、时间轴、渲染等各步骤状态
 * @throws ApiError 请求失败时抛出错误
 */
export async function fetchWebsiteData(domain: string): Promise<WebsiteData> {
  const url = `${API_BASE}/websites/${domain}`;
  const response = await fetchWithTimeout(url);
  return handleResponse<WebsiteData>(response, url);
}

/**
 * 获取指定网站的时间轴配置
 *
 * @param domain - 网站域名
 * @returns 时间轴数据，包含场景列表、样式、BGM等
 * @throws ApiError 请求失败时抛出错误
 */
export async function fetchTimeline(domain: string): Promise<Timeline> {
  const url = `/websites/${domain}/public/timeline.json`;
  const response = await fetchWithTimeout(url);
  return handleResponse<Timeline>(response, url);
}

/**
 * 获取指定网站的爬取数据
 *
 * @param domain - 网站域名
 * @returns 爬取数据，包含标题、描述、产品信息、颜色、内容块等
 * @throws ApiError 请求失败时抛出错误
 */
export async function fetchScrapedData(domain: string): Promise<ScrapedData> {
  const url = `/websites/${domain}/public/scraped.json`;
  const response = await fetchWithTimeout(url);
  return handleResponse<ScrapedData>(response, url);
}

/**
 * 获取指定网站的音频文件列表
 *
 * @param domain - 网站域名
 * @returns 音频文件数组，包含文件名、时长、大小等信息
 * @throws ApiError 请求失败时抛出错误
 */
export async function fetchAudioFiles(domain: string): Promise<AudioFile[]> {
  const url = `${API_BASE}/websites/${domain}/audio`;
  const response = await fetchWithTimeout(url);
  return handleResponse<AudioFile[]>(response, url);
}

/**
 * 获取截图文件的完整URL
 *
 * @param domain - 网站域名
 * @param filename - 截图文件名
 * @returns 截图文件的完整访问路径
 */
export function getScreenshotUrl(domain: string, filename: string): string {
  return `/websites/${domain}/public/${filename}`;
}

/**
 * 获取音频文件的完整URL
 *
 * @param domain - 网站域名
 * @param filename - 音频文件名
 * @returns 音频文件的完整访问路径
 */
export function getAudioUrl(domain: string, filename: string): string {
  return `/websites/${domain}/public/${filename}`;
}

/**
 * 获取音频文件时长
 *
 * @param domain - 网站域名
 * @param filename - 音频文件名
 * @returns 音频时长（秒）
 * @throws ApiError 请求失败时抛出错误
 */
export async function fetchAudioDuration(domain: string, filename: string): Promise<number> {
  const url = `${API_BASE}/websites/${domain}/audio/${filename}/duration`;
  const response = await fetchWithTimeout(url);
  const data = await handleResponse<{ filename: string; duration: number }>(response, url);
  return data.duration;
}

/**
 * 获取视频文件的完整URL
 *
 * @param domain - 网站域名
 * @param type - 视频类型：横版(landscape)或竖版(portrait)
 * @returns 视频文件的完整访问路径
 */
export function getVideoUrl(domain: string, type: 'landscape' | 'portrait'): string {
  return `/websites/${domain}/out/${type}.mp4`;
}

/**
 * 处理无返回值的 API 响应
 *
 * @param response - fetch Response 对象
 * @param url - 请求的 URL（用于错误信息）
 * @throws ApiError 当响应状态码非 2xx 时
 */
async function handleVoidResponse(response: Response, url: string): Promise<void> {
  if (!response.ok) {
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '[无法读取响应体]';
    }
    throw new ApiError(url, response.status, response.statusText, body);
  }
}

/**
 * 保存时间轴配置
 *
 * 将编辑后的时间轴数据保存到服务器的 timeline.json 文件
 *
 * @param domain - 网站域名
 * @param timeline - 时间轴数据
 * @throws ApiError 请求失败时抛出错误
 */
export async function saveTimeline(domain: string, timeline: Timeline): Promise<void> {
  const url = `${API_BASE}/timeline/${domain}`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(timeline)
  });
  return handleVoidResponse(response, url);
}

/**
 * 触发视频渲染
 *
 * 启动后台渲染任务，生成指定比例的视频
 *
 * @param domain - 网站域名
 * @param aspectRatio - 视频比例：横版(landscape)或竖版(portrait)
 * @returns 包含渲染任务ID的对象
 * @throws ApiError 请求失败时抛出错误
 */
export async function renderVideo(domain: string, aspectRatio: 'landscape' | 'portrait'): Promise<{ jobId: string }> {
  const url = `${API_BASE}/websites/${domain}/render`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aspectRatio })
  });
  return handleResponse<{ jobId: string }>(response, url);
}

/**
 * 重新生成场景配音
 *
 * 使用高质量TTS服务重新生成指定场景的配音文件
 *
 * @param domain - 网站域名
 * @param sceneIndex - 场景索引
 * @param text - 配音文本内容
 * @returns 包含新生成的音频文件名和时长
 * @throws ApiError 请求失败时抛出错误
 */
export async function regenerateVoiceover(domain: string, sceneIndex: number, text: string): Promise<{ audioFile: string; duration: number }> {
  const url = `${API_BASE}/websites/${domain}/voiceover`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneIndex, text })
  });
  return handleResponse<{ audioFile: string; duration: number }>(response, url);
}

/**
 * 生成预览配音
 *
 * 使用免费的 Edge-TTS 服务快速生成预览配音，用于试听效果
 *
 * @param domain - 网站域名
 * @param sceneIndex - 场景索引
 * @param text - 配音文本内容
 * @param type - 配音类型 ('main' 主配音 / 'sub' 次配音)
 * @returns 包含新生成的音频文件名和时长
 * @throws ApiError 请求失败时抛出错误
 */
export async function generatePreviewVoiceover(
  domain: string,
  sceneIndex: number,
  text: string,
  type: 'main' | 'sub' = 'main',
  sceneId?: string
): Promise<{ audioFile: string; duration: number; type: string }> {
  const url = `${API_BASE}/websites/${domain}/voiceover/preview`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneIndex, text, type, sceneId })
  });
  return handleResponse<{ audioFile: string; duration: number; type: string }>(response, url);
}

/**
 * 上传图片到指定网站
 *
 * 上传截图或其他图片资源，服务器会自动处理长图等特殊情况
 *
 * @param domain - 网站域名
 * @param file - 要上传的图片文件
 * @returns 上传结果，包含文件名、URL、尺寸信息，以及是否为长图
 * @throws ApiError 请求失败时抛出错误
 */
export async function uploadImage(domain: string, file: File): Promise<{ success: boolean; filename: string; url: string; width: number; height: number; isLongImage: boolean }> {
  const formData = new FormData();
  formData.append('image', file);

  const url = `${API_BASE}/websites/${domain}/images`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    body: formData
  });
  return handleResponse<{ success: boolean; filename: string; url: string; width: number; height: number; isLongImage: boolean }>(response, url);
}

// --- Billing API ---

export interface SubscriptionInfo {
  status: string;
  plan: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string;
}

/**
 * Create a Stripe Checkout session
 */
export async function createCheckout(mode: 'pro' | 'credit_pack'): Promise<{ url: string }> {
  const url = `${API_BASE}/billing/checkout`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });
  return handleResponse<{ url: string }>(response, url);
}

/**
 * Get current subscription status
 */
export async function getSubscription(): Promise<{ subscription: SubscriptionInfo | null }> {
  const url = `${API_BASE}/billing/subscription`;
  const response = await fetchWithTimeout(url);
  return handleResponse<{ subscription: SubscriptionInfo | null }>(response, url);
}

/**
 * Get current credit balance
 */
export async function getCredits(): Promise<{ credits: number }> {
  const url = `${API_BASE}/billing/credits`;
  const response = await fetchWithTimeout(url);
  return handleResponse<{ credits: number }>(response, url);
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortal(): Promise<{ url: string }> {
  const url = `${API_BASE}/billing/portal`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return handleResponse<{ url: string }>(response, url);
}

// --- Credit Transactions API ---

export interface CreditTransaction {
  id: string;
  amount: number;
  balance_after: number;
  type: string;
  reference_id: string | null;
  created_at: string;
}

export async function getCreditTransactions(limit = 20, offset = 0): Promise<{ transactions: CreditTransaction[] }> {
  const url = `${API_BASE}/billing/transactions?limit=${limit}&offset=${offset}`;
  const response = await fetchWithTimeout(url);
  return handleResponse<{ transactions: CreditTransaction[] }>(response, url);
}

export async function deleteVideo(domain: string): Promise<void> {
  const res = await fetchWithTimeout(`/api/delete/${domain}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete video');
}

// ========== FAQ ==========

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Public: fetch active FAQs for homepage */
export async function fetchFaqs(): Promise<{ faqs: Pick<FaqItem, 'id' | 'question' | 'answer' | 'sort_order'>[] }> {
  const response = await fetchWithTimeout(`${API_BASE}/faqs`);
  return handleResponse<{ faqs: Pick<FaqItem, 'id' | 'question' | 'answer' | 'sort_order'>[] }>(response, `${API_BASE}/faqs`);
}

/** Admin: list all FAQs (including inactive) */
export async function adminFetchFaqs(): Promise<{ faqs: FaqItem[] }> {
  const response = await fetchWithTimeout(`${API_BASE}/admin/faqs`);
  return handleResponse<{ faqs: FaqItem[] }>(response, `${API_BASE}/admin/faqs`);
}

/** Admin: create FAQ */
export async function adminCreateFaq(data: { question: string; answer: string; sort_order?: number; is_active?: boolean }): Promise<{ faq: FaqItem }> {
  const response = await fetchWithTimeout(`${API_BASE}/admin/faqs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<{ faq: FaqItem }>(response, `${API_BASE}/admin/faqs`);
}

/** Admin: update FAQ */
export async function adminUpdateFaq(id: string, data: Partial<Pick<FaqItem, 'question' | 'answer' | 'sort_order' | 'is_active'>>): Promise<{ faq: FaqItem }> {
  const response = await fetchWithTimeout(`${API_BASE}/admin/faqs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<{ faq: FaqItem }>(response, `${API_BASE}/admin/faqs/${id}`);
}

/** Admin: delete FAQ */
export async function adminDeleteFaq(id: string): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/admin/faqs/${id}`, { method: 'DELETE' });
  await handleVoidResponse(response, `${API_BASE}/admin/faqs/${id}`);
}

/** Admin: batch reorder FAQs */
export async function adminReorderFaqs(items: { id: string; sort_order: number }[]): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/admin/faqs/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  await handleVoidResponse(response, `${API_BASE}/admin/faqs/reorder`);
}

// ========== Blog ==========

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  category: string;
  author: string;
  read_time: number;
  is_active: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

/** Public: fetch active blog posts for blog page */
export async function fetchBlogPosts(): Promise<{ posts: Pick<BlogPost, 'id' | 'title' | 'slug' | 'excerpt' | 'cover_image_url' | 'category' | 'author' | 'read_time' | 'published_at'>[] }> {
  const response = await fetchWithTimeout(`${API_BASE}/blog`);
  return handleResponse(response, `${API_BASE}/blog`);
}

/** Public: fetch a single blog post by slug */
export async function fetchBlogPost(slug: string): Promise<{ post: BlogPost }> {
  const response = await fetchWithTimeout(`${API_BASE}/blog/${slug}`);
  return handleResponse(response, `${API_BASE}/blog/${slug}`);
}

/** Admin: list all blog posts (including inactive) */
export async function adminFetchBlogPosts(): Promise<{ posts: BlogPost[] }> {
  const response = await fetchWithTimeout(`${API_BASE}/admin/blog`);
  return handleResponse(response, `${API_BASE}/admin/blog`);
}

/** Admin: create blog post */
export async function adminCreateBlogPost(data: Partial<BlogPost> & { title: string; slug: string; content: string }): Promise<{ post: BlogPost }> {
  const response = await fetchWithTimeout(`${API_BASE}/admin/blog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response, `${API_BASE}/admin/blog`);
}

/** Admin: update blog post */
export async function adminUpdateBlogPost(id: string, data: Partial<BlogPost>): Promise<{ post: BlogPost }> {
  const response = await fetchWithTimeout(`${API_BASE}/admin/blog/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response, `${API_BASE}/admin/blog/${id}`);
}

/** Admin: delete blog post */
export async function adminDeleteBlogPost(id: string): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/admin/blog/${id}`, { method: 'DELETE' });
  await handleVoidResponse(response, `${API_BASE}/admin/blog/${id}`);
}
