import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DEFAULT_RUNTIME_DIR = resolve(ROOT, 'data/runtime')
const DEFAULT_SNAPSHOT_DIR = resolve(DEFAULT_RUNTIME_DIR, 'provider-snapshots')
const DEFAULT_AUDIT_LOG = resolve(DEFAULT_RUNTIME_DIR, 'audit-log.jsonl')

export const DATA_SOURCE_KINDS = Object.freeze({
  authoritativeStatic: 'authoritative_static',
  providerSnapshot: 'provider_snapshot',
  realtimeObservation: 'realtime_observation',
  derivedRecommendation: 'derived_recommendation',
  demoMock: 'demo_mock',
  unavailable: 'unavailable',
})

const UNVERIFIED_FACT_RE =
  /(排队\s*\d+|等位\s*\d+|人流\s*(?:较多|拥挤|爆满)|门票\s*\d+|票价\s*\d+|人均价\s*\d+|人均\s*\d+|评论数\s*\d+|推荐菜\S*|当前营业|正在营业|实时拥堵|预计拥堵|开放中)/gi

export function createRawSnapshotId(prefix = 'snap') {
  const safePrefix = String(prefix || 'snap').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'snap'
  return `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function createSourcedField(value, meta = {}, now = new Date()) {
  const fetchedAt = isoString(meta.fetchedAt, now)
  const expiresAt = isoString(meta.expiresAt, new Date(Date.parse(fetchedAt) + Number(meta.ttlMs || 0)))
  const unavailableReason = meta.unavailableReason ?? null
  const stale = Boolean(meta.stale) || !expiresAt || Date.parse(expiresAt) <= now.getTime()

  return {
    value,
    sourceProvider: String(meta.sourceProvider || ''),
    sourceEndpoint: String(meta.sourceEndpoint || ''),
    sourceId: String(meta.sourceId || ''),
    fetchedAt,
    expiresAt,
    confidence: String(meta.confidence || DATA_SOURCE_KINDS.unavailable),
    stale,
    unavailableReason,
    rawSnapshotId: String(meta.rawSnapshotId || createRawSnapshotId('field')),
  }
}

export function createUnavailableField(reason, meta = {}, now = new Date()) {
  const rawSnapshotId = String(meta.rawSnapshotId || createRawSnapshotId('unavailable'))
  return createSourcedField(null, {
    ...meta,
    sourceProvider: meta.sourceProvider || DATA_SOURCE_KINDS.unavailable,
    sourceEndpoint: meta.sourceEndpoint || DATA_SOURCE_KINDS.unavailable,
    sourceId: meta.sourceId || DATA_SOURCE_KINDS.unavailable,
    confidence: meta.confidence || DATA_SOURCE_KINDS.unavailable,
    fetchedAt: meta.fetchedAt || now.toISOString(),
    expiresAt: meta.expiresAt || now.toISOString(),
    stale: true,
    unavailableReason: reason,
    rawSnapshotId,
  }, now)
}

export function isFreshSourcedField(field, now = new Date()) {
  if (!field || field.value == null || field.unavailableReason) return false
  if (field.stale) return false
  const expiresAt = Date.parse(field.expiresAt || '')
  return Number.isFinite(expiresAt) && expiresAt > now.getTime()
}

export function isTrustedForProduction(field, now = null) {
  const fresh = now instanceof Date
    ? isFreshSourcedField(field, now)
    : Boolean(field && field.value != null && !field.unavailableReason && !field.stale)
  if (!fresh) return false
  return ![
    DATA_SOURCE_KINDS.demoMock,
    DATA_SOURCE_KINDS.unavailable,
    'demo_mock',
    'local-fallback',
    'provider_seed',
  ].includes(String(field.sourceProvider || field.confidence || ''))
}

export function wrapPoiAsSourced(poi, meta = {}, now = new Date()) {
  const fetchedAt = meta.fetchedAt || now.toISOString()
  const rawSnapshotId = meta.rawSnapshotId || createRawSnapshotId('poi')
  const base = {
    sourceProvider: meta.sourceProvider || 'amap',
    sourceEndpoint: meta.sourceEndpoint || 'place/text',
    sourceId: meta.sourceId || poi?.id || '',
    fetchedAt,
    expiresAt: meta.expiresAt || new Date(Date.parse(fetchedAt) + Number(meta.ttlMs || 24 * 60 * 60_000)).toISOString(),
    confidence: meta.confidence || DATA_SOURCE_KINDS.providerSnapshot,
    rawSnapshotId,
  }

  const field = (value, override = {}) => createSourcedField(value, { ...base, ...override }, now)
  const unavailable = (reason, override = {}) => createUnavailableField(reason, { ...base, ...override }, now)

  return {
    id: poi?.id || '',
    rawSnapshotId,
    sourceProvider: base.sourceProvider,
    sourceEndpoint: base.sourceEndpoint,
    sourceId: base.sourceId,
    fetchedAt: base.fetchedAt,
    expiresAt: base.expiresAt,
    stale: Date.parse(base.expiresAt) <= now.getTime(),
    fields: {
      name: poi?.name ? field(poi.name) : unavailable('POI name is unavailable'),
      category: poi?.category ? field(poi.category) : unavailable('POI category is unavailable'),
      address: poi?.address ? field(poi.address) : unavailable('POI address is unavailable'),
      openingHours: poi?.openingHours ? field(poi.openingHours) : unavailable('Opening hours are unavailable'),
      ticket: poi?.ticket ? field(poi.ticket) : unavailable('Ticket or price data is unavailable'),
      rating: Number.isFinite(Number(poi?.rating)) ? field(Number(poi.rating)) : unavailable('Rating is unavailable'),
      lng: Number.isFinite(Number(poi?.lng)) ? field(Number(poi.lng)) : unavailable('Longitude is unavailable'),
      lat: Number.isFinite(Number(poi?.lat)) ? field(Number(poi.lat)) : unavailable('Latitude is unavailable'),
      cover: poi?.cover ? field(poi.cover) : unavailable('Trusted cover image is unavailable'),
    },
    raw: poi,
  }
}

export function writeProviderSnapshot(snapshot, options = {}) {
  const dir = options.snapshotDir || DEFAULT_SNAPSHOT_DIR
  const auditLog = options.auditLog || DEFAULT_AUDIT_LOG
  ensureDir(dir)
  ensureDir(resolve(auditLog, '..'))

  const rawSnapshotId = snapshot.rawSnapshotId || createRawSnapshotId(snapshot.sourceProvider || 'snapshot')
  const normalized = {
    ...snapshot,
    rawSnapshotId,
    storedAt: snapshot.storedAt || new Date().toISOString(),
  }

  writeFileSync(join(dir, `${rawSnapshotId}.json`), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  appendFileSync(auditLog, `${JSON.stringify({
    rawSnapshotId,
    sourceProvider: normalized.sourceProvider,
    sourceEndpoint: normalized.sourceEndpoint,
    sourceId: normalized.sourceId,
    storedAt: normalized.storedAt,
    stale: Boolean(normalized.stale),
    unavailableReason: normalized.unavailableReason || null,
  })}\n`, 'utf8')
  return normalized
}

export function readAuditRecord(rawSnapshotId, options = {}) {
  const id = String(rawSnapshotId || '').trim()
  if (!id) return null
  const auditLog = options.auditLog || DEFAULT_AUDIT_LOG
  if (existsSync(auditLog)) {
    const rows = readFileSync(auditLog, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => safeJson(line))
      .filter(Boolean)
    const found = rows.reverse().find((row) => row.rawSnapshotId === id)
    if (found) return found
  }

  const dir = options.snapshotDir || DEFAULT_SNAPSHOT_DIR
  const path = join(dir, `${id}.json`)
  if (existsSync(path)) return safeJson(readFileSync(path, 'utf8'))
  return null
}

export function listRuntimeSnapshotIds(options = {}) {
  const dir = options.snapshotDir || DEFAULT_SNAPSHOT_DIR
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort()
}

export function sanitizeDerivedRecommendation(recommendation, context = {}) {
  const verifiedFieldNames = context.verifiedFieldNames instanceof Set ? context.verifiedFieldNames : new Set(context.verifiedFieldNames || [])
  const source = recommendation?.source || 'deepseek'
  const summary = stripUnverifiedFacts(String(recommendation?.summary || '暂无可用建议'))

  return {
    source,
    summary: summary || '暂无可用建议',
    risks: normalizeDerivedRisks(recommendation?.risks, verifiedFieldNames),
    actions: normalizeDerivedActions(recommendation?.actions, verifiedFieldNames),
  }
}

function normalizeDerivedRisks(risks, verifiedFieldNames) {
  if (!Array.isArray(risks)) return []
  return risks.slice(0, 6).map((risk, index) => {
    const type = ['traffic', 'weather', 'queue', 'crowd', 'route', 'unknown'].includes(risk?.type) ? risk.type : 'unknown'
    if ((type === 'queue' || type === 'crowd') && !verifiedFieldNames.has(type)) {
      return {
        type,
        level: '低',
        title: type === 'queue' ? '排队暂无实时数据' : '人流暂无实时数据',
        reason: '暂无实时数据：当前项目没有官方实时数据源，不能推断排队或人流情况。',
      }
    }

    const verified = verifiedFieldNames.has(type)
    return {
      type,
      level: ['高', '中', '低'].includes(risk?.level) ? risk.level : '中',
      title: verified ? stripUnverifiedFacts(String(risk?.title || `风险项 ${index + 1}`)) : `${defaultRiskTitle(type)}待验证`,
      reason: verified ? stripUnverifiedFacts(String(risk?.reason || '暂无详细说明')) : `暂无可信${defaultRiskTitle(type)}事实源。`,
    }
  })
}

function normalizeDerivedActions(actions, verifiedFieldNames) {
  if (!Array.isArray(actions)) return []
  return actions.slice(0, 6).map((action, index) => {
    const text = `${action?.label || ''} ${action?.description || ''}`
    const hasUnverifiedFact = UNVERIFIED_FACT_RE.test(text) || /(ticket|price|opening|queue|crowd)/i.test(String(action?.id || ''))
    UNVERIFIED_FACT_RE.lastIndex = 0
    const canApply = action?.canApply === true && !hasUnverifiedFact && verifiedFieldNames.size > 0
    return {
      id: sanitizeId(action?.id || `action-${index + 1}`),
      label: stripUnverifiedFacts(String(action?.label || `建议 ${index + 1}`)) || `建议 ${index + 1}`,
      description: stripUnverifiedFacts(String(action?.description || '暂无详细说明')) || '暂无详细说明',
      canApply,
      unavailableReason: canApply ? undefined : String(action?.unavailableReason || '包含未验证事实或缺少可信数据源，当前仅可作为参考。'),
    }
  })
}

function stripUnverifiedFacts(text) {
  UNVERIFIED_FACT_RE.lastIndex = 0
  return String(text || '').replace(UNVERIFIED_FACT_RE, '暂无可信数据').replace(/\s+/g, ' ').trim()
}

function defaultRiskTitle(type) {
  if (type === 'traffic') return '交通'
  if (type === 'weather') return '天气'
  if (type === 'route') return '路线'
  if (type === 'queue') return '排队'
  if (type === 'crowd') return '人流'
  return '风险'
}

function isoString(value, fallback) {
  const time = Date.parse(String(value || ''))
  if (Number.isFinite(time)) return new Date(time).toISOString()
  return fallback instanceof Date && Number.isFinite(fallback.getTime()) ? fallback.toISOString() : ''
}

function sanitizeId(value) {
  return String(value || 'item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item'
}

function safeJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}
