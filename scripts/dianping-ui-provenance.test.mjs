import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const poiDetailSource = readFileSync(resolve(root, 'src/pages/PoiDetail.tsx'), 'utf8')
const dianpingServiceSource = readFileSync(resolve(root, 'src/services/dianpingService.ts'), 'utf8')

test('poi detail fetches Dianping fields through the Agent data endpoint only', () => {
  assert.match(dianpingServiceSource, /fetchDianpingPoiDetail/)
  assert.match(dianpingServiceSource, /'\/api\/data\/dianping\/pois\/detail'/)
  assert.match(dianpingServiceSource, /'\/api\/data\/dianping\/realtime\/queue'/)
  assert.doesNotMatch(dianpingServiceSource, /DIANPING_APP_KEY|DIANPING_APP_SECRET|DIANPING_SESSION|process\.env/)
})

test('poi detail renders Dianping source and stale state for all displayed fields', () => {
  assert.match(poiDetailSource, /DianpingSourcePanel/)
  assert.match(poiDetailSource, /dianpingDetail/)
  assert.match(poiDetailSource, /dianpingQueue/)
  assert.match(poiDetailSource, /SourcedFactRow/)
  assert.match(poiDetailSource, /field\.sourceProvider/)
  assert.match(poiDetailSource, /field\.stale \? '已过期' : '有效'/)
  assert.match(poiDetailSource, /field\.unavailableReason/)
})
