import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PLACE_IMAGE_PLACEHOLDER_RE =
  /(?:picsum\.photos|placehold\.co|placeholder\.com|dummyimage\.com|loremflickr\.com|source\.unsplash\.com\/random|unsplash\.it)/i

const checks = [
  {
    file: 'server/agent-server.mjs',
    required: ['buildAmapSearchQueries', 'pickTrustedAmapPhoto', 'imageConfidence', 'imageVerifiedAt'],
    forbidden: [/picsum\.photos\/seed\/\$\{encodeURIComponent\(poi\.name/i, /cover:\s*firstPhoto\s*\|\|/i],
  },
  {
    file: 'src/pages/Explore.tsx',
    required: ['displayPlaceImage', 'hasPendingPlaceImageReview'],
    forbidden: [/picsum\.photos\/seed\/\$\{encodeURIComponent\(p\.name\)/i, /picsum\.photos\/seed\/\$\{encodeURIComponent\(result\.name\)/i],
  },
  {
    file: 'src/pages/PoiDetail.tsx',
    required: ['displayPlaceImage', 'hasPendingPlaceImageReview'],
    forbidden: [/src=\{poi\.cover\}/i, /picsum\.photos\/seed\//i],
  },
  {
    file: 'src/utils/tripBuilders.ts',
    required: ['displayPlaceImage'],
    forbidden: [/picsum\.photos\/seed\//i],
  },
]

const failures = []
for (const check of checks) {
  const text = readFile(check.file)
  for (const token of check.required) {
    if (!text.includes(token)) failures.push(`${check.file}: missing ${token}`)
  }
  for (const pattern of check.forbidden) {
    if (pattern.test(text)) failures.push(`${check.file}: matched forbidden pattern ${pattern}`)
  }
}

const mockReviewList = collectMockPendingImages(readFile('src/mock/pois.ts'))
const generatedImageFailures = collectGeneratedImageFailures('data/generated-pois.json')

failures.push(...generatedImageFailures)

if (failures.length > 0) {
  console.error('[poi-images] failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('[poi-images] search image safety checks passed.')
if (mockReviewList.length > 0) {
  console.log('[poi-images] local mock POIs still using placeholder covers and should be manually reviewed:')
  for (const item of mockReviewList) console.log(`- ${item}`)
}

function readFile(relPath) {
  return readFileSync(resolve(ROOT, relPath), 'utf8')
}

function collectMockPendingImages(text) {
  const lines = text.split(/\r?\n/)
  const names = new Set()
  let currentName = ''

  for (const line of lines) {
    const nameMatch = line.match(/^\s*name:\s*'([^']+)'\s*,\s*$/)
    if (nameMatch) {
      currentName = nameMatch[1]
      continue
    }

    if (/^\s*cover:\s*'https:\/\/picsum\.photos\//i.test(line) && currentName) {
      names.add(currentName)
    }
  }

  return Array.from(names)
}

function collectGeneratedImageFailures(relPath) {
  const path = resolve(ROOT, relPath)
  if (!existsSync(path)) return []
  const pois = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(pois)) return [`${relPath}: expected array root`]

  const generatedFailures = []
  for (const poi of pois) {
    const label = `${relPath}:${poi.id || poi.name || 'unknown'}`
    const urls = [poi.cover, ...(Array.isArray(poi.images) ? poi.images : [])].filter(Boolean)
    for (const url of urls) {
      if (PLACE_IMAGE_PLACEHOLDER_RE.test(String(url))) {
        generatedFailures.push(`${label}: generated POI uses forbidden placeholder image ${url}`)
      }
    }
    if (poi.imageConfidence === 'pending-review' && (poi.cover || (Array.isArray(poi.images) && poi.images.length > 0))) {
      generatedFailures.push(`${label}: pending-review image must not include cover/images`)
    }
    if (poi.imageConfidence === 'poi-photo' && (!poi.cover || !Array.isArray(poi.images) || poi.images.length === 0)) {
      generatedFailures.push(`${label}: poi-photo must include cover/images`)
    }
  }
  return generatedFailures
}
