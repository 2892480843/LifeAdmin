import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const uiSource = readFileSync(resolve(root, 'src/components/ui/index.tsx'), 'utf8')

test('modal renders through a document body portal to escape page stacking contexts', () => {
  assert.match(uiSource, /import\s+\{\s*createPortal\s*\}\s+from\s+['"]react-dom['"]/)
  assert.match(uiSource, /return\s+createPortal\(/)
  assert.match(uiSource, /document\.body/)
})
