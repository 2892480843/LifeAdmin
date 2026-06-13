import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('external facts are wrapped with source, timestamps, freshness and raw snapshot id', async () => {
  const {
    createSourcedField,
    isFreshSourcedField,
    isTrustedForProduction,
  } = await import('../server/data-layer.mjs')

  const field = createSourcedField('09:00-18:00', {
    sourceProvider: 'amap',
    sourceEndpoint: 'place/detail',
    sourceId: 'B012345',
    fetchedAt: '2026-06-07T00:00:00.000Z',
    expiresAt: '2026-06-07T01:00:00.000Z',
    confidence: 'provider_snapshot',
    rawSnapshotId: 'snap_1',
  }, new Date('2026-06-07T00:30:00.000Z'))

  assert.equal(field.value, '09:00-18:00')
  assert.equal(field.sourceProvider, 'amap')
  assert.equal(field.sourceEndpoint, 'place/detail')
  assert.equal(field.sourceId, 'B012345')
  assert.equal(field.fetchedAt, '2026-06-07T00:00:00.000Z')
  assert.equal(field.expiresAt, '2026-06-07T01:00:00.000Z')
  assert.equal(field.confidence, 'provider_snapshot')
  assert.equal(field.rawSnapshotId, 'snap_1')
  assert.equal(field.stale, false)
  assert.equal(field.unavailableReason, null)
  assert.equal(isFreshSourcedField(field, new Date('2026-06-07T00:30:00.000Z')), true)
  assert.equal(isTrustedForProduction(field), true)
})

test('expired and demo fields cannot be displayed as fresh production facts', async () => {
  const {
    createSourcedField,
    createUnavailableField,
    isFreshSourcedField,
    isTrustedForProduction,
  } = await import('../server/data-layer.mjs')

  const expired = createSourcedField('拥堵', {
    sourceProvider: 'amap',
    sourceEndpoint: 'traffic/status/circle',
    sourceId: '121.490000,31.240000',
    fetchedAt: '2026-06-07T00:00:00.000Z',
    expiresAt: '2026-06-07T00:02:00.000Z',
    confidence: 'realtime_observation',
    rawSnapshotId: 'snap_traffic',
  }, new Date('2026-06-07T00:03:00.000Z'))

  const demo = createSourcedField('免费', {
    sourceProvider: 'demo_mock',
    sourceEndpoint: 'src/mock/pois.ts',
    sourceId: 'waitan',
    fetchedAt: '2026-06-07T00:00:00.000Z',
    expiresAt: '2026-06-08T00:00:00.000Z',
    confidence: 'demo_mock',
    rawSnapshotId: 'demo_waitan',
  }, new Date('2026-06-07T00:01:00.000Z'))

  const unavailable = createUnavailableField('暂无官方实时数据源', {
    sourceProvider: 'unavailable',
    sourceEndpoint: 'queue',
    sourceId: 'queue',
    confidence: 'unavailable',
    rawSnapshotId: 'unavailable_queue',
  })

  assert.equal(expired.stale, true)
  assert.equal(isFreshSourcedField(expired, new Date('2026-06-07T00:03:00.000Z')), false)
  assert.equal(isTrustedForProduction(expired), false)
  assert.equal(isTrustedForProduction(demo), false)
  assert.equal(isTrustedForProduction(unavailable), false)
  assert.equal(unavailable.value, null)
  assert.equal(unavailable.unavailableReason, '暂无官方实时数据源')
})

test('production mode does not mix demo or generated seed POIs into the app fact pool', () => {
  const appContext = readFileSync(resolve(root, 'src/store/AppContext.tsx'), 'utf8')
  const poiLoader = readFileSync(resolve(root, 'src/mock/poiLoader.ts'), 'utf8')

  assert.match(appContext, /isProductionDataMode/)
  assert.match(appContext, /productionPois/)
  assert.match(appContext, /isProductionDataMode\s*\?\s*\[\]\s*:\s*mockPois/)
  assert.match(poiLoader, /sourceKind:\s*'demo_mock'/)
})

test('browser-side code never references server-only provider keys', () => {
  const frontendFiles = [
    'src/services/agent.ts',
    'src/services/realtimeService.ts',
    'src/store/AppContext.tsx',
    'src/pages/Explore.tsx',
    'src/pages/PoiDetail.tsx',
    'src/pages/Realtime.tsx',
    'src/vite-env.d.ts',
  ]

  for (const file of frontendFiles) {
    const source = readFileSync(resolve(root, file), 'utf8')
    assert.doesNotMatch(source, /AMAP_WEB_SERVICE_KEY|DEEPSEEK_API_KEY|LONGCAT_API_KEY|process\.env/)
  }
})

test('LLM-derived recommendations cannot introduce unverified realtime, ticket or opening facts', async () => {
  const { sanitizeDerivedRecommendation } = await import('../server/data-layer.mjs')

  const recommendation = sanitizeDerivedRecommendation({
    source: 'deepseek',
    summary: '建议先去豫园，排队 30 分钟，门票 40 元，当前营业。',
    risks: [
      { type: 'queue', level: '中', title: '排队 30 分钟', reason: '预计排队 30 分钟' },
      { type: 'weather', level: '低', title: '天气正常', reason: '天气接口返回多云' },
    ],
    actions: [
      { id: 'buy-ticket', label: '购买门票 40 元', description: '按 40 元购票', canApply: true },
    ],
  }, {
    verifiedFieldNames: new Set(['weather']),
  })

  assert.doesNotMatch(recommendation.summary, /排队\s*30|门票\s*40|当前营业/)
  assert.equal(recommendation.risks[0].title, '排队暂无实时数据')
  assert.equal(recommendation.risks[0].reason, '暂无实时数据：当前项目没有官方实时数据源，不能推断排队或人流情况。')
  assert.equal(recommendation.actions[0].canApply, false)
  assert.match(recommendation.actions[0].unavailableReason, /未验证/)
})

test('LLM-derived recommendations cannot invent Dianping reputation or queue facts', async () => {
  const { sanitizeDerivedRecommendation } = await import('../server/data-layer.mjs')

  const recommendation = sanitizeDerivedRecommendation({
    source: 'deepseek',
    summary: '这家店人均价 88 元，推荐菜小笼包，评论数 1200，排队 20 分钟。',
    risks: [
      { type: 'queue', level: '中', title: '排队 20 分钟', reason: '大众点评显示排队 20 分钟' },
    ],
    actions: [
      { id: 'dianping-dish', label: '点推荐菜小笼包', description: '按人均价 88 元安排预算', canApply: true },
    ],
  }, {
    verifiedFieldNames: new Set(),
  })

  assert.doesNotMatch(recommendation.summary, /人均价\s*88|推荐菜|评论数\s*1200|排队\s*20/)
  assert.equal(recommendation.risks[0].title, '排队暂无实时数据')
  assert.equal(recommendation.actions[0].canApply, false)
  assert.doesNotMatch(recommendation.actions[0].label, /推荐菜/)
})
