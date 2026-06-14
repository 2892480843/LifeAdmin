/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 高德地图 Web 端 JS API Key（缺省时地图自动回退为内置示意图）
  readonly VITE_AMAP_KEY?: string
  // 高德安全密钥（JSAPI 2.0 可选，部分账号需要）
  readonly VITE_AMAP_SECURITY_CODE?: string
  // 后端 Agent 服务地址
  readonly VITE_AGENT_API_BASE_URL?: string
  // Agent auth mode. Use demo locally and production behind a real auth boundary.
  readonly VITE_AGENT_AUTH_MODE?: 'demo' | 'production'
  // Browser-visible token for local demo mode only.
  readonly VITE_AGENT_API_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
