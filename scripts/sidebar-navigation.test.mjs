import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(root, 'src/components/layout/Sidebar.tsx')
const sourceText = readFileSync(sourcePath, 'utf8')
const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

test('desktop sidebar omits the favorites navigation entry', () => {
  const navItems = findSidebarItems()

  assert.ok(navItems.some((item) => item.label === '我的行程' && item.path === '/trips'))
  assert.ok(navItems.some((item) => item.label === '实时动态' && item.path === '/realtime'))
  assert.ok(navItems.some((item) => item.label === '个人中心' && item.path === '/profile'))
  assert.equal(navItems.some((item) => item.label === '收藏地点'), false)
  assert.equal(navItems.some((item) => item.path === '/profile?tab=favorites'), false)
})

function findSidebarItems() {
  const groupsDeclaration = findNode(
    sourceFile,
    (node) =>
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'groups' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer),
  )

  assert.ok(groupsDeclaration?.initializer, 'sidebar groups array was not found')

  return groupsDeclaration.initializer.elements.flatMap((groupElement) => {
    assert.ok(ts.isObjectLiteralExpression(groupElement), 'sidebar group must be an object literal')
    const itemsProperty = groupElement.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) &&
        property.name.getText(sourceFile) === 'items' &&
        ts.isArrayLiteralExpression(property.initializer),
    )

    assert.ok(itemsProperty && ts.isPropertyAssignment(itemsProperty), 'sidebar group items were not found')
    assert.ok(ts.isArrayLiteralExpression(itemsProperty.initializer), 'sidebar group items must be an array')

    return itemsProperty.initializer.elements.map((itemElement) => {
      assert.ok(ts.isObjectLiteralExpression(itemElement), 'sidebar item must be an object literal')
      return Object.fromEntries(
        itemElement.properties
          .filter(ts.isPropertyAssignment)
          .filter((property) => ['label', 'path'].includes(property.name.getText(sourceFile)))
          .map((property) => [property.name.getText(sourceFile), literalValue(property.initializer)]),
      )
    })
  })
}

function literalValue(node) {
  return ts.isStringLiteral(node) ? node.text : undefined
}

function findNode(node, predicate) {
  if (predicate(node)) return node

  let match
  ts.forEachChild(node, (child) => {
    if (!match) match = findNode(child, predicate)
  })

  return match
}
