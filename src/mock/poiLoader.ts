import type { Poi } from '../types'
import cityDataRaw from '../data/china-prefecture-cities.json'
import { pois as curatedPois } from './pois'

export type PoiShardKey = 'featured' | 'north' | 'east' | 'south' | 'central' | 'southwest' | 'northwest' | 'northeast'

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
const regionByProvincePrefix: Record<string, PoiShardKey> = {
  '11': 'north',
  '12': 'north',
  '13': 'north',
  '14': 'north',
  '15': 'north',
  '21': 'northeast',
  '22': 'northeast',
  '23': 'northeast',
  '31': 'east',
  '32': 'east',
  '33': 'east',
  '34': 'east',
  '35': 'east',
  '36': 'east',
  '37': 'east',
  '41': 'central',
  '42': 'central',
  '43': 'central',
  '44': 'south',
  '45': 'south',
  '46': 'south',
  '50': 'southwest',
  '51': 'southwest',
  '52': 'southwest',
  '53': 'southwest',
  '54': 'southwest',
  '61': 'northwest',
  '62': 'northwest',
  '63': 'northwest',
  '64': 'northwest',
  '65': 'northwest',
}

const shardCache = new Map<PoiShardKey, Promise<Poi[]>>()
let poiShardIndexCache: Promise<Record<string, PoiShardKey>> | null = null

export async function loadPoisByCity(cityId: string): Promise<Poi[]> {
  const curated = curatedPois.filter((poi) => poi.cityId === cityId).map(markDemoPoi)
  const generated = (await loadGeneratedPoisByCity(cityId)).filter((poi) => !curated.some((item) => item.id === poi.id))
  return [...curated, ...generated]
}

export async function loadGeneratedPoisByCity(cityId: string): Promise<Poi[]> {
  if (!cityId) return []
  const shard = shardForCity(cityId)
  const pois = await loadShard(shard)
  return pois.filter((poi) => poi.cityId === cityId)
}

export async function loadGeneratedPoiById(id: string): Promise<Poi | undefined> {
  if (!id) return undefined
  const poiShardIndex = await loadPoiShardIndex()
  const shard = poiShardIndex[id]
  if (!shard) return undefined
  const pois = await loadShard(shard)
  const found = pois.find((poi) => poi.id === id)
  return found ? markDemoPoi(found) : undefined
}

function shardForCity(cityId: string): PoiShardKey {
  if (featuredCityIds.has(cityId)) return 'featured'
  const city = cityById.get(cityId)
  const prefix = String(city?.adcode || '').slice(0, 2)
  return regionByProvincePrefix[prefix] || 'east'
}

function loadShard(shard: PoiShardKey): Promise<Poi[]> {
  const cached = shardCache.get(shard)
  if (cached) return cached

  const loader = {
    featured: () => import('./generatedPois/featured').then((module) => module.featuredPois),
    north: () => import('./generatedPois/north').then((module) => module.northPois),
    east: () => import('./generatedPois/east').then((module) => module.eastPois),
    south: () => import('./generatedPois/south').then((module) => module.southPois),
    central: () => import('./generatedPois/central').then((module) => module.centralPois),
    southwest: () => import('./generatedPois/southwest').then((module) => module.southwestPois),
    northwest: () => import('./generatedPois/northwest').then((module) => module.northwestPois),
    northeast: () => import('./generatedPois/northeast').then((module) => module.northeastPois),
  }[shard]

  const promise = loader()
  shardCache.set(shard, promise)
  return promise
}

function loadPoiShardIndex(): Promise<Record<string, PoiShardKey>> {
  if (!poiShardIndexCache) {
    poiShardIndexCache = import('./generatedPois/poiShardIndex').then((module) => module.poiShardIndex)
  }
  return poiShardIndexCache
}

function markDemoPoi(poi: Poi): Poi {
  return {
    ...poi,
    sourceKind: 'demo_mock',
    sourceProvider: 'demo_mock',
    rawSnapshotId: poi.rawSnapshotId || `demo-${poi.id}`,
  }
}
