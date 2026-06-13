import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

test('check-env accepts local demo token pairing', () => {
  const result = runCheckEnv([
    'AGENT_AUTH_MODE=demo',
    'AGENT_PRODUCTION_AUTH_READY=0',
    'AGENT_API_TOKEN=local-demo-token',
    'VITE_AGENT_AUTH_MODE=demo',
    'VITE_AGENT_API_TOKEN=local-demo-token',
  ])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Environment variable check passed/)
})

test('check-env rejects production browser-visible agent token', () => {
  const result = runCheckEnv([
    'AGENT_AUTH_MODE=production',
    'AGENT_PRODUCTION_AUTH_READY=1',
    'AGENT_API_TOKEN=server-only-production-token',
    'VITE_AGENT_AUTH_MODE=production',
    'VITE_AGENT_API_TOKEN=server-only-production-token',
  ])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /VITE_AGENT_API_TOKEN: must be empty in production/)
})

function runCheckEnv(extraLines) {
  const dir = mkdtempSync(join(tmpdir(), 'routewise-check-env-'))
  const envPath = join(dir, '.env')
  const examplePath = join(dir, '.env.example')
  const baseLines = [
    'VITE_AMAP_KEY=demo-map-key',
    'VITE_AMAP_SECURITY_CODE=demo-security',
    'AGENT_PORT=8787',
    'AGENT_ALLOWED_ORIGINS=http://localhost:5173',
    'AGENT_RATE_LIMIT_WINDOW_MS=60000',
    'AGENT_RATE_LIMIT_MAX=30',
    'AGENT_AMAP_CACHE_TTL_MS=600000',
    'AGENT_AMAP_MIN_INTERVAL_MS=250',
    'LLM_PROVIDER=deepseek',
    'LLM_MODEL=deepseek-v4-flash',
    'DEEPSEEK_API_KEY=',
    'DEEPSEEK_BASE_URL=https://api.deepseek.com',
    'AMAP_WEB_SERVICE_KEY=',
    'VITE_AGENT_API_BASE_URL=http://localhost:8787',
  ]

  writeFileSync(examplePath, [...baseLines, ...extraLines].join('\n'))
  writeFileSync(envPath, [...baseLines, ...extraLines].join('\n'))

  return spawnSync(process.execPath, ['scripts/check-env.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CHECK_ENV_FILE: envPath,
      CHECK_ENV_EXAMPLE_FILE: examplePath,
    },
    encoding: 'utf8',
  })
}
