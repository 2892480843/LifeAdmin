import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { getSmokePort } from './smoke-ports.mjs'

const root = process.cwd()

test('dianping signature is stable and excludes empty values, sign and appsecret', async () => {
  const { signDianpingParams } = await import('../server/providers/dianping-provider.mjs')

  const signature = signDianpingParams({
    AppKey: 'demo-key',
    Foo: 'bar',
    Session: 'demo-session',
    Timestamp: '2026-06-08 00:00:00',
    Empty: '',
    sign: 'must-not-be-signed',
    appsecret: 'must-not-be-signed',
    appsecrect: 'must-not-be-signed',
  }, 'secret')

  assert.equal(signature, 'abf5ed2204febf91432693a2596dbb3a')
})

test('dianping POI search constructs a signed request and normalizes sourced fields', async () => {
  const { searchDianpingPois } = await import('../server/providers/dianping-provider.mjs')
  let capturedRequest = null

  const result = await searchDianpingPois({
    keyword: '火锅',
    cityName: '上海',
    lng: 121.4737,
    lat: 31.2304,
    categories: ['美食'],
    page: 2,
    limit: 5,
    timestamp: '1780819200000',
  }, {
    config: {
      appKey: 'demo-key',
      appSecret: 'secret',
      session: 'demo-session',
      cacheTtlMs: 600_000,
    },
    requestJson: async (request) => {
      capturedRequest = request
      return {
        status: 'OK',
        records: [
          {
            openshopid: 'dp-001',
            name: '测试火锅',
            branchname: '人民广场店',
            shopaddress: '上海市黄浦区测试路 1 号',
            category: '火锅',
            distance: 860,
            latitude: 31.2304,
            longitude: 121.4737,
          },
        ],
      }
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.source, 'dianping')
  assert.equal(capturedRequest.url, 'https://poiopen.dianping.com/router/poisearch/search')
  assert.equal(capturedRequest.params.appkey, 'demo-key')
  assert.equal(capturedRequest.params.session, 'demo-session')
  assert.equal(capturedRequest.params.keyword, '火锅')
  assert.equal(capturedRequest.params.city, '上海')
  assert.equal(capturedRequest.params.categories, '美食')
  assert.equal(capturedRequest.params.latitude, 31.2304)
  assert.equal(capturedRequest.params.longitude, 121.4737)
  assert.equal(capturedRequest.params.page, 2)
  assert.equal(capturedRequest.params.limit, 5)
  assert.equal(capturedRequest.params.timestamp, '1780819200000')
  assert.match(capturedRequest.params.sign, /^[a-f0-9]{32}$/)

  const [poi] = result.pois
  assert.equal(poi.id, 'dp-001')
  assert.equal(poi.sourceProvider, 'dianping')
  assert.equal(poi.sourceId, 'dp-001')
  assert.equal(poi.name, '测试火锅（人民广场店）')
  assert.equal(poi.category, '美食')
  assert.equal(poi.address, '上海市黄浦区测试路 1 号')
  assert.equal(poi.distance, 0.86)
  assert.equal(poi.lat, 31.2304)
  assert.equal(poi.lng, 121.4737)
  assert.equal(poi.fields.name.sourceProvider, 'dianping')
  assert.equal(poi.fields.rating.value, null)
  assert.match(poi.fields.rating.unavailableReason, /unavailable/i)
  assert.equal(result.fields.pois.sourceProvider, 'dianping')
  assert.equal(result.fields.pois.value.length, 1)
})

test('dianping detail and queue use official openshopid endpoints and normalize fields', async () => {
  const {
    DIANPING_POI_DETAIL_URL,
    DIANPING_REALTIME_QUEUE_URL,
    createDianpingProvider,
  } = await import('../server/providers/dianping-provider.mjs')
  const capturedRequests = []
  const provider = createDianpingProvider({
    appKey: 'demo-key',
    appSecret: 'secret',
    session: 'demo-session',
    cacheTtlMs: 600_000,
    queueTtlMs: 120_000,
  }, {
    requestJson: async (request) => {
      capturedRequests.push(request)
      if (request.endpoint === 'poi/getsinglepoi') {
        return {
          status: 'success',
          success: true,
          data: {
            openshopid: 'dp-001',
            shopDesc: '本地口碑餐厅',
            reviewCount: 42,
            star: 4.5,
            avgprice: 88,
            dishs: [{ dishName: '小笼包' }],
            shopPics: [{ picUrl: 'https://img.example.com/shop.jpg', title: '门头' }],
          },
        }
      }
      return {
        status: 'success',
        success: true,
        data: {
          queueInfo: {
            msg: '当前等位约20分钟',
            shortMsg: '约20分钟',
          },
        },
      }
    },
  })

  const detail = await provider.getPoiDetail({ sourceId: 'dp-001', timestamp: '1780819200000' })
  const queue = await provider.getQueue({ sourceId: 'dp-001', timestamp: '1780819200000' })

  assert.equal(capturedRequests[0].endpoint, 'poi/getsinglepoi')
  assert.equal(capturedRequests[0].url, DIANPING_POI_DETAIL_URL)
  assert.equal(capturedRequests[0].params.openshopid, 'dp-001')
  assert.equal(detail.fields.rating.sourceEndpoint, 'poi/getsinglepoi')
  assert.equal(detail.fields.rating.value, 4.5)
  assert.equal(detail.fields.avgPrice.value, 88)
  assert.deepEqual(detail.fields.recommendedDishes.value, ['小笼包'])
  assert.equal(detail.fields.images.value[0].url, 'https://img.example.com/shop.jpg')

  assert.equal(capturedRequests[1].endpoint, 'realtime/getcoopinfo')
  assert.equal(capturedRequests[1].url, DIANPING_REALTIME_QUEUE_URL)
  assert.equal(capturedRequests[1].params.openshopid, 'dp-001')
  assert.equal(queue.fields.queue.sourceEndpoint, 'realtime/getcoopinfo')
  assert.equal(queue.fields.queue.value.status, '约20分钟')
  assert.equal(queue.fields.queue.value.fetchedText, '当前等位约20分钟')
})

test('dianping provider returns sourced unavailable fields when disabled or unconfigured', async () => {
  const { createDianpingProvider } = await import('../server/providers/dianping-provider.mjs')
  const runtimeDir = mkdtempSync(join(tmpdir(), 'routewise-dianping-'))

  try {
    const provider = createDianpingProvider({
      enabled: false,
      appKey: '',
      appSecret: '',
      session: '',
      snapshotDir: join(runtimeDir, 'provider-snapshots'),
      auditLog: join(runtimeDir, 'audit-log.jsonl'),
    })

    const detail = await provider.getPoiDetail({ sourceId: 'dp-001', name: '测试餐厅' })
    assert.equal(detail.ok, false)
    assert.equal(detail.status, 'missing-config')
    assert.equal(detail.fields.rating.value, null)
    assert.equal(detail.fields.rating.sourceProvider, 'dianping')
    assert.equal(detail.fields.rating.sourceEndpoint, 'poi/getsinglepoi')
    assert.equal(detail.fields.rating.confidence, 'unavailable')
    assert.equal(detail.fields.rating.stale, true)
    assert.match(detail.fields.rating.unavailableReason, /not configured|disabled/i)

    const auditLog = readFileSync(join(runtimeDir, 'audit-log.jsonl'), 'utf8')
    assert.match(auditLog, /"sourceProvider":"dianping"/)
    assert.match(auditLog, /"sourceEndpoint":"poi\/getsinglepoi"/)
    assert.match(auditLog, /Dianping provider is disabled or not configured/)
  } finally {
    rmSync(runtimeDir, { recursive: true, force: true })
  }
})

test('dianping POI detail constructs getsinglepoi request and maps official rich fields', async () => {
  const { createDianpingProvider } = await import('../server/providers/dianping-provider.mjs')
  let capturedRequest = null
  const provider = createDianpingProvider({
    appKey: 'demo-key',
    appSecret: 'secret',
    session: 'demo-session',
    cacheTtlMs: 600_000,
  }, {
    requestJson: async (request) => {
      capturedRequest = request
      return {
        success: true,
        status: 'success',
        data: {
          openshopid: 'dp-001',
          name: '测试餐厅',
          branch_name: '南京东路店',
          address: '上海市黄浦区测试路 2 号',
          categories: ['火锅'],
          city: '上海',
          latitude: 31.231,
          longitude: 121.474,
          business_hour: '10:00-22:00',
          star: 4.7,
          reviewCount: 1288,
          avgprice: 139,
          shopPics: [{ picUrl: 'https://example.com/shop.jpg', title: '门头' }],
          dishs: [{ dishName: '招牌锅底' }, { dishName: '虾滑' }],
          queueable: true,
          mQueueUrl: 'https://example.com/queue',
        },
      }
    },
  })

  const detail = await provider.getPoiDetail({
    sourceId: 'dp-001',
    timestamp: '2026-06-08 00:00:00',
  })

  assert.equal(detail.ok, true)
  assert.equal(capturedRequest.url, 'https://poiopen.dianping.com/router/poi/getsinglepoi')
  assert.equal(capturedRequest.params.openshopid, 'dp-001')
  assert.match(capturedRequest.params.sign, /^[a-f0-9]{32}$/)
  assert.equal(detail.poi.id, 'dp-001')
  assert.equal(detail.poi.name, '测试餐厅（南京东路店）')
  assert.equal(detail.poi.category, '美食')
  assert.equal(detail.poi.address, '上海市黄浦区测试路 2 号')
  assert.equal(detail.fields.rating.value, 4.7)
  assert.equal(detail.fields.commentCount.value, 1288)
  assert.equal(detail.fields.avgPrice.value, 139)
  assert.deepEqual(detail.fields.recommendedDishes.value, ['招牌锅底', '虾滑'])
  assert.deepEqual(detail.fields.images.value, [{ url: 'https://example.com/shop.jpg', title: '门头' }])
  assert.equal(detail.fields.queue.value.status, 'queueable')
  assert.equal(detail.fields.queue.value.fetchedText, '支持排号')
})

test('dianping realtime queue constructs getcoopinfo request and maps queueInfo', async () => {
  const { createDianpingProvider } = await import('../server/providers/dianping-provider.mjs')
  let capturedRequest = null
  const provider = createDianpingProvider({
    appKey: 'demo-key',
    appSecret: 'secret',
    session: 'demo-session',
    queueTtlMs: 120_000,
  }, {
    requestJson: async (request) => {
      capturedRequest = request
      return {
        success: true,
        status: 'success',
        data: {
          queueInfo: {
            msg: '当前无需排队',
            shortMsg: '无需排队',
          },
        },
      }
    },
  })

  const queue = await provider.getQueue({
    sourceId: 'dp-001',
    timestamp: '2026-06-08 00:00:00',
  })

  assert.equal(queue.ok, true)
  assert.equal(capturedRequest.url, 'https://poiopen.dianping.com/router/realtime/getcoopinfo')
  assert.equal(capturedRequest.params.openshopid, 'dp-001')
  assert.match(capturedRequest.params.sign, /^[a-f0-9]{32}$/)
  assert.equal(queue.fields.queue.sourceEndpoint, 'realtime/getcoopinfo')
  assert.deepEqual(queue.fields.queue.value, {
    status: '无需排队',
    waitingMinutes: null,
    waitingTables: null,
    fetchedText: '当前无需排队',
  })
})

test('dianping data endpoints degrade without credentials and preserve provenance', async () => {
  const token = `dianping-${randomUUID()}`
  const port = await getSmokePort(undefined, 'dianping')
  const origin = 'http://127.0.0.1:5173'
  const baseUrl = `http://127.0.0.1:${port}`
  const server = spawn(process.execPath, ['server/agent-server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      AGENT_LOAD_DOTENV: '0',
      AGENT_PORT: String(port),
      AGENT_AUTH_MODE: 'demo',
      AGENT_PRODUCTION_AUTH_READY: '0',
      AGENT_API_TOKEN: token,
      VITE_AGENT_API_TOKEN: token,
      AGENT_ALLOWED_ORIGINS: origin,
      DIANPING_ENABLED: '0',
      DIANPING_APP_KEY: '',
      DIANPING_APP_SECRET: '',
      DIANPING_SESSION: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  try {
    await waitForHealth(`${baseUrl}/health`)
    const detail = await postJson(baseUrl, token, origin, '/api/data/dianping/pois/detail', {
      sourceId: 'dp-001',
      name: '测试餐厅',
    })

    assert.equal(detail.ok, false)
    assert.equal(detail.status, 'missing-config')
    assert.equal(detail.fields.avgPrice.sourceProvider, 'dianping')
    assert.equal(detail.fields.avgPrice.confidence, 'unavailable')
    assert.equal(detail.fields.avgPrice.stale, true)
    assert.ok(detail.rawSnapshotId)

    const queue = await postJson(baseUrl, token, origin, '/api/data/dianping/realtime/queue', {
      sourceId: 'dp-001',
    })
    assert.equal(queue.fields.queue.sourceProvider, 'dianping')
    assert.equal(queue.fields.queue.sourceEndpoint, 'realtime/getcoopinfo')
    assert.equal(queue.fields.queue.value, null)

    const search = await postJson(baseUrl, token, origin, '/api/agent/search', {
      keyword: '火锅',
      cityName: '上海',
      provider: 'auto',
    })
    assert.equal(search.ok, true)
    assert.equal(search.source, 'local-fallback')
    assert.deepEqual(search.pois, [])
    assert.match(search.warnings.join('\n'), /AMap search is not configured/)
    assert.match(search.warnings.join('\n'), /Dianping provider is disabled or not configured/)
  } finally {
    server.kill()
    await new Promise((resolveStop) => server.once('exit', resolveStop))
  }
})

test('dianping server secrets are not referenced by browser-side code', () => {
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
    const source = readFileSync(join(root, file), 'utf8')
    assert.doesNotMatch(source, /DIANPING_APP_KEY|DIANPING_APP_SECRET|DIANPING_SESSION|DIANPING_ENABLED|process\.env/)
  }
})

async function waitForHealth(url) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 5000) {
    try {
      const response = await fetch(url)
      const json = await response.json()
      if (response.ok && json.ok) return
    } catch {
      // Server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 80))
  }
  throw new Error('agent server did not become ready')
}

async function postJson(baseUrl, token, origin, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify(body),
  })
  const json = await response.json()
  assert.equal(response.status, 200, `${path} should return 200: ${JSON.stringify(json)}`)
  return json
}
