import { createHash } from 'node:crypto'
import {
  DATA_SOURCE_KINDS,
  createRawSnapshotId,
  createSourcedField,
  createUnavailableField,
  writeProviderSnapshot,
} from '../data-layer.mjs'

const PROVIDER = 'dianping'
const SEARCH_ENDPOINT = 'poisearch/search'
const DETAIL_ENDPOINT = 'poi/getsinglepoi'
const QUEUE_ENDPOINT = 'realtime/getcoopinfo'
export const DIANPING_POI_SEARCH_URL = 'https://poiopen.dianping.com/router/poisearch/search'
export const DIANPING_POI_DETAIL_URL = 'https://poiopen.dianping.com/router/poi/getsinglepoi'
export const DIANPING_REALTIME_QUEUE_URL = 'https://poiopen.dianping.com/router/realtime/getcoopinfo'
const DEFAULT_REPUTATION_TTL_MS = 24 * 60 * 60_000
const DEFAULT_QUEUE_TTL_MS = 2 * 60_000
const DEFAULT_MIN_INTERVAL_MS = 300
const MISSING_CONFIG_REASON = 'Dianping provider is disabled or not configured.'
const TRANSPORT_UNAVAILABLE_REASON = 'Dianping provider transport is not configured; production credentials and API permissions are required.'
let lastDianpingRequestAt = 0

export function signDianpingParams(params = {}, appSecret = '') {
  const secret = String(appSecret || '')
  const pairs = Object.entries(params)
    .map(([name, value]) => [String(name).toLowerCase(), value])
    .filter(([name, value]) => !['appsecret', 'appsecrect', 'sign'].includes(name) && value !== undefined && value !== null && String(value) !== '')
    .sort(([left], [right]) => {
      if (left < right) return -1
      if (left > right) return 1
      return 0
    })

  const signText = `${secret}${pairs.map(([name, value]) => `${name}${String(value)}`).join('')}${secret}`
  return createHash('md5').update(Buffer.from(signText, 'utf8')).digest('hex')
}

export const buildDianpingSignature = signDianpingParams

export function isDianpingConfigured(config = {}) {
  return isConfigured(normalizeConfig(config))
}

export async function searchDianpingPois(params = {}, options = {}) {
  const provider = createDianpingProvider(options.config || envDianpingConfig(), {
    requestJson: options.requestJson,
    fetch: options.fetch,
  })
  return provider.searchPois(params)
}

export function createDianpingProvider(config = {}, deps = {}) {
  const providerConfig = normalizeConfig(config)
  const requestJson = typeof deps.requestJson === 'function' ? deps.requestJson : createDianpingRequestJson(providerConfig, deps)

  return {
    buildSignedParams(params = {}) {
      return buildSignedParams(providerConfig, params)
    },
    async searchPois(params = {}) {
      const searchParams = buildDianpingSearchParams(params)
      return withProviderBoundary({
        config: providerConfig,
        endpoint: SEARCH_ENDPOINT,
        sourceId: sourceIdFromSearch(searchParams),
        params: searchParams,
        requestJson,
        normalize: normalizeSearchResult,
        unavailable: unavailableSearch,
      })
    },
    async getPoiDetail(params = {}) {
      const detailParams = buildDianpingOpenShopParams(params)
      return withProviderBoundary({
        config: providerConfig,
        endpoint: DETAIL_ENDPOINT,
        sourceId: sourceIdFromDetail(params),
        params: detailParams,
        requestJson,
        normalize: normalizeDetailResult,
        unavailable: unavailableDetail,
      })
    },
    async getQueue(params = {}) {
      const queueParams = buildDianpingOpenShopParams(params)
      return withProviderBoundary({
        config: providerConfig,
        endpoint: QUEUE_ENDPOINT,
        sourceId: sourceIdFromDetail(params),
        params: queueParams,
        requestJson,
        normalize: normalizeQueueResult,
        unavailable: unavailableQueue,
      })
    },
  }
}

async function withProviderBoundary({ config, endpoint, sourceId, params, requestJson, normalize, unavailable }) {
  const generatedAt = new Date().toISOString()
  const rawSnapshotId = createRawSnapshotId(`dianping_${endpoint.replace(/\//g, '_')}`)

  if (!isConfigured(config)) {
    return unavailable({
      config,
      rawSnapshotId,
      generatedAt,
      sourceId,
      reason: MISSING_CONFIG_REASON,
      status: 'missing-config',
      request: redactRequest(params),
    })
  }

  if (!requestJson) {
    return unavailable({
      config,
      rawSnapshotId,
      generatedAt,
      sourceId,
      reason: TRANSPORT_UNAVAILABLE_REASON,
      status: 'unavailable',
      request: redactRequest(params),
    })
  }

  try {
    const signedParams = buildSignedParams(config, params)
    const raw = await requestJson({ endpoint, url: dianpingEndpointUrl(endpoint), params: signedParams })
    const result = normalize({ config, raw, rawSnapshotId, generatedAt, sourceId, request: redactRequest(params) })
    writeSnapshot(config, {
      rawSnapshotId,
      sourceEndpoint: endpoint,
      sourceId,
      fetchedAt: generatedAt,
      expiresAt: result.expiresAt,
      stale: false,
      unavailableReason: null,
      request: redactRequest(params),
      raw,
    })
    return result
  } catch (error) {
    return unavailable({
      config,
      rawSnapshotId,
      generatedAt,
      sourceId,
      reason: providerErrorReason(error),
      status: 'unavailable',
      request: redactRequest(params),
    })
  }
}

function normalizeConfig(config = {}) {
  const appKey = String(config.appKey || '')
  const appSecret = String(config.appSecret || '')
  const session = String(config.session || '')
  const enabledValue = config.enabled ?? config.dianpingEnabled
  const hasCredentials = Boolean(appKey && appSecret && session)
  return {
    enabled: enabledValue === undefined || String(enabledValue).trim() === '' ? hasCredentials : parseEnabled(enabledValue),
    appKey,
    appSecret,
    session,
    snapshotDir: config.snapshotDir,
    auditLog: config.auditLog,
    reputationTtlMs: positiveNumber(config.cacheTtlMs ?? config.reputationTtlMs, DEFAULT_REPUTATION_TTL_MS),
    queueTtlMs: positiveNumber(config.queueTtlMs, DEFAULT_QUEUE_TTL_MS),
    minIntervalMs: positiveNumber(config.minIntervalMs, DEFAULT_MIN_INTERVAL_MS),
  }
}

function parseEnabled(value) {
  if (value === true) return true
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function isConfigured(config) {
  return Boolean(config.enabled && config.appKey && config.appSecret && config.session)
}

function buildSignedParams(config, params = {}) {
  const signedParams = {
    ...normalizeParamKeys(removeEmptyValues(params)),
    appkey: config.appKey,
    session: config.session,
    timestamp: params.timestamp || String(Date.now()),
  }
  return {
    ...signedParams,
    sign: signDianpingParams(signedParams, config.appSecret),
  }
}

function buildDianpingSearchParams(params = {}) {
  const categories = Array.isArray(params.categories)
    ? params.categories.map(String).filter(Boolean).join(',')
    : String(params.categories || '').trim()
  const radius = finiteNumber(params.radius)
    ? clampNumber(params.radius, 1, 5000, undefined)
    : finiteNumber(params.maxDistance)
      ? clampNumber(Math.round(Number(params.maxDistance) * 1000), 1, 5000, undefined)
      : undefined

  return removeEmptyValues({
    keyword: String(params.keyword || params.query || '').trim(),
    city: String(params.cityName || params.city || '').trim(),
    categories,
    latitude: finiteNumber(params.lat ?? params.latitude) ? Number(params.lat ?? params.latitude) : undefined,
    longitude: finiteNumber(params.lng ?? params.longitude) ? Number(params.lng ?? params.longitude) : undefined,
    radius,
    page: clampNumber(params.page, 1, 10, 1),
    limit: clampNumber(params.limit, 1, 25, 25),
    timestamp: params.timestamp,
  })
}

function buildDianpingOpenShopParams(params = {}) {
  const openshopid = String(
    params.openshopid || params.openShopId || params.sourceId || params.id || params.shopId || params.poiId || '',
  ).trim()
  return removeEmptyValues({
    openshopid,
    timestamp: params.timestamp,
  })
}

function createDianpingRequestJson(config, deps = {}) {
  const fetchImpl = typeof deps.fetch === 'function' ? deps.fetch : globalThis.fetch
  if (typeof fetchImpl !== 'function') return null

  return async ({ endpoint, url, params }) => {
    await throttleDianping(config.minIntervalMs)
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams(Object.entries(params).map(([name, value]) => [name, String(value)])).toString(),
    })
    const text = await response.text()
    const json = parseJsonPayload(text)

    if (!response.ok) {
      throw new Error(`Dianping request failed (${response.status})`)
    }
    if (json && typeof json === 'object' && isDianpingErrorResponse(json)) {
      throw new Error(String(json.msg || json.message || json.error || 'Dianping API request failed'))
    }
    return json
  }
}

function dianpingEndpointUrl(endpoint) {
  if (endpoint === SEARCH_ENDPOINT) return DIANPING_POI_SEARCH_URL
  if (endpoint === DETAIL_ENDPOINT) return DIANPING_POI_DETAIL_URL
  if (endpoint === QUEUE_ENDPOINT) return DIANPING_REALTIME_QUEUE_URL
  return `dianping://${endpoint}`
}

function normalizeSearchResult({ config, raw, rawSnapshotId, generatedAt, sourceId }) {
  const pois = rawPois(raw).map((poi, index) => normalizeDianpingPoi(poi, {
    rawSnapshotId: `${rawSnapshotId}_${sanitizeId(sourceIdFromDianpingRaw(poi) || poi.name || index)}`,
    generatedAt,
    ttlMs: config.reputationTtlMs,
    sourceEndpoint: SEARCH_ENDPOINT,
  }))
  const expiresAt = new Date(Date.parse(generatedAt) + config.reputationTtlMs).toISOString()
  return {
    ok: true,
    status: 'ready',
    generatedAt,
    rawSnapshotId,
    expiresAt,
    source: PROVIDER,
    fields: {
      pois: createSourcedField(pois, sourcedMeta({
        endpoint: SEARCH_ENDPOINT,
        sourceId,
        rawSnapshotId,
        fetchedAt: generatedAt,
        expiresAt,
      })),
    },
    pois,
  }
}

function normalizeDetailResult({ config, raw, rawSnapshotId, generatedAt, sourceId }) {
  const poi = normalizePoi(rawPoi(raw), {
    rawSnapshotId,
    generatedAt,
    ttlMs: config.reputationTtlMs,
    sourceEndpoint: DETAIL_ENDPOINT,
    sourceId,
  })
  const expiresAt = new Date(Date.parse(generatedAt) + config.reputationTtlMs).toISOString()
  return {
    ok: true,
    status: 'ready',
    generatedAt,
    rawSnapshotId,
    expiresAt,
    source: PROVIDER,
    poi,
    fields: poi.fields,
  }
}

function normalizeQueueResult({ config, raw, rawSnapshotId, generatedAt, sourceId }) {
  const expiresAt = new Date(Date.parse(generatedAt) + config.queueTtlMs).toISOString()
  const queue = normalizeQueue(raw)
  return {
    ok: true,
    status: 'ready',
    generatedAt,
    rawSnapshotId,
    expiresAt,
    source: PROVIDER,
    fields: {
      queue: createSourcedField(queue, sourcedMeta({
        endpoint: QUEUE_ENDPOINT,
        sourceId,
        rawSnapshotId,
        fetchedAt: generatedAt,
        expiresAt,
        confidence: DATA_SOURCE_KINDS.realtimeObservation,
      })),
    },
  }
}

function unavailableSearch(context) {
  writeUnavailableSnapshot(SEARCH_ENDPOINT, context)
  return {
    ok: false,
    status: context.status,
    generatedAt: context.generatedAt,
    rawSnapshotId: context.rawSnapshotId,
    source: PROVIDER,
    warnings: [context.reason],
    fields: {
      pois: unavailableField(context.reason, {
        endpoint: SEARCH_ENDPOINT,
        sourceId: context.sourceId,
        rawSnapshotId: context.rawSnapshotId,
        fetchedAt: context.generatedAt,
      }),
    },
    pois: [],
  }
}

function unavailableDetail(context) {
  writeUnavailableSnapshot(DETAIL_ENDPOINT, context)
  const fields = unavailableDetailFields(context)
  return {
    ok: false,
    status: context.status,
    generatedAt: context.generatedAt,
    rawSnapshotId: context.rawSnapshotId,
    source: PROVIDER,
    warnings: [context.reason],
    poi: null,
    fields,
  }
}

function unavailableQueue(context) {
  writeUnavailableSnapshot(QUEUE_ENDPOINT, context)
  return {
    ok: false,
    status: context.status,
    generatedAt: context.generatedAt,
    rawSnapshotId: context.rawSnapshotId,
    source: PROVIDER,
    warnings: [context.reason],
    fields: {
      queue: unavailableField(context.reason, {
        endpoint: QUEUE_ENDPOINT,
        sourceId: context.sourceId,
        rawSnapshotId: context.rawSnapshotId,
        fetchedAt: context.generatedAt,
        confidence: DATA_SOURCE_KINDS.realtimeObservation,
      }),
    },
  }
}

function unavailableDetailFields(context) {
  const base = {
    sourceId: context.sourceId,
    rawSnapshotId: context.rawSnapshotId,
    fetchedAt: context.generatedAt,
  }
  return {
    reputation: unavailableField(context.reason, { ...base, endpoint: `${DETAIL_ENDPOINT}:reputation` }),
    commentCount: unavailableField(context.reason, { ...base, endpoint: `${DETAIL_ENDPOINT}:commentCount` }),
    rating: unavailableField(context.reason, { ...base, endpoint: DETAIL_ENDPOINT }),
    avgPrice: unavailableField(context.reason, { ...base, endpoint: `${DETAIL_ENDPOINT}:avgPrice` }),
    recommendedDishes: unavailableField(context.reason, { ...base, endpoint: `${DETAIL_ENDPOINT}:recommendedDishes` }),
    images: unavailableField(context.reason, { ...base, endpoint: `${DETAIL_ENDPOINT}:images` }),
    queue: unavailableField(context.reason, { ...base, endpoint: QUEUE_ENDPOINT, confidence: DATA_SOURCE_KINDS.realtimeObservation }),
  }
}

export function normalizeDianpingPoi(poi = {}, context = {}) {
  const rawSnapshotId = context.rawSnapshotId || createRawSnapshotId('dianping_poi')
  const fetchedAt = context.generatedAt || new Date().toISOString()
  const ttlMs = positiveNumber(context.ttlMs, DEFAULT_REPUTATION_TTL_MS)
  const expiresAt = new Date(Date.parse(fetchedAt) + ttlMs).toISOString()
  const rawSourceId = sourceIdFromDianpingRaw(poi)
  const sourceId = rawSourceId === 'unknown' ? String(context.sourceId || rawSourceId) : rawSourceId
  const sourceEndpoint = context.sourceEndpoint || SEARCH_ENDPOINT
  const name = normalizeDianpingName(poi)
  const rawCategory = String(poi.category || poi.categories || poi.shopcategoryname || poi.type || '').trim()
  const category = classifyDianpingCategory(rawCategory, name)
  const address = String(poi.shopaddress || poi.address || poi.addr || '').trim()
  const lng = finiteNumber(poi.longitude ?? poi.lng) ? Number(poi.longitude ?? poi.lng) : undefined
  const lat = finiteNumber(poi.latitude ?? poi.lat) ? Number(poi.latitude ?? poi.lat) : undefined
  const distance = normalizeDianpingDistance(poi.distance)
  const rating = finiteNumber(poi.rating ?? poi.score ?? poi.avgscore ?? poi.star) ? Number(poi.rating ?? poi.score ?? poi.avgscore ?? poi.star) : undefined
  const commentCount = finiteNumber(poi.commentCount ?? poi.reviewCount ?? poi.review_count) ? Number(poi.commentCount ?? poi.reviewCount ?? poi.review_count) : undefined
  const cost = finiteNumber(poi.avgPrice ?? poi.price ?? poi.avgprice) ? Number(poi.avgPrice ?? poi.price ?? poi.avgprice) : undefined
  const photos = normalizeDianpingPhotos(poi)
  const cover = photos[0]?.url || ''
  const field = (value, endpoint, confidence = DATA_SOURCE_KINDS.providerSnapshot) => createSourcedField(value, sourcedMeta({
    endpoint,
    sourceId,
    rawSnapshotId,
    fetchedAt,
    expiresAt,
    confidence,
  }))
  const unavailable = (reason, endpoint, confidence = DATA_SOURCE_KINDS.unavailable) => unavailableField(reason, {
    endpoint,
    sourceId,
    rawSnapshotId,
    fetchedAt,
    confidence,
  })

  return {
    id: sourceId,
    rawSnapshotId,
    sourceProvider: PROVIDER,
    sourceEndpoint,
    sourceId,
    fetchedAt,
    expiresAt,
    stale: Date.parse(expiresAt) <= Date.now(),
    name,
    type: rawCategory,
    category,
    address,
    city: String(poi.city || poi.cityname || '').trim(),
    district: String(poi.district || poi.adname || '').trim(),
    distance,
    lng,
    lat,
    rating,
    cost,
    reviewCount: commentCount,
    cover,
    imageUrl: cover,
    thumbnail: cover,
    photos,
    imageConfidence: cover ? 'poi-photo' : 'pending-review',
    imageSource: cover ? 'dianping-poi-photos' : 'pending-manual-review',
    imageVerifiedAt: fetchedAt,
    imagePendingReview: !cover,
    imageReviewReason: cover ? '' : 'Dianping POI search did not include a trusted photo URL.',
    openingHours: poi.openingHours || poi.opentime || '',
    fields: {
      name: name ? field(name, sourceEndpoint) : unavailable('Dianping POI name is unavailable', sourceEndpoint),
      category: category ? field(category, sourceEndpoint) : unavailable('Dianping POI category is unavailable', sourceEndpoint),
      address: address ? field(address, sourceEndpoint) : unavailable('Dianping POI address is unavailable', sourceEndpoint),
      distance: distance !== undefined ? field(distance, sourceEndpoint) : unavailable('Dianping POI distance is unavailable', sourceEndpoint),
      lng: lng !== undefined ? field(lng, sourceEndpoint) : unavailable('Dianping POI longitude is unavailable', sourceEndpoint),
      lat: lat !== undefined ? field(lat, sourceEndpoint) : unavailable('Dianping POI latitude is unavailable', sourceEndpoint),
      rating: rating !== undefined ? field(rating, sourceEndpoint) : unavailable('Dianping rating is unavailable', sourceEndpoint),
      commentCount: commentCount !== undefined ? field(commentCount, sourceEndpoint) : unavailable('Dianping comment count is unavailable', sourceEndpoint),
      avgPrice: cost !== undefined ? field(cost, sourceEndpoint) : unavailable('Dianping average price is unavailable', sourceEndpoint),
      images: photos.length > 0 ? field(photos, sourceEndpoint) : unavailable('Dianping images are unavailable', sourceEndpoint),
    },
    raw: poi,
  }
}

function normalizePoi(poi = {}, context) {
  const normalized = normalizeDianpingPoi(poi, {
    rawSnapshotId: context.rawSnapshotId,
    generatedAt: context.generatedAt,
    ttlMs: context.ttlMs,
    sourceEndpoint: context.sourceEndpoint || DETAIL_ENDPOINT,
    sourceId: context.sourceId,
  })
  const rawSnapshotId = context.rawSnapshotId
  const fetchedAt = context.generatedAt
  const expiresAt = new Date(Date.parse(fetchedAt) + context.ttlMs).toISOString()
  const sourceEndpoint = context.sourceEndpoint || DETAIL_ENDPOINT
  const sourceId = normalized.sourceId
  const recommendedDishes = normalizeDianpingDishes(poi)
  const images = normalizeDianpingPhotos(poi)
  const queue = normalizeDetailQueue(poi)
  const field = (value, endpoint, confidence = DATA_SOURCE_KINDS.providerSnapshot) => createSourcedField(value, sourcedMeta({
    endpoint,
    sourceId,
    rawSnapshotId,
    fetchedAt,
    expiresAt,
    confidence,
  }))
  const unavailable = (reason, endpoint, confidence = DATA_SOURCE_KINDS.unavailable) => unavailableField(reason, {
    endpoint,
    sourceId,
    rawSnapshotId,
    fetchedAt,
    confidence,
  })

  return {
    ...normalized,
    fields: {
      ...normalized.fields,
      reputation: hasText(poi.reputation ?? poi.shopDesc) ? field(String(poi.reputation ?? poi.shopDesc), `${sourceEndpoint}:reputation`) : unavailable('Dianping reputation is unavailable', `${sourceEndpoint}:reputation`),
      commentCount: finiteNumber(poi.commentCount ?? poi.reviewCount) ? field(Number(poi.commentCount ?? poi.reviewCount), `${sourceEndpoint}:commentCount`) : unavailable('Dianping comment count is unavailable', `${sourceEndpoint}:commentCount`),
      rating: finiteNumber(poi.rating ?? poi.score ?? poi.star) ? field(Number(poi.rating ?? poi.score ?? poi.star), sourceEndpoint) : unavailable('Dianping rating is unavailable', sourceEndpoint),
      avgPrice: finiteNumber(poi.avgPrice ?? poi.price ?? poi.avgprice) ? field(Number(poi.avgPrice ?? poi.price ?? poi.avgprice), `${sourceEndpoint}:avgPrice`) : unavailable('Dianping average price is unavailable', `${sourceEndpoint}:avgPrice`),
      recommendedDishes: recommendedDishes.length > 0 ? field(recommendedDishes, `${sourceEndpoint}:recommendedDishes`) : unavailable('Dianping recommended dishes are unavailable', `${sourceEndpoint}:recommendedDishes`),
      images: images.length > 0 ? field(images, `${sourceEndpoint}:images`) : unavailable('Dianping images are unavailable', `${sourceEndpoint}:images`),
      queue: queue ? field(queue, QUEUE_ENDPOINT, DATA_SOURCE_KINDS.realtimeObservation) : unavailable('Dianping queue data is unavailable', QUEUE_ENDPOINT, DATA_SOURCE_KINDS.realtimeObservation),
    },
    raw: poi,
  }
}

function normalizeQueue(raw = {}) {
  const source = raw.data?.queueInfo || raw.queueInfo || raw.queue || raw
  const text = String(source.msg || source.shortMsg || source.text || source.description || '')
  return {
    status: String(source.status || source.queueStatus || source.shortMsg || source.msg || ''),
    waitingMinutes: finiteNumber(source.waitingMinutes ?? source.waitMinutes) ? Number(source.waitingMinutes ?? source.waitMinutes) : null,
    waitingTables: finiteNumber(source.waitingTables ?? source.tableCount) ? Number(source.waitingTables ?? source.tableCount) : null,
    fetchedText: text,
  }
}

function normalizeDetailQueue(poi = {}) {
  if (poi.queue || poi.queueInfo || poi.data?.queueInfo) return normalizeQueue(poi)
  if (poi.queueable === true || poi.queueable === 1 || poi.queueable === 'true' || poi.queueable === '1') {
    return {
      status: 'queueable',
      waitingMinutes: null,
      waitingTables: null,
      fetchedText: '支持排号',
    }
  }
  return null
}

function normalizeImage(image) {
  if (typeof image === 'string') return image
  const url = String(image?.url || image?.imageUrl || image?.picUrl || '').trim()
  if (!url) return null
  return {
    url,
    title: String(image?.title || ''),
  }
}

function normalizeDianpingDishes(poi = {}) {
  const dishes = poi.recommendedDishes ?? poi.dishes ?? poi.dishs
  if (!Array.isArray(dishes)) return []
  return dishes
    .map((dish) => {
      if (typeof dish === 'string') return dish
      return String(dish?.dishName || dish?.name || dish?.title || '').trim()
    })
    .filter(Boolean)
}

function rawPois(raw = {}) {
  if (Array.isArray(raw)) return raw
  if (Array.isArray(raw.records)) return raw.records
  if (Array.isArray(raw.pois)) return raw.pois
  if (Array.isArray(raw.shops)) return raw.shops
  if (Array.isArray(raw.shoplist)) return raw.shoplist
  if (Array.isArray(raw.data?.records)) return raw.data.records
  if (Array.isArray(raw.data?.pois)) return raw.data.pois
  if (Array.isArray(raw.data?.shops)) return raw.data.shops
  if (Array.isArray(raw.data?.shoplist)) return raw.data.shoplist
  if (Array.isArray(raw.result?.pois)) return raw.result.pois
  if (Array.isArray(raw.result?.shops)) return raw.result.shops
  return []
}

function rawPoi(raw = {}) {
  if (raw.poi || raw.shop) return raw.poi || raw.shop
  if (raw.data?.poi || raw.data?.shop) return raw.data.poi || raw.data.shop
  if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) return raw.data
  return raw
}

function writeUnavailableSnapshot(endpoint, context) {
  writeSnapshot(context.config, {
    rawSnapshotId: context.rawSnapshotId,
    sourceEndpoint: endpoint,
    sourceId: context.sourceId,
    fetchedAt: context.generatedAt,
    expiresAt: context.generatedAt,
    stale: true,
    unavailableReason: context.reason,
    request: context.request,
  })
}

function writeSnapshot(config, snapshot) {
  return writeProviderSnapshot({
    sourceProvider: PROVIDER,
    ...snapshot,
  }, {
    snapshotDir: config.snapshotDir,
    auditLog: config.auditLog,
  })
}

function sourcedMeta({ endpoint, sourceId, rawSnapshotId, fetchedAt, expiresAt, confidence = DATA_SOURCE_KINDS.providerSnapshot }) {
  return {
    sourceProvider: PROVIDER,
    sourceEndpoint: endpoint,
    sourceId: sourceId || 'unknown',
    fetchedAt,
    expiresAt,
    confidence,
    rawSnapshotId,
  }
}

function unavailableField(reason, { endpoint, sourceId, rawSnapshotId, fetchedAt, confidence = DATA_SOURCE_KINDS.unavailable }) {
  return createUnavailableField(reason, {
    sourceProvider: PROVIDER,
    sourceEndpoint: endpoint,
    sourceId: sourceId || 'unknown',
    fetchedAt,
    expiresAt: fetchedAt,
    confidence,
    rawSnapshotId,
  })
}

function sourceIdFromSearch(params = {}) {
  return [params.cityName || params.city || '', params.keyword || params.query || ''].map((value) => String(value).trim()).filter(Boolean).join(':') || 'search'
}

function sourceIdFromDetail(params = {}) {
  return String(params.sourceId || params.id || params.shopId || params.poiId || params.name || 'unknown').trim() || 'unknown'
}

function redactRequest(params = {}) {
  return {
    keyword: String(params.keyword || params.query || ''),
    cityName: String(params.cityName || params.city || ''),
    categories: Array.isArray(params.categories) ? params.categories.map(String) : String(params.categories || ''),
    latitude: finiteNumber(params.lat ?? params.latitude) ? Number(params.lat ?? params.latitude) : undefined,
    longitude: finiteNumber(params.lng ?? params.longitude) ? Number(params.lng ?? params.longitude) : undefined,
    radius: finiteNumber(params.radius) ? Number(params.radius) : undefined,
    sourceId: String(params.sourceId || params.id || params.shopId || params.poiId || ''),
    name: String(params.name || ''),
  }
}

function envDianpingConfig(env = process.env) {
  return {
    enabled: env.DIANPING_ENABLED,
    appKey: env.DIANPING_APP_KEY,
    appSecret: env.DIANPING_APP_SECRET,
    session: env.DIANPING_SESSION,
    cacheTtlMs: env.DIANPING_CACHE_TTL_MS,
    minIntervalMs: env.DIANPING_MIN_INTERVAL_MS,
  }
}

function sourceIdFromDianpingRaw(poi = {}) {
  return String(poi.openshopid || poi.openShopId || poi.shopid || poi.shopId || poi.id || poi.poiId || poi.name || 'unknown').trim() || 'unknown'
}

function normalizeDianpingName(poi = {}) {
  const name = String(poi.name || poi.shopname || poi.shopName || '').trim()
  const branch = String(poi.branchname || poi.branchName || poi.branch_name || '').trim()
  if (!name) return branch
  if (!branch || name.includes(branch)) return name
  return `${name}（${branch}）`
}

function classifyDianpingCategory(category, name = '') {
  const text = `${category} ${name}`
  if (/餐|菜|火锅|烧烤|咖啡|茶|酒楼|饭|面|小吃|美食|甜品|烘焙|料理|牛排|自助|店/i.test(text)) return '美食'
  if (/商场|购物|超市|百货|市场|商业|奥莱/i.test(text)) return '购物'
  if (/博物馆|美术馆|剧院|展览|文化|艺术|书店|图书馆/i.test(text)) return '文化艺术'
  if (/儿童|亲子|乐园|游乐|动物园|海洋馆/i.test(text)) return '亲子游'
  if (/公园|湿地|森林|自然|花园|植物园/i.test(text)) return '公园自然'
  if (/古|遗址|纪念|寺|庙|城墙|历史/i.test(text)) return '历史遗迹'
  if (/酒吧|夜店|KTV|夜市|live|club/i.test(text)) return '夜生活'
  return '景点'
}

function normalizeDianpingDistance(value) {
  if (!finiteNumber(value)) return undefined
  const distance = Number(value)
  if (distance > 100) return Math.round((distance / 1000) * 100) / 100
  return Math.round(distance * 100) / 100
}

function normalizeDianpingPhotos(poi = {}) {
  const candidates = []
  const images = poi.images ?? poi.photos ?? poi.shopPics ?? poi.photoUrls ?? poi.pic_url ?? poi.defaultpic
  if (poi.headPic) candidates.push(poi.headPic)
  if (Array.isArray(images)) candidates.push(...images)
  else if (images) candidates.push(images)

  return candidates
    .map(normalizeImage)
    .filter((image) => image && /^https?:\/\//i.test(typeof image === 'string' ? image : image.url))
    .map((image) => (typeof image === 'string' ? { url: image, title: '' } : image))
}

function normalizeParamKeys(params = {}) {
  return Object.fromEntries(Object.entries(params).map(([name, value]) => [String(name).toLowerCase(), value]))
}

function removeEmptyValues(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && String(value) !== ''),
  )
}

function parseJsonPayload(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Dianping API returned invalid JSON')
  }
}

function isDianpingErrorResponse(json) {
  if (json.success === true) return false
  if (json.success === false) return true

  const status = String(json.status ?? '').trim().toLowerCase()
  if (['ok', 'success'].includes(status)) return false
  if (status && !['0', '1', '200'].includes(status)) return true

  const code = json.code ?? json.errorCode ?? json.errcode
  if (code === undefined || code === null || code === '') return false
  return !['0', '1', '200', 0, 1, 200, 'success', 'SUCCESS'].includes(code)
}

function providerErrorReason(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  if (/permission|unauthorized|forbidden|401|403|scope|权限/i.test(message)) return 'Dianping API permission is unavailable.'
  if (/quota|limit|429/i.test(message)) return 'Dianping API quota is unavailable.'
  if (/timeout|aborted/i.test(message)) return 'Dianping API timed out.'
  return 'Dianping API is unavailable.'
}

function positiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function positiveInteger(value, fallback) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function finiteNumber(value) {
  return Number.isFinite(Number(value))
}

function hasText(value) {
  return String(value || '').trim().length > 0
}

async function throttleDianping(minIntervalMs) {
  const elapsed = Date.now() - lastDianpingRequestAt
  const delay = Number(minIntervalMs || 0) - elapsed
  if (delay > 0) await new Promise((resolveWait) => setTimeout(resolveWait, delay))
  lastDianpingRequestAt = Date.now()
}

function sanitizeId(value) {
  return String(value || 'item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item'
}
