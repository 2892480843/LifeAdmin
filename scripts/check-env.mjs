import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const EXAMPLE_FILE = process.env.CHECK_ENV_EXAMPLE_FILE
  ? resolve(process.env.CHECK_ENV_EXAMPLE_FILE)
  : resolve(ROOT, '.env.example')
const ENV_FILE = process.env.CHECK_ENV_FILE
  ? resolve(process.env.CHECK_ENV_FILE)
  : resolve(ROOT, '.env')

const REQUIRED_LOCAL_AGENT_KEYS = new Set([
  'AGENT_API_TOKEN',
  'AGENT_ALLOWED_ORIGINS',
  'AGENT_PORT',
  'AGENT_RATE_LIMIT_WINDOW_MS',
  'AGENT_RATE_LIMIT_MAX',
  'AGENT_AMAP_CACHE_TTL_MS',
  'AGENT_AMAP_MIN_INTERVAL_MS',
  'VITE_AGENT_API_BASE_URL',
])
const OPTIONAL_DEFAULTED_KEYS = new Set([
  'AGENT_AUTH_MODE',
  'AGENT_PRODUCTION_AUTH_READY',
  'VITE_AGENT_AUTH_MODE',
  'VITE_AGENT_API_TOKEN',
])
const DEMO_AGENT_TOKEN = 'change-me-local-agent-token'

if (!existsSync(EXAMPLE_FILE)) {
  console.error('.env.example is missing.')
  process.exit(1)
}

const exampleEnv = parseEnv(readFileSync(EXAMPLE_FILE, 'utf8'))
const localEnv = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : new Map()
const rows = []
const failures = []

for (const name of exampleEnv.keys()) {
  const local = localEnv.get(name)
  const existsInEnv = Boolean(local)
  const requiredForLocalAgent = REQUIRED_LOCAL_AGENT_KEYS.has(name)

  rows.push({
    name,
    existsInExample: true,
    existsInEnv,
    emptyInEnv: existsInEnv ? local.empty : null,
    requiredForLocalAgent,
  })

  if (!existsInEnv && requiredForLocalAgent && !OPTIONAL_DEFAULTED_KEYS.has(name)) failures.push(`${name}: missing in .env`)
  if (requiredForLocalAgent && local?.empty) failures.push(`${name}: empty in .env`)
}

const agentToken = localEnv.get('AGENT_API_TOKEN')
const viteAgentToken = localEnv.get('VITE_AGENT_API_TOKEN')
const agentAuthMode = envValue(localEnv, exampleEnv, 'AGENT_AUTH_MODE', 'demo')
const viteAgentAuthMode = envValue(localEnv, exampleEnv, 'VITE_AGENT_AUTH_MODE', agentAuthMode)
const productionAuthReady = envValue(localEnv, exampleEnv, 'AGENT_PRODUCTION_AUTH_READY', '0') === '1'
const productionMode = agentAuthMode === 'production' || process.env.NODE_ENV === 'production'
const canCompareTokens = Boolean(agentToken && viteAgentToken && !agentToken.empty && !viteAgentToken.empty)
const tokensMatch = canCompareTokens ? agentToken.value === viteAgentToken.value : null

console.table(rows)
console.log(`Agent auth mode: ${agentAuthMode}`)
console.log(`Frontend Agent auth mode: ${viteAgentAuthMode}`)
console.log(`AGENT_API_TOKEN matches VITE_AGENT_API_TOKEN: ${tokensMatch === null ? 'not checked' : tokensMatch}`)

if (productionMode) {
  if (agentAuthMode !== 'production') failures.push('AGENT_AUTH_MODE: must be production when NODE_ENV=production')
  if (viteAgentAuthMode !== 'production') failures.push('VITE_AGENT_AUTH_MODE: must be production for production builds')
  if (!productionAuthReady) failures.push('AGENT_PRODUCTION_AUTH_READY: must be 1 only after real server-side auth is in place')
  if (!agentToken || agentToken.empty) failures.push('AGENT_API_TOKEN: required for production server-side auth')
  if (agentToken && isDemoAgentToken(agentToken.value)) failures.push('AGENT_API_TOKEN: demo placeholder is not allowed in production')
  if (viteAgentToken && !viteAgentToken.empty) failures.push('VITE_AGENT_API_TOKEN: must be empty in production because VITE_* values are browser-visible')
  if (tokensMatch === true) failures.push('AGENT_API_TOKEN and VITE_AGENT_API_TOKEN: must not match in production')
} else {
  if (agentAuthMode !== 'demo') failures.push('AGENT_AUTH_MODE: local check expects demo unless NODE_ENV=production')
  if (viteAgentAuthMode !== 'demo') failures.push('VITE_AGENT_AUTH_MODE: local check expects demo unless NODE_ENV=production')
  if (!viteAgentToken || viteAgentToken.empty) failures.push('VITE_AGENT_API_TOKEN: required for local demo mode')
  if (tokensMatch === false) failures.push('AGENT_API_TOKEN and VITE_AGENT_API_TOKEN: mismatch in local demo mode')
}

if (failures.length > 0) {
  console.error('Environment variable check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Environment variable check passed.')

function envValue(localEnv, exampleEnv, name, fallback) {
  return localEnv.get(name)?.value || exampleEnv.get(name)?.value || fallback
}

function isDemoAgentToken(token) {
  const normalized = String(token || '').trim().toLowerCase()
  return !normalized ||
    normalized === DEMO_AGENT_TOKEN ||
    normalized === 'demo' ||
    normalized === 'demo-token' ||
    normalized === 'local-agent-token' ||
    normalized.includes('change-me')
}

function parseEnv(content) {
  const entries = new Map()
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue

    const index = line.indexOf('=')
    const name = line.slice(0, index).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue

    const value = stripQuotes(line.slice(index + 1).trim())
    entries.set(name, {
      value,
      empty: value.length === 0,
    })
  }
  return entries
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}
