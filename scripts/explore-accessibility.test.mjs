import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const source = readFileSync(resolve(process.cwd(), 'src/pages/Explore.tsx'), 'utf8')

test('explore renders only one responsive layout for the active viewport', () => {
  assert.match(source, /useCompactViewport\(\)/)
  assert.match(source, /\{!compactViewport && \(/)
  assert.match(source, /\{compactViewport && \(/)
  assert.match(source, /renderActivePreview\(\)/)
})

test('desktop explore filter panel hides the divider-like scrollbar', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

  assert.match(source, /className="explore-filter-panel min-h-0 overflow-y-auto bg-white p-4"/)
  assert.doesNotMatch(source, /className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-4"/)
  assert.match(css, /\.explore-filter-panel\s*{\s*scrollbar-width:\s*none;/)
  assert.match(css, /\.explore-filter-panel::-webkit-scrollbar\s*{\s*display:\s*none;/)
})
