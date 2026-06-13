import type { ChatMessage, DynamicLog, EventLevel, EventType, SourcedField, Trip } from '../types'
import type { CurrentLocation } from './locationService'
import { askAgentWithResult, isAgentRateLimitError, isAgentRequestCanceled, postAgentJson } from './agent'
import type { AgentLlmSource, AgentRequestOptions } from './agent'

export type RealtimeStatus = 'ready' | 'partial' | 'missing-config' | 'no-trip' | 'error'

export interface RealtimeSourceMap {
  poi: string
  route: string
  weather: string
  traffic: string
  crowd: string
  queue: string
  ai: string
}

export interface RealtimeUnavailableField {
  label: string
  message: string
}

export interface RealtimeEventItem {
  id: string
  type: EventType
  level: EventLevel
  title: string
  description: string
  time: string
  affectedPoi: string
  source?: string
}

export interface RealtimePoint {
  id?: string
  name?: string
  lng: number
  lat: number
  x?: number
  y?: number
  color?: string
}

export interface RealtimeRouteLeg {
  from: RealtimePoint
  to: RealtimePoint
  mode: 'driving' | 'walking' | 'transit'
  distanceMeters: number
  durationSeconds: number
  distanceText: string
  durationText: string
  trafficStatus?: string
  trafficDescription?: string
  polyline: RealtimePoint[]
}

export interface RealtimeRoute {
  distanceMeters: number
  durationSeconds: number
  distanceText: string
  durationText: string
  congestionLegs: number
  legs: RealtimeRouteLeg[]
}

export interface RealtimeWeather {
  city: string
  adcode: string
  weather: string
  temperature: string
  winddirection: string
  windpower: string
  humidity: string
  reporttime: string
}

export interface RealtimeTraffic {
  status: string
  description: string
  expedite?: string
  congested?: string
  blocked?: string
  unknown?: string
  roads: { name: string; status: string; direction: string; angle: string; speed: string }[]
}

export interface RealtimeRecommendation {
  source: AgentLlmSource
  summary: string
  risks: RealtimeRecommendationRisk[]
  actions: RealtimeRecommendationAction[]
}

export type RealtimeRecommendationRiskType = 'traffic' | 'weather' | 'queue' | 'crowd' | 'route' | 'unknown'
export type RealtimeRecommendationLevel = '高' | '中' | '低'

export interface RealtimeRecommendationRisk {
  type: RealtimeRecommendationRiskType
  level: RealtimeRecommendationLevel
  title: string
  reason: string
}

export interface RealtimeRecommendationAction {
  id: string
  label: string
  description: string
  canApply: boolean
  unavailableReason?: string
}

export interface RealtimeSnapshot {
  ok: boolean
  status: RealtimeStatus
  generatedAt: string
  sources: RealtimeSourceMap
  warnings?: string[]
  currentLocation?: CurrentLocation | null
  trip?: {
    id: string
    title: string
    cityId: string
    startDate: string
    endDate: string
    status: string
  }
  events: RealtimeEventItem[]
  logs: DynamicLog[]
  route: RealtimeRoute | null
  weather: RealtimeWeather | null
  traffic: RealtimeTraffic | null
  facts?: {
    weather: SourcedField<RealtimeWeather>
    route: SourcedField<RealtimeRoute>
    traffic: SourcedField<RealtimeTraffic>
    queue: SourcedField<null>
    crowd: SourcedField<null>
  }
  recommendation: RealtimeRecommendation | null
  unavailable: {
    queue: RealtimeUnavailableField
    crowd: RealtimeUnavailableField
  }
}

export async function fetchRealtimeSnapshot(
  trip: Trip,
  currentLocation?: CurrentLocation | null,
  options?: AgentRequestOptions,
): Promise<RealtimeSnapshot> {
  return postAgentJson<RealtimeSnapshot>('/api/agent/realtime', {
    trip,
    currentLocation: currentLocation ?? undefined,
  }, options)
}

export async function askRealtimeAssistant(params: {
  question: string
  trip: Trip
  snapshot: RealtimeSnapshot | null
  messages: ChatMessage[]
  currentLocation?: CurrentLocation | null
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<string> {
  const result = await askAgentWithResult(params.question, {
    trip: params.trip,
    messages: params.messages,
    realtime: params.snapshot,
    currentLocation: params.currentLocation ?? null,
  }, {
    signal: params.signal,
    timeoutMs: params.timeoutMs,
  })

  if (!isAgentLlmSource(result.source)) {
    throw new Error('Realtime assistant requires a configured model and real context')
  }

  return result.reply
}

export function realtimeErrorStatus(error: unknown): RealtimeStatus {
  const message = error instanceof Error ? error.message : String(error)
  if (/token|configured|认证|配置/i.test(message)) return 'missing-config'
  return 'error'
}

export function isRealtimeRequestCanceled(error: unknown) {
  return isAgentRequestCanceled(error)
}

export function realtimeRetryAfterSeconds(error: unknown) {
  return isAgentRateLimitError(error) ? error.retryAfterSeconds : null
}

function isAgentLlmSource(source: string): source is AgentLlmSource {
  return source === 'deepseek' || source === 'longcat'
}
