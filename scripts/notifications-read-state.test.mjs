import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import test from 'node:test'
import { getSmokePort } from './smoke-ports.mjs'

const root = process.cwd()

test('agent notifications persist read state per user', async () => {
  const token = `notification-${randomUUID()}`
  const port = await getSmokePort(undefined, 'notification')
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
      AGENT_RATE_LIMIT_MAX: '120',
      AGENT_RATE_LIMIT_WINDOW_MS: '60000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  try {
    await waitForHealth(`${baseUrl}/health`)

    const payload = notificationPayload()
    const first = await postJson(baseUrl, token, origin, '/api/agent/notifications', payload)
    assert.equal(first.ok, true)
    assert.equal(first.unreadCount, 3)

    const readId = first.notifications[0].id
    const read = await postJson(baseUrl, token, origin, '/api/agent/notifications/read', {
      id: readId,
      userId: payload.user.id,
    })
    assert.equal(read.ok, true)
    assert.equal(read.readId, readId)

    const second = await postJson(baseUrl, token, origin, '/api/agent/notifications', payload)
    assert.equal(second.ok, true)
    assert.equal(second.unreadCount, 2)
    assert.equal(second.notifications.some((notice) => notice.id === readId), false)
  } finally {
    server.kill()
    await new Promise((resolveStop) => server.once('exit', resolveStop))
  }
})

test('agent notification requests do not consume the realtime rate limit bucket', async () => {
  const token = `notification-isolation-${randomUUID()}`
  const port = await getSmokePort(undefined, 'notification-isolation')
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
      AGENT_RATE_LIMIT_MAX: '2',
      AGENT_RATE_LIMIT_WINDOW_MS: '60000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  try {
    await waitForHealth(`${baseUrl}/health`)

    const payload = notificationPayload()
    await postJson(baseUrl, token, origin, '/api/agent/notifications', payload)
    await postJson(baseUrl, token, origin, '/api/agent/notifications', payload)

    const realtime = await postRaw(baseUrl, token, origin, '/api/agent/realtime', {
      trip: payload.trips[0],
    })
    const body = await realtime.json()

    assert.equal(realtime.status, 200, `realtime should remain in a separate bucket: ${JSON.stringify(body)}`)
    assert.equal(body.ok, false)
    assert.equal(body.status, 'missing-config')
  } finally {
    server.kill()
    await new Promise((resolveStop) => server.once('exit', resolveStop))
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
  const response = await postRaw(baseUrl, token, origin, path, body)
  const json = await response.json()
  assert.equal(response.status, 200, `${path} should return 200: ${JSON.stringify(json)}`)
  return json
}

async function postRaw(baseUrl, token, origin, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify(body),
  })
}

function notificationPayload() {
  return {
    user: {
      id: 'u-001',
      name: 'Traveler_01',
      city: '上海',
    },
    trips: [
      {
        id: 'trip-shanghai-2d',
        title: '上海经典两日游',
        cityId: 'shanghai',
        startDate: '2026-06-07',
        endDate: '2026-06-08',
        status: '规划中',
        itinerary: [
          {
            day: 1,
            date: '2026-06-07',
            title: '城市地标与海派风情',
            items: [
              { id: 'waitan', name: '外滩', status: '已完成', lng: 121.49, lat: 31.24 },
              { id: 'nanjinglu', name: '南京路步行街', status: '已完成', lng: 121.48, lat: 31.23 },
              { id: 'yuyuan', name: '豫园', status: '进行中', lng: 121.5, lat: 31.22 },
            ],
          },
        ],
      },
    ],
  }
}
