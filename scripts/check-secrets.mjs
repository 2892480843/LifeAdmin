import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST_DIR = resolve(ROOT, 'dist')
const ENV_FILE = resolve(ROOT, '.env')

if (!existsSync(DIST_DIR)) {
  console.error('dist directory is missing. Run npm run build first.')
  process.exit(1)
}

if (!existsSync(ENV_FILE)) {
  console.log('No .env file found; server-side secret scan skipped.')
  process.exit(0)
}

const envPairs = parseEnv(readFileSync(ENV_FILE, 'utf8'))
const distFiles = listFiles(DIST_DIR)
const distBuffers = distFiles.map((file) => readFileSync(file))
const failures = []
const checked = []

for (const [key, value] of envPairs) {
  if (!shouldScanSecret(key, value)) continue
  const needle = Buffer.from(value)
  const present = distBuffers.some((buffer) => buffer.includes(needle))
  checked.push({ key, present })
  if (present) failures.push(key)
}

if (checked.length === 0) {
  console.log('No configured server-side secrets were eligible for scanning.')
} else {
  console.table(checked.map((item) => ({
    key: item.key,
    presentInDist: item.present,
  })))
}

if (failures.length > 0) {
  console.error(`Server-side secret values found in dist: ${failures.join(', ')}`)
  process.exit(1)
}

console.log('Server-side secret scan passed.')

function parseEnv(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=')
      const key = line.slice(0, index).trim()
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      return [key, value]
    })
}

function shouldScanSecret(key, value) {
  if (!value || value.length < 8) return false
  if (key.startsWith('VITE_')) return false
  if (key === 'AGENT_API_TOKEN') return false
  return /(API_KEY|WEB_SERVICE_KEY|SECRET|PASSWORD|PRIVATE|TOKEN)/i.test(key)
}

function listFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(full))
    else files.push(full)
  }
  return files
}
