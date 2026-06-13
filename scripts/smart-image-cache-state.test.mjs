import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(root, 'src/components/ui/SmartImage.tsx')
const sourceText = readFileSync(sourcePath, 'utf8')
const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

test('smart image syncs cached loaded images into visible state', () => {
  assert.match(sourceText, /\buseRef\b/, 'SmartImage should keep a ref to the image element')
  assert.ok(hasJsxAttribute('img', 'ref'), 'SmartImage img should attach the ref')
  assert.ok(
    sourceText.includes('.complete') && sourceText.includes('.naturalWidth'),
    'SmartImage should check cached image completion and dimensions',
  )
})

function hasJsxAttribute(tagName, attributeName) {
  return Boolean(findNode(sourceFile, (node) => {
    if (!ts.isJsxSelfClosingElement(node) || node.tagName.getText(sourceFile) !== tagName) return false

    return node.attributes.properties.some((property) => (
      ts.isJsxAttribute(property) && property.name.getText(sourceFile) === attributeName
    ))
  }))
}

function findNode(node, predicate) {
  if (predicate(node)) return node

  let match
  ts.forEachChild(node, (child) => {
    if (!match) match = findNode(child, predicate)
  })

  return match
}
