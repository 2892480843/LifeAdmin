import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('production data quality checker reports seed uncertainty and known coverage risks', () => {
  const scriptPath = resolve(root, 'scripts/validate-production-data.mjs')
  assert.equal(existsSync(scriptPath), true, 'production data checker should exist')

  const result = spawnSync(process.execPath, ['scripts/validate-production-data.mjs'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /production data quality/i)
  assert.match(result.stdout, /demoMockIsolated:\s*true/)
  assert.match(result.stdout, /uncertainTicketCount:\s*\d+/)
  assert.match(result.stdout, /uncertainOpeningHoursCount:\s*\d+/)
  assert.match(result.stdout, /pendingImageReviewCount:\s*\d+/)
  assert.match(result.stdout, /sanshaCoverage:/)
})

test('documentation describes production data sources, refresh, downgrade and limitations', () => {
  const readme = readFileSync(resolve(root, 'README.md'), 'utf8')
  const docPath = resolve(root, 'docs/production-data-source-architecture.md')

  assert.equal(existsSync(docPath), true, 'production data architecture doc should exist')
  const doc = readFileSync(docPath, 'utf8')

  for (const source of ['authoritative_static', 'provider_snapshot', 'realtime_observation', 'derived_recommendation', 'demo_mock']) {
    assert.match(doc, new RegExp(source))
  }

  assert.match(doc, /sourceProvider/)
  assert.match(doc, /fetchedAt/)
  assert.match(doc, /expiresAt/)
  assert.match(doc, /降级/)
  assert.match(doc, /刷新/)
  assert.match(doc, /LLM/)
  assert.match(readme, /生产数据源架构/)
})
