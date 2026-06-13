import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const agentServerSource = readFileSync(resolve(root, 'server/agent-server.mjs'), 'utf8')
const envExampleSource = readFileSync(resolve(root, '.env.example'), 'utf8')
const agentSource = readFileSync(resolve(root, 'src/services/agent.ts'), 'utf8')
const realtimeServiceSource = readFileSync(resolve(root, 'src/services/realtimeService.ts'), 'utf8')
const exploreSource = readFileSync(resolve(root, 'src/pages/Explore.tsx'), 'utf8')
const realtimeSource = readFileSync(resolve(root, 'src/pages/Realtime.tsx'), 'utf8')
const generatingSource = readFileSync(resolve(root, 'src/pages/newtrip/StepGenerating.tsx'), 'utf8')

test('agent server supports LongCat as an OpenAI-compatible LLM provider', () => {
  assert.match(envExampleSource, /LLM_PROVIDER=deepseek/)
  assert.match(envExampleSource, /LONGCAT_API_KEY=/)
  assert.match(envExampleSource, /LONGCAT_BASE_URL=https:\/\/api\.longcat\.chat\/openai\/v1/)
  assert.match(agentServerSource, /longcat:\s*{[\s\S]*apiKeyEnv:\s*'LONGCAT_API_KEY'/)
  assert.match(agentServerSource, /defaultModel:\s*'LongCat-2\.0-Preview'/)
  assert.match(agentServerSource, /longcat:\s*{[\s\S]*supportsJsonResponseFormat:\s*false/)
  assert.match(agentServerSource, /options\.json && provider\.supportsJsonResponseFormat/)
  assert.match(agentServerSource, /function callLlm\(/)
  assert.match(agentServerSource, /llmSource\(\)/)
  assert.doesNotMatch(agentServerSource, /async function callDeepSeek/)
  assert.match(agentSource, /export type AgentLlmSource = 'deepseek' \| 'longcat'/)
  assert.match(realtimeServiceSource, /isAgentLlmSource\(result\.source\)/)
  assert.match(realtimeSource, /recommendation\.source/)
})

test('postAgentJson supports timeout and caller cancellation', () => {
  assert.match(agentSource, /DEFAULT_AGENT_TIMEOUT_MS\s*=\s*15_000/)
  assert.match(agentSource, /interface AgentRequestOptions/)
  assert.match(agentSource, /timeoutMs\?: number/)
  assert.match(agentSource, /signal\?: AbortSignal/)
  assert.match(agentSource, /new AbortController\(\)/)
  assert.match(agentSource, /setTimeout\(/)
  assert.match(agentSource, /options\.signal\.addEventListener\('abort'/)
  assert.match(agentSource, /fetch\(`\$\{AGENT_BASE_URL\}\$\{path\}`,[\s\S]*signal: controller\.signal/)
})

test('agent errors are mapped to user-safe messages', () => {
  assert.match(agentSource, /getAgentErrorMessage/)
  assert.match(agentSource, /Agent 请求超时/)
  assert.match(agentSource, /Agent 服务暂不可用/)
  assert.doesNotMatch(agentSource, /throw new Error\(data\?\.error/)
})

test('postAgentJson preserves Retry-After details on rate limit responses', () => {
  assert.match(agentSource, /class AgentRateLimitError extends Error/)
  assert.match(agentSource, /status\s*=\s*429/)
  assert.match(agentSource, /retryAfterSeconds/)
  assert.match(agentSource, /response\.headers\.get\('Retry-After'\)/)
  assert.match(agentSource, /throw new AgentRateLimitError/)
})

test('explore cancels stale searches and ignores old responses', () => {
  assert.match(exploreSource, /searchAbortRef/)
  assert.match(exploreSource, /searchRequestIdRef/)
  assert.match(exploreSource, /searchAbortRef\.current\?\.abort\(\)/)
  assert.match(exploreSource, /searchPois\([\s\S]*signal: controller\.signal/)
  assert.match(exploreSource, /requestId !== searchRequestIdRef\.current/)
})

test('realtime service and page pass cancellation signals through agent calls', () => {
  assert.match(realtimeServiceSource, /fetchRealtimeSnapshot\([\s\S]*options\?: AgentRequestOptions/)
  assert.match(realtimeServiceSource, /askRealtimeAssistant\([\s\S]*signal\?: AbortSignal/)
  assert.match(realtimeSource, /realtimeAbortRef/)
  assert.match(realtimeSource, /assistantAbortRef/)
  assert.match(realtimeSource, /fetchRealtimeSnapshot\([\s\S]*signal: controller\.signal/)
  assert.match(realtimeSource, /askRealtimeAssistant\([\s\S]*signal: controller\.signal/)
})

test('realtime page schedules 429 recovery from Retry-After instead of exponential backoff', () => {
  assert.match(realtimeServiceSource, /isAgentRateLimitError/)
  assert.match(realtimeServiceSource, /realtimeRetryAfterSeconds/)
  assert.match(realtimeSource, /realtimeRetryAfterSeconds\(err\)/)
  assert.match(realtimeSource, /rateLimitRetryAfterSeconds/)
  assert.match(realtimeSource, /scheduleRefresh\(autoRefreshRef\.current \? rateLimitRetryAfterSeconds : null\)/)
  assert.match(realtimeSource, /formatRetryAfterLabel/)
})

test('generating step times out without exposing local fallback copy', () => {
  assert.match(generatingSource, /new AbortController\(\)/)
  assert.match(generatingSource, /generateRoutePlans\([\s\S]*timeoutMs: 15_000/)
  assert.doesNotMatch(generatingSource, /本地兜底方案/)
  assert.doesNotMatch(generatingSource, /usingLocalFallback/)
})
