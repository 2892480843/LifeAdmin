import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(resolve(root, 'src/index.css'), 'utf8')

test('route page headers do not render a top accent line', () => {
  const routeHeaderPseudo = css.match(/\.route-header::before\s*\{[\s\S]*?\}/)

  assert.equal(routeHeaderPseudo, null)
  assert.doesNotMatch(css, /\.route-header::before/)
})
