// Frontend-only demo credentials. Do not treat these as production authentication.
export const DEMO_LOGIN_ACCOUNT = 'traveler01@example.com'
export const DEMO_LOGIN_PASSWORD = 'routewise2024'

export function isValidDemoCredential(account: string, password: string) {
  return account.trim().toLowerCase() === DEMO_LOGIN_ACCOUNT && password === DEMO_LOGIN_PASSWORD
}
