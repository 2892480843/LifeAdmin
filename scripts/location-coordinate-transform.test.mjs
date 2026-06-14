import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function loadTsModule(path) {
  const source = readFileSync(resolve(process.cwd(), path), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(compiled, { exports: module.exports, module }, { filename: path })
  return module.exports
}

test('converts browser WGS84 coordinates in China to GCJ-02 for AMap', () => {
  const { wgs84ToGcj02 } = loadTsModule('src/utils/coordinateTransform.ts')

  const converted = wgs84ToGcj02({ lng: 116.32022, lat: 39.9829 })

  assert.equal(converted.converted, true)
  assert.equal(converted.coordinateSystem, 'GCJ-02')
  assert.ok(Math.abs(converted.lng - 116.32637) < 0.0002)
  assert.ok(Math.abs(converted.lat - 39.98425) < 0.0002)
})

test('keeps out-of-China browser coordinates unchanged', () => {
  const { wgs84ToGcj02 } = loadTsModule('src/utils/coordinateTransform.ts')

  const converted = wgs84ToGcj02({ lng: -122.4194, lat: 37.7749 })

  assert.equal(converted.lng, -122.4194)
  assert.equal(converted.lat, 37.7749)
  assert.equal(converted.converted, false)
  assert.equal(converted.coordinateSystem, 'WGS84')
})

test('location service exposes converted AMap coordinates and raw browser coordinates', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/services/locationService.ts'), 'utf8')

  assert.match(source, /wgs84ToGcj02/)
  assert.match(source, /rawLng/)
  assert.match(source, /rawLat/)
  assert.match(source, /rawCoordinateSystem/)
  assert.match(source, /coordinateSystem/)
})
