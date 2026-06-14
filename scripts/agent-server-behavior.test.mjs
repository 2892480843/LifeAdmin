import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const serverSource = readFileSync(resolve(root, 'server/agent-server.mjs'), 'utf8')
const smokeSource = readFileSync(resolve(root, 'scripts/smoke.mjs'), 'utf8')
const envExample = readFileSync(resolve(root, '.env.example'), 'utf8')
const agentClientSource = readFileSync(resolve(root, 'src/services/agent.ts'), 'utf8')

test('agent allows local Vite dev and preview port drift outside production', () => {
  assert.match(serverSource, /LOCAL_DEV_ORIGIN_PORTS[\s\S]*'5174'/)
  assert.match(serverSource, /LOCAL_DEV_ORIGIN_PORTS[\s\S]*'4174'/)
  assert.match(serverSource, /config\.allowedOrigins\.includes\(origin\) \|\| isLocalDevOrigin\(origin\)/)
  assert.match(serverSource, /process\.env\.NODE_ENV === 'production'[\s\S]*return false/)
  assert.match(envExample, /http:\/\/localhost:5174/)
  assert.match(envExample, /http:\/\/127\.0\.0\.1:4174/)
  assert.match(smokeSource, /Origin: 'http:\/\/127\.0\.0\.1:5174'/)
})

test('agent chat rejects empty question at HTTP layer', () => {
  assert.match(serverSource, /url\.pathname === '\/api\/agent\/chat'[\s\S]*sendJson\(req, res, 400, \{ ok: false, error: 'question is required' \}\)/)
  assert.match(smokeSource, /agent empty chat question rejection/)
})

test('agent documents demo and production auth modes', () => {
  assert.match(serverSource, /authMode: process\.env\.AGENT_AUTH_MODE/)
  assert.match(serverSource, /AGENT_PRODUCTION_AUTH_READY/)
  assert.match(serverSource, /validateProductionAuthConfig\(config\)/)
  assert.match(envExample, /AGENT_AUTH_MODE=demo/)
  assert.match(envExample, /AGENT_PRODUCTION_AUTH_READY=0/)
})

test('frontend agent client treats browser token as demo-only', () => {
  assert.match(agentClientSource, /VITE_AGENT_AUTH_MODE/)
  assert.match(agentClientSource, /AGENT_AUTH_MODE === 'demo'/)
  assert.match(agentClientSource, /if \(AGENT_API_TOKEN\) \{/)
  assert.match(agentClientSource, /credentials: AGENT_AUTH_MODE === 'production' \? 'include' : 'same-origin'/)
})

test('production agent rejects browser-visible demo token configuration at startup', () => {
  const result = spawnSync(process.execPath, ['server/agent-server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      AGENT_LOAD_DOTENV: '0',
      NODE_ENV: 'production',
      AGENT_AUTH_MODE: 'production',
      AGENT_PRODUCTION_AUTH_READY: '0',
      AGENT_API_TOKEN: 'change-me-local-agent-token',
      VITE_AGENT_API_TOKEN: 'change-me-local-agent-token',
      AGENT_ALLOWED_ORIGINS: 'https://example.com',
    },
    encoding: 'utf8',
    timeout: 3000,
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Production Agent auth is not configured/)
})

test('agent search applies selected category filters after AMap keyword recall', () => {
  assert.match(serverSource, /\.filter\(\(poi\) => matchesPoiCategoryFilter\(poi, categories\)\)/)
  assert.match(serverSource, /function matchesPoiCategoryFilter\(poi, categories = \[\]\)/)
  assert.match(serverSource, /categories\.length === 0/)
  assert.match(serverSource, /categories\.includes\(poi\.category\)/)
})

test('agent search expands app categories into precise AMap query terms', () => {
  assert.match(serverSource, /const CATEGORY_SEARCH_TERMS = \{/)
  assert.match(serverSource, /购物:\s*\['商场', '步行街', '商业街'\]/)
  assert.match(serverSource, /亲子游:\s*\['动物园', '科技馆', '游乐园', '海洋馆'\]/)
  assert.match(serverSource, /\.flatMap\(\(category\) => CATEGORY_SEARCH_TERMS\[category\] \?\? \[category\]\)/)
})

test('agent search queries category terms separately before de-duplication', () => {
  assert.match(serverSource, /const defaultTerms = categoryTerms\.length > 0 \? categoryTerms : \['热门景点'\]/)
  assert.match(serverSource, /for \(const term of defaultTerms\) \{/)
  assert.match(serverSource, /keyword: unique\(\[cityName, term\]\)\.join\(' '\)/)
  assert.doesNotMatch(serverSource, /const defaultKeyword = categoryTerms\.length > 0 \? categoryTerms\.join\(' '\) : '热门景点'/)
})
