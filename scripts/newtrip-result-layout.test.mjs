import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const newTripSource = readFileSync(resolve(root, 'src/pages/newtrip/NewTrip.tsx'), 'utf8')
const stepPlansSource = readFileSync(resolve(root, 'src/pages/newtrip/StepPlans.tsx'), 'utf8')
const css = readFileSync(resolve(root, 'src/index.css'), 'utf8')

test('new trip result page uses a focused route plan workbench layout', () => {
  assert.match(stepPlansSource, /route-plan-type-tabs/)
  assert.match(stepPlansSource, /route-plan-workbench/)
  assert.match(stepPlansSource, /route-plan-list/)
  assert.match(stepPlansSource, /route-plan-card-compact/)
  assert.match(stepPlansSource, /route-plan-detail-grid/)
  assert.match(stepPlansSource, /route-plan-decision-panel/)

  assert.match(css, /\.route-plan-workbench\s*\{/)
  assert.match(css, /grid-template-columns:\s*minmax\(17rem,\s*0\.78fr\)\s+minmax\(0,\s*1\.22fr\)/)
  assert.match(css, /\.route-plan-card-compact\s*\{/)
  assert.match(css, /\.route-plan-detail-grid\s*\{/)
  assert.match(css, /\.route-plan-decision-panel\s*\{/)
  assert.match(css, /@media \(min-width:\s*1536px\)\s*\{[\s\S]*?\.route-plan-workbench/)
  assert.match(newTripSource, /2xl:grid-cols-\[minmax\(0,1fr\)_340px\]/)
  assert.match(newTripSource, /2xl:block/)
  assert.match(newTripSource, /2xl:hidden/)
})
