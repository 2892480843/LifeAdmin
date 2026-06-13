# 智行路线生产交付说明

## 交付状态

本项目为 Vite + React + TypeScript 前端，配套 `server/agent-server.mjs` 本地 Agent 服务。
当前交付目标是保留演示功能，同时补齐基础安全边界、构建验收、烟测和依赖风险说明。

## 环境变量

复制 `.env.example` 为 `.env` 后配置以下变量。

| 变量 | 作用 | 是否进入前端产物 |
|---|---|---|
| `VITE_AMAP_KEY` | 前端高德 JS API Key | 是 |
| `VITE_AMAP_SECURITY_CODE` | 前端高德 JSAPI 安全码 | 是 |
| `VITE_AGENT_API_BASE_URL` | 前端调用 Agent 的地址 | 是 |
| `VITE_AGENT_API_TOKEN` | 前端调用 Agent 的演示 Token | 是 |
| `AGENT_PORT` | Agent 服务端口 | 否 |
| `AGENT_ALLOWED_ORIGINS` | CORS 白名单 | 否 |
| `AGENT_API_TOKEN` | Agent API Token，应与 `VITE_AGENT_API_TOKEN` 保持一致 | 否 |
| `AGENT_RATE_LIMIT_WINDOW_MS` | 限流窗口 | 否 |
| `AGENT_RATE_LIMIT_MAX` | 限流窗口内最大请求数 | 否 |
| `AGENT_AMAP_CACHE_TTL_MS` | 高德 POI 搜索缓存时间 | 否 |
| `AGENT_AMAP_MIN_INTERVAL_MS` | 高德 POI 请求最小间隔 | 否 |
| `LLM_PROVIDER` | 服务端 LLM 提供方：`deepseek` 或 `longcat` | 否 |
| `LLM_MODEL` | 服务端 LLM 模型名称 | 否 |
| `DEEPSEEK_API_KEY` | 服务端 DeepSeek 密钥 | 否 |
| `LONGCAT_API_KEY` | 服务端美团 LongCat 密钥 | 否 |
| `AMAP_WEB_SERVICE_KEY` | 服务端高德 Web Service Key | 否 |

注意：

- 本地 Agent 演示需要 `AGENT_API_TOKEN` 与 `VITE_AGENT_API_TOKEN` 保持一致；二者不一致时，浏览器请求会被 Agent 拒绝。
- `.env.example` 中的 `change-me-local-agent-token` 只是本地占位值，不能用于生产，也不能当作真实密钥。
- `VITE_*` 变量会被打进浏览器产物，任何浏览器用户都可能看到；`VITE_AGENT_API_TOKEN` 只能作为本地或受控部署的基础边界，不等同于生产安全认证。
- 缺少 `VITE_AGENT_API_TOKEN` 或 Agent 未配置服务端 token 时，前端生成方案、实时问答和探索搜索应走本地降级，不阻断演示链路。

可执行以下命令检查 `.env` 与 `.env.example` 的变量名、空值状态和本地演示 token 一致性；该命令只输出变量名和布尔状态，不输出任何变量值。

```powershell
npm run check:env
```

## 启动命令

```powershell
npm install
npm run agent
npm run dev
```

生产构建和预览：

```powershell
npm run build
npm run preview
```

## 验收命令

```powershell
npm run typecheck
npm run check:env
npm run lint
npm run build
npm run smoke
npm audit --audit-level=moderate
node --check server\agent-server.mjs
```

## 本次验收结果

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过 |
| `npm run build` | 通过，Vite 8 生产构建成功 |
| `npm run smoke` | 通过，覆盖 Agent 健康检查、鉴权/CORS、三个 Agent API、构建、密钥扫描和 preview 首页 |
| `npm audit --audit-level=moderate` | 通过，0 vulnerabilities |
| `node --check server\agent-server.mjs` | 通过 |

当前依赖已升级到 `vite@8.0.16` 和 `@vitejs/plugin-react@6.0.2`。

`npm run smoke` 会自动完成：

- Agent `/health`
- `/api/agent/search`
- `/api/agent/chat`
- `/api/agent/plan`
- 前端生产构建
- 构建产物服务端密钥扫描
- Vite preview 首页 HTTP 200

## 安全边界

- `/health` 公开，但只返回服务状态、模型名和配置布尔值，不返回密钥内容。
- `/api/agent/plan`、`/api/agent/chat`、`/api/agent/search` 需要 `Authorization: Bearer <token>`。
- CORS 由 `AGENT_ALLOWED_ORIGINS` 控制，默认仅允许本机开发和预览地址。
- Agent 对受保护接口启用基础限流，避免 LLM 和高德接口被刷。
- 高德 POI 搜索使用内存缓存和请求间隔控制；外部失败时返回稳定降级响应。
- 服务端错误返回通用文案，具体异常只写入服务端日志。

## 已知限制

- 登录仍是 `localStorage` 演示态，不是生产认证体系。正式上线应接入后端 Session、JWT 或统一身份网关。
- `VITE_AGENT_API_TOKEN` 会暴露在浏览器包中，只适合本地或受控环境的基础防护。公网生产应将 Agent 放在认证网关后面。
- 当前限流和高德缓存都是单进程内存实现；多实例部署需要 Redis 或网关层限流。
- 高德和 LLM 外部服务不可用时，系统会返回本地降级结果，保证演示链路不断，但结果质量会下降。

## 回滚方式

当前目录不是 Git 仓库，建议发布前先归档以下文件：

- `server/agent-server.mjs`
- `src/services/agent.ts`
- `src/vite-env.d.ts`
- `package.json`
- `package-lock.json`
- `.env.example`
- `scripts/`
- `DELIVERY.md`

若 Vite 主版本升级导致构建异常，优先恢复 `package.json` 和 `package-lock.json`，再执行 `npm install`。
