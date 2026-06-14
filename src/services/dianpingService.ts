import type { SourcedField } from '../types'
import { postAgentJson } from './agent'
import type { AgentRequestOptions } from './agent'

export interface DianpingQueueValue {
  status: string
  waitingMinutes: number | null
  waitingTables: number | null
  fetchedText: string
}

export interface DianpingPoiDetailFields {
  reputation: SourcedField<string>
  commentCount: SourcedField<number>
  rating: SourcedField<number>
  avgPrice: SourcedField<number>
  recommendedDishes: SourcedField<string[]>
  images: SourcedField<Array<string | { url: string; title?: string }>>
  queue: SourcedField<DianpingQueueValue>
}

export interface DianpingPoiDetailResult {
  ok: boolean
  status: 'ready' | 'missing-config' | 'unavailable'
  generatedAt: string
  rawSnapshotId: string
  source: 'dianping'
  warnings?: string[]
  fields: DianpingPoiDetailFields
}

export interface DianpingQueueResult {
  ok: boolean
  status: 'ready' | 'missing-config' | 'unavailable'
  generatedAt: string
  rawSnapshotId: string
  source: 'dianping'
  warnings?: string[]
  fields: {
    queue: SourcedField<DianpingQueueValue>
  }
}

export function fetchDianpingPoiDetail(
  params: { sourceId?: string; name: string; cityName?: string },
  options?: AgentRequestOptions,
) {
  return postAgentJson<DianpingPoiDetailResult>('/api/data/dianping/pois/detail', params, options)
}

export function fetchDianpingQueue(
  params: { sourceId?: string; name: string; cityName?: string },
  options?: AgentRequestOptions,
) {
  return postAgentJson<DianpingQueueResult>('/api/data/dianping/realtime/queue', params, options)
}
