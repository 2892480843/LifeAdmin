import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dashboard = readFileSync(resolve(root, 'src/pages/Dashboard.tsx'), 'utf8')
const sidebar = readFileSync(resolve(root, 'src/components/layout/Sidebar.tsx'), 'utf8')
const css = readFileSync(resolve(root, 'src/index.css'), 'utf8')

test('dashboard featured trip area uses a compact two-column operating layout', () => {
  assert.match(dashboard, /dashboard-welcome-strip/)
  assert.match(dashboard, /dashboard-stats-grid/)
  assert.match(dashboard, /dashboard-trip-layout/)
  assert.match(dashboard, /dashboard-featured-map/)
  assert.match(dashboard, /dashboard-route-preview/)
  assert.match(dashboard, /dashboard-route-preview-list/)
  assert.match(dashboard, /dashboard-now-grid/)
  assert.match(css, /\.dashboard-trip-layout\s*\{/)
  assert.match(css, /grid-template-areas:\s*'summary'\s*'map'\s*'route'/)
  assert.match(css, /grid-template-areas:\s*'summary map'\s*'route route'/)
  assert.match(css, /\.dashboard-route-preview\s*\{/)
  assert.match(css, /\.dashboard-featured-map\s*\{/)
})

test('desktop sidebar keeps scrolling available without exposing a gutter scrollbar', () => {
  assert.match(sidebar, /sidebar-rail/)
  assert.match(css, /\.sidebar-rail\s*\{/)
  assert.match(css, /scrollbar-width:\s*none/)
  assert.match(css, /\.sidebar-rail::-webkit-scrollbar\s*\{/)
  assert.match(css, /display:\s*none/)
})
