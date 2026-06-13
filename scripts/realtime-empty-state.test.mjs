import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const source = readFileSync(resolve(process.cwd(), 'src/pages/Realtime.tsx'), 'utf8')
const agentServerSource = readFileSync(resolve(process.cwd(), 'server/agent-server.mjs'), 'utf8')

test('realtime metrics use explicit empty states instead of fake weather and risk data', () => {
  assert.doesNotMatch(source, /晴 25°C/)
  assert.doesNotMatch(source, /realtimeEvents\.length \|\| 1/)
  assert.doesNotMatch(source, /陆家嘴拥堵/)

  assert.match(source, /暂无实时天气数据/)
  assert.match(source, /0条提醒/)
})

test('realtime recommendation primary action is a preview when itinerary writeback is unavailable', () => {
  assert.doesNotMatch(source, /接受调整建议/)
  assert.doesNotMatch(source, /路线建议已采纳/)

  assert.match(source, /预览调整建议/)
  assert.match(source, /当前仅预览 AI 建议/)
})

test('realtime page only previews executable suggestions backed by real data', () => {
  assert.match(source, /const previewableRecommendationActions = recommendationActions\.filter\(\(action\) => action\.canApply\)/)
  assert.match(source, /items=\{previewableRecommendationActions\.map\(\(item\) => item\.label\)\}/)
  assert.match(source, /暂无可执行建议/)
})

test('realtime page surfaces the live data source snapshot', () => {
  assert.match(source, /RealtimeSourceSnapshot/)
  assert.match(source, /真实数据源/)
  assert.match(source, /snapshot\.sources\.route/)
  assert.match(source, /snapshot\.sources\.weather/)
  assert.match(source, /snapshot\.sources\.traffic/)
})

test('agent marks queue and crowd realtime actions as unavailable without official data', () => {
  assert.match(agentServerSource, /function isUnavailableRealtimeAction/)
  assert.match(agentServerSource, /const unavailableReason = isUnavailableRealtimeAction/)
  assert.match(agentServerSource, /canApply: unavailableReason \? false : canApply/)
})
