import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

loadDotEnv(resolve(ROOT, '.env'))

const AMAP_KEY = process.env.AMAP_WEB_SERVICE_KEY || ''
const CITY_SOURCE_PATH = resolve(ROOT, 'src/data/china-prefecture-cities.json')
const GENERATED_DATA_PATH = resolve(ROOT, 'data/generated-pois.json')
const AUDIT_PATH = resolve(ROOT, 'data/poi-source-audit.json')
const PROGRESS_PATH = resolve(ROOT, 'data/poi-collection-progress.json')

const COLLECTION_SOURCE = {
  provider: 'amap',
  endpoint: 'https://restapi.amap.com/v3/place/text',
  coordinateSystem: 'GCJ-02',
  api: 'AMap Web Service keyword search',
}

const ALLOWED_CATEGORIES = [
  '景点',
  '美食',
  '文化艺术',
  '购物',
  '亲子游',
  '公园自然',
  '历史遗迹',
  '夜生活',
]

const CATEGORY_KEYWORDS = {
  景点: ['景区', '风景名胜', '地标'],
  历史遗迹: ['古城', '遗址', '寺庙', '古建筑', '纪念馆'],
  文化艺术: ['博物馆', '美术馆', '剧院', '文化馆'],
  公园自然: ['公园', '湿地', '森林公园', '山'],
  亲子游: ['动物园', '科技馆', '游乐园', '海洋馆'],
  购物: ['商场', '步行街', '商业街'],
  美食: ['老字号', '特色餐厅', '小吃', '本地菜'],
  夜生活: ['夜市', '酒吧街', '夜游'],
}

const CAPITAL_CITY_IDS = new Set([
  'shijiazhuang',
  'taiyuan',
  'hohhot',
  'shenyang',
  'changchun',
  'haerbin',
  'nanjing',
  'hangzhou',
  'hefei',
  'fuzhou',
  'nanchang',
  'jinan',
  'zhengzhou',
  'wuhan',
  'changsha',
  'guangzhou',
  'nanning',
  'haikou',
  'chengdu',
  'guiyang',
  'kunming',
  'lhasa',
  'xian',
  'lanzhou',
  'xining',
  'yinchuan',
  'urumqi',
])

const KEY_CITY_IDS = new Set([
  'beijing',
  'shanghai',
  'tianjin',
  'chongqing',
  'shenzhen',
  'suzhou',
  'ningbo',
  'qingdao',
  'xiamen',
  'dalian',
  'foshan',
  'dongguan',
  'wuxi',
  'wenzhou',
  'quanzhou',
  'zhuhai',
  'sanya',
  'luoyang',
  'yantai',
  'changzhou',
  'nantong',
  'xuzhou',
  'jiaxing',
  'shaoxing',
  'taizhou-331000',
  'guilin',
  'lijiang',
  'huangshan',
  'zhangjiajie',
  'datong',
  'chengde',
  'yangzhou',
  'dali',
])

const PLACEHOLDER_IMAGE_RE =
  /(?:picsum\.photos|placehold\.co|placeholder\.com|dummyimage\.com|loremflickr\.com|source\.unsplash\.com\/random)/i
const REJECT_TYPE_RE =
  /(公司企业|政府机构|社会团体|金融保险|医疗保健|汽车服务|汽车销售|汽车维修|摩托车|房地产|工厂|批发市场|通行设施|道路附属设施|地名地址信息|室内设施|事件活动|车辆|机动车|生活服务;丧葬设施)/
const ADMIN_ONLY_NAME_RE = /(?:省|市|区|县|旗|镇|乡|街道|新区|开发区)$/
const DESTINATION_HINT_RE =
  /(景区|风景|名胜|公园|湿地|森林|博物馆|美术馆|剧院|文化馆|科技馆|动物园|海洋馆|游乐园|纪念馆|遗址|古城|古镇|古建筑|寺|庙|宫|观|商业街|步行街|商场|夜市|酒吧|餐厅|饭店|小吃|菜馆|老字号|地标|广场|旅游)/
const REGIONAL_NAME_RE = /(街|巷|坊|商圈|步行街|古城|古镇|夜市|广场|商业街|片区|景区|风景区|旅游区)$/

const DEFAULT_OPENING_HOURS = '开放时间以官方公告或地图实时信息为准'
const DEFAULT_TICKET = '以官方公告或现场为准'
const NO_TRUSTED_IMAGE_REASON = 'No trusted POI photo was available from the source.'
const REQUEST_INTERVAL_MS = Number(process.env.POI_COLLECT_INTERVAL_MS || 360)
const REQUEST_TIMEOUT_MS = Number(process.env.POI_COLLECT_TIMEOUT_MS || 15000)
const MAX_ATTEMPTS = Number(process.env.POI_COLLECT_MAX_ATTEMPTS || 3)

const args = parseArgs(process.argv.slice(2))
let lastRequestAt = 0

async function main() {
  ensureDataDir()

  if (!AMAP_KEY) {
    writeEmptyProgress('AMAP_WEB_SERVICE_KEY is not configured.')
    console.error('[collect-city-pois] AMAP_WEB_SERVICE_KEY is not configured.')
    console.error('[collect-city-pois] No POI data was generated because trusted source collection cannot run without a key.')
    process.exit(1)
  }

  const cityData = readJson(CITY_SOURCE_PATH)
  const cities = Array.isArray(cityData?.cities) ? cityData.cities : []
  if (cities.length === 0) throw new Error('City source is empty.')

  const existingPois = readJsonIfExists(GENERATED_DATA_PATH, [])
  const existingAudit = readAudit()
  const progress = readProgress(cities, existingPois)
  const cityFilters = parseCityFilters(args)
  const candidates = cities.filter((city) => cityFilters.size === 0 || cityFilters.has(city.id) || cityFilters.has(city.adcode))
  const selectedCities = Number.isFinite(args.limit) ? candidates.slice(0, args.limit) : candidates

  let allPois = Array.isArray(existingPois) ? existingPois : []
  const auditsById = new Map(existingAudit.poiAudits.map((audit) => [audit.id, audit]))
  const startedAt = new Date().toISOString()

  console.log(`[collect-city-pois] source cities: ${cities.length}`)
  console.log(`[collect-city-pois] selected cities: ${selectedCities.length}`)

  for (const city of selectedCities) {
    const target = targetForCity(city)
    const currentCityPois = allPois.filter((poi) => poi.cityId === city.id)
    const current = progress.cities[city.id]

    if (!args.force && current?.status === 'completed' && currentCityPois.length > 0) {
      console.log(`[collect-city-pois] skip completed ${city.name} (${city.id}): ${currentCityPois.length}`)
      continue
    }

    if (!args.force && currentCityPois.length >= target.min) {
      progress.cities[city.id] = completedProgress(city, target, currentCityPois.length, 'seeded from existing generated data')
      writeProgress(progress)
      console.log(`[collect-city-pois] mark existing ${city.name} (${city.id}): ${currentCityPois.length}`)
      continue
    }

    console.log(`[collect-city-pois] collecting ${city.name} (${city.id}, ${city.adcode}) target ${target.min}-${target.max}`)

    try {
      const { pois, audits, cityAudit } = await collectCity(city, target)
      allPois = [...allPois.filter((poi) => poi.cityId !== city.id), ...pois]
      for (const audit of audits) auditsById.set(audit.id, audit)

      progress.cities[city.id] = {
        status: 'completed',
        cityId: city.id,
        name: city.name,
        adcode: city.adcode,
        level: city.level,
        targetMin: target.min,
        targetMax: target.max,
        collectedCount: pois.length,
        coverage: pois.length >= target.min ? 'target-met' : 'insufficient-source-results',
        reason: pois.length >= target.min ? '' : `Only ${pois.length} trusted POIs were collected from AMap.`,
        completedAt: new Date().toISOString(),
        lastError: '',
      }
      existingAudit.cityAudits[city.id] = cityAudit
      existingAudit.insufficientCities = buildInsufficientCities(progress)

      writeGeneratedData(allPois)
      writeAudit(existingAudit, auditsById, cities, progress, startedAt)
      writeProgress(progress)
      console.log(`[collect-city-pois] completed ${city.name}: ${pois.length}`)
    } catch (error) {
      const message = messageOf(error)
      progress.cities[city.id] = {
        status: 'failed',
        cityId: city.id,
        name: city.name,
        adcode: city.adcode,
        level: city.level,
        targetMin: target.min,
        targetMax: target.max,
        collectedCount: currentCityPois.length,
        coverage: 'failed',
        reason: message,
        failedAt: new Date().toISOString(),
        lastError: message,
      }
      existingAudit.cityAudits[city.id] = {
        cityId: city.id,
        name: city.name,
        adcode: city.adcode,
        status: 'failed',
        reason: message,
        collectedCount: currentCityPois.length,
        targetMin: target.min,
        targetMax: target.max,
        collectedAt: new Date().toISOString(),
      }
      existingAudit.insufficientCities = buildInsufficientCities(progress)
      writeAudit(existingAudit, auditsById, cities, progress, startedAt)
      writeProgress(progress)

      console.error(`[collect-city-pois] failed ${city.name}: ${message}`)
      if (isQuotaLikeError(message) || args.stopOnError) {
        console.error('[collect-city-pois] stopped. Re-run the same command later to resume.')
        process.exit(1)
      }
    }
  }

  writeGeneratedData(allPois)
  writeAudit(existingAudit, auditsById, cities, progress, startedAt)
  writeProgress(progress)
  await runBuildGeneratedPois()
  printSummary(cities, allPois, progress)
}

async function collectCity(city, target) {
  const rawItems = []
  const seenRawIds = new Set()
  const stats = {
    keywordRequests: 0,
    acceptedRaw: 0,
    rejectedNoLocation: 0,
    rejectedOutOfScope: 0,
    rejectedLowQuality: 0,
    rejectedDuplicate: 0,
    acceptedByCategory: Object.fromEntries(ALLOWED_CATEGORIES.map((category) => [category, 0])),
  }

  for (const category of ALLOWED_CATEGORIES) {
    const categoryLimit = categoryLimitForTarget(target)
    const keywords = CATEGORY_KEYWORDS[category] || []

    for (const keyword of keywords) {
      if (countCategory(rawItems, category) >= categoryLimit) break

      const pages = pagesForTarget(target)
      for (let page = 1; page <= pages; page += 1) {
        if (countCategory(rawItems, category) >= categoryLimit) break

        stats.keywordRequests += 1
        const results = await searchAmap({ city, keyword, page })
        if (results.length === 0) break

        for (const raw of results) {
          if (!raw.locationOk) {
            stats.rejectedNoLocation += 1
            continue
          }
          if (!isAcceptablePoi(raw, city, category)) {
            stats.rejectedLowQuality += 1
            continue
          }
          if (seenRawIds.has(raw.id)) {
            stats.rejectedDuplicate += 1
            continue
          }
          if (!isWithinCity(raw, city)) {
            stats.rejectedOutOfScope += 1
            continue
          }
          seenRawIds.add(raw.id)
          rawItems.push({ raw, category, keyword })
          stats.acceptedByCategory[category] += 1
        }
      }
    }
  }

  const deduped = dedupeRawItems(rawItems)
  stats.rejectedDuplicate += rawItems.length - deduped.length
  const finalItems = rankAndTrim(deduped, target)
  stats.acceptedRaw = finalItems.length

  const origin = pickDistanceOrigin(finalItems)
  const bbox = computeBbox(finalItems.map((item) => item.raw))
  const built = finalItems.map((item) => buildPoiRecord({ ...item, city, bbox, origin }))

  return {
    pois: built.map((item) => item.poi),
    audits: built.map((item) => item.audit),
    cityAudit: {
      cityId: city.id,
      name: city.name,
      officialName: city.officialName,
      adcode: city.adcode,
      level: city.level,
      status: 'completed',
      targetMin: target.min,
      targetMax: target.max,
      collectedCount: built.length,
      coverage: built.length >= target.min ? 'target-met' : 'insufficient-source-results',
      source: COLLECTION_SOURCE,
      stats,
      collectedAt: new Date().toISOString(),
    },
  }
}

async function searchAmap({ city, keyword, page }) {
  const url = new URL(COLLECTION_SOURCE.endpoint)
  url.searchParams.set('key', AMAP_KEY)
  url.searchParams.set('keywords', keyword)
  url.searchParams.set('city', city.adcode || city.name)
  url.searchParams.set('citylimit', 'true')
  url.searchParams.set('offset', '25')
  url.searchParams.set('page', String(page))
  url.searchParams.set('extensions', 'all')
  url.searchParams.set('output', 'JSON')

  const data = await fetchAmapWithRetry(url)
  return (Array.isArray(data.pois) ? data.pois : []).map((poi) => parseAmapPoi(poi, keyword))
}

function parseAmapPoi(poi, keyword) {
  const [lng, lat] = String(poi?.location || '').split(',').map(Number)
  const locationOk = Number.isFinite(lng) && Number.isFinite(lat)
  const bizExt = poi?.biz_ext || {}
  return {
    id: String(poi?.id || '').trim(),
    name: cleanText(poi?.name),
    type: cleanText(poi?.type),
    typecode: cleanText(poi?.typecode),
    address: cleanText(poi?.address),
    province: cleanText(poi?.pname),
    cityname: cleanText(poi?.cityname),
    district: cleanText(poi?.adname),
    adcode: cleanText(poi?.adcode),
    lng: locationOk ? lng : 0,
    lat: locationOk ? lat : 0,
    locationOk,
    rating: parseRating(bizExt.rating),
    cost: parseCost(bizExt.cost),
    opentime: cleanText(bizExt.opentime2) || cleanText(bizExt.opentime),
    photos: Array.isArray(poi?.photos) ? poi.photos : [],
    keyword,
  }
}

function isAcceptablePoi(raw, city, category) {
  if (!raw.id || !raw.name || !raw.locationOk) return false
  if (REJECT_TYPE_RE.test(raw.type)) return false
  if (category === '美食' && !/(餐饮|中餐|小吃|餐厅|饭店|菜馆|火锅|咖啡|茶馆|饮品|甜品)/.test(raw.type + raw.name)) {
    return false
  }
  if (category === '夜生活' && !/(夜市|酒吧|清吧|夜游|娱乐|休闲|餐饮|商业街|步行街)/.test(raw.type + raw.name)) {
    return false
  }
  if (ADMIN_ONLY_NAME_RE.test(raw.name) && !DESTINATION_HINT_RE.test(raw.name + raw.type)) return false
  if (!raw.address && !isKnownRegionalOrNatural(raw, category)) return false
  if (normalizeName(raw.name).length < 2) return false
  if (raw.name.includes('入口') || raw.name.includes('出口') || raw.name.includes('停车场')) return false
  if (raw.adcode && city.adcode && !String(raw.adcode).startsWith(String(city.adcode).slice(0, 4))) {
    const cityHint = normalizeRegion(city.name)
    const hints = [raw.cityname, raw.district, raw.address].map(normalizeRegion).join('|')
    if (!hints.includes(cityHint)) return false
  }
  return true
}

function isWithinCity(raw, city) {
  const targetAdcode = String(city.adcode || '')
  if (raw.adcode && targetAdcode && raw.adcode.startsWith(targetAdcode.slice(0, 4))) return true

  const target = normalizeRegion(city.name)
  const official = normalizeRegion(city.officialName)
  const hints = [raw.cityname, raw.district, raw.address].map(normalizeRegion).filter(Boolean)
  if (hints.length === 0) return true
  return hints.some((hint) => hint.includes(target) || target.includes(hint) || hint.includes(official) || official.includes(hint))
}

function dedupeRawItems(items) {
  const result = []
  const seenAmapIds = new Set()
  const seenCityNames = new Set()

  for (const item of items) {
    const raw = item.raw
    const name = normalizeName(raw.name)
    const cityNameKey = `${raw.adcode || raw.cityname}|${name}`
    if (seenAmapIds.has(raw.id) || seenCityNames.has(cityNameKey)) continue
    const duplicate = result.some((kept) => {
      const keptName = normalizeName(kept.raw.name)
      const near = Math.abs(kept.raw.lng - raw.lng) < 0.0006 && Math.abs(kept.raw.lat - raw.lat) < 0.0006
      return near && (keptName.includes(name) || name.includes(keptName))
    })
    if (duplicate) continue

    seenAmapIds.add(raw.id)
    seenCityNames.add(cityNameKey)
    result.push(item)
  }

  return result
}

function rankAndTrim(items, target) {
  const perCategory = categoryLimitForTarget(target)
  const buckets = new Map(ALLOWED_CATEGORIES.map((category) => [category, []]))
  for (const item of items) buckets.get(item.category)?.push(item)

  for (const bucket of buckets.values()) {
    bucket.sort((left, right) => scoreRaw(right.raw, right.category) - scoreRaw(left.raw, left.category))
  }

  const balanced = []
  let round = 0
  while (balanced.length < target.max && round < perCategory) {
    for (const category of ALLOWED_CATEGORIES) {
      if (balanced.length >= target.max) break
      const next = buckets.get(category)?.[round]
      if (next) balanced.push(next)
    }
    round += 1
  }

  if (balanced.length < target.min) {
    const rest = [...buckets.values()].flat().filter((item) => !balanced.includes(item))
    rest.sort((left, right) => scoreRaw(right.raw, right.category) - scoreRaw(left.raw, left.category))
    balanced.push(...rest.slice(0, target.max - balanced.length))
  }

  return balanced.slice(0, target.max)
}

function scoreRaw(raw, category) {
  let score = 0
  if (raw.rating > 0) score += raw.rating * 8
  if (raw.address) score += 8
  if (raw.photos.some((photo) => isTrustedImageUrl(toHttps(String(photo?.url || ''))))) score += 4
  if (DESTINATION_HINT_RE.test(raw.name + raw.type)) score += 12
  if (category === '美食' && /(餐厅|饭店|菜馆|老字号|小吃|火锅|本地菜|特色)/.test(raw.name + raw.type)) score += 14
  if (category === '夜生活' && /(夜市|酒吧|清吧|夜游|Live|LIVE|音乐|演艺)/i.test(raw.name + raw.type)) score += 12
  if (REGIONAL_NAME_RE.test(raw.name)) score -= 2
  if (!raw.address) score -= 12
  return score
}

function buildPoiRecord({ raw, category, keyword, city, bbox, origin }) {
  const id = `${city.id}-${slugFromAmapId(raw.id) || slugFromName(raw.name)}`
  const image = buildImage(raw)
  const { x, y } = normalizeXY(raw, bbox)
  const distance = origin ? haversineKm(origin, raw) : 0
  const isRegion = isRegionalDestination(raw, category)
  const price = priceFromCost(raw, category)
  const address = raw.address || `${raw.cityname}${raw.district}`.trim() || `${city.name}${raw.district}`.trim()

  const poi = {
    id,
    name: raw.name,
    cityId: city.id,
    category,
    rating: raw.rating,
    reviewCount: 0,
    cover: image.cover,
    images: image.images,
    imageConfidence: image.imageConfidence,
    imageSource: image.imageSource,
    imageVerifiedAt: image.imageVerifiedAt,
    imagePendingReview: image.imagePendingReview,
    imageReviewReason: image.imageReviewReason,
    tags: buildTags(raw, category),
    x,
    y,
    lng: round6(raw.lng),
    lat: round6(raw.lat),
    address,
    openingHours: raw.opentime || DEFAULT_OPENING_HOURS,
    ticket: price > 0 && (category === '美食' || category === '夜生活') ? `人均约￥${price}` : DEFAULT_TICKET,
    suggestedDuration: suggestedDuration(category),
    suitableFor: suitableFor(category),
    price,
    distance,
    aiReason: buildAiReason(raw, category, city),
    description: buildDescription(raw, category, city, isRegion),
    reviews: [],
  }

  const audit = {
    id,
    name: raw.name,
    cityId: city.id,
    cityName: city.name,
    category,
    keyword,
    primarySource: COLLECTION_SOURCE.provider,
    endpoint: COLLECTION_SOURCE.endpoint,
    amapId: raw.id,
    amapType: raw.type,
    amapAdcode: raw.adcode,
    collectedAt: new Date().toISOString(),
    coordinateSource: 'AMap POI location field, GCJ-02.',
    nameSource: 'AMap POI name field.',
    addressSource: raw.address ? 'AMap POI address field.' : 'AMap cityname + adname fallback because address was empty.',
    ratingSource: raw.rating > 0 ? 'AMap biz_ext.rating.' : 'AMap did not provide a trusted rating; rating set to 0.',
    reviewCountSource: 'AMap text search did not provide trusted review count; reviewCount set to 0.',
    priceSource: price > 0 ? 'AMap biz_ext.cost for per-capita spend.' : 'No trusted price source; price set to 0.',
    openingHoursSource: raw.opentime ? 'AMap biz_ext.opentime/opentime2.' : 'No trusted opening-hours source; default uncertainty text used.',
    ticketSource: 'AMap text search does not provide stable ticket data; default uncertainty text used.',
    imageSource: image.imageSource,
    imagePendingReview: image.imagePendingReview,
    distanceSource: origin ? `Straight-line distance from first core POI: ${origin.name || origin.id || 'city-origin'}.` : 'No origin available; distance set to 0.',
    regionalDestination: isRegion,
  }

  return { poi, audit }
}

function buildImage(raw) {
  const urls = unique(
    raw.photos
      .map((photo) => toHttps(String(photo?.url || '').trim()))
      .filter((url) => isTrustedImageUrl(url)),
  ).slice(0, 3)
  const imageVerifiedAt = new Date().toISOString()

  if (urls.length > 0) {
    return {
      cover: urls[0],
      images: urls,
      imageConfidence: 'poi-photo',
      imageSource: 'amap-poi-photos',
      imageVerifiedAt,
      imagePendingReview: false,
      imageReviewReason: '',
    }
  }

  return {
    cover: '',
    images: [],
    imageConfidence: 'pending-review',
    imageSource: 'pending-manual-review',
    imageVerifiedAt,
    imagePendingReview: true,
    imageReviewReason: NO_TRUSTED_IMAGE_REASON,
  }
}

async function fetchAmapWithRetry(url) {
  let lastError
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await throttle()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, { signal: controller.signal })
      const data = await response.json()
      if (data.status === '1') return data
      const info = `${data.info || 'AMAP_ERROR'} (${data.infocode || 'no infocode'})`
      lastError = new Error(info)
      if (!isQuotaLikeError(info)) throw lastError
      await wait(Math.min(30000, 1200 * attempt ** 2))
    } catch (error) {
      lastError = error
      if (attempt >= MAX_ATTEMPTS) break
      await wait(Math.min(10000, 800 * attempt ** 2))
    } finally {
      clearTimeout(timeout)
    }
  }
  throw lastError || new Error('AMap request failed.')
}

async function throttle() {
  const elapsed = Date.now() - lastRequestAt
  const delay = REQUEST_INTERVAL_MS - elapsed
  if (delay > 0) await wait(delay)
  lastRequestAt = Date.now()
}

function targetForCity(city) {
  if (city.level === 'municipality' || CAPITAL_CITY_IDS.has(city.id) || KEY_CITY_IDS.has(city.id)) {
    return { tier: 'major', min: 50, max: 72 }
  }
  if (city.level === 'prefecture' || city.level === 'autonomous-prefecture' || city.level === 'league') {
    return { tier: 'region', min: 8, max: 18 }
  }
  return { tier: 'ordinary', min: 15, max: 28 }
}

function categoryLimitForTarget(target) {
  if (target.tier === 'major') return 9
  if (target.tier === 'region') return 3
  return 4
}

function pagesForTarget(target) {
  return target.tier === 'major' ? 2 : 1
}

function completedProgress(city, target, count, reason = '') {
  return {
    status: 'completed',
    cityId: city.id,
    name: city.name,
    adcode: city.adcode,
    level: city.level,
    targetMin: target.min,
    targetMax: target.max,
    collectedCount: count,
    coverage: count >= target.min ? 'target-met' : 'insufficient-source-results',
    reason,
    completedAt: new Date().toISOString(),
    lastError: '',
  }
}

function readProgress(cities, existingPois) {
  const progress = readJsonIfExists(PROGRESS_PATH, null) || {
    version: 1,
    source: COLLECTION_SOURCE,
    sourceCityCount: cities.length,
    updatedAt: '',
    cities: {},
  }
  if (!progress.cities || typeof progress.cities !== 'object') progress.cities = {}

  const existingCounts = countBy(existingPois, (poi) => poi.cityId)
  for (const city of cities) {
    if (progress.cities[city.id]) continue
    const target = targetForCity(city)
    const count = existingCounts.get(city.id) || 0
    if (count >= target.min) {
      progress.cities[city.id] = completedProgress(city, target, count, 'seeded from existing generated data')
    }
  }
  progress.sourceCityCount = cities.length
  progress.updatedAt = new Date().toISOString()
  return progress
}

function readAudit() {
  const raw = readJsonIfExists(AUDIT_PATH, null)
  if (Array.isArray(raw)) {
    return {
      version: 1,
      source: COLLECTION_SOURCE,
      generatedAt: '',
      cityAudits: {},
      poiAudits: raw,
      insufficientCities: [],
    }
  }
  return {
    version: 1,
    source: COLLECTION_SOURCE,
    generatedAt: raw?.generatedAt || '',
    cityAudits: raw?.cityAudits || {},
    poiAudits: Array.isArray(raw?.poiAudits) ? raw.poiAudits : [],
    insufficientCities: Array.isArray(raw?.insufficientCities) ? raw.insufficientCities : [],
  }
}

function writeGeneratedData(pois) {
  writeTextFile(GENERATED_DATA_PATH, `${JSON.stringify(sortPois(pois), null, 2)}\n`)
}

function writeAudit(auditState, auditsById, cities, progress, startedAt) {
  const poiAudits = [...auditsById.values()].sort((left, right) => String(left.id).localeCompare(String(right.id)))
  const audit = {
    version: 1,
    source: COLLECTION_SOURCE,
    startedAt,
    generatedAt: new Date().toISOString(),
    cityTotal: cities.length,
    coveredCityCount: countCoveredCities(progress),
    uncoveredCityCount: cities.length - countCoveredCities(progress),
    cityAudits: auditState.cityAudits || {},
    poiAudits,
    insufficientCities: buildInsufficientCities(progress),
  }
  writeTextFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`)
}

function writeProgress(progress) {
  progress.updatedAt = new Date().toISOString()
  writeTextFile(PROGRESS_PATH, `${JSON.stringify(progress, null, 2)}\n`)
}

function writeEmptyProgress(reason) {
  ensureDataDir()
  const cityData = existsSync(CITY_SOURCE_PATH) ? readJson(CITY_SOURCE_PATH) : { cities: [] }
  const cities = Array.isArray(cityData?.cities) ? cityData.cities : []
  const progress = {
    version: 1,
    source: COLLECTION_SOURCE,
    sourceCityCount: cities.length,
    updatedAt: new Date().toISOString(),
    blockedReason: reason,
    cities: {},
  }
  if (!existsSync(PROGRESS_PATH)) writeTextFile(PROGRESS_PATH, `${JSON.stringify(progress, null, 2)}\n`)
}

async function runBuildGeneratedPois() {
  if (args.noBuild) return
  const module = await import('./build-generated-pois.mjs')
  if (typeof module.buildGeneratedPois === 'function') {
    await module.buildGeneratedPois({ root: ROOT, quiet: true })
  }
}

function printSummary(cities, pois, progress) {
  const byCity = countBy(pois, (poi) => poi.cityId)
  const byCategory = countBy(pois, (poi) => poi.category)
  const pendingImages = pois.filter((poi) => poi.imagePendingReview).length
  const noRating = pois.filter((poi) => !poi.rating).length
  const uncertainOpening = pois.filter((poi) => poi.openingHours === DEFAULT_OPENING_HOURS).length
  const uncertainTicket = pois.filter((poi) => poi.ticket === DEFAULT_TICKET).length
  const coveredCityCount = [...byCity.values()].filter((count) => count > 0).length

  console.log('\n[collect-city-pois] summary')
  console.log(`  cities: ${cities.length}`)
  console.log(`  covered cities: ${coveredCityCount}`)
  console.log(`  uncovered cities: ${cities.length - coveredCityCount}`)
  console.log(`  generated POIs: ${pois.length}`)
  console.log(`  pending image review: ${pendingImages}`)
  console.log(`  no rating: ${noRating}`)
  console.log(`  uncertain opening hours: ${uncertainOpening}`)
  console.log(`  uncertain ticket: ${uncertainTicket}`)
  console.log('  category counts:')
  for (const category of ALLOWED_CATEGORIES) console.log(`    ${category}: ${byCategory.get(category) || 0}`)
  const failed = Object.values(progress.cities || {}).filter((item) => item.status === 'failed')
  if (failed.length > 0) {
    console.log('  failed cities:')
    for (const item of failed) console.log(`    ${item.cityId}: ${item.reason}`)
  }
}

function buildInsufficientCities(progress) {
  return Object.values(progress.cities || {})
    .filter((item) => item.status !== 'completed' || item.coverage !== 'target-met')
    .map((item) => ({
      cityId: item.cityId,
      name: item.name,
      adcode: item.adcode,
      status: item.status,
      collectedCount: item.collectedCount || 0,
      targetMin: item.targetMin,
      reason: item.reason || item.lastError || 'Not collected yet.',
    }))
}

function countCoveredCities(progress) {
  return Object.values(progress.cities || {}).filter((item) => item.status === 'completed' && item.collectedCount > 0).length
}

function sortPois(pois) {
  return [...pois].sort((left, right) => {
    const city = String(left.cityId).localeCompare(String(right.cityId))
    if (city) return city
    const category = ALLOWED_CATEGORIES.indexOf(left.category) - ALLOWED_CATEGORIES.indexOf(right.category)
    if (category) return category
    return String(left.name).localeCompare(String(right.name))
  })
}

function pickDistanceOrigin(items) {
  const preferred = items.find((item) => item.category === '景点') || items.find((item) => item.category === '历史遗迹') || items[0]
  if (!preferred) return null
  return {
    id: preferred.raw.id,
    name: preferred.raw.name,
    lng: preferred.raw.lng,
    lat: preferred.raw.lat,
  }
}

function computeBbox(raws) {
  if (raws.length === 0) return null
  const lngs = raws.map((raw) => raw.lng)
  const lats = raws.map((raw) => raw.lat)
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  }
}

function normalizeXY(raw, bbox) {
  if (!bbox || bbox.minLng === bbox.maxLng || bbox.minLat === bbox.maxLat) return { x: 50, y: 50 }
  const x = 8 + ((raw.lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * 84
  const y = 8 + ((bbox.maxLat - raw.lat) / (bbox.maxLat - bbox.minLat)) * 84
  return { x: round1(x), y: round1(y) }
}

function buildTags(raw, category) {
  const typeTags = raw.type
    .split(/[;；|/]/)
    .map((item) => item.trim())
    .filter((item) => item && !/(服务|场所|相关|其它|其他|综合)$/.test(item))
    .slice(-2)
  return unique([category, ...typeTags, raw.district].filter(Boolean)).slice(0, 5)
}

function buildAiReason(raw, category, city) {
  const where = raw.district ? `${city.name}${raw.district}` : city.name
  return `${raw.name}位于${where}，可作为${city.name}行程中的${category}候选点。建议结合地图动线、实时营业状态和同行人偏好安排停留顺序。`
}

function buildDescription(raw, category, city, isRegion) {
  const where = raw.district ? `${city.name}${raw.district}` : city.name
  const regionNote = isRegion ? '该条目是区域推荐，不是单一门店；具体入口、店铺或游览动线需以地图实时信息确认。' : ''
  return `${raw.name}位于${where}，地址为${raw.address || '高德地图未提供详细地址'}，是高德地图收录的${category}类地点。${regionNote}开放时间、门票和人均消费等易变信息以官方公告或地图实时信息为准。`
}

function suggestedDuration(category) {
  return {
    景点: '1.5-2 小时',
    美食: '1-1.5 小时',
    文化艺术: '1.5-2 小时',
    购物: '1.5-2 小时',
    亲子游: '3-4 小时',
    公园自然: '2-3 小时',
    历史遗迹: '1.5-2 小时',
    夜生活: '1.5-2 小时',
  }[category]
}

function suitableFor(category) {
  return {
    景点: '城市观光 / 摄影 / 家庭',
    美食: '美食爱好者 / 朋友聚会 / 家庭',
    文化艺术: '文化爱好者 / 亲子 / 朋友出行',
    购物: '购物 / 美食 / 朋友出行',
    亲子游: '亲子 / 家庭 / 学生',
    公园自然: '家庭 / 散步 / 摄影',
    历史遗迹: '历史文化 / 家庭 / 慢游',
    夜生活: '朋友聚会 / 情侣 / 夜间出行',
  }[category]
}

function isKnownRegionalOrNatural(raw, category) {
  return category === '公园自然' || category === '景点' || REGIONAL_NAME_RE.test(raw.name)
}

function isRegionalDestination(raw, category) {
  if (REGIONAL_NAME_RE.test(raw.name)) return true
  if ((category === '购物' || category === '夜生活') && /(商业街|步行街|休闲广场|商圈|夜市)/.test(raw.type + raw.name)) return true
  return false
}

function priceFromCost(raw, category) {
  if (raw.cost > 0 && (category === '美食' || category === '夜生活')) return Math.round(raw.cost)
  return 0
}

function haversineKm(origin, point) {
  const radius = 6371
  const dLat = toRad(point.lat - origin.lat)
  const dLng = toRad(point.lng - origin.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) * Math.cos(toRad(point.lat)) * Math.sin(dLng / 2) ** 2
  return round1(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function countCategory(items, category) {
  return items.filter((item) => item.category === category).length
}

function countBy(items, keyFn) {
  const map = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    const key = keyFn(item)
    if (!key) continue
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}

function parseCityFilters(parsedArgs) {
  return new Set(
    String(parsedArgs.city || parsedArgs.cities || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

function parseArgs(argv) {
  const parsed = { force: false, noBuild: false, stopOnError: false, limit: Number.NaN }
  for (const arg of argv) {
    if (arg === '--force') parsed.force = true
    else if (arg === '--no-build') parsed.noBuild = true
    else if (arg === '--stop-on-error') parsed.stopOnError = true
    else if (arg.startsWith('--limit=')) parsed.limit = Number(arg.slice('--limit='.length))
    else if (arg.startsWith('--city=')) parsed.city = arg.slice('--city='.length)
    else if (arg.startsWith('--cities=')) parsed.cities = arg.slice('--cities='.length)
  }
  return parsed
}

function isQuotaLikeError(message) {
  return /10019|10020|10021|10029|CUQPS|DAILY|LIMIT|quota|exceed/i.test(String(message || ''))
}

function isTrustedImageUrl(url) {
  return /^https?:\/\//i.test(url) && !PLACEHOLDER_IMAGE_RE.test(url)
}

function toHttps(url) {
  return url.replace(/^http:\/\//i, 'https://')
}

function parseRating(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n <= 5 ? round1(n) : 0
}

function parseCost(value) {
  const n = Number(String(value || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function cleanText(value) {
  if (Array.isArray(value)) return ''
  const text = String(value == null ? '' : value).trim()
  return text === '[]' ? '' : text
}

function normalizeName(value) {
  return String(value || '')
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .replace(/[\s·.,，。、“”'"-]/g, '')
    .toLowerCase()
}

function normalizeRegion(value) {
  return normalizeName(value).replace(/[省市区县旗盟地区自治州特别行政壮族回族维吾尔蒙古藏族苗族彝族布依族侗族傣族哈萨克族柯尔克孜族]/g, '')
}

function slugFromAmapId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function slugFromName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function round6(value) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function toRad(deg) {
  return (deg * Math.PI) / 180
}

function unique(values) {
  return [...new Set(values)]
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms))
}

function writeTextFile(path, text) {
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tempPath, text, 'utf8')
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      renameSync(tempPath, path)
      return
    } catch (error) {
      if (attempt === 8) {
        try {
          rmSync(tempPath, { force: true })
        } catch {
          // best effort cleanup
        }
        throw error
      }
      sleepSync(80 * attempt)
    }
  }
}

function sleepSync(ms) {
  const buffer = new SharedArrayBuffer(4)
  const view = new Int32Array(buffer)
  Atomics.wait(view, 0, 0, ms)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonIfExists(path, fallback) {
  if (!existsSync(path)) return fallback
  return readJson(path)
}

function ensureDataDir() {
  const dataDir = resolve(ROOT, 'data')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
}

function loadDotEnv(path) {
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

main().catch((error) => {
  console.error('[collect-city-pois] fatal:', messageOf(error))
  process.exit(1)
})
