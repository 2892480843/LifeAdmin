import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const cityDataPath = path.join(root, 'src/data/china-prefecture-cities.json')
const provinceDataPath = path.join(root, 'src/data/china-provinces.json')

test('province data covers every prefecture city adcode prefix', () => {
  const cityData = JSON.parse(fs.readFileSync(cityDataPath, 'utf8'))
  const provinces = JSON.parse(fs.readFileSync(provinceDataPath, 'utf8'))
  const provinceCodes = new Set(provinces.map((province) => province.code))
  const cityProvinceCodes = new Set(cityData.cities.map((city) => city.adcode.slice(0, 2)))

  assert.equal(provinces.length, 31)

  for (const provinceCode of cityProvinceCodes) {
    assert.ok(provinceCodes.has(provinceCode), `missing province code ${provinceCode}`)
  }
})

test('province data maps common city prefixes to their province names', () => {
  const provinces = JSON.parse(fs.readFileSync(provinceDataPath, 'utf8'))
  const provinceNameByCode = new Map(provinces.map((province) => [province.code, province.name]))

  assert.equal(provinceNameByCode.get('31'), '上海')
  assert.equal(provinceNameByCode.get('33'), '浙江')
  assert.equal(provinceNameByCode.get('44'), '广东')
})
