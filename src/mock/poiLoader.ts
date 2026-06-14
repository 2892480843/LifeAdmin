import type { Poi } from '../types'
import cityDataRaw from '../data/china-prefecture-cities.json'
import { pois as curatedPois } from './pois'

// 分片键：featured（高频精选城市）或 p{adcode前两位}（省份）
export type PoiShardKey = string

interface CityMeta {
  id: string
  adcode: string
}

interface CityData {
  cities: CityMeta[]
}

const cityData = cityDataRaw as CityData
const cityById = new Map(cityData.cities.map((city) => [city.id, city]))
const featuredCityIds = new Set(['beijing', 'shanghai', 'hangzhou', 'chengdu', 'xian', 'sanya'])

const shardCache = new Map<PoiShardKey, Promise<Poi[]>>()
let poiShardIndexCache: Promise<Record<string, PoiShardKey>> | null = null

export async function loadPoisByCity(cityId: string): Promise<Poi[]> {
  // 按城市缓存已去重的合并结果，切回同一城市时直接返回，避免重复 filter 与对象拷贝
  const merged = mergedCityCache.get(cityId)
  if (merged) return merged

  const promise = (async () => {
    const curated = loadCuratedByCity(cityId)
    const curatedIds = new Set(curated.map((item) => item.id))
    const generated = (await loadGeneratedPoisByCity(cityId)).filter((poi) => !curatedIds.has(poi.id))
    return [...curated, ...generated]
  })()
  mergedCityCache.set(cityId, promise)
  return promise
}

// 精选 POI 按 city 预建索引，避免每次全表扫描
const curatedByCityCache = new Map<string, Poi[]>()
function loadCuratedByCity(cityId: string): Poi[] {
  const cached = curatedByCityCache.get(cityId)
  if (cached) return cached
  const result = curatedPois.filter((poi) => poi.cityId === cityId).map(markDemoPoi)
  curatedByCityCache.set(cityId, result)
  return result
}

export async function loadGeneratedPoisByCity(cityId: string): Promise<Poi[]> {
  if (!cityId) return []
  // 城市级结果缓存：同一城市的后续请求直接命中，无需重新 filter 整个分片
  const cached = generatedCityCache.get(cityId)
  if (cached) return cached

  const promise = (async () => {
  const shard = shardForCity(cityId)
  const pois = await loadShard(shard)
  return pois.filter((poi) => poi.cityId === cityId)
  })()
  generatedCityCache.set(cityId, promise)
  return promise
}

export async function loadGeneratedPoiById(id: string): Promise<Poi | undefined> {
  if (!id) return undefined
  // 已查过的 POI 直接命中索引，避免重复加载分片与 find 扫描
  const indexed = poiByIdCache.get(id)
  if (indexed) return indexed
  const promise = (async () => {
  const poiShardIndex = await loadPoiShardIndex()
  const shard = poiShardIndex[id]
    if (!shard) return undefined
  const pois = await loadShard(shard)
    const found = indexShard(shard, pois).get(id)
  return found ? markDemoPoi(found) : undefined
  })()
  poiByIdCache.set(id, promise)
  return promise
}

function shardForCity(cityId: string): PoiShardKey {
  if (featuredCityIds.has(cityId)) return 'featured'
  const city = cityById.get(cityId)
  const prefix = String(city?.adcode || '').slice(0, 2)
  return prefix ? `p${prefix}` : 'featured'
}

function loadShard(shard: PoiShardKey): Promise<Poi[]> {
  const cached = shardCache.get(shard)
  if (cached) return cached

  // Vite 构建时将所有分片文件收集为懒加载映射，新增省份无需改动本文件
  const loader = shardLoaders[`./generatedPois/${shard}.ts`]
  const promise = loader ? loader().then((module) => module.pois) : Promise.resolve([])
  shardCache.set(shard, promise)
  return promise
}

// featured 与省份分片（p11~p65）的懒加载映射；p[0-9]* 自动排除 poiShardIndex.ts
const shardLoaders = import.meta.glob<{ pois: Poi[] }>([
  './generatedPois/featured.ts',
  './generatedPois/p[0-9]*.ts',
]) as unknown as Record<string, () => Promise<{ pois: Poi[] }>>

// 加载分片后建立 id 索引，供 loadGeneratedPoiById 做 O(1) 查找
const shardIdIndex = new Map<PoiShardKey, Map<string, Poi>>()
function indexShard(shard: PoiShardKey, pois: Poi[]): Map<string, Poi> {
  const cached = shardIdIndex.get(shard)
  if (cached) return cached
  const index = new Map<string, Poi>()
  for (const poi of pois) index.set(poi.id, poi)
  shardIdIndex.set(shard, index)
  return index
}

// 预热某城市所属分片，用于登录后提前加载高频数据，消除首屏等待
export function prefetchPoisForCity(cityId: string): void {
  if (!cityId) return
  void loadPoisByCity(cityId)
}

function loadPoiShardIndex(): Promise<Record<string, PoiShardKey>> {
  if (!poiShardIndexCache) {
    poiShardIndexCache = import('./generatedPois/poiShardIndex').then((module) => module.poiShardIndex)
  }
  return poiShardIndexCache
}

const mergedCityCache = new Map<string, Promise<Poi[]>>()
const generatedCityCache = new Map<string, Promise<Poi[]>>()
const poiByIdCache = new Map<string, Promise<Poi | undefined>>()

function markDemoPoi(poi: Poi): Poi {
  return {
    ...poi,
    sourceKind: 'demo_mock',
    sourceProvider: 'demo_mock',
    rawSnapshotId: poi.rawSnapshotId || `demo-${poi.id}`,
  }
}
