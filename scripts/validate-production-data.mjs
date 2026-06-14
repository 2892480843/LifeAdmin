import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const GENERATED_DATA_PATH = resolve(ROOT, 'data/generated-pois.json')
const PROGRESS_PATH = resolve(ROOT, 'data/poi-collection-progress.json')
const APP_CONTEXT_PATH = resolve(ROOT, 'src/store/AppContext.tsx')

const DEFAULT_OPENING_HOURS = '开放时间以官方公告或地图实时信息为准'
const DEFAULT_TICKET = '以官方公告或现场为准'

const pois = readJsonIfExists(GENERATED_DATA_PATH, [])
const progress = readJsonIfExists(PROGRESS_PATH, { cities: {} })
const appContext = readTextIfExists(APP_CONTEXT_PATH)
const errors = []

const uncertainTicketCount = pois.filter((poi) => poi.ticket === DEFAULT_TICKET).length
const uncertainOpeningHoursCount = pois.filter((poi) => poi.openingHours === DEFAULT_OPENING_HOURS).length
const pendingImageReviewCount = pois.filter((poi) => poi.imagePendingReview === true).length
const demoMockIsolated = /isProductionDataMode/.test(appContext) &&
  /isProductionDataMode\s*\?\s*\[\]\s*:\s*mockPois/.test(appContext)
const sanshaProgress = progress.cities?.sansha || null
const sanshaPois = pois.filter((poi) => poi.cityId === 'sansha').length
const sanshaCoverage = {
  collectedCount: sanshaProgress?.collectedCount ?? sanshaPois,
  targetMin: sanshaProgress?.targetMin ?? 0,
  coverage: sanshaProgress?.coverage ?? (sanshaPois > 0 ? 'seeded' : 'missing'),
}

if (!Array.isArray(pois)) errors.push('generated POI seed must be an array')
if (!demoMockIsolated) errors.push('demo/mock POIs are not isolated from production data mode')

console.log('[production data quality]')
console.log(`demoMockIsolated: ${demoMockIsolated}`)
console.log(`generatedSeedCount: ${Array.isArray(pois) ? pois.length : 0}`)
console.log(`uncertainTicketCount: ${uncertainTicketCount}`)
console.log(`uncertainOpeningHoursCount: ${uncertainOpeningHoursCount}`)
console.log(`pendingImageReviewCount: ${pendingImageReviewCount}`)
console.log(`sanshaCoverage: ${sanshaCoverage.collectedCount}/${sanshaCoverage.targetMin} ${sanshaCoverage.coverage}`)

if (errors.length > 0) {
  console.error('[production data quality] errors:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('[production data quality] passed: generated POIs are treated as seed/demo data, not production facts.')

function readJsonIfExists(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readTextIfExists(path) {
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf8')
}
