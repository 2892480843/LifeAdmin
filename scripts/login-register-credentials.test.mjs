import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const loginSource = readFileSync(resolve(root, 'src/pages/Login.tsx'), 'utf8')

test('login tab pre-fills the built-in credentials and register tab starts empty', () => {
  assert.match(loginSource, /const handleTabChange = \(nextTab: 'login' \| 'register'\) => \{/)
  assert.match(loginSource, /const \[account, setAccount\] = useState\(DEMO_LOGIN_ACCOUNT\)/)
  assert.match(loginSource, /const \[password, setPassword\] = useState\(DEMO_LOGIN_PASSWORD\)/)
  assert.match(loginSource, /const \[showPassword, setShowPassword\] = useState\(false\)/)
  assert.match(loginSource, /setAccount\(nextTab === 'login' \? DEMO_LOGIN_ACCOUNT : ''\)/)
  assert.match(loginSource, /setPassword\(nextTab === 'login' \? DEMO_LOGIN_PASSWORD : ''\)/)
  assert.match(loginSource, /setConfirm\(''\)/)
  assert.match(loginSource, /setShowPassword\(false\)/)
})

test('login and register tabs expose browser credential metadata', () => {
  assert.match(loginSource, /<form onSubmit=\{submit\} className="space-y-4" autoComplete="on">/)
  assert.ok(loginSource.includes('id={`${tab}-account`}'))
  assert.match(loginSource, /name="username"/)
  assert.match(loginSource, /autoComplete="username"/)
  assert.ok(loginSource.includes('id={`${tab}-password`}'))
  assert.match(loginSource, /name=\{tab === 'login' \? 'password' : 'new-password'\}/)
  assert.match(loginSource, /autoComplete=\{tab === 'login' \? 'current-password' : 'new-password'\}/)
  assert.match(loginSource, /id="register-confirm-password"/)
  assert.match(loginSource, /name="new-password-confirm"/)
})

test('login tab uses built-in demo credentials before entering the app', () => {
  assert.match(loginSource, /import \{ DEMO_LOGIN_ACCOUNT, DEMO_LOGIN_PASSWORD, isValidDemoCredential \} from '\.\.\/auth\/demoCredentials'/)
  assert.match(loginSource, /tab === 'login' && !isValidDemoCredential\(account, password\)/)
  assert.match(loginSource, /login\(tab === 'login' \? DEMO_LOGIN_ACCOUNT : account\.trim\(\)\)/)
  assert.doesNotMatch(loginSource, /固定账号/)
})
