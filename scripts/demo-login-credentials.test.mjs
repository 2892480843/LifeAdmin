import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const modulePath = 'src/auth/demoCredentials.ts'

test('demo login credentials module exists', () => {
  assert.ok(existsSync(modulePath), 'expected src/auth/demoCredentials.ts to define demo login credentials')
})

const source = existsSync(modulePath) ? readFileSync(modulePath, 'utf8') : ''
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`
const credentials = await import(moduleUrl)

test('demo login only accepts the built-in account and password', () => {
  assert.equal(credentials.DEMO_LOGIN_ACCOUNT, 'traveler01@example.com')
  assert.equal(credentials.DEMO_LOGIN_PASSWORD, 'routewise2024')
  assert.equal(credentials.isValidDemoCredential('traveler01@example.com', 'routewise2024'), true)
  assert.equal(credentials.isValidDemoCredential(' traveler01@example.com ', 'routewise2024'), true)
  assert.equal(credentials.isValidDemoCredential('TRAVELER01@EXAMPLE.COM', 'routewise2024'), true)
  assert.equal(credentials.isValidDemoCredential('traveler01@example.com', 'wrong-password'), false)
  assert.equal(credentials.isValidDemoCredential('other@example.com', 'routewise2024'), false)
})
