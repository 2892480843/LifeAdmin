import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const stepPlansSource = readFileSync(resolve(root, 'src/pages/newtrip/StepPlans.tsx'), 'utf8')
const stepGeneratingSource = readFileSync(resolve(root, 'src/pages/newtrip/StepGenerating.tsx'), 'utf8')
const typesSource = readFileSync(resolve(root, 'src/types/index.ts'), 'utf8')
const agentServerSource = readFileSync(resolve(root, 'server/agent-server.mjs'), 'utf8')
const tripBuildersSource = readFileSync(resolve(root, 'src/utils/tripBuilders.ts'), 'utf8')

test('new trip generated plans expose a selectable detail view', () => {
  assert.match(stepPlansSource, /const selectedPlan\s*=/)
  assert.match(stepPlansSource, /方案详情/)
  assert.match(stepPlansSource, /selectedPlan\.stops\.map/)
  assert.match(stepPlansSource, /Agent 推荐依据/)
})

test('agent plan schema carries generated recommendation rationale through to the UI', () => {
  assert.match(typesSource, /aiReason\?: string/)
  assert.match(agentServerSource, /aiReason/)
  assert.match(stepPlansSource, /plan\.aiReason/)
})

test('new trip generation does not reuse static Shanghai mock plans for other draft cities', () => {
  assert.doesNotMatch(stepGeneratingSource, /import\s+\{\s*routePlans\s*\}\s+from\s+'..\/..\/mock'/)
  assert.doesNotMatch(stepPlansSource, /import\s+\{\s*routePlans\s*\}\s+from\s+'..\/..\/mock'/)
  assert.doesNotMatch(stepGeneratingSource, /plans\s*=\s*routePlans/)
  assert.match(stepGeneratingSource, /createDraftRoutePlans/)
  assert.match(stepPlansSource, /createDraftRoutePlans/)
})

test('selected generated trip keeps draft day count ahead of stale plan metadata', () => {
  assert.match(tripBuildersSource, /const days = Math\.max\(1, draft\.days \|\| plan\.days \|\| 1\)/)
  assert.doesNotMatch(tripBuildersSource, /const days = Math\.max\(1, plan\.days \|\| draft\.days \|\| 1\)/)
})

test('agent plan normalization keeps generated cards aligned to draft days', () => {
  assert.match(agentServerSource, /const draftDays = Math\.max\(1, normalizeNumber\(draft\?\.days, normalizeNumber\(plan\.days, 1\)\)\)/)
  assert.match(agentServerSource, /days: draftDays/)
  assert.match(agentServerSource, /normalizePlanName\(plan\.name, type, draft, draftDays\)/)
})

test('generated plans preserve real POI metadata through trip construction', () => {
  const planStopBlock = interfaceBlock(typesSource, 'PlanStop')

  assert.match(planStopBlock, /category\?: PoiCategory/)
  assert.match(planStopBlock, /lng\?: number/)
  assert.match(planStopBlock, /lat\?: number/)
  assert.match(planStopBlock, /cost\?: number/)
  assert.match(planStopBlock, /address\?: string/)

  assert.match(agentServerSource, /function candidatePlanStopFields\(candidate = \{\}\)/)
  assert.match(agentServerSource, /\.\.\.candidatePlanStopFields\(candidate\)/)

  assert.match(tripBuildersSource, /firstFiniteNumber\(stop\.lng,\s*poi\?\.lng,\s*0\)/)
  assert.match(tripBuildersSource, /firstFiniteNumber\(stop\.lat,\s*poi\?\.lat,\s*0\)/)
  assert.match(tripBuildersSource, /category: stop\.category \?\? poi\?\.category \?\? '景点'/)
  assert.match(tripBuildersSource, /cost: firstFiniteNumber\(stop\.cost,\s*poi\?\.price,\s*0\)/)
})

function interfaceBlock(source, name) {
  const start = source.indexOf(`interface ${name}`)
  assert.notEqual(start, -1, `${name} interface should exist`)

  const nextInterface = source.indexOf('\nexport interface ', start + 1)
  const nextType = source.indexOf('\nexport type ', start + 1)
  const candidates = [nextInterface, nextType].filter((index) => index !== -1)
  const end = candidates.length > 0 ? Math.min(...candidates) : source.length
  return source.slice(start, end)
}
