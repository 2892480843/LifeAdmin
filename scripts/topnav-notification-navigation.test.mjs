import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(root, 'src/components/layout/TopNav.tsx')
const sourceText = readFileSync(sourcePath, 'utf8')
const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const realtimeSource = readFileSync(resolve(root, 'src/pages/Realtime.tsx'), 'utf8')
const notificationServiceSource = readFileSync(resolve(root, 'src/services/notificationService.ts'), 'utf8')

test('top nav notifications define target routes', () => {
  assert.match(notificationServiceSource, /'\/api\/agent\/notifications'/)
  assert.match(notificationServiceSource, /'\/api\/agent\/notifications\/read'/)
})

test('top nav notification click navigates to the notice route', () => {
  assert.ok(hasCall('setNoticeOpen', ['false']))
  assert.ok(hasNavigateNoticePath())
})

test('top nav notifications are synchronized with backend read state', () => {
  const appBindings = findUseAppBindings()

  assert.ok(appBindings.includes('user'))
  assert.ok(appBindings.includes('trips'))
  assert.doesNotMatch(sourceText, /3 条新消息/)
  assert.match(sourceText, /fetchSystemNotifications/)
  assert.match(sourceText, /markSystemNotificationRead/)
  assert.match(sourceText, /setNotices\(\(current\) => current\.filter\(\(item\) => item\.id !== notice\.id\)\)/)
  assert.match(sourceText, /await markSystemNotificationRead\(\{ id: notice\.id, userId: user\?\.id \}\)/)
  assert.doesNotMatch(sourceText, /function buildSystemNotices/)
})

test('top nav notification fetches use a short client cache across remounts', () => {
  assert.match(notificationServiceSource, /NOTIFICATION_CACHE_TTL_MS\s*=\s*5_000/)
  assert.match(notificationServiceSource, /notificationCache/)
  assert.match(notificationServiceSource, /getNotificationCacheKey/)
  assert.match(notificationServiceSource, /forceRefresh/)
  assert.match(notificationServiceSource, /expiresAt > Date\.now\(\)/)
  assert.match(notificationServiceSource, /notificationCache = null/)
})

test('realtime page exposes notification anchor targets', () => {
  assert.match(realtimeSource, /id="weather-status"/)
  assert.match(realtimeSource, /id="route-status"/)
  assert.match(realtimeSource, /scrollIntoView/)
})

function hasNavigateNoticePath() {
  return Boolean(findNode(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || node.arguments.length !== 1) return false
    if (!ts.isIdentifier(node.expression) || node.expression.text !== 'navigate') return false

    const [argument] = node.arguments
    return ts.isPropertyAccessExpression(argument) &&
      ts.isIdentifier(argument.expression) &&
      argument.expression.text === 'notice' &&
      argument.name.text === 'path'
  }))
}

function findUseAppBindings() {
  const declaration = findNode(
    sourceFile,
    (node) => ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'useApp',
  )

  assert.ok(declaration, 'useApp destructuring was not found')
  return declaration.name.elements.map((element) => element.name.getText(sourceFile))
}

function hasCall(name, args) {
  return Boolean(findNode(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return false
    if (!ts.isIdentifier(node.expression) || node.expression.text !== name) return false
    return args.every((arg, index) => node.arguments[index]?.getText(sourceFile) === arg)
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
