import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const agentSource = readFileSync(resolve(root, 'src/services/agent.ts'), 'utf8')
const exploreSource = readFileSync(resolve(root, 'src/pages/Explore.tsx'), 'utf8')

test('agent search result type accepts dianping and multi-provider sources', () => {
  assert.match(agentSource, /export type AgentSearchSource = 'amap' \| 'dianping' \| 'multi-provider' \| 'local-fallback'/)
  assert.match(agentSource, /source: AgentSearchSource/)
  assert.match(agentSource, /provider\?: 'auto' \| 'amap' \| 'dianping'/)
})

test('explore renders remote source labels without hard-coded AMap copy', () => {
  assert.match(exploreSource, /type ExploreSource = 'local' \| AgentSearchSource/)
  assert.match(exploreSource, /function providerResultLabel/)
  assert.match(exploreSource, /amap: '高德结果'/)
  assert.match(exploreSource, /dianping: '大众点评结果'/)
  assert.match(exploreSource, /'multi-provider': '多来源结果'/)
  assert.doesNotMatch(exploreSource, /remoteResults \? '高德实时结果' : '精选地点'/)
  assert.doesNotMatch(exploreSource, /result\.source === 'amap' \? '高德结果' : '暂无评价'/)
})

test('explore remote POI conversion uses provider-aware IDs and copy', () => {
  assert.match(exploreSource, /normalizeRemotePoiId\(p\.id, p\.name, index, result\.source, p\.sourceProvider, p\.sourceId\)/)
  assert.match(exploreSource, /const providerSourceId = sanitizeRemoteIdPart\(sourceId \|\| source\)/)
  assert.match(exploreSource, /`\$\{sourceProvider\}-\$\{providerSourceId\}`/)
  assert.match(exploreSource, /providerResultLabel\(result\.source\)/)
  assert.match(exploreSource, /sourceProvider: p\.sourceProvider/)
  assert.match(exploreSource, /const sourceProvider = result\.sourceProvider \|\| \(result\.source === 'local-fallback' \? undefined : result\.source\)/)
  assert.doesNotMatch(exploreSource, /`amap-\$\{source\}`/)
  assert.doesNotMatch(exploreSource, /营业时间以高德地图为准/)
  assert.doesNotMatch(exploreSource, /来自高德搜索/)
})
