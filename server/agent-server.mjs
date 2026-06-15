import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DATA_SOURCE_KINDS,
  createRawSnapshotId,
  createSourcedField,
  createUnavailableField,
  readAuditRecord,
  sanitizeDerivedRecommendation,
  wrapPoiAsSourced,
  writeProviderSnapshot,
} from './data-layer.mjs'
import { createDianpingProvider, isDianpingConfigured } from './providers/dianping-provider.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PORT = Number(process.env.AGENT_PORT || 8787)

if (process.env.AGENT_LOAD_DOTENV !== '0') {
  loadDotEnv(resolve(ROOT, '.env'))
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]
const LOCAL_DEV_ORIGIN_PORTS = new Set(['5173', '5174', '5175', '5176', '5177', '5178', '5179', '4173', '4174', '4175', '4176'])
const MAX_JSON_BODY_BYTES = 1024 * 1024
const DEFAULT_LLM_PROVIDER = 'deepseek'
const LLM_PROVIDER_CONFIG = {
  deepseek: {
    label: 'DeepSeek',
    source: 'deepseek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    supportsJsonResponseFormat: true,
  },
  longcat: {
    label: 'LongCat',
    source: 'longcat',
    apiKeyEnv: 'LONGCAT_API_KEY',
    baseUrlEnv: 'LONGCAT_BASE_URL',
    defaultBaseUrl: 'https://api.longcat.chat/openai/v1',
    defaultModel: 'LongCat-2.0-Preview',
    supportsJsonResponseFormat: false,
  },
}
const selectedLlmProvider = normalizeLlmProvider(process.env.LLM_PROVIDER)
const selectedLlmProviderConfig = LLM_PROVIDER_CONFIG[selectedLlmProvider]

const config = {
  authMode: process.env.AGENT_AUTH_MODE || (process.env.NODE_ENV === 'production' ? 'production' : 'demo'),
  productionAuthReady: process.env.AGENT_PRODUCTION_AUTH_READY === '1',
  llmProvider: selectedLlmProvider,
  llmModel: process.env.LLM_MODEL || selectedLlmProviderConfig.defaultModel,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekBaseUrl: trimTrailingSlash(process.env.DEEPSEEK_BASE_URL || LLM_PROVIDER_CONFIG.deepseek.defaultBaseUrl),
  longcatApiKey: process.env.LONGCAT_API_KEY || '',
  longcatBaseUrl: trimTrailingSlash(process.env.LONGCAT_BASE_URL || LLM_PROVIDER_CONFIG.longcat.defaultBaseUrl),
  amapKey: process.env.AMAP_WEB_SERVICE_KEY || '',
  dianpingEnabled: process.env.DIANPING_ENABLED || '',
  dianpingAppKey: process.env.DIANPING_APP_KEY || '',
  dianpingAppSecret: process.env.DIANPING_APP_SECRET || '',
  dianpingSession: process.env.DIANPING_SESSION || '',
  dianpingCacheTtlMs: parsePositiveNumber(process.env.DIANPING_CACHE_TTL_MS, 10 * 60_000),
  dianpingMinIntervalMs: parsePositiveNumber(process.env.DIANPING_MIN_INTERVAL_MS, 300),
  apiToken: process.env.AGENT_API_TOKEN || '',
  browserAgentToken: process.env.VITE_AGENT_API_TOKEN || '',
  allowedOrigins: resolveAllowedOrigins(process.env.AGENT_ALLOWED_ORIGINS),
  rateLimitWindowMs: parsePositiveNumber(process.env.AGENT_RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: parsePositiveNumber(process.env.AGENT_RATE_LIMIT_MAX, 30),
  amapCacheTtlMs: parsePositiveNumber(process.env.AGENT_AMAP_CACHE_TTL_MS, 10 * 60_000),
  amapMinIntervalMs: parsePositiveNumber(process.env.AGENT_AMAP_MIN_INTERVAL_MS, 250),
}

const startupError = validateProductionAuthConfig(config)
if (startupError) {
  console.error(startupError)
  process.exit(1)
}

const PLAN_TYPES = ['效率优先', '体验优先', '预算优先']
const DEFAULT_COVERS = ['', '', '']
const PLACE_IMAGE_PLACEHOLDER_RE =
  /(?:picsum\.photos|placehold\.co|placeholder\.com|dummyimage\.com|loremflickr\.com|source\.unsplash\.com\/random)/i
const CITY_META_SOURCE = resolve(ROOT, 'src/data/china-prefecture-cities.json')
const CITY_META = loadCityMeta(CITY_META_SOURCE)
const REALTIME_DATA_SOURCES = {
  poi: '高德地图 POI 搜索接口',
  route: '高德地图路径规划接口',
  weather: '高德天气查询接口',
  traffic: '高德交通态势查询接口',
  crowd: '暂无官方实时数据源',
  queue: '暂无官方实时数据源',
  ai: `${llmProviderLabel()} 智能体基于实时接口结果生成`,
}
const CATEGORY_SEARCH_TERMS = {
  景点: ['景区', '风景名胜', '地标'],
  美食: ['老字号', '特色餐厅', '小吃', '本地菜'],
  文化艺术: ['博物馆', '美术馆', '剧院', '文化馆'],
  购物: ['商场', '步行街', '商业街'],
  亲子游: ['动物园', '科技馆', '游乐园', '海洋馆'],
  公园自然: ['公园', '湿地', '森林公园', '山'],
  历史遗迹: ['古城', '遗址', '寺庙', '古建筑', '纪念馆'],
  夜生活: ['夜市', '酒吧街', '夜游'],
}
const rateLimitBuckets = new Map()
const amapCache = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitBuckets) {
    if (now >= value.resetAt) rateLimitBuckets.delete(key)
  }
}, 60_000).unref()
const notificationReadState = new Map()
const dianpingProvider = createDianpingProvider({
  enabled: config.dianpingEnabled,
  appKey: config.dianpingAppKey,
  appSecret: config.dianpingAppSecret,
  session: config.dianpingSession,
  cacheTtlMs: config.dianpingCacheTtlMs,
  minIntervalMs: config.dianpingMinIntervalMs,
})
const dianpingConfigured = isDianpingConfigured({
  enabled: config.dianpingEnabled,
  appKey: config.dianpingAppKey,
  appSecret: config.dianpingAppSecret,
  session: config.dianpingSession,
})
let lastAmapRequestAt = 0
let realtimeLogSequence = 0

const server = createServer(async (req, res) => {
  const corsAllowed = setCors(req, res)

  if (req.method === 'OPTIONS') {
    res.writeHead(corsAllowed ? 204 : 403)
    res.end()
    return
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (!corsAllowed) {
      sendJson(req, res, 403, { ok: false, error: 'Origin is not allowed' })
      return
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(req, res, 200, {
        ok: true,
        service: 'zhixing-agent',
        provider: config.llmProvider,
        model: config.llmModel,
        authMode: config.authMode,
        llmConfigured: isLlmConfigured(),
        deepseekConfigured: Boolean(config.deepseekApiKey),
        longcatConfigured: Boolean(config.longcatApiKey),
        amapConfigured: Boolean(config.amapKey),
        authConfigured: Boolean(config.apiToken),
        dianpingConfigured,
      })
      return
    }

    let authenticatedSubject = 'anonymous'
    if (isProtectedAgentPath(url.pathname)) {
      const auth = authenticateAgentRequest(req)
      if (!auth.ok) {
        sendJson(req, res, auth.status, { ok: false, error: auth.error })
        return
      }
      authenticatedSubject = auth.subject

      const rateLimitBucket = rateLimitBucketForPath(url.pathname)
      const rateLimit = checkRateLimit(auth.subject, rateLimitBucket)
      setRateLimitHeaders(res, rateLimit)
      if (!rateLimit.allowed) {
        sendJson(req, res, 429, { ok: false, error: 'Too many requests' })
        return
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/agent/plan') {
      const body = await readJson(req)
      const result = await generatePlans(body?.draft || body)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/agent/chat') {
      const body = await readJson(req)
      if (!String(body?.question || '').trim()) {
        sendJson(req, res, 400, { ok: false, error: 'question is required' })
        return
      }
      const result = await chatWithAgent(body)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/agent/search') {
      const body = await readJson(req)
      const result = await searchPois(body)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/agent/realtime') {
      const body = await readJson(req)
      const result = await getRealtimeSnapshot(body)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/data/pois/search') {
      const body = await readJson(req)
      const result = await searchSourcedPois(body)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/data/pois/detail') {
      const body = await readJson(req)
      const result = await getSourcedPoiDetail(body)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/data/realtime/snapshot') {
      const body = await readJson(req)
      const result = await getRealtimeSnapshot(body)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/data/dianping/pois/search') {
      const body = await readJson(req)
      const result = await dianpingProvider.searchPois(body)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/data/dianping/pois/detail') {
      const body = await readJson(req)
      const result = await dianpingProvider.getPoiDetail(body)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/data/dianping/realtime/queue') {
      const body = await readJson(req)
      const result = await dianpingProvider.getQueue(body)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/data/audit/')) {
      const rawSnapshotId = decodeURIComponent(url.pathname.slice('/api/data/audit/'.length))
      const record = readAuditRecord(rawSnapshotId)
      sendJson(req, res, record ? 200 : 404, record ? { ok: true, record } : { ok: false, error: 'Audit record not found' })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/agent/notifications') {
      const body = await readJson(req)
      const result = getSystemNotifications(body, authenticatedSubject)
      sendJson(req, res, 200, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/agent/notifications/read') {
      const body = await readJson(req)
      const result = markSystemNotificationRead(body, authenticatedSubject)
      sendJson(req, res, 200, result)
      return
    }

    sendJson(req, res, 404, { ok: false, error: 'Not found' })
  } catch (error) {
    console.error('[agent-server] request failed:', messageOf(error))
    sendJson(req, res, statusOf(error), {
      ok: false,
      error: publicErrorMessage(error),
    })
  }
})

server.listen(PORT, () => {
  console.log(`Zhixing Agent service listening on http://localhost:${PORT}`)
})

async function generatePlans(draft = {}) {
  const warnings = []
  const candidates = await collectPoiCandidates(draft, warnings)

  try {
    const content = await generatePlanJson(draft, candidates)
    const parsed = await parseOrRepairPlanJson(content)
    const plans = normalizePlans(parsed?.plans, draft, candidates)
    return { ok: true, source: llmSource(), warnings, candidates, plans }
  } catch (error) {
    warnings.push(`LLM fallback: ${messageOf(error)}`)
    return {
      ok: true,
      source: candidates.length > 0 ? 'amap-fallback' : 'local-fallback',
      warnings,
      candidates,
      plans: fallbackPlans(draft, candidates),
    }
  }
}

async function generatePlanJson(draft, candidates) {
  const messages = [
    {
      role: 'system',
      content:
        '你是“智行路线”的旅行路线规划 Agent。你必须只输出合法 json，不要 Markdown，不要解释文字。json 顶层格式必须是 {"plans":[...]}。',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          task:
            '生成 3 套路线方案，分别对应“效率优先”“体验优先”“预算优先”。只返回 json。内容必须简短，避免长段描述。',
          jsonExample: {
            plans: [
              {
                id: 'agent-efficient',
                type: '效率优先',
                name: '高效精华路线',
                recommended: true,
                days: 2,
                totalDuration: '约 15 小时',
                budget: 900,
                distance: 12.6,
                satisfaction: 94,
                tags: ['动线最优', '少走回头路'],
                summary: '用更少通勤串联核心点位。',
                aiReason: '根据用户偏好、预算和交通约束，优先串联评分较高且动线相近的候选点位。',
                stops: [
                  { poiId: 'poi-id', name: '景点名', order: 1 },
                ],
              },
            ],
          },
          constraints: draft,
          candidatePois: candidates.slice(0, 12).map((poi) => ({
            id: poi.id,
            name: poi.name,
            type: poi.type,
            district: poi.district,
            rating: poi.rating,
            cost: poi.cost,
          })),
          strictRules: [
            'type 必须是 效率优先、体验优先、预算优先 之一',
            'recommended 只能有一个 true',
            'budget 为数字，distance 为数字，satisfaction 为 0-100 数字',
            '每个方案 stops 数量固定 4 个，order 从 1 开始',
            'stops 只输出 poiId、name、order，不要输出 cover',
            'summary 不超过 45 个汉字',
            'aiReason 必须说明该方案如何匹配 constraints 和 candidatePois，不超过 70 个汉字',
            'tags 每个方案最多 3 个，每个标签不超过 6 个汉字',
            '优先使用 candidatePois 里的 id、name',
            '所有文本使用简体中文',
          ],
        },
        null,
        2,
      ),
    },
  ]

  try {
    return await callLlm(messages, { json: true, maxTokens: 4200 })
  } catch (error) {
    if (!String(messageOf(error)).includes('no content')) throw error
    return callLlm(
      [
        ...messages,
        {
          role: 'user',
          content:
            '上一次返回为空。请重新生成，严格只输出 json，格式为 {"plans":[...]}，不要空白内容。',
        },
      ],
      { json: true, maxTokens: 4200 },
    )
  }
}

async function parseOrRepairPlanJson(content) {
  try {
    return parseJsonObject(content)
  } catch (error) {
    const repaired = await callLlm(
      [
        {
          role: 'system',
          content:
            '你是 JSON 修复器。只输出合法 json，不要 Markdown，不要解释。顶层必须是 {"plans":[...]}。',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task:
              '下面是一个可能被截断或格式错误的路线方案 json。请修复为合法 json，保留 3 个 plans，每个 plan 4 个 stops。stops 只保留 poiId、name、order。',
            invalidJson: content.slice(0, 8000),
            requiredTopLevel: '{"plans":[...]}',
          }),
        },
      ],
      { json: true, maxTokens: 4200 },
    )
    try {
      return parseJsonObject(repaired)
    } catch {
      throw error
    }
  }
}

async function chatWithAgent(body = {}) {
  const question = String(body.question || '').trim()
  if (!question) {
    return { ok: false, error: 'question is required' }
  }

  try {
    const content = await callLlm([
      {
        role: 'system',
        content:
          '你是“智行助手”，负责回答旅行路线、交通、预算、景点安排和实时调整问题。回答要短、具体、可执行。若请求中包含 realtime 字段，必须只依据 realtime 与 trip 回答；缺少实时数据时明确说暂无实时数据，不得补充未经接口返回的城市、交通、天气、排队、费用或耗时估算。',
      },
      {
        role: 'user',
        content: JSON.stringify({
          question,
          trip: body.trip || null,
          draft: body.draft || null,
          realtime: body.realtime || null,
          currentLocation: normalizeCurrentLocation(body.currentLocation),
          recentMessages: (body.messages || []).slice(-10),
        }),
      },
    ], { maxTokens: 700 })

    return { ok: true, source: llmSource(), reply: content.trim() }
  } catch (error) {
    return {
      ok: true,
      source: 'local-fallback',
      warnings: [`LLM fallback: ${messageOf(error)}`],
      reply:
        '我已收到你的问题。当前智能体服务暂时无法完成模型调用，建议先按公共交通优先、预留 15-30 分钟缓冲、避开高峰排队的原则调整行程。',
    }
  }
}

async function searchPois(body = {}) {
  const keyword = String(body.keyword || '').trim()
  const cityName = String(body.cityName || '').trim()
  const categories = Array.isArray(body.categories) ? body.categories.filter(Boolean) : []
  const minRating = normalizeNumber(body.minRating, 0)
  const maxDistance = normalizeNumber(body.maxDistance, 40)
  const provider = normalizeSearchProvider(body.provider)
  const warnings = []

  const results = []

  if (provider === 'auto' || provider === 'amap') {
    if (!config.amapKey) {
      warnings.push('AMap search is not configured')
    } else {
      const searchQueries = buildAmapSearchQueries({ keyword, cityName, categories })
      for (const query of searchQueries) {
        try {
          const pois = await searchAmapPois({ city: query.city, keyword: query.keyword, offset: 20 })
          results.push(...pois)
        } catch (error) {
          warnings.push(`AMap ${query.keyword}: ${externalWarning(error)}`)
        }
      }
    }
  }

  if (provider === 'auto' || provider === 'dianping') {
    try {
      const dianpingResult = await dianpingProvider.searchPois({
        keyword,
        cityName,
        categories,
        lng: body.lng,
        lat: body.lat,
        radius: finitePositiveNumber(body.radius) ?? Math.round(maxDistance * 1000),
        page: body.page,
        limit: body.limit || 20,
      })
      if (dianpingResult.ok && Array.isArray(dianpingResult.pois)) {
        results.push(...dianpingResult.pois)
      } else {
        warnings.push(...(dianpingResult.warnings || ['Dianping search is unavailable']))
      }
    } catch (error) {
      warnings.push(`Dianping search: ${externalWarning(error)}`)
    }
  }

  const pois = mergePoiSearchResults(results)
    .filter((poi) => isRelevantCityPoi(poi, cityName))
    .filter((poi) => matchesPoiCategoryFilter(poi, categories))
    .filter((poi) => !minRating || !poi.rating || poi.rating >= minRating)
    .filter((poi) => !poi.distance || poi.distance <= maxDistance)
    .filter((poi) => scorePoiSearchResult(poi, keyword, cityName) >= -10)
    .sort((left, right) => scorePoiSearchResult(right, keyword, cityName) - scorePoiSearchResult(left, keyword, cityName))
    .slice(0, 30)

  return { ok: true, source: searchResultSource(pois), pois, warnings }
}

function normalizeSearchProvider(value) {
  return ['auto', 'amap', 'dianping'].includes(value) ? value : 'auto'
}

function mergePoiSearchResults(results = []) {
  const byProviderId = uniqueBy(results, (poi) => {
    const provider = String(poi.sourceProvider || (String(poi.id || '').startsWith('dp-') ? 'dianping' : 'amap')).trim()
    const sourceId = String(poi.sourceId || poi.id || '').trim()
    return sourceId ? `${provider}:${sourceId}` : `${provider}:${poi.name}|${poi.address}`
  })
  const seenPlaces = new Set()
  const merged = []

  for (const poi of byProviderId) {
    const placeKey = normalizePoiPlaceKey(poi)
    if (placeKey && seenPlaces.has(placeKey)) continue
    if (placeKey) seenPlaces.add(placeKey)
    merged.push(poi)
  }

  return merged
}

function normalizePoiPlaceKey(poi = {}) {
  const name = normalizeRegionName(poi.name)
  const address = normalizeRegionName(poi.address)
  if (!name || !address) return ''
  return `${name}|${address}`
}

function searchResultSource(pois = []) {
  const providers = new Set(
    pois
      .map((poi) => String(poi.sourceProvider || '').trim())
      .filter((sourceProvider) => ['amap', 'dianping'].includes(sourceProvider)),
  )
  if (providers.size > 1) return 'multi-provider'
  if (providers.has('dianping')) return 'dianping'
  if (providers.has('amap')) return 'amap'
  return 'local-fallback'
}

function providerSearchEndpoint(sourceProvider) {
  if (sourceProvider === 'amap') return 'place/text'
  if (sourceProvider === 'dianping') return 'poisearch/search'
  if (sourceProvider === 'multi-provider') return 'pois/search'
  return 'local-fallback'
}

function providerCacheTtlMs(sourceProvider) {
  if (sourceProvider === 'dianping') return config.dianpingCacheTtlMs
  return config.amapCacheTtlMs
}

async function searchSourcedPois(body = {}) {
  const generatedAt = new Date().toISOString()
  const result = await searchPois(body)
  const rawSnapshotId = createRawSnapshotId('poi_search')
  const searchReady = result.source !== 'local-fallback'
  const sourceProvider = searchReady ? result.source : DATA_SOURCE_KINDS.unavailable
  const sourceEndpoint = searchReady ? 'pois/search' : 'local-fallback'
  const sourcedPois = result.pois.map((poi) => wrapPoiAsSourced(poi, {
    sourceProvider: poi.sourceProvider || sourceProvider,
    sourceEndpoint: poi.sourceEndpoint || providerSearchEndpoint(poi.sourceProvider || sourceProvider),
    sourceId: poi.sourceId || poi.id,
    fetchedAt: generatedAt,
    ttlMs: providerCacheTtlMs(poi.sourceProvider || sourceProvider),
    rawSnapshotId: `${rawSnapshotId}_${sanitizeId(poi.id || poi.name)}`,
    confidence: searchReady ? DATA_SOURCE_KINDS.providerSnapshot : DATA_SOURCE_KINDS.unavailable,
  }))

  writeProviderSnapshot({
    rawSnapshotId,
    sourceProvider,
    sourceEndpoint,
    sourceId: `${body.cityName || ''}:${body.keyword || ''}`,
    fetchedAt: generatedAt,
    expiresAt: new Date(Date.parse(generatedAt) + Math.max(config.amapCacheTtlMs, config.dianpingCacheTtlMs)).toISOString(),
    stale: false,
    unavailableReason: searchReady ? null : 'No trusted remote POI search results were returned.',
    request: redactProviderRequest(body),
    resultCount: sourcedPois.length,
  })

  return {
    ok: result.ok,
    status: searchReady ? 'ready' : 'unavailable',
    generatedAt,
    source: result.source,
    rawSnapshotId,
    warnings: result.warnings || [],
    pois: sourcedPois,
  }
}

async function getSourcedPoiDetail(body = {}) {
  const generatedAt = new Date().toISOString()
  const sourceId = String(body.sourceId || body.id || '').trim()
  const city = String(body.cityName || body.city || '').trim()
  const keyword = String(body.name || body.keyword || sourceId).trim()

  if (!config.amapKey) {
    const rawSnapshotId = createRawSnapshotId('poi_detail_unavailable')
    const detail = {
      ok: false,
      status: 'missing-config',
      generatedAt,
      rawSnapshotId,
      poi: null,
      fields: {
        detail: createUnavailableField('AMAP_WEB_SERVICE_KEY is not configured', {
          sourceProvider: DATA_SOURCE_KINDS.unavailable,
          sourceEndpoint: 'place/detail',
          sourceId: sourceId || keyword || 'unknown',
          confidence: DATA_SOURCE_KINDS.unavailable,
          rawSnapshotId,
        }),
      },
    }
    writeProviderSnapshot({
      rawSnapshotId,
      sourceProvider: DATA_SOURCE_KINDS.unavailable,
      sourceEndpoint: 'place/detail',
      sourceId: sourceId || keyword || 'unknown',
      fetchedAt: generatedAt,
      expiresAt: generatedAt,
      stale: true,
      unavailableReason: 'AMAP_WEB_SERVICE_KEY is not configured',
    })
    return detail
  }

  const rawSnapshotId = createRawSnapshotId('poi_detail')
  let poi = null
  try {
    poi = sourceId ? await queryAmapPoiDetail(sourceId) : null
    if (!poi && keyword) {
      const candidates = await searchAmapPois({ city, keyword, offset: 5 })
      poi = candidates[0] || null
    }
  } catch (error) {
    const unavailableReason = externalWarning(error)
    writeProviderSnapshot({
      rawSnapshotId,
      sourceProvider: 'amap',
      sourceEndpoint: sourceId ? 'place/detail' : 'place/text',
      sourceId: sourceId || keyword || 'unknown',
      fetchedAt: generatedAt,
      expiresAt: generatedAt,
      stale: true,
      unavailableReason,
    })
    return {
      ok: false,
      status: 'unavailable',
      generatedAt,
      rawSnapshotId,
      poi: null,
      fields: {
        detail: createUnavailableField(unavailableReason, {
          sourceProvider: 'amap',
          sourceEndpoint: sourceId ? 'place/detail' : 'place/text',
          sourceId: sourceId || keyword || 'unknown',
          confidence: DATA_SOURCE_KINDS.unavailable,
          rawSnapshotId,
        }),
      },
    }
  }

  const sourced = poi ? wrapPoiAsSourced(poi, {
    sourceProvider: 'amap',
    sourceEndpoint: sourceId ? 'place/detail' : 'place/text',
    sourceId: poi.id || sourceId || keyword,
    fetchedAt: generatedAt,
    ttlMs: config.amapCacheTtlMs,
    rawSnapshotId,
    confidence: DATA_SOURCE_KINDS.providerSnapshot,
  }) : null

  writeProviderSnapshot({
    rawSnapshotId,
    sourceProvider: 'amap',
    sourceEndpoint: sourceId ? 'place/detail' : 'place/text',
    sourceId: poi?.id || sourceId || keyword || 'unknown',
    fetchedAt: generatedAt,
    expiresAt: new Date(Date.parse(generatedAt) + config.amapCacheTtlMs).toISOString(),
    stale: false,
    unavailableReason: sourced ? null : 'No trusted POI detail was returned.',
    raw: poi,
  })

  return {
    ok: Boolean(sourced),
    status: sourced ? 'ready' : 'unavailable',
    generatedAt,
    rawSnapshotId,
    poi: sourced,
    fields: sourced?.fields || {
      detail: createUnavailableField('No trusted POI detail was returned.', {
        sourceProvider: 'amap',
        sourceEndpoint: sourceId ? 'place/detail' : 'place/text',
        sourceId: sourceId || keyword || 'unknown',
        confidence: DATA_SOURCE_KINDS.unavailable,
        rawSnapshotId,
      }),
    },
  }
}

async function queryAmapPoiDetail(id) {
  const cacheKey = `detail:${id}`
  const cached = getAmapCache(cacheKey)
  if (cached) return cached

  const url = new URL('https://restapi.amap.com/v3/place/detail')
  url.searchParams.set('key', config.amapKey)
  url.searchParams.set('id', id)
  url.searchParams.set('extensions', 'all')
  url.searchParams.set('output', 'JSON')

  await throttleAmap()
  const data = await fetchJson(url)
  if (data.status !== '1') {
    throw new Error(data.infocode === '10021' || data.info === 'CUQPS_HAS_EXCEEDED_THE_LIMIT' ? 'AMap quota exceeded' : 'AMap detail request failed')
  }
  const raw = Array.isArray(data.pois) ? data.pois[0] : null
  const poi = raw ? normalizeAmapPoi(raw, { keyword: raw.name || id, fallbackId: id }) : null
  setAmapCache(cacheKey, poi)
  return poi
}

function redactProviderRequest(body = {}) {
  return {
    keyword: String(body.keyword || ''),
    cityName: String(body.cityName || ''),
    categories: Array.isArray(body.categories) ? body.categories.map(String) : [],
    minRating: normalizeNumber(body.minRating, 0),
    maxDistance: normalizeNumber(body.maxDistance, 40),
  }
}

async function collectPoiCandidates(draft, warnings) {
  const city = draft?.cityName || draft?.cityId || '上海'
  const keywords = unique([
    ...(draft?.interests || []),
    ...(draft?.cuisines || []),
    ...(draft?.travelType || []),
    draft?.spotPreference,
    '热门景点',
  ])
    .filter(Boolean)
    .slice(0, 6)

  if (!config.amapKey) {
    warnings.push('AMap search is not configured')
    return []
  }

  const settled = await Promise.allSettled(keywords.map((keyword) => searchAmapPois({ city, keyword })))
  const results = []
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]
    if (outcome.status === 'fulfilled') {
      results.push(...outcome.value)
    } else {
      warnings.push(`AMap ${keywords[i]}: ${externalWarning(outcome.reason)}`)
    }
  }

  return uniqueBy(results, (p) => p.id || `${p.name}|${p.city}|${p.district}|${p.address}`).slice(0, 24)
}

async function searchAmapPois({ city, keyword, offset = 10 }) {
  const cacheKey = JSON.stringify({ city: city || '', keyword, offset })
  const cached = getAmapCache(cacheKey)
  if (cached) return cached

  const url = new URL('https://restapi.amap.com/v3/place/text')
  url.searchParams.set('key', config.amapKey)
  url.searchParams.set('keywords', keyword)
  if (city) url.searchParams.set('city', city)
  url.searchParams.set('offset', String(offset))
  url.searchParams.set('page', '1')
  url.searchParams.set('extensions', 'all')
  url.searchParams.set('output', 'JSON')

  await throttleAmap()
  const data = await fetchJson(url)
  if (data.status !== '1') {
    throw new Error(data.infocode === '10021' || data.info === 'CUQPS_HAS_EXCEEDED_THE_LIMIT' ? 'AMap quota exceeded' : 'AMap request failed')
  }

  const pois = (data.pois || [])
    .map((poi, index) => normalizeAmapPoi(poi, { keyword, city, fallbackId: `${keyword}-${index}` }))
    .filter((poi) => poi.name)

  setAmapCache(cacheKey, pois)
  return pois
}

function buildAmapSearchQueries({ keyword, cityName, categories }) {
  const categoryTerms = normalizeSearchCategories(categories)
  const queries = []

  if (keyword) {
    for (const term of categoryTerms) {
      queries.push({ city: cityName, keyword: unique([cityName, keyword, term]).join(' ') })
    }
    queries.push({ city: cityName, keyword: unique([cityName, keyword]).join(' ') })
    queries.push({ city: cityName, keyword })
  } else {
    const defaultTerms = categoryTerms.length > 0 ? categoryTerms : ['热门景点']
    for (const term of defaultTerms) {
      queries.push({ city: cityName, keyword: unique([cityName, term]).join(' ') })
    }
    for (const term of defaultTerms) {
      queries.push({ city: cityName, keyword: term })
    }
  }

  return uniqueBy(
    queries
      .map((query) => ({
        city: String(query.city || '').trim(),
        keyword: String(query.keyword || '').trim(),
      }))
      .filter((query) => query.keyword),
    (query) => `${query.city}|${query.keyword}`,
  ).slice(0, 4)
}

function normalizeSearchCategories(categories = []) {
  return unique(
    categories
      .map((category) => String(category || '').trim())
      .filter(Boolean)
      .flatMap((category) => CATEGORY_SEARCH_TERMS[category] ?? [category]),
  )
}

function matchesPoiCategoryFilter(poi, categories = []) {
  if (categories.length === 0) return true
  return categories.includes(poi.category)
}

function normalizeAmapPoi(poi, { keyword = '', city = '', fallbackId = '' } = {}) {
  const [lng, lat] = String(poi?.location || '').split(',').map(Number)
  const image = buildAmapPoiImage(poi || {})
  const id = poi?.id || fallbackId || `${keyword}-${Date.now()}`
  return {
    id,
    sourceProvider: 'amap',
    sourceEndpoint: 'place/text',
    sourceId: id,
    name: poi?.name || keyword,
    type: poi?.type || '',
    address: poi?.address || '',
    city: poi?.cityname || city,
    district: poi?.adname || '',
    category: classifyAmapCategory(poi?.type, poi?.name),
    lng: Number.isFinite(lng) ? lng : undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    rating: normalizeRating(poi?.biz_ext?.rating),
    cost: normalizeNumber(poi?.biz_ext?.cost),
    cover: image.url,
    imageUrl: image.url,
    thumbnail: image.url,
    photos: image.photos,
    imageConfidence: image.confidence,
    imageSource: image.source,
    imageVerifiedAt: image.verifiedAt,
    imagePendingReview: image.pendingReview,
    imageReviewReason: image.reviewReason,
    openingHours: poi?.biz_ext?.opentime2 || poi?.biz_ext?.opentime || '',
    keyword,
  }
}

function isRelevantCityPoi(poi, requestedCity) {
  const target = normalizeRegionName(requestedCity)
  if (!target) return true

  const locationHints = [poi.city, poi.district, poi.address].map(normalizeRegionName).filter(Boolean)
  if (locationHints.length === 0) return true
  return locationHints.some((hint) => hint.includes(target) || target.includes(hint))
}

function normalizeRegionName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[省市区县特别行政自治区壮族回族维吾尔盟地区]/g, '')
    .replace(/\s+/g, '')
}

function buildAmapPoiImage(poi) {
  const photo = pickTrustedAmapPhoto(poi.photos)
  const verifiedAt = new Date().toISOString()

  if (photo) {
    return {
      url: photo.url,
      photos: [{ ...photo, source: 'amap-poi-photos' }],
      confidence: 'poi-photo',
      source: 'amap-poi-photos',
      verifiedAt,
      pendingReview: false,
      reviewReason: '',
    }
  }

  return {
    url: '',
    photos: [],
    confidence: 'pending-review',
    source: 'pending-manual-review',
    verifiedAt,
    pendingReview: true,
    reviewReason: 'AMap POI did not include a trusted photo URL.',
  }
}

function scorePoiSearchResult(poi, keyword, requestedCity) {
  const normalizedKeyword = normalizeRegionName(keyword).replace(/[景景区景点风景名胜公园]/g, '')
  const normalizedName = normalizeRegionName(poi.name).replace(/[景景区景点风景名胜公园]/g, '')
  const normalizedCity = normalizeRegionName(poi.city)
  const normalizedDistrict = normalizeRegionName(poi.district)
  const normalizedAddress = normalizeRegionName(poi.address)
  let score = 0

  if (normalizedKeyword) {
    if (normalizedName === normalizedKeyword) score += 120
    else if (normalizedName.includes(normalizedKeyword)) score += 100
    else if (normalizedKeyword.includes(normalizedName) && normalizedName) score += 85
    else if (normalizedDistrict.includes(normalizedKeyword) || normalizedAddress.includes(normalizedKeyword)) score += 60
    else if (normalizedCity.includes(normalizedKeyword)) score += 45
    else score -= 25
  }

  if (/[区县市镇乡街道]$/.test(String(poi.name || '')) && !/(景区|风景名胜|公园|景点|旅游)/.test(String(poi.name || '') + String(poi.type || ''))) {
    score -= 40
  }
  if (!String(poi.address || '').trim()) score -= 10
  if (isRelevantCityPoi(poi, requestedCity)) score += 20
  if (poi.imageConfidence === 'poi-photo') score += 5
  if (Number.isFinite(Number(poi.rating))) score += Math.min(10, Number(poi.rating) * 2)

  return score
}

function pickTrustedAmapPhoto(photos) {
  if (!Array.isArray(photos)) return null

  for (const photo of photos) {
    const url = String(photo?.url || '').trim()
    if (!isTrustedPlaceImageUrl(url)) continue
    return {
      url,
      title: String(photo?.title || ''),
    }
  }

  return null
}

function isTrustedPlaceImageUrl(url) {
  if (!/^https?:\/\//i.test(url)) return false
  return !PLACE_IMAGE_PLACEHOLDER_RE.test(url)
}

async function getRealtimeSnapshot(body = {}) {
  const trip = normalizeRealtimeTrip(body.trip)
  const currentLocation = normalizeCurrentLocation(body.currentLocation)
  const generatedAt = new Date().toISOString()
  const warnings = []

  if (!trip) {
    return {
      ok: false,
      status: 'no-trip',
      generatedAt,
      sources: REALTIME_DATA_SOURCES,
      warnings: ['No current trip context was provided'],
      currentLocation,
      events: [],
      logs: [],
      route: null,
      weather: null,
      traffic: null,
      facts: buildRealtimeFactFields({ generatedAt }),
      recommendation: null,
      unavailable: unavailableRealtimeFields(),
    }
  }

  if (!config.amapKey) {
    return {
      ok: false,
      status: 'missing-config',
      generatedAt,
      sources: REALTIME_DATA_SOURCES,
      warnings: ['AMAP_WEB_SERVICE_KEY is not configured'],
      currentLocation,
      trip: summarizeRealtimeTrip(trip),
      events: [],
      logs: [],
      route: null,
      weather: null,
      traffic: null,
      facts: buildRealtimeFactFields({ generatedAt }),
      recommendation: null,
      unavailable: unavailableRealtimeFields(),
    }
  }

  const city = resolveTripCity(trip)
  const items = pickRealtimeItems(trip)
  const logs = []
  let weather = null
  let route = null
  let traffic = null

  if (body.currentLocation && !currentLocation) {
    warnings.push('Current location payload is invalid and was ignored')
    logs.push(realtimeLog('warning', '当前位置无效', '浏览器定位数据格式不合法，已忽略当前位置。'))
  } else if (currentLocation) {
    logs.push(realtimeLog('info', '当前位置已接入', '将优先计算当前位置到下一未完成行程点的真实路线。'))
  }

  try {
    weather = await queryAmapWeather(city)
    logs.push(realtimeLog('success', '天气数据已更新', `${weather.city} ${weather.weather}，${weather.temperature}℃。`))
  } catch (error) {
    warnings.push(`AMap weather: ${externalWarning(error)}`)
    logs.push(realtimeLog('warning', '天气数据请求失败', '高德天气接口暂时不可用。'))
  }

  const routeItems = currentLocation
    ? buildRouteItemsFromCurrentLocation(items, currentLocation, warnings, logs)
    : buildRouteItemsFromFirstIncomplete(items, warnings, logs)

  if (routeItems.length >= 2) {
    route = await buildRealtimeRoute(routeItems, city, warnings, logs)
  } else {
    warnings.push('Current trip has fewer than two geocoded stops')
    logs.push(realtimeLog('warning', '路线数据不足', '当前行程少于两个带经纬度的地点，无法请求路径规划。'))
  }

  const trafficLeg = route?.legs?.find((leg) => leg.polyline.length > 0) || null
  const trafficPoint = trafficLeg?.polyline[Math.floor(trafficLeg.polyline.length / 2)] || items[0]
  if (trafficPoint && hasPoint(trafficPoint)) {
    try {
      traffic = await queryAmapTrafficCircle(trafficPoint)
      logs.push(realtimeLog('success', '路况数据已更新', traffic.description || '已获取路线周边交通态势。'))
    } catch (error) {
      warnings.push(`AMap traffic: ${externalWarning(error)}`)
      logs.push(realtimeLog('warning', '路况数据请求失败', '高德交通态势接口暂时不可用。'))
    }
  }

  const events = buildRealtimeEvents({ weather, route, traffic })
  const recommendation = await buildRealtimeRecommendation({ trip, city, currentLocation, weather, route, traffic, events, warnings })
  const status = warnings.length > 0 ? 'partial' : 'ready'

  return {
    ok: true,
    status,
    generatedAt,
    sources: REALTIME_DATA_SOURCES,
    warnings,
    currentLocation,
    trip: summarizeRealtimeTrip(trip),
    events,
    logs,
    route,
    weather,
    traffic,
    facts: buildRealtimeFactFields({ weather, route, traffic, generatedAt }),
    recommendation,
    unavailable: unavailableRealtimeFields(),
  }
}

function buildRealtimeFactFields({ weather = null, route = null, traffic = null, generatedAt = new Date().toISOString() } = {}) {
  const rawSnapshotId = createRawSnapshotId('realtime')
  const weatherMeta = {
    sourceProvider: weather ? 'amap' : DATA_SOURCE_KINDS.unavailable,
    sourceEndpoint: 'weather/weatherInfo',
    sourceId: weather?.adcode || weather?.city || 'weather',
    fetchedAt: generatedAt,
    ttlMs: 10 * 60_000,
    confidence: weather ? DATA_SOURCE_KINDS.realtimeObservation : DATA_SOURCE_KINDS.unavailable,
    rawSnapshotId: `${rawSnapshotId}_weather`,
  }
  const routeMeta = {
    sourceProvider: route ? 'amap' : DATA_SOURCE_KINDS.unavailable,
    sourceEndpoint: 'direction',
    sourceId: route ? String(route.legs?.map((leg) => `${leg.from.name}-${leg.to.name}`).join('|') || 'route') : 'route',
    fetchedAt: generatedAt,
    ttlMs: 2 * 60_000,
    confidence: route ? DATA_SOURCE_KINDS.realtimeObservation : DATA_SOURCE_KINDS.unavailable,
    rawSnapshotId: `${rawSnapshotId}_route`,
  }
  const trafficMeta = {
    sourceProvider: traffic ? 'amap' : DATA_SOURCE_KINDS.unavailable,
    sourceEndpoint: 'traffic/status/circle',
    sourceId: traffic?.description || traffic?.status || 'traffic',
    fetchedAt: generatedAt,
    ttlMs: 2 * 60_000,
    confidence: traffic ? DATA_SOURCE_KINDS.realtimeObservation : DATA_SOURCE_KINDS.unavailable,
    rawSnapshotId: `${rawSnapshotId}_traffic`,
  }

  return {
    weather: weather
      ? createSourcedField(weather, weatherMeta)
      : createUnavailableField('天气实时数据不可用', weatherMeta),
    route: route
      ? createSourcedField(route, routeMeta)
      : createUnavailableField('路线实时数据不可用', routeMeta),
    traffic: traffic
      ? createSourcedField(traffic, trafficMeta)
      : createUnavailableField('交通态势实时数据不可用', trafficMeta),
    queue: createUnavailableField('暂无官方实时数据源', {
      sourceProvider: DATA_SOURCE_KINDS.unavailable,
      sourceEndpoint: 'queue',
      sourceId: 'queue',
      confidence: DATA_SOURCE_KINDS.unavailable,
      rawSnapshotId: `${rawSnapshotId}_queue`,
    }),
    crowd: createUnavailableField('暂无官方实时数据源', {
      sourceProvider: DATA_SOURCE_KINDS.unavailable,
      sourceEndpoint: 'crowd',
      sourceId: 'crowd',
      confidence: DATA_SOURCE_KINDS.unavailable,
      rawSnapshotId: `${rawSnapshotId}_crowd`,
    }),
  }
}

function normalizeRealtimeTrip(value) {
  if (!value || typeof value !== 'object') return null
  const itinerary = Array.isArray(value.itinerary) ? value.itinerary : []
  return {
    id: String(value.id || ''),
    title: String(value.title || '当前行程'),
    cityId: String(value.cityId || ''),
    cityName: String(value.cityName || ''),
    startDate: String(value.startDate || ''),
    endDate: String(value.endDate || ''),
    status: String(value.status || ''),
    itinerary,
  }
}

function normalizeCurrentLocation(value) {
  if (!value || typeof value !== 'object') return null
  const lng = Number(value.lng)
  const lat = Number(value.lat)
  const accuracy = Number(value.accuracy)

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null

  return {
    lng,
    lat,
    accuracy: Number.isFinite(accuracy) ? Math.max(0, Math.round(accuracy)) : 0,
    capturedAt: String(value.capturedAt || new Date().toISOString()),
  }
}

function summarizeRealtimeTrip(trip) {
  return {
    id: trip.id,
    title: trip.title,
    cityId: trip.cityId,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
  }
}

function resolveTripCity(trip) {
  const byId = CITY_META[trip.cityId]
  if (byId) return { id: trip.cityId, ...byId }

  const cityName = String(trip.cityName || trip.cityId || trip.title || '').replace(/市$/, '')
  const normalizedTarget = normalizeRegionName(cityName)
  const matched = Object.entries(CITY_META).find(([, meta]) => {
    const normalizedName = normalizeRegionName(meta.name)
    const normalizedOfficialName = normalizeRegionName(meta.officialName || meta.name)
    return normalizedName === normalizedTarget || normalizedOfficialName === normalizedTarget
  })

  if (matched) {
    const [id, meta] = matched
    return { id, ...meta }
  }

  return {
    id: trip.cityId || cityName || 'unknown',
    name: cityName,
    adcode: '',
  }
}

function pickRealtimeItems(trip) {
  const today = new Date().toISOString().slice(0, 10)
  const day =
    trip.itinerary.find((item) => item?.date === today && Array.isArray(item.items) && item.items.length > 0) ||
    trip.itinerary.find((item) => Array.isArray(item.items) && item.items.length > 0)

  return (day?.items || [])
    .map((item) => ({
      id: String(item.id || item.poiId || item.name || ''),
      poiId: String(item.poiId || ''),
      name: String(item.name || '未命名地点'),
      transport: String(item.transport || ''),
      status: String(item.status || ''),
      lng: normalizeNumber(item.lng, NaN),
      lat: normalizeNumber(item.lat, NaN),
      x: normalizeNumber(item.x, 50),
      y: normalizeNumber(item.y, 50),
      color: String(item.color || '#2563eb'),
    }))
    .filter(hasPoint)
}

function buildRouteItemsFromCurrentLocation(items, currentLocation, warnings, logs) {
  const nextItem = items.find((item) => item.status !== '已完成') || null
  if (!nextItem) {
    warnings.push('Current location is available but no unfinished geocoded stop was found')
    logs.push(realtimeLog('warning', '当前位置未用于路线', '未找到下一未完成行程点，保留行程节点之间的路线逻辑。'))
    return items
  }

  logs.push(realtimeLog('info', '路线优先使用当前位置', `当前位置到 ${nextItem.name} 的真实路线将优先计算。`))
  return [
    {
      id: 'current-location',
      poiId: 'current-location',
      name: '当前位置',
      transport: nextItem.transport || '',
      status: '进行中',
      lng: currentLocation.lng,
      lat: currentLocation.lat,
      x: 50,
      y: 50,
      color: '#0f766e',
      accuracy: currentLocation.accuracy,
    },
    nextItem,
  ]
}

function buildRouteItemsFromFirstIncomplete(items, warnings, logs) {
  const firstIncompleteIdx = items.findIndex((item) => item.status !== '已完成')
  if (firstIncompleteIdx <= 0) return items

  const remaining = items.slice(firstIncompleteIdx)
  if (remaining.length < 2) return items

  logs.push(realtimeLog('info', '路线从当前节点开始', `已跳过 ${firstIncompleteIdx} 个已完成节点，路线从 ${remaining[0].name} 开始计算。`))
  return remaining
}

async function queryAmapWeather(city) {
  if (!city.adcode && !city.name) throw new Error('AMap weather city is missing')
  const url = new URL('https://restapi.amap.com/v3/weather/weatherInfo')
  url.searchParams.set('key', config.amapKey)
  url.searchParams.set('city', city.adcode || city.name)
  url.searchParams.set('extensions', 'base')
  url.searchParams.set('output', 'JSON')

  const data = await fetchAmapJson(url, 10 * 60_000)
  const live = data.lives?.[0]
  if (!live) throw new Error('AMap weather response has no live data')
  return {
    city: live.city || city.name,
    adcode: live.adcode || city.adcode,
    weather: live.weather || '',
    temperature: live.temperature || '',
    winddirection: live.winddirection || '',
    windpower: live.windpower || '',
    humidity: live.humidity || '',
    reporttime: live.reporttime || '',
  }
}

async function buildRealtimeRoute(items, city, warnings, logs) {
  const pairs = []
  for (let i = 0; i < items.length - 1; i++) {
    pairs.push({ from: items[i], to: items[i + 1], mode: routeModeFromTransport(items[i + 1].transport || items[i].transport) })
  }
  const settled = await Promise.allSettled(pairs.map(({ from, to, mode }) => queryAmapRoute({ from, to, mode, city })))
  const legs = []
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]
    if (outcome.status === 'fulfilled') {
      legs.push(outcome.value)
    } else {
      warnings.push(`AMap route ${pairs[i].from.name}-${pairs[i].to.name}: ${externalWarning(outcome.reason)}`)
    }
  }

  if (legs.length === 0) {
    logs.push(realtimeLog('warning', '路径规划请求失败', '高德路径规划接口未返回可用路线。'))
    return null
  }

  const distanceMeters = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0)
  const durationSeconds = legs.reduce((sum, leg) => sum + leg.durationSeconds, 0)
  logs.push(realtimeLog('success', '路径规划已更新', `已获取 ${legs.length} 段真实路线，预计 ${formatDuration(durationSeconds)}。`))

  return {
    distanceMeters,
    durationSeconds,
    distanceText: formatDistanceMeters(distanceMeters),
    durationText: formatDuration(durationSeconds),
    congestionLegs: legs.filter((leg) => leg.trafficStatus && leg.trafficStatus !== '畅通').length,
    legs,
  }
}

async function queryAmapRoute({ from, to, mode, city }) {
  const url = new URL(
    mode === 'walking'
      ? 'https://restapi.amap.com/v3/direction/walking'
      : mode === 'transit'
        ? 'https://restapi.amap.com/v3/direction/transit/integrated'
        : 'https://restapi.amap.com/v3/direction/driving',
  )
  url.searchParams.set('key', config.amapKey)
  url.searchParams.set('origin', formatLngLat(from))
  url.searchParams.set('destination', formatLngLat(to))
  url.searchParams.set('extensions', 'all')
  url.searchParams.set('output', 'JSON')
  if (mode === 'transit') {
    url.searchParams.set('city', city.name)
    url.searchParams.set('cityd', city.name)
    url.searchParams.set('strategy', '0')
  }
  if (mode === 'driving') {
    url.searchParams.set('strategy', '10')
  }

  const data = await fetchAmapJson(url, 2 * 60_000)
  const parsed = mode === 'transit' ? parseTransitRoute(data, from, to) : parsePathRoute(data, from, to)
  return {
    from: pointSummary(from),
    to: pointSummary(to),
    mode,
    ...parsed,
  }
}

function parsePathRoute(data, from, to) {
  const path = data.route?.paths?.[0]
  if (!path) throw new Error('AMap route response has no path')
  const steps = Array.isArray(path.steps) ? path.steps : []
  const tmcs = steps.flatMap((step) => Array.isArray(step.tmcs) ? step.tmcs : [])
  const traffic = summarizeRouteTraffic(tmcs)
  const polyline = uniquePolylinePoints([
    pointSummary(from),
    ...steps.flatMap((step) => parsePolyline(step.polyline)),
    pointSummary(to),
  ])
  return {
    distanceMeters: normalizeNumber(path.distance, 0),
    durationSeconds: normalizeNumber(path.duration, 0),
    distanceText: formatDistanceMeters(path.distance),
    durationText: formatDuration(path.duration),
    trafficStatus: traffic.status,
    trafficDescription: traffic.description,
    polyline,
  }
}

function parseTransitRoute(data, from, to) {
  const transit = data.route?.transits?.[0]
  if (!transit) throw new Error('AMap transit response has no path')
  const segments = Array.isArray(transit.segments) ? transit.segments : []
  const polyline = uniquePolylinePoints([
    pointSummary(from),
    ...segments.flatMap((segment) => collectTransitPolyline(segment)),
    pointSummary(to),
  ])
  return {
    distanceMeters: normalizeNumber(transit.distance, 0),
    durationSeconds: normalizeNumber(transit.duration, 0),
    distanceText: formatDistanceMeters(transit.distance),
    durationText: formatDuration(transit.duration),
    trafficStatus: '',
    trafficDescription: '',
    polyline,
  }
}

function collectTransitPolyline(segment) {
  const walking = Array.isArray(segment.walking?.steps)
    ? segment.walking.steps.flatMap((step) => parsePolyline(step.polyline))
    : []
  const busline = Array.isArray(segment.bus?.buslines) && segment.bus.buslines[0]
    ? parsePolyline(segment.bus.buslines[0].polyline)
    : []
  return [...walking, ...busline]
}

async function queryAmapTrafficCircle(point) {
  const url = new URL('https://restapi.amap.com/v3/traffic/status/circle')
  url.searchParams.set('key', config.amapKey)
  url.searchParams.set('location', formatLngLat(point))
  url.searchParams.set('radius', '1200')
  url.searchParams.set('extensions', 'all')
  url.searchParams.set('output', 'JSON')

  const data = await fetchAmapJson(url, 2 * 60_000)
  const trafficInfo = data.trafficinfo || {}
  const evaluation = trafficInfo.evaluation || {}
  const roads = Array.isArray(trafficInfo.roads) ? trafficInfo.roads : []
  return {
   status: normalizeTrafficStatusCode(evaluation.status || ''),
   description: evaluation.description || '',
   expedite: evaluation.expedite || '',
   congested: evaluation.congested || '',
   blocked: evaluation.blocked || '',
   unknown: evaluation.unknown || '',
   roads: roads.slice(0, 8).map((road) => ({
     name: road.name || '',
     status: normalizeTrafficStatusCode(road.status || ''),
     direction: road.direction || '',
     angle: road.angle || '',
     speed: road.speed || '',
   })),
 }
}

// AMap traffic status codes: 0=未知 1=畅通 2=缓行 3=拥堵 4=严重拥堵
function normalizeTrafficStatusCode(value) {
  const code = String(value || '').trim()
  const map = { '0': '未知', '1': '畅通', '2': '缓行', '3': '拥堵', '4': '严重拥堵' }
  return map[code] || code
}

function buildRealtimeEvents({ weather, route, traffic }) {
  const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const events = []

  const trafficStatus = traffic?.status || ''
  const congestedLeg = route?.legs?.find((leg) => leg.trafficStatus && leg.trafficStatus !== '畅通')
  if (isCongestedTraffic(trafficStatus) || congestedLeg) {
    const title = congestedLeg
      ? `${congestedLeg.from.name} 至 ${congestedLeg.to.name} 路段${congestedLeg.trafficStatus}`
      : `路线周边交通${trafficStatus}`
    const description = congestedLeg?.trafficDescription || traffic?.description || '高德交通态势接口返回路线周边存在拥堵。'
    events.push({
      id: `traffic-${Date.now()}`,
      type: '交通拥堵',
      level: trafficLevel(trafficStatus || congestedLeg?.trafficStatus),
      title,
      description,
      time: now,
      affectedPoi: congestedLeg?.to.name || '当前路线',
      source: REALTIME_DATA_SOURCES.traffic,
    })
  }

  if (weather && isRiskyWeather(weather.weather, weather.windpower)) {
    events.push({
      id: `weather-${Date.now()}`,
      type: '天气变化',
      level: weatherLevel(weather.weather, weather.windpower),
      title: `${weather.city}当前天气：${weather.weather}`,
      description: `高德天气 ${weather.reporttime || '最新'} 返回：${weather.weather}，${weather.temperature}℃，${weather.winddirection}${weather.windpower}级，湿度 ${weather.humidity}%。`,
      time: now,
      affectedPoi: weather.city,
      source: REALTIME_DATA_SOURCES.weather,
    })
  }

  return events
}

async function buildRealtimeRecommendation({ trip, city, currentLocation, weather, route, traffic, events, warnings }) {
  if (!isLlmConfigured()) return null
  if (!weather && !route && !traffic) return null

  try {
    const content = await callLlm([
      {
        role: 'system',
        content:
          '你是“智行路线”的实时出行建议助手。只允许依据 trip、currentLocation 和真实实时接口结果生成结构化 JSON，不要输出 Markdown，不要输出解释文字。若排队或人流没有官方实时数据，必须明确写“暂无实时数据”，不能猜测。actions 只能给出不会写回行程的建议，或把不可执行项标记为 canApply=false。',
      },
      {
        role: 'user',
        content: JSON.stringify({
          trip: summarizeRealtimeTrip(trip),
          city,
          currentLocation,
          weather,
          route: summarizeRouteForLlm(route),
          traffic: summarizeTrafficForLlm(traffic),
          events,
          unavailable: unavailableRealtimeFields(),
          outputSchema: {
            source: llmSource(),
            summary: 'string',
            risks: [
              {
                type: 'traffic | weather | queue | crowd | route | unknown',
                level: '高 | 中 | 低',
                title: 'string',
                reason: 'string',
              },
            ],
            actions: [
              {
                id: 'string',
                label: 'string',
                description: 'string',
                canApply: false,
                unavailableReason: 'string',
              },
            ],
          },
          instruction: '只输出符合 schema 的 JSON。summary 必须简洁，risks 和 actions 只能基于实时接口、trip 和 currentLocation，不得补充未返回的数据。',
        }),
      },
    ], { json: true, maxTokens: 2000 })
    const verifiedFieldNames = new Set([
      weather ? 'weather' : '',
      route ? 'route' : '',
      traffic ? 'traffic' : '',
    ].filter(Boolean))
    return sanitizeDerivedRecommendation(normalizeRealtimeRecommendation(content), { verifiedFieldNames })
  } catch (error) {
    warnings.push(`Realtime advice: ${externalWarning(error)}`)
    return null
  }
}

function normalizeRealtimeRecommendation(content) {
  const parsed = parseJsonObject(content)
  const summary = String(parsed?.summary || '').trim()
  if (!summary) return null

  return {
    source: llmSource(),
    summary,
    risks: normalizeRealtimeRisks(parsed?.risks),
    actions: normalizeRealtimeActions(parsed?.actions),
  }
}

function normalizeRealtimeRisks(risks) {
  if (!Array.isArray(risks)) return []
  return risks
    .map((risk, index) => {
      const type = normalizeRealtimeRiskType(risk?.type)
      const title = String(risk?.title || '').trim()
      const reason = String(risk?.reason || '').trim()
      if (!title && !reason) return null

      if ((type === 'queue' || type === 'crowd') && !/暂无实时数据|暂无官方实时数据源/.test(`${title}${reason}`)) {
        return {
          type,
          level: '低',
          title: type === 'queue' ? '排队暂无实时数据' : '人流暂无实时数据',
          reason: '暂无实时数据：当前项目没有官方实时数据源，不能推断排队或人流情况。',
        }
      }

      return {
        type,
        level: normalizeRealtimeRiskLevel(risk?.level),
        title: title || defaultRealtimeRiskTitle(type, index),
        reason: reason || '暂无实时数据',
      }
    })
    .filter(Boolean)
    .slice(0, 6)
}

function normalizeRealtimeActions(actions) {
  if (!Array.isArray(actions)) return []
  return actions
    .map((action, index) => {
      const label = String(action?.label || '').trim()
      const description = String(action?.description || '').trim()
      if (!label && !description) return null
      const canApply = action?.canApply === true
      const unavailableReason = isUnavailableRealtimeAction(action, label, description)
      return {
        id: sanitizeId(action?.id || label || `action-${index + 1}`),
        label: label || `建议 ${index + 1}`,
        description: description || '暂无详细说明',
        canApply: unavailableReason ? false : canApply,
        unavailableReason: unavailableReason || (canApply ? undefined : String(action?.unavailableReason || '暂无真实行程写回接口，当前仅展示建议。')),
      }
    })
    .filter(Boolean)
    .slice(0, 6)
}

function isUnavailableRealtimeAction(action, label, description) {
  const text = `${action?.id || ''} ${label} ${description} ${action?.unavailableReason || ''}`
  if (!/排队|等位|人流|拥挤|客流|crowd|queue/i.test(text)) return ''
  return '暂无官方实时数据源，当前不能把排队或景区人流判断作为可执行建议。'
}

function normalizeRealtimeRiskType(value) {
  const allowed = ['traffic', 'weather', 'queue', 'crowd', 'route', 'unknown']
  return allowed.includes(value) ? value : 'unknown'
}

function normalizeRealtimeRiskLevel(value) {
  return ['高', '中', '低'].includes(value) ? value : '中'
}

function defaultRealtimeRiskTitle(type, index) {
  if (type === 'traffic') return '交通风险'
  if (type === 'weather') return '天气风险'
  if (type === 'queue') return '排队暂无实时数据'
  if (type === 'crowd') return '人流暂无实时数据'
  if (type === 'route') return '路线风险'
  return `风险项 ${index + 1}`
}

async function fetchAmapJson(url, ttlMs) {
  const cacheKey = `amap:${url.toString()}`
  const cached = getAmapCache(cacheKey)
  if (cached) return cached

  await throttleAmap()
  const data = await fetchJson(url)
  if (data.status !== '1') {
    throw new Error(data.infocode === '10021' || data.info === 'CUQPS_HAS_EXCEEDED_THE_LIMIT' ? 'AMap quota exceeded' : (data.info || 'AMap request failed'))
  }
  amapCache.set(cacheKey, { value: data, expiresAt: Date.now() + ttlMs })
  return data
}

function unavailableRealtimeFields() {
  return {
    queue: {
      label: '排队时间',
      message: '暂无官方实时数据源',
    },
    crowd: {
      label: '景区人流',
      message: '暂无官方实时数据源',
    },
  }
}

function realtimeLog(type, title, detail) {
  realtimeLogSequence = (realtimeLogSequence + 1) % 100000
  return {
    id: `log-${type}-${Date.now()}-${realtimeLogSequence}`,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    type,
    title,
    detail,
  }
}

function hasPoint(point) {
  return Number.isFinite(Number(point?.lng)) && Number.isFinite(Number(point?.lat))
}

// Equirectangular projection: lng/lat to normalized 0-100 grid.
// Frontend re-projects via local bounding box for display, but backend
// must return geographically-correct x,y instead of placeholder 50,50.
function lngLatToXY(lng, lat) {
  return {
    x: Number(((lng + 180) / 360 * 100).toFixed(4)),
    y: Number(((90 - lat) / 180 * 100).toFixed(4)),
  }
}

function pointSummary(point) {
  const projected = lngLatToXY(Number(point.lng), Number(point.lat))
  return {
    id: point.id || point.poiId || point.name || '',
    name: point.name || '',
    lng: Number(point.lng),
    lat: Number(point.lat),
    x: projected.x,
    y: projected.y,
    color: point.color || '#2563eb',
  }
}

function formatLngLat(point) {
  return `${Number(point.lng).toFixed(6)},${Number(point.lat).toFixed(6)}`
}

function routeModeFromTransport(transport = '') {
  if (transport.includes('步行')) return 'walking'
  if (transport.includes('地铁') || transport.includes('公交')) return 'transit'
  return 'driving'
}

function parsePolyline(value) {
  return String(value || '')
    .split(';')
    .map((item) => {
      const [lng, lat] = item.split(',').map(Number)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      return { lng, lat, ...lngLatToXY(lng, lat) }
    })
    .filter(Boolean)
}

function uniquePolylinePoints(points) {
  const seen = new Set()
  return points.filter((point) => {
    if (!hasPoint(point)) return false
    const key = `${Number(point.lng).toFixed(6)},${Number(point.lat).toFixed(6)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function summarizeRouteTraffic(tmcs) {
  const statuses = tmcs.map((tmc) => String(tmc.status || '')).filter(Boolean)
  if (statuses.some((status) => status.includes('严重'))) return { status: '严重拥堵', description: '路径规划返回部分路段严重拥堵。' }
  if (statuses.some((status) => status.includes('拥堵'))) return { status: '拥堵', description: '路径规划返回部分路段拥堵。' }
  if (statuses.some((status) => status.includes('缓行'))) return { status: '缓行', description: '路径规划返回部分路段缓行。' }
  if (statuses.length > 0) return { status: '畅通', description: '路径规划返回沿线整体畅通。' }
  return { status: '', description: '' }
}

function isCongestedTraffic(status = '') {
  const text = normalizeTrafficStatusCode(status)
  return /拥堵|缓行|blocked|congested/i.test(text)
}

function trafficLevel(status = '') {
  const text = normalizeTrafficStatusCode(status)
  if (text.includes('严重')) return '高'
  if (isCongestedTraffic(text)) return '中'
  return '低'
}

function isRiskyWeather(weather = '', windpower = '') {
  return /雨|雪|雷|雾|霾|沙|冰雹|台风/i.test(weather) || normalizeNumber(String(windpower).replace(/[^\d.]/g, ''), 0) >= 5
}

function weatherLevel(weather = '', windpower = '') {
  if (/暴|大雨|大雪|雷|台风|冰雹/i.test(weather)) return '高'
  if (normalizeNumber(String(windpower).replace(/[^\d.]/g, ''), 0) >= 6) return '高'
  return '中'
}

function formatDistanceMeters(value) {
  const meters = normalizeNumber(value, 0)
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1)} km`
  return `${Math.round(meters)} m`
}

function formatDuration(value) {
  const seconds = normalizeNumber(value, 0)
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
  }
  return `${minutes} 分钟`
}

function classifyAmapCategory(type = '', name = '') {
  const text = `${type} ${name}`
  if (/动物园|科技馆|游乐园|游乐场|海洋馆|儿童|亲子|主题乐园/.test(text)) return '亲子游'
  if (/餐饮|美食|餐厅|饭店|菜馆|小吃|火锅|咖啡|茶馆|甜品|饮品|老字号|本地菜/.test(text)) return '美食'
  if (/购物|商场|购物中心|百货|奥莱|商业街|步行街|购物服务/.test(text)) return '购物'
  if (/公园|自然|湿地|森林|植物园|郊野|山/.test(text)) return '公园自然'
  if (/历史|遗址|古迹|古城|古镇|寺|庙|宫|观|祠|陵园|文物|纪念馆|古建筑/.test(text)) return '历史遗迹'
  if (/科教|文化|传媒|博物馆|美术馆|展览|剧院|图书馆|艺术/.test(text)) return '文化艺术'
  if (/夜市|酒吧|清吧|夜游|夜店|KTV|迪厅|夜总会|Live|LIVE|娱乐|休闲/.test(text)) return '夜生活'
  if (/风景名胜|景点|景区|旅游|地标/.test(text)) return '景点'
  return '景点'
}

async function callLlm(messages, options = {}) {
  const provider = currentLlmProvider()
  const apiKey = currentLlmApiKey()
  const baseUrl = currentLlmBaseUrl()
  if (!apiKey) {
    throw new Error(`${provider.apiKeyEnv} is missing`)
  }

  const body = {
    model: config.llmModel,
    messages,
    stream: false,
    temperature: 0.4,
    max_tokens: options.maxTokens || 1200,
  }

  if (options.json && provider.supportsJsonResponseFormat) {
    body.response_format = { type: 'json_object' }
  }

  const data = await fetchJson(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  }, 60000)

  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error(`${provider.label} response has no content`)
  }
  return content
}

function normalizePlans(plans, draft, candidates) {
  const source = Array.isArray(plans) && plans.length > 0 ? plans : fallbackPlans(draft, candidates)
  const llmRecommendedType = source.find((p) => p?.recommended === true)?.type || null
  return PLAN_TYPES.map((type, index) => {
    const plan = source.find((p) => p?.type === type) || source[index] || {}
    const stops = normalizeStops(plan.stops, candidates)
    const draftDays = Math.max(1, normalizeNumber(draft?.days, normalizeNumber(plan.days, 1)))
    return {
      id: sanitizeId(plan.id || `agent-plan-${index + 1}`),
      type,
      name: normalizePlanName(plan.name, type, draft, draftDays),
      recommended: llmRecommendedType ? type === llmRecommendedType : index === 0,
      days: draftDays,
      totalDuration: String(plan.totalDuration || `约 ${Math.max(6, draftDays * 7)} 小时`),
      budget: normalizeNumber(plan.budget, draft?.budget || 800),
      distance: normalizeNumber(plan.distance, 10 + index * 2),
      satisfaction: Math.min(100, Math.max(60, normalizeNumber(plan.satisfaction, 92 - index * 2))),
      tags: normalizeStringArray(plan.tags, ['AI 生成', '动线优化', '偏好匹配']).slice(0, 4),
      summary: String(plan.summary || defaultSummary(type, draft)),
      aiReason: String(plan.aiReason || defaultAiReason(type, draft)),
      stops,
    }
  })
}

function normalizeStops(stops, candidates) {
  const fallback = candidates.length > 0 ? candidates : defaultPois()
  const raw = Array.isArray(stops) && stops.length > 0 ? stops : fallback.slice(0, 6)
  return raw.slice(0, 8).map((stop, index) => {
    const candidate = fallback.find((p) => p.id === stop.poiId || p.name === stop.name) || fallback[index % fallback.length] || {}
    return {
      poiId: sanitizeId(stop.poiId || candidate.id || `poi-${index + 1}`),
      name: String(stop.name || candidate.name || `兴趣点 ${index + 1}`),
      cover: String(stop.cover || candidate.cover || DEFAULT_COVERS[index % DEFAULT_COVERS.length]),
      order: index + 1,
      ...candidatePlanStopFields(candidate),
    }
  })
}

function candidatePlanStopFields(candidate = {}) {
  const lng = normalizeNumber(candidate.lng, NaN)
  const lat = normalizeNumber(candidate.lat, NaN)
  const x = normalizeNumber(candidate.x, NaN)
  const y = normalizeNumber(candidate.y, NaN)
  const rating = normalizeNumber(candidate.rating, NaN)
  const cost = normalizeNumber(candidate.cost, NaN)

  return omitUndefined({
    category: candidate.category,
    lng: Number.isFinite(lng) ? lng : undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    x: Number.isFinite(x) ? x : undefined,
    y: Number.isFinite(y) ? y : undefined,
    rating: Number.isFinite(rating) ? rating : undefined,
    cost: Number.isFinite(cost) ? cost : undefined,
    address: stringOrUndefined(candidate.address),
    openingHours: stringOrUndefined(candidate.openingHours),
    imageConfidence: stringOrUndefined(candidate.imageConfidence),
    imageSource: stringOrUndefined(candidate.imageSource),
    imageVerifiedAt: stringOrUndefined(candidate.imageVerifiedAt),
    imagePendingReview: typeof candidate.imagePendingReview === 'boolean' ? candidate.imagePendingReview : undefined,
    imageReviewReason: stringOrUndefined(candidate.imageReviewReason),
  })
}

function fallbackPlans(draft = {}, candidates = []) {
  const stops = (candidates.length > 0 ? candidates : defaultPois()).slice(0, 6)
  return PLAN_TYPES.map((type, index) => ({
    id: `fallback-${index + 1}`,
    type,
    name: defaultPlanName(type),
    recommended: index === 0,
    days: draft.days || 1,
    totalDuration: `约 ${Math.max(6, (draft.days || 1) * 7 - index)} 小时`,
    budget: Math.max(300, Number(draft.budget || 900) - index * 120),
    distance: 10 + index * 1.8,
    satisfaction: 94 - index * 3,
    tags: type === '预算优先' ? ['高性价比', '少绕路', '公共交通'] : ['AI 生成', '动线优化', '偏好匹配'],
    summary: defaultSummary(type, draft),
    aiReason: defaultAiReason(type, draft),
    stops: stops.map((poi, i) => ({
      poiId: sanitizeId(poi.id || `poi-${i + 1}`),
      name: poi.name,
      cover: poi.cover || DEFAULT_COVERS[i % DEFAULT_COVERS.length],
      order: i + 1,
      ...candidatePlanStopFields(poi),
    })),
  }))
}

function defaultPois() {
  return [
    { id: 'the-bund', name: '外滩', cover: DEFAULT_COVERS[0] },
    { id: 'city-walk', name: '城市漫步街区', cover: DEFAULT_COVERS[1] },
    { id: 'local-food', name: '本地特色餐厅', cover: DEFAULT_COVERS[2] },
    { id: 'museum', name: '城市博物馆', cover: DEFAULT_COVERS[0] },
    { id: 'landmark', name: '地标观景点', cover: DEFAULT_COVERS[1] },
  ]
}

function defaultPlanName(type) {
  if (type === '体验优先') return '沉浸体验路线'
  if (type === '预算优先') return '高性价比轻松路线'
  return '高效精华路线'
}

function normalizePlanName(name, type, draft = {}, days = 1) {
  const cityName = draftCityName(draft)
  const draftDays = Math.max(1, normalizeNumber(days, 1))
  const fallbackName = `${cityName}${planTypeTitle(type)}${draftDays}日路线`
  const rawName = String(name || '').trim()
  if (!rawName) return fallbackName

  const dayAlignedName = rawName.replace(/\d+\s*[日天]/g, `${draftDays}日`)
  if (cityName !== '目的地' && dayAlignedName.includes(cityName) && /\d+\s*[日天]/.test(rawName)) {
    return dayAlignedName
  }

  return fallbackName
}

function draftCityName(draft = {}) {
  return String(draft.cityName || CITY_META[String(draft.cityId || '')]?.name || '目的地').trim() || '目的地'
}

function planTypeTitle(type) {
  if (type === '体验优先') return '深度体验'
  if (type === '预算优先') return '高性价比'
  return '高效精华'
}

function defaultSummary(type, draft = {}) {
  const city = draft.cityName || '目的地'
  if (type === '体验优先') return `围绕${city}的文化、街区和美食体验展开，节奏更舒展，适合深度游。`
  if (type === '预算优先') return `优先选择免费或低成本点位，并减少不必要交通成本，适合控制预算。`
  return `优先压缩通勤和等待时间，串联${city}核心点位，适合首次到访和时间有限的行程。`
}

function defaultAiReason(type, draft = {}) {
  const city = draft.cityName || '目的地'
  const interests = normalizeStringArray(draft.interests).slice(0, 2).join('、') || '当前兴趣偏好'
  const transport = normalizeStringArray(draft.transport).slice(0, 2).join('、') || '可用交通方式'
  if (type === '体验优先') return `Agent 根据${city}、${interests}和${draft.pace || '舒适节奏'}，保留更多体验停留时间。`
  if (type === '预算优先') return `Agent 根据人均预算 ¥${draft.budget || 0} 和${transport}，优先控制门票与交通成本。`
  return `Agent 根据${city}、${interests}和${transport}，优先减少绕路并覆盖核心点位。`
}

function getSystemNotifications(body = {}, subject = 'anonymous') {
  const user = body.user || null
  const readMap = getNotificationReadMap(subject, user?.id)
  const notifications = buildSystemNotifications(body)
    .filter((notice) => !readMap.has(notice.id))
    .map((notice) => ({ ...notice, readAt: null }))

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    unreadCount: notifications.length,
    notifications,
  }
}

function markSystemNotificationRead(body = {}, subject = 'anonymous') {
  const id = String(body.id || '').trim()
  if (!id) throw new Error('notification id is required')

  const readAt = new Date().toISOString()
  const readMap = getNotificationReadMap(subject, body.userId)
  readMap.set(id, readAt)

  return { ok: true, readId: id, readAt }
}

function getNotificationReadMap(subject, userId) {
  const key = `${subject}:${String(userId || 'anonymous')}`
  let readMap = notificationReadState.get(key)
  if (!readMap) {
    readMap = new Map()
    notificationReadState.set(key, readMap)
  }
  return readMap
}

function buildSystemNotifications(body = {}) {
  const user = body.user || {}
  const trips = Array.isArray(body.trips) ? body.trips : []
  const activeTrip = pickNotificationActiveTrip(trips)
  const activeDay = pickNotificationActiveDay(activeTrip)
  const visibleItems = activeDay?.items ?? []
  const completedCount = visibleItems.filter((item) => item.status === '已完成').length
  const currentItem = visibleItems.find((item) => item.status === '进行中') ??
    visibleItems.find((item) => item.status === '待出发') ??
    visibleItems[0]
  const routeNodeCount = visibleItems.filter(hasUsableNotificationCoordinate).length
  const travelerName = user.name || '当前用户'
  const cityLabel = user.city || activeTrip?.cityId || '目的地'
  const generatedAt = new Date().toISOString()
  const activeTripId = activeTrip?.id || 'no-trip'
  const activeDayId = activeDay?.day || 0
  const currentItemId = currentItem?.id || 'no-node'

  return [
    {
      id: `trip-progress:${activeTripId}:${activeDayId}:${completedCount}:${visibleItems.length}:${currentItemId}`,
      type: 'trip',
      title: `${travelerName} 的当前行程`,
      desc: activeTrip
        ? `${activeTrip.title} · ${activeDay ? `第${activeDay.day}天，` : ''}已完成 ${completedCount} / ${visibleItems.length} 个地点，当前节点 ${currentItem?.name ?? '暂无节点'}。`
        : '暂无当前行程，先创建或选择行程后再查看实时动态。',
      path: '/realtime',
      createdAt: generatedAt,
    },
    {
      id: `weather-status:${activeTripId}:${activeTrip?.startDate || 'none'}:${activeTrip?.endDate || 'none'}`,
      type: 'weather',
      title: '天气接口状态',
      desc: activeTrip
        ? `${activeTrip.title} 将在实时页读取 ${cityLabel} 的高德天气结果。`
        : '暂无行程时不会请求天气接口，创建行程后自动同步目的地天气。',
      path: '/realtime#weather-status',
      createdAt: generatedAt,
    },
    {
      id: `route-status:${activeTripId}:${routeNodeCount}:${visibleItems.length}`,
      type: 'route',
      title: '路线接口状态',
      desc: activeTrip
        ? routeNodeCount >= 2
          ? `${routeNodeCount} 个节点可用于高德路径规划与交通态势计算。`
          : `仅 ${routeNodeCount} 个节点有可用经纬度，实时页会提示路线数据不足。`
        : '暂无路线节点，系统不会展示虚构路径规划。',
      path: '/realtime#route-status',
      createdAt: generatedAt,
    },
  ]
}

function pickNotificationActiveTrip(trips) {
  return trips.find((trip) => trip.status !== '已完成' && trip.itinerary?.some((day) => day.items?.length > 0)) ??
    trips.find((trip) => trip.itinerary?.some((day) => day.items?.length > 0)) ??
    null
}

function pickNotificationActiveDay(trip) {
  if (!trip) return null
  const today = new Date().toISOString().slice(0, 10)
  return trip.itinerary?.find((day) => day.date === today && day.items?.length > 0) ??
    trip.itinerary?.find((day) => day.items?.length > 0) ??
    null
}

function hasUsableNotificationCoordinate(item) {
  const lng = Number(item?.lng)
  const lat = Number(item?.lat)
  return Number.isFinite(lng) && Number.isFinite(lat) && (lng !== 0 || lat !== 0)
}

async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      throw new Error(`Invalid JSON response: ${text.slice(0, 120)}`)
    }
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || `HTTP ${response.status}`)
    }
    return data
  } finally {
    clearTimeout(timeout)
  }
}

function readJson(req) {
  return new Promise((resolveRead, reject) => {
    const chunks = []
    let receivedBytes = 0
    let settled = false
    let tooLarge = false

    const rejectRead = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    req.on('data', (chunk) => {
      if (tooLarge) return

      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      receivedBytes += buffer.length
      if (receivedBytes > MAX_JSON_BODY_BYTES) {
        tooLarge = true
        rejectRead(new Error('Request body too large'))
        req.resume()
        return
      }

      chunks.push(buffer)
    })
    req.on('end', () => {
      if (settled) return
      const body = Buffer.concat(chunks, receivedBytes).toString('utf8')
      if (!body) {
        settled = true
        resolveRead({})
        return
      }
      try {
        const parsed = JSON.parse(body)
        settled = true
        resolveRead(parsed)
      } catch {
        rejectRead(new Error('Invalid JSON request body'))
      }
    })
    req.on('error', rejectRead)
  })
}

function sendJson(req, res, status, data) {
  setCors(req, res)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function setCors(req, res) {
  const origin = req.headers.origin
  const allowed = isOriginAllowed(origin)
  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Agent-Token')
  res.setHeader('Access-Control-Max-Age', '600')
  return allowed
}

function isOriginAllowed(origin) {
  if (!origin) return true
  return config.allowedOrigins.includes(origin) || isLocalDevOrigin(origin)
}

function isProtectedAgentPath(pathname) {
  if (pathname.startsWith('/api/data/')) return true
  return [
    '/api/agent/plan',
    '/api/agent/chat',
    '/api/agent/search',
    '/api/agent/realtime',
    '/api/agent/notifications',
    '/api/agent/notifications/read',
  ].includes(pathname)
}

function authenticateAgentRequest(req) {
  if (!config.apiToken) {
    return { ok: false, status: 503, error: 'Agent API token is not configured' }
  }

  const token = readRequestToken(req)
  if (!token || !safeEqual(token, config.apiToken)) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  return { ok: true, subject: `token:${token.slice(0, 8)}` }
}

function validateProductionAuthConfig(config) {
  const productionRuntime = process.env.NODE_ENV === 'production'
  const productionAuthMode = config.authMode === 'production'

  if (productionRuntime && !productionAuthMode) {
    return 'Production Agent auth is not configured: NODE_ENV=production requires AGENT_AUTH_MODE=production.'
  }

  if (!productionAuthMode) return ''

  if (!config.productionAuthReady) {
    return 'Production Agent auth is not configured: set AGENT_PRODUCTION_AUTH_READY=1 only after a real server-side auth boundary is in place.'
  }

  if (!config.apiToken) {
    return 'Production Agent auth is not configured: AGENT_API_TOKEN is required.'
  }

  if (isDemoAgentToken(config.apiToken)) {
    return 'Production Agent auth is not configured: AGENT_API_TOKEN still uses a demo placeholder.'
  }

  if (config.browserAgentToken && config.apiToken === config.browserAgentToken) {
    return 'Production Agent auth is not configured: AGENT_API_TOKEN must not equal browser-visible VITE_AGENT_API_TOKEN.'
  }

  return ''
}

function isDemoAgentToken(token) {
  const normalized = String(token || '').trim().toLowerCase()
  return !normalized ||
    normalized === 'change-me-local-agent-token' ||
    normalized === 'demo' ||
    normalized === 'demo-token' ||
    normalized === 'local-agent-token' ||
    normalized.includes('change-me')
}

function readRequestToken(req) {
  const auth = req.headers.authorization || ''
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return String(req.headers['x-agent-token'] || '').trim()
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function rateLimitBucketForPath(pathname) {
  if (pathname === '/api/agent/notifications' || pathname === '/api/agent/notifications/read') return 'notifications'
  if (pathname === '/api/agent/realtime' || pathname === '/api/data/realtime/snapshot' || pathname === '/api/data/dianping/realtime/queue') return 'realtime'
  return 'search-chat-plan'
}

function checkRateLimit(subject, bucket = 'search-chat-plan') {
  const now = Date.now()
  const key = `${subject || 'anonymous'}:${bucket}`
  const current = rateLimitBuckets.get(key)

  if (!current || now >= current.resetAt) {
    const next = { count: 1, resetAt: now + config.rateLimitWindowMs }
    rateLimitBuckets.set(key, next)
    return {
      allowed: true,
      bucket,
      limit: config.rateLimitMax,
      remaining: Math.max(0, config.rateLimitMax - 1),
      resetAt: next.resetAt,
    }
  }

  current.count += 1
  const remaining = Math.max(0, config.rateLimitMax - current.count)
  return {
    allowed: current.count <= config.rateLimitMax,
    bucket,
    limit: config.rateLimitMax,
    remaining,
    resetAt: current.resetAt,
  }
}

function setRateLimitHeaders(res, rateLimit) {
  res.setHeader('X-RateLimit-Bucket', rateLimit.bucket)
  res.setHeader('X-RateLimit-Limit', String(rateLimit.limit))
  res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetAt / 1000)))
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
    res.setHeader('Retry-After', String(retryAfter))
  }
}

function statusOf(error) {
  const message = messageOf(error)
  if (message === 'Invalid JSON request body' || message === 'Request body too large') return 400
  return 500
}

function publicErrorMessage(error) {
  const message = messageOf(error)
  if (message === 'Invalid JSON request body' || message === 'Request body too large') return message
  return 'Internal server error'
}

function externalWarning(error) {
  const message = messageOf(error)
  if (message.includes('quota') || message.includes('CUQPS_HAS_EXCEEDED_THE_LIMIT')) {
    return 'external map quota exceeded'
  }
  if (message.includes('missing') || message.includes('configured')) return 'external service is not configured'
  if (message.includes('aborted') || message.includes('timeout')) return 'external service timed out'
  return 'external service temporarily unavailable'
}

function getAmapCache(key) {
  const item = amapCache.get(key)
  if (!item) return null
  if (Date.now() > item.expiresAt) {
    amapCache.delete(key)
    return null
  }
  return item.value
}

function setAmapCache(key, value) {
  amapCache.set(key, { value, expiresAt: Date.now() + config.amapCacheTtlMs })
  if (amapCache.size > 200) {
    const firstKey = amapCache.keys().next().value
    if (firstKey) amapCache.delete(firstKey)
  }
}

async function throttleAmap() {
  const elapsed = Date.now() - lastAmapRequestAt
  const delay = config.amapMinIntervalMs - elapsed
  if (delay > 0) await wait(delay)
  lastAmapRequestAt = Date.now()
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms))
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function resolveAllowedOrigins(value) {
  const explicitOrigins = parseCsv(value)
  if (explicitOrigins.length === 0) return DEFAULT_ALLOWED_ORIGINS
  if (process.env.NODE_ENV === 'production') return unique(explicitOrigins)
  return unique([...explicitOrigins, ...DEFAULT_ALLOWED_ORIGINS])
}

function isLocalDevOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false

  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:') return false
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return false
    return LOCAL_DEV_ORIGIN_PORTS.has(url.port)
  } catch {
    return false
  }
}

function normalizeLlmProvider(value) {
  const provider = String(value || DEFAULT_LLM_PROVIDER).trim().toLowerCase()
  return LLM_PROVIDER_CONFIG[provider] ? provider : DEFAULT_LLM_PROVIDER
}

function currentLlmProvider() {
  return LLM_PROVIDER_CONFIG[config.llmProvider] || LLM_PROVIDER_CONFIG[DEFAULT_LLM_PROVIDER]
}

function currentLlmApiKey() {
  const { source } = currentLlmProvider()
  return config[`${source}ApiKey`] || ''
}

function currentLlmBaseUrl() {
  const { source } = currentLlmProvider()
  return config[`${source}BaseUrl`] || ''
}

function isLlmConfigured() {
  return Boolean(currentLlmApiKey())
}

function llmSource() {
  return currentLlmProvider().source
}

function llmProviderLabel() {
  return currentLlmProvider().label
}

function parsePositiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
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

function loadCityMeta(path) {
  try {
    const content = readFileSync(path, 'utf8')
    const data = JSON.parse(content)
    const cities = Array.isArray(data?.cities) ? data.cities : []
    if (cities.length === 0) throw new Error('city metadata is empty')

    return Object.fromEntries(
      cities.map((city) => [
        String(city.id || '').trim(),
        {
          name: String(city.name || '').trim(),
          officialName: String(city.officialName || '').trim(),
          adcode: String(city.adcode || '').trim(),
        },
      ]),
    )
  } catch (error) {
    console.warn('[agent-server] failed to load city metadata from JSON, using legacy fallback:', messageOf(error))
    return {
      shanghai: { name: '上海', officialName: '上海市', adcode: '310000' },
      beijing: { name: '北京', officialName: '北京市', adcode: '110000' },
      hangzhou: { name: '杭州', officialName: '杭州市', adcode: '330100' },
      chengdu: { name: '成都', officialName: '成都市', adcode: '510100' },
      xian: { name: '西安', officialName: '西安市', adcode: '610100' },
      sanya: { name: '三亚', officialName: '三亚市', adcode: '460200' },
    }
  }
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Model did not return JSON')
    return JSON.parse(match[0])
  }
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function uniqueBy(values, keyFn) {
  const seen = new Set()
  return values.filter((value) => {
    const key = keyFn(value)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeStringArray(value, fallback = []) {
  if (!Array.isArray(value)) return Array.isArray(fallback) ? fallback : []
  return value.map((item) => String(item)).filter(Boolean)
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function finitePositiveNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function stringOrUndefined(value) {
  const text = String(value || '').trim()
  return text || undefined
}

function omitUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

function normalizeRating(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function sanitizeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `id-${Date.now()}`
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

function summarizeRouteForLlm(route) {
  if (!route) return null
  return {
    distanceText: route.distanceText,
    durationText: route.durationText,
    congestionLegs: route.congestionLegs,
    legs: (route.legs || []).map((leg) => ({
      from: leg.from?.name,
      to: leg.to?.name,
      mode: leg.mode,
      distanceText: leg.distanceText,
      durationText: leg.durationText,
      trafficStatus: leg.trafficStatus || null,
    })),
  }
}

function summarizeTrafficForLlm(traffic) {
  if (!traffic) return null
  return {
    status: traffic.status,
    description: traffic.description,
    expedite: traffic.expedite,
    congested: traffic.congested,
  }
}
