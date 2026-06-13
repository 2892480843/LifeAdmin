import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { getSmokePort } from './smoke-ports.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const TOKEN = `smoke-${randomUUID()}`
const isWindows = process.platform === 'win32'

const children = []

try {
  const agentPort = await getSmokePort(process.env.SMOKE_AGENT_PORT, 'agent')
  const previewPort = await getSmokePort(process.env.SMOKE_PREVIEW_PORT, 'preview', '127.0.0.1')
  const origin = `http://127.0.0.1:${previewPort}`

  const agent = startProcess(process.execPath, ['server/agent-server.mjs'], {
    ...process.env,
    AGENT_LOAD_DOTENV: '0',
    AGENT_PORT: String(agentPort),
    AGENT_AUTH_MODE: 'demo',
    AGENT_PRODUCTION_AUTH_READY: '0',
    AGENT_API_TOKEN: TOKEN,
    VITE_AGENT_API_TOKEN: TOKEN,
    AMAP_WEB_SERVICE_KEY: '',
    AGENT_ALLOWED_ORIGINS: origin,
    AGENT_RATE_LIMIT_MAX: '120',
    AGENT_RATE_LIMIT_WINDOW_MS: '60000',
  }, 'agent')
  children.push(agent)

  const baseUrl = `http://127.0.0.1:${agentPort}`
  await waitForJson(`${baseUrl}/health`, {}, (json) => json.ok === true && json.authConfigured === true && json.authMode === 'demo', 'agent health')
  await expectStatus(`${baseUrl}/api/agent/realtime`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:5174',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Authorization, Content-Type',
    },
  }, 204, 'agent local dev cors preflight')
  await expectStatus(`${baseUrl}/api/agent/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify({ question: 'missing token' }),
  }, 401, 'agent auth rejection')
  await expectStatus(`${baseUrl}/api/agent/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Origin: 'http://blocked.example',
    },
    body: JSON.stringify({ question: 'blocked origin' }),
  }, 403, 'agent cors rejection')
  await expectJsonStatus(`${baseUrl}/api/agent/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify({ question: '   ' }),
  }, 400, 'question is required', 'agent empty chat question rejection')
  await expectJsonStatus(`${baseUrl}/api/agent/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: '{"question":',
  }, 400, 'Invalid JSON request body', 'agent invalid JSON rejection')
  await expectJsonStatus(`${baseUrl}/api/agent/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify({ question: 'x'.repeat(1024 * 1024) }),
  }, 400, 'Request body too large', 'agent oversized body rejection')

  await expectStatus(`${baseUrl}/api/agent/realtime`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify({ trip: smokeTrip(), currentLocation: smokeCurrentLocation() }),
  }, 401, 'agent realtime auth rejection')

  await postAgent(baseUrl, origin, '/api/agent/realtime', {
    trip: smokeTrip(),
    currentLocation: smokeCurrentLocation(),
  }, validateRealtimeMissingConfig)

  await postAgent(baseUrl, origin, '/api/agent/search', {
    keyword: '',
    cityName: 'Shanghai',
    categories: ['scenic'],
  }, (json) => json.ok === true && Array.isArray(json.pois))

  await postAgent(baseUrl, origin, '/api/agent/chat', {
    question: 'smoke test',
  }, (json) => json.ok === true && typeof json.reply === 'string')

  await postAgent(baseUrl, origin, '/api/agent/plan', {
    draft: {
      cityName: 'Shanghai',
      days: 1,
      budget: 800,
      interests: ['museum'],
    },
  }, (json) => json.ok === true && Array.isArray(json.plans) && json.plans.length > 0)

  await runCommand('npm', ['run', 'build'])
  await runCommand(process.execPath, ['scripts/check-secrets.mjs'])

  const preview = startProcess('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(previewPort)], process.env, 'preview')
  children.push(preview)

  await waitForText(`${origin}/`, {}, (text, response) => response.status === 200 && text.includes('root'), 'preview home')

  console.log('Smoke checks passed.')
} finally {
  await Promise.all(children.map(stopProcess))
}

async function postAgent(baseUrl, origin, path, body, validate) {
  await waitForJson(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify(body),
  }, (json, response) => response.status === 200 && validate(json, response), path)
}

function validateRealtimeMissingConfig(json) {
  return json?.ok === false &&
    json?.status === 'missing-config' &&
    json?.recommendation === null &&
    Array.isArray(json?.events) &&
    Array.isArray(json?.logs) &&
    json?.route === null &&
    json?.weather === null &&
    json?.traffic === null &&
    json?.unavailable?.queue?.message === '暂无官方实时数据源' &&
    json?.unavailable?.crowd?.message === '暂无官方实时数据源'
}

function smokeTrip() {
  return {
    id: 'smoke-trip',
    title: 'Smoke Trip',
    cityId: 'shanghai',
    startDate: '2026-06-01',
    endDate: '2026-06-02',
    status: '规划中',
    itinerary: [
      {
        day: 1,
        date: '2026-06-02',
        title: 'Day 1',
        items: [
          {
            id: 'poi-1',
            poiId: 'poi-1',
            name: '起点',
            transport: '步行',
            status: '进行中',
            lng: 121.49,
            lat: 31.24,
            x: 20,
            y: 25,
            color: '#2563eb',
          },
          {
            id: 'poi-2',
            poiId: 'poi-2',
            name: '终点',
            transport: '步行',
            status: '待出发',
            lng: 121.5,
            lat: 31.25,
            x: 40,
            y: 55,
            color: '#f97316',
          },
        ],
      },
    ],
  }
}

function smokeCurrentLocation() {
  return {
    lng: 121.4923,
    lat: 31.2417,
    accuracy: 42,
  }
}

function startProcess(command, args, env, name) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env,
    shell: isWindows && command === 'npm',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`))
  child.on('exit', (code) => {
    if (!child.expectedStop && code && code !== 0) process.stderr.write(`[${name}] exited with ${code}\n`)
  })

  return child
}

function runCommand(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = startProcess(command, args, process.env, args.join(' '))
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('exit', (code) => {
      if (code === 0) resolveRun()
      else reject(new Error(`${command} ${args.join(' ')} failed with ${code}: ${stderr.slice(-1000)}`))
    })
  })
}

async function waitForJson(url, options, validate, label) {
  await retry(label, async () => {
    const response = await fetch(url, options)
    const json = await response.json()
    if (!validate(json, response)) {
      throw new Error(`${label} returned unexpected JSON`)
    }
  })
}

async function waitForText(url, options, validate, label) {
  await retry(label, async () => {
    const response = await fetch(url, options)
    const text = await response.text()
    if (!validate(text, response)) {
      throw new Error(`${label} returned unexpected response`)
    }
  })
}

async function expectStatus(url, options, expectedStatus, label) {
  await retry(label, async () => {
    const response = await fetch(url, options)
    await response.text()
    if (response.status !== expectedStatus) {
      throw new Error(`${label} returned ${response.status}, expected ${expectedStatus}`)
    }
  })
}

async function expectJsonStatus(url, options, expectedStatus, expectedError, label) {
  await waitForJson(url, options, (json, response) => {
    return response.status === expectedStatus && json?.ok === false && json?.error === expectedError
  }, label)
}

async function retry(label, fn, timeoutMs = 30_000) {
  const start = Date.now()
  let lastError
  while (Date.now() - start < timeoutMs) {
    try {
      await fn()
      return
    } catch (error) {
      lastError = error
      await delay(500)
    }
  }
  throw new Error(`${label} did not pass within ${timeoutMs}ms: ${lastError?.message || 'unknown error'}`)
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

function stopProcess(child) {
  if (!child || child.killed) return Promise.resolve()
  child.expectedStop = true
  return new Promise((resolveStop) => {
    child.once('exit', () => resolveStop())
    if (isWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' }).on('exit', () => resolveStop())
    } else {
      child.kill('SIGTERM')
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL')
        resolveStop()
      }, 2000)
    }
  })
}
