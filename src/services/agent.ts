import type { ChatMessage, PoiCategory, PoiImageConfidence, RoutePlan, Trip, TripDraft } from '../types'

const AGENT_BASE_URL = (import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8787').replace(/\/+$/, '')
const AGENT_API_TOKEN = import.meta.env.VITE_AGENT_API_TOKEN || ''
const AGENT_AUTH_MODE = import.meta.env.VITE_AGENT_AUTH_MODE || 'demo'
const DEFAULT_AGENT_TIMEOUT_MS = 15_000
const AGENT_REQUEST_CANCELED_MESSAGE = 'Agent 请求已取消'

export class AgentRateLimitError extends Error {
  status = 429
  retryAfterSeconds: number | null

  constructor(retryAfterSeconds: number | null) {
    super(retryAfterSeconds ? `请求过于频繁，请等待 ${retryAfterSeconds} 秒后再试` : '请求过于频繁，请稍后再试')
    this.name = 'AgentRateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export interface AgentRequestOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

export type AgentLlmSource = 'deepseek' | 'longcat'

export interface AgentPlanResult {
  ok: boolean
  source: AgentLlmSource | 'amap-fallback' | 'local-fallback'
  plans: RoutePlan[]
  warnings?: string[]
}

export interface AgentChatResult {
  ok: boolean
  source: AgentLlmSource | 'local-fallback'
  reply: string
  warnings?: string[]
}

export type AgentSearchSource = 'amap' | 'dianping' | 'multi-provider' | 'local-fallback'

export interface AgentSearchPoi {
  id: string
  sourceProvider?: 'amap' | 'dianping' | string
  sourceEndpoint?: string
  sourceId?: string
  rawSnapshotId?: string
  name: string
  type?: string
  category?: PoiCategory
  address?: string
  city?: string
  district?: string
  distance?: number
  lng?: number
  lat?: number
  rating?: number
  reviewCount?: number
  cost?: number
  cover?: string
  imageUrl?: string
  thumbnail?: string
  photos?: { url: string; title?: string; source?: string }[]
  imageConfidence?: PoiImageConfidence
  imageSource?: string
  imageVerifiedAt?: string
  imagePendingReview?: boolean
  imageReviewReason?: string
  openingHours?: unknown
}

export interface AgentSearchResult {
  ok: boolean
  source: AgentSearchSource
  pois: AgentSearchPoi[]
  warnings?: string[]
  error?: string
}

export async function generateRoutePlans(draft: TripDraft, options?: AgentRequestOptions): Promise<AgentPlanResult> {
  const data = await postAgentJson<AgentPlanResult>('/api/agent/plan', { draft }, options)
  if (!data.ok || !Array.isArray(data.plans)) {
    throw new Error('Agent 行程生成结果不可用，请稍后重试')
  }
  return data
}

export async function askAgentWithResult(
  question: string,
  context?: { trip?: Trip; draft?: TripDraft; messages?: ChatMessage[]; realtime?: unknown; currentLocation?: unknown },
  options?: AgentRequestOptions,
): Promise<AgentChatResult> {
  const data = await postAgentJson<AgentChatResult>('/api/agent/chat', {
    question,
    trip: context?.trip,
    draft: context?.draft,
    messages: context?.messages,
    realtime: context?.realtime,
    currentLocation: context?.currentLocation,
  }, options)
  if (!data.ok || !data.reply) {
    throw new Error('Agent 对话结果不可用，请稍后重试')
  }
  return data
}

export async function askAgent(
  question: string,
  context?: { trip?: Trip; draft?: TripDraft; messages?: ChatMessage[] },
  options?: AgentRequestOptions,
): Promise<string> {
  const data = await askAgentWithResult(question, context, options)
  return data.reply
}

export async function searchPois(params: {
  keyword: string
  cityName?: string
  categories?: PoiCategory[]
  minRating?: number
  maxDistance?: number
  lng?: number
  lat?: number
  provider?: 'auto' | 'amap' | 'dianping'
}, options?: AgentRequestOptions): Promise<AgentSearchResult> {
  const data = await postAgentJson<AgentSearchResult>('/api/agent/search', params, options)
  if (!data.ok || !Array.isArray(data.pois)) {
    throw new Error('远程搜索结果不可用，请稍后重试')
  }
  return data
}

export async function postAgentJson<T>(path: string, body: unknown, options: AgentRequestOptions = {}): Promise<T> {
  if (!AGENT_API_TOKEN && AGENT_AUTH_MODE === 'demo') {
    throw new Error('Agent 认证信息未配置，请检查本地环境变量')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (AGENT_API_TOKEN) {
    headers.Authorization = `Bearer ${AGENT_API_TOKEN}`
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS
  const controller = new AbortController()
  let abortReason: 'timeout' | 'caller' | null = null
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const abortFromCaller = () => {
    abortReason = 'caller'
    controller.abort()
  }

  if (options.signal?.aborted) {
    abortFromCaller()
  } else if (options.signal) {
    options.signal.addEventListener('abort', abortFromCaller, { once: true })
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      abortReason = 'timeout'
      controller.abort()
    }, timeoutMs)
  }

  try {
    const response = await fetch(`${AGENT_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: AGENT_AUTH_MODE === 'production' ? 'include' : 'same-origin',
    })

    const text = await response.text()
    const data = parseJson(text)

    if (!response.ok) {
      if (response.status === 429) {
        throw new AgentRateLimitError(parseRetryAfterSeconds(response.headers.get('Retry-After')))
      }
      throw new Error(agentHttpStatusMessage(response.status))
    }

    return (data ?? {}) as T
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(abortReason === 'timeout' ? 'Agent 请求超时，请稍后重试' : AGENT_REQUEST_CANCELED_MESSAGE)
    }
    throw error
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

export function isAgentRequestCanceled(error: unknown) {
  return error instanceof Error && error.message === AGENT_REQUEST_CANCELED_MESSAGE
}

export function isAgentRateLimitError(error: unknown): error is AgentRateLimitError {
  return error instanceof AgentRateLimitError
}

export function getAgentErrorMessage(error: unknown, fallback = 'Agent 服务暂不可用，请稍后重试') {
  if (isAgentRateLimitError(error)) return error.message
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (!message) return fallback
  if (message === AGENT_REQUEST_CANCELED_MESSAGE) return message
  if (/超时/.test(message)) return 'Agent 请求超时，请稍后重试'
  if (/认证|token|auth|unauthorized/i.test(message)) return 'Agent 认证失败，请检查本地配置'
  if (/安全策略|forbidden|cors|403/i.test(message)) return 'Agent 请求被安全策略拒绝'
  if (/频繁|rate|429/i.test(message)) return '请求过于频繁，请稍后再试'
  if (/参数|400|invalid/i.test(message)) return '请求参数无效，请检查输入后重试'
  if (/服务暂不可用|5\d\d|network|fetch/i.test(message)) return 'Agent 服务暂不可用，请稍后重试'
  return fallback
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function parseJson(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function parseRetryAfterSeconds(value: string | null) {
  if (!value) return null

  const seconds = Number(value)
  if (Number.isFinite(seconds)) {
    return Math.max(1, Math.ceil(seconds))
  }

  const retryAt = Date.parse(value)
  if (Number.isNaN(retryAt)) return null
  return Math.max(1, Math.ceil((retryAt - Date.now()) / 1000))
}

function agentHttpStatusMessage(status: number) {
  if (status === 400) return '请求参数无效，请检查输入后重试'
  if (status === 401) return 'Agent 认证失败，请检查本地配置'
  if (status === 403) return 'Agent 请求被安全策略拒绝'
  if (status === 429) return '请求过于频繁，请稍后再试'
  if (status >= 500) return 'Agent 服务暂不可用，请稍后重试'
  return `Agent 服务暂不可用，请稍后重试（${status}）`
}
