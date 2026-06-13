import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CITY_SOURCE_PATH = process.env.VALIDATE_POIS_CITY_SOURCE || resolve(ROOT, 'src/data/china-prefecture-cities.json')
const GENERATED_DATA_PATH = process.env.VALIDATE_POIS_DATA_SOURCE || resolve(ROOT, 'data/generated-pois.json')
const PROGRESS_PATH = process.env.VALIDATE_POIS_PROGRESS_SOURCE || resolve(ROOT, 'data/poi-collection-progress.json')

const args = new Set(process.argv.slice(2))
const strictCoverage = args.has('--strict-coverage')

const ALLOWED_CATEGORIES = new Set([
  '景点',
  '美食',
  '文化艺术',
  '购物',
  '亲子游',
  '公园自然',
  '历史遗迹',
  '夜生活',
])
const ALLOWED_CONFIDENCE = new Set(['poi-photo', 'verified', 'unverified', 'pending-review'])
const REQUIRED_FIELDS = {
  id: 'string',
  name: 'string',
  cityId: 'string',
  category: 'string',
  rating: 'number',
  reviewCount: 'number',
  cover: 'string',
  images: 'string[]',
  imageConfidence: 'string',
  imageSource: 'string',
  imageVerifiedAt: 'string',
  imagePendingReview: 'boolean',
  tags: 'string[]',
  x: 'number',
  y: 'number',
  lng: 'number',
  lat: 'number',
  address: 'string',
  openingHours: 'string',
  ticket: 'string',
  suggestedDuration: 'string',
  suitableFor: 'string',
  price: 'number',
  distance: 'number',
  aiReason: 'string',
  description: 'string',
  reviews: 'array',
}

const CHINA_BBOX = { minLng: 73, maxLng: 135, minLat: 3, maxLat: 54 }
const ID_SAFE_RE = /^[a-z0-9][a-z0-9-]*$/
const URL_RE = /^https?:\/\//i
const PLACEHOLDER_RE =
  /(?:picsum\.photos|placehold\.co|placeholder\.com|dummyimage\.com|loremflickr\.com|source\.unsplash\.com\/random|unsplash\.it)/i
const SECRET_RE = /[?&](?:key|token|sig|secret|signature)=/i
const BAD_TEXT_RE = /(?:undefined|null|NaN|TODO|TBD|lorem ipsum|示例值|模拟数据|随便|待填写|待补充)/i
const NO_TRUSTED_IMAGE_REASON = 'No trusted POI photo was available from the source.'

const errors = []
const warnings = []

function main() {
  const cityData = readJson(CITY_SOURCE_PATH)
  const cities = Array.isArray(cityData?.cities) ? cityData.cities : []
  const cityById = new Map(cities.map((city) => [city.id, city]))
  const progress = readJsonIfExists(PROGRESS_PATH, null)
  const pois = readJson(GENERATED_DATA_PATH)

  if (!Array.isArray(pois)) {
    failNow('data/generated-pois.json root must be an array.')
  }

  const idSet = new Set()
  const nameByCity = new Map()

  pois.forEach((poi, index) => {
    const label = poiLabel(poi, index)
    validateFields(poi, label)
    validateCity(poi, label, cityById)
    validateCategory(poi, label)
    validateId(poi, label, idSet)
    validateCoordinates(poi, label)
    validateXY(poi, label)
    validateImages(poi, label)
    validateTextAndNumbers(poi, label)
    validateNoSecret(poi, label)
    validateSameCityNameDup(poi, label, nameByCity)
  })

  validateNearDuplicatePois(pois)
  validateCoverage(cities, pois, progress)
  printSummary(cities, pois, progress)
  report()
}

function validateFields(poi, label) {
  if (!poi || typeof poi !== 'object' || Array.isArray(poi)) {
    errors.push(`${label}: POI item must be an object.`)
    return
  }

  for (const [field, kind] of Object.entries(REQUIRED_FIELDS)) {
    if (!(field in poi)) {
      errors.push(`${label}: missing required field ${field}.`)
      continue
    }
    const value = poi[field]
    if (kind === 'string' && typeof value !== 'string') errors.push(`${label}: ${field} must be string.`)
    if (kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
      errors.push(`${label}: ${field} must be a finite number.`)
    }
    if (kind === 'boolean' && typeof value !== 'boolean') errors.push(`${label}: ${field} must be boolean.`)
    if (kind === 'string[]' && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
      errors.push(`${label}: ${field} must be string[].`)
    }
    if (kind === 'array' && !Array.isArray(value)) errors.push(`${label}: ${field} must be an array.`)
  }

  for (const field of ['name', 'address', 'openingHours', 'ticket', 'suggestedDuration', 'suitableFor', 'aiReason', 'description']) {
    if (typeof poi[field] === 'string' && poi[field].trim() === '') {
      errors.push(`${label}: ${field} must not be empty.`)
    }
  }

  if (Array.isArray(poi.tags) && (poi.tags.length < 1 || poi.tags.length > 5)) {
    warnings.push(`${label}: tags should contain 1-5 concise labels.`)
  }
}

function validateCity(poi, label, cityById) {
  if (typeof poi.cityId === 'string' && !cityById.has(poi.cityId)) {
    errors.push(`${label}: cityId "${poi.cityId}" is not present in china-prefecture-cities.json.`)
  }
}

function validateCategory(poi, label) {
  if (typeof poi.category === 'string' && !ALLOWED_CATEGORIES.has(poi.category)) {
    errors.push(`${label}: invalid category "${poi.category}".`)
  }
}

function validateId(poi, label, idSet) {
  if (typeof poi.id !== 'string') return
  if (!ID_SAFE_RE.test(poi.id)) errors.push(`${label}: id contains unsupported characters.`)
  if (typeof poi.cityId === 'string' && !poi.id.startsWith(`${poi.cityId}-`)) {
    errors.push(`${label}: id must start with cityId prefix "${poi.cityId}-".`)
  }
  if (idSet.has(poi.id)) errors.push(`${label}: duplicate id.`)
  idSet.add(poi.id)
}

function validateCoordinates(poi, label) {
  if (typeof poi.lng !== 'number' || typeof poi.lat !== 'number') return
  if (poi.lng < CHINA_BBOX.minLng || poi.lng > CHINA_BBOX.maxLng || poi.lat < CHINA_BBOX.minLat || poi.lat > CHINA_BBOX.maxLat) {
    errors.push(`${label}: lng/lat (${poi.lng}, ${poi.lat}) is outside mainland China bounds.`)
  }
}

function validateXY(poi, label) {
  for (const axis of ['x', 'y']) {
    const value = poi[axis]
    if (typeof value === 'number' && (value < 0 || value > 100)) {
      errors.push(`${label}: ${axis}=${value} is outside 0-100.`)
    }
  }
}

function validateImages(poi, label) {
  if (typeof poi.imageConfidence === 'string' && !ALLOWED_CONFIDENCE.has(poi.imageConfidence)) {
    errors.push(`${label}: invalid imageConfidence "${poi.imageConfidence}".`)
  }

  const cover = typeof poi.cover === 'string' ? poi.cover.trim() : ''
  const images = Array.isArray(poi.images) ? poi.images : []

  for (const url of [cover, ...images].filter(Boolean)) {
    if (!URL_RE.test(url) && !url.startsWith('/') && !url.startsWith('data:image/')) {
      errors.push(`${label}: image URL is not valid: ${url}`)
    }
    if (PLACEHOLDER_RE.test(url)) errors.push(`${label}: placeholder image URL is forbidden: ${url}`)
  }

  if (poi.imageConfidence === 'poi-photo') {
    if (!cover || images.length === 0) errors.push(`${label}: poi-photo requires cover and images.`)
    if (poi.imageSource !== 'amap-poi-photos') errors.push(`${label}: poi-photo must use imageSource=amap-poi-photos.`)
    if (poi.imagePendingReview !== false) errors.push(`${label}: poi-photo must set imagePendingReview=false.`)
    if (!isIsoDate(poi.imageVerifiedAt)) errors.push(`${label}: imageVerifiedAt must be ISO timestamp.`)
  }

  if (poi.imageConfidence === 'pending-review') {
    if (cover || images.length > 0) errors.push(`${label}: pending-review image must not include cover/images.`)
    if (poi.imagePendingReview !== true) errors.push(`${label}: pending-review must set imagePendingReview=true.`)
    if (poi.imageReviewReason !== NO_TRUSTED_IMAGE_REASON) {
      errors.push(`${label}: pending-review must use the standard imageReviewReason.`)
    }
  }
}

function validateTextAndNumbers(poi, label) {
  if (typeof poi.rating === 'number' && (poi.rating < 0 || poi.rating > 5)) errors.push(`${label}: rating must be in [0,5].`)
  if (typeof poi.reviewCount === 'number' && poi.reviewCount < 0) errors.push(`${label}: reviewCount must be >= 0.`)
  if (typeof poi.price === 'number' && poi.price < 0) errors.push(`${label}: price must be >= 0.`)
  if (typeof poi.distance === 'number' && poi.distance < 0) errors.push(`${label}: distance must be >= 0.`)

  for (const field of ['openingHours', 'ticket', 'aiReason', 'description', 'address']) {
    const value = poi[field]
    if (typeof value === 'string' && BAD_TEXT_RE.test(value)) errors.push(`${label}: ${field} contains obvious invalid placeholder text.`)
  }

  if (typeof poi.openingHours === 'string' && poi.openingHours.length > 220) {
    warnings.push(`${label}: openingHours is very long; consider reviewing UI fit.`)
  }
  if (typeof poi.ticket === 'string' && poi.ticket.length > 80) {
    warnings.push(`${label}: ticket text is very long; consider reviewing UI fit.`)
  }
}

function validateNoSecret(poi, label) {
  const strings = []
  collectStrings(poi, strings)
  for (const value of strings) {
    if (SECRET_RE.test(value)) {
      errors.push(`${label}: field value appears to contain a secret-like query parameter.`)
      return
    }
  }
}

function validateSameCityNameDup(poi, label, nameByCity) {
  if (typeof poi.cityId !== 'string' || typeof poi.name !== 'string') return
  if (!nameByCity.has(poi.cityId)) nameByCity.set(poi.cityId, new Map())
  const normalized = normalizeName(poi.name)
  const bucket = nameByCity.get(poi.cityId)
  const currentFingerprint = poiDuplicateFingerprint(poi, normalized)
  const sameNamePois = bucket.get(normalized) || []

  for (const existing of sameNamePois) {
    if (existing.fingerprint === currentFingerprint) {
      errors.push(`${label}: duplicate same-city place with ${existing.id}.`)
      return
    }

    const distanceMeters = distanceBetweenMeters(poi, existing.poi)
    if (distanceMeters !== null && distanceMeters < 80 && sameAddress(poi, existing.poi)) {
      warnings.push(`${label}: possible same-place duplicate with ${existing.id}; same name/address and ${distanceMeters.toFixed(0)}m apart.`)
      return
    }
  }

  sameNamePois.push({ id: poi.id, poi, fingerprint: currentFingerprint })
  bucket.set(normalized, sameNamePois)
}

function validateNearDuplicatePois(pois) {
  for (let i = 0; i < pois.length; i += 1) {
    const left = pois[i]
    if (!left || typeof left.lng !== 'number' || typeof left.lat !== 'number') continue
    for (let j = i + 1; j < pois.length; j += 1) {
      const right = pois[j]
      if (!right || left.cityId !== right.cityId) continue
      if (typeof right.lng !== 'number' || typeof right.lat !== 'number') continue
      const near = Math.abs(left.lng - right.lng) < 0.0006 && Math.abs(left.lat - right.lat) < 0.0006
      if (!near) continue
      const leftName = normalizeName(left.name)
      const rightName = normalizeName(right.name)
      if (leftName && rightName && (leftName.includes(rightName) || rightName.includes(leftName))) {
        warnings.push(`possible near-coordinate duplicate: ${left.id} (${left.name}) <-> ${right.id} (${right.name}).`)
      }
    }
  }
}

function validateCoverage(cities, pois, progress) {
  const byCity = countBy(pois, (poi) => poi.cityId)
  const uncovered = cities.filter((city) => !byCity.has(city.id))
  if (uncovered.length > 0) {
    const message = `${uncovered.length} cities have no generated POIs.`
    if (strictCoverage) errors.push(message)
    else warnings.push(message)
  }

  if (progress?.cities) {
    const failed = Object.values(progress.cities).filter((item) => item.status === 'failed')
    if (failed.length > 0) warnings.push(`${failed.length} cities are marked failed in poi-collection-progress.json.`)
  }
}

function printSummary(cities, pois, progress) {
  const byCity = countBy(pois, (poi) => poi.cityId)
  const byCategory = countBy(pois, (poi) => poi.category)
  const covered = cities.filter((city) => byCity.get(city.id) > 0)
  const pendingImages = pois.filter((poi) => poi.imagePendingReview).length
  const noRating = pois.filter((poi) => !poi.rating).length
  const uncertainOpening = pois.filter((poi) => poi.openingHours === '开放时间以官方公告或地图实时信息为准').length
  const uncertainTicket = pois.filter((poi) => poi.ticket === '以官方公告或现场为准').length

  console.log('[validate-pois] summary')
  console.log(`  city total: ${cities.length}`)
  console.log(`  covered cities: ${covered.length}`)
  console.log(`  uncovered cities: ${cities.length - covered.length}`)
  console.log(`  POI total: ${pois.length}`)
  console.log(`  pending image review: ${pendingImages}`)
  console.log(`  no rating: ${noRating}`)
  console.log(`  uncertain opening hours: ${uncertainOpening}`)
  console.log(`  uncertain ticket: ${uncertainTicket}`)
  console.log('  category counts:')
  for (const category of ALLOWED_CATEGORIES) console.log(`    ${category}: ${byCategory.get(category) || 0}`)

  const insufficient = Object.values(progress?.cities || {}).filter((item) => item.coverage && item.coverage !== 'target-met')
  if (insufficient.length > 0) {
    console.log('  progress issues:')
    for (const item of insufficient.slice(0, 30)) {
      console.log(`    ${item.cityId}: ${item.status}, ${item.collectedCount || 0}/${item.targetMin || 0}, ${item.reason || item.lastError || ''}`)
    }
    if (insufficient.length > 30) console.log(`    ... ${insufficient.length - 30} more`)
  }
}

function report() {
  if (warnings.length > 0) {
    console.log(`\n[validate-pois] warnings: ${warnings.length}`)
    for (const warning of warnings.slice(0, 80)) console.log(`  - ${warning}`)
    if (warnings.length > 80) console.log(`  ... ${warnings.length - 80} more`)
  }

  if (errors.length > 0) {
    console.error(`\n[validate-pois] errors: ${errors.length}`)
    for (const error of errors.slice(0, 120)) console.error(`  - ${error}`)
    if (errors.length > 120) console.error(`  ... ${errors.length - 120} more`)
    process.exit(1)
  }

  console.log('\n[validate-pois] passed: no hard errors found.')
}

function poiLabel(poi, index) {
  if (!poi || typeof poi !== 'object') return `#${index}`
  return `${poi.id || `#${index}`} ${poi.name ? `(${poi.name})` : ''}`
}

function normalizeName(value) {
  return String(value || '')
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .replace(/[\s·.,，。、“”'"-]/g, '')
    .toLowerCase()
}

function poiDuplicateFingerprint(poi, normalizedName = normalizeName(poi.name)) {
  return [
    normalizedName,
    normalizeAddress(poi.address),
    normalizeNumberKey(poi.lng, 5),
    normalizeNumberKey(poi.lat, 5),
  ].join('|')
}

function sameAddress(left, right) {
  const leftAddress = normalizeAddress(left.address)
  const rightAddress = normalizeAddress(right.address)
  return Boolean(leftAddress && rightAddress && leftAddress === rightAddress)
}

function normalizeAddress(value) {
  return String(value || '')
    .replace(/[\s·.,，。、“”'"-]/g, '')
    .toLowerCase()
}

function normalizeNumberKey(value, digits) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(digits) : ''
}

function distanceBetweenMeters(left, right) {
  if (typeof left.lng !== 'number' || typeof left.lat !== 'number' || typeof right.lng !== 'number' || typeof right.lat !== 'number') {
    return null
  }
  const latMeters = Math.abs(left.lat - right.lat) * 111_000
  const lngMeters = Math.abs(left.lng - right.lng) * 111_000 * Math.cos((left.lat * Math.PI) / 180)
  return Math.sqrt(latMeters ** 2 + lngMeters ** 2)
}

function countBy(items, keyFn) {
  const result = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    const key = keyFn(item)
    if (!key) continue
    result.set(key, (result.get(key) || 0) + 1)
  }
  return result
}

function collectStrings(value, out) {
  if (typeof value === 'string') {
    out.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out)
  }
}

function isIsoDate(value) {
  if (typeof value !== 'string') return false
  const time = Date.parse(value)
  return Number.isFinite(time) && value.includes('T')
}

function readJson(path) {
  if (!existsSync(path)) failNow(`Missing file: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonIfExists(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function failNow(message) {
  console.error(`[validate-pois] ${message}`)
  process.exit(1)
}

main()
