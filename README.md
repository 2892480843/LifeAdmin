# Routewise / 智行路线

Routewise 是一款面向旅行与城市出行的智能路线规划 Web 应用。它把目的地探索、POI 推荐、行程生成、地图查看和实时调整放在同一个工作台里，帮助用户更快规划可执行的旅行路线。

## 页面截图

### 登录页

![登录页](./docs/screenshots/01-login.png)

### 首页仪表盘

![首页仪表盘](./docs/screenshots/02-dashboard.png)

### 新建行程

![新建行程](./docs/screenshots/03-new-trip.png)

### 地图探索

![地图探索](./docs/screenshots/04-explore.png)

### 行程列表

![行程列表](./docs/screenshots/05-trips.png)

### 行程总览

![行程总览](./docs/screenshots/06-trip-overview.png)

### 实时动态

![实时动态](./docs/screenshots/07-realtime.png)

### 个人中心

![个人中心](./docs/screenshots/08-profile.png)

## 功能亮点

- **行程创建**：按目的地、日期、人数、预算、兴趣偏好和交通约束生成行程草稿。
- **智能推荐**：生成效率优先、体验优先、预算优先等多套路线方案。
- **地图探索**：查看城市 POI（Point of Interest，兴趣点，如景点、餐厅、商圈）并进入详情页。
- **行程管理**：支持行程总览、地图视图、时间轴详情和历史行程列表。
- **实时调整**：结合实时状态提示交通、天气、排队和路线风险，并给出调整建议。
- **偏好画像**：沉淀用户兴趣、餐饮偏好、节奏和预算等级，用于后续推荐。

## 技术栈

- **前端**：Vite + React + TypeScript
- **样式**：Tailwind CSS
- **路由**：React Router
- **图标**：lucide-react
- **地图能力**：高德地图 JS API 与 Web Service
- **本地 Agent**：Node.js HTTP 服务，支持路线生成、问答、POI 搜索和实时状态接口
- **AI 能力**：可配置 DeepSeek 或美团 LongCat，用于生成路线方案、智能问答和实时建议；未配置时会走本地降级逻辑

## 快速开始

```powershell
npm install
```

复制环境变量示例：

```powershell
Copy-Item .env.example .env
```

按需填写 `.env` 里的高德地图、Agent 和 LLM 配置后，分别启动本地 Agent 与前端开发服务：

```powershell
npm run agent
npm run dev
```

常用检查命令：

```powershell
npm run typecheck
npm run lint
npm run build
npm run smoke
```

## 环境变量

主要配置项见 `.env.example`。`VITE_*` 变量会进入浏览器产物（打包后任何用户都能看到），只能放公开配置或本地演示值。

| 变量 | 可见范围 | 说明 |
|---|---|---|
| `VITE_AMAP_KEY` | 浏览器可见 | 前端高德地图 JS API Key |
| `VITE_AMAP_SECURITY_CODE` | 浏览器可见 | 前端高德 JSAPI 安全密钥 |
| `VITE_AGENT_API_BASE_URL` | 浏览器可见 | 前端访问 Agent 的地址 |
| `VITE_AGENT_AUTH_MODE` | 浏览器可见 | 前端 Agent 模式：本地用 `demo`，生产用 `production` |
| `VITE_AGENT_API_TOKEN` | 浏览器可见 | 仅本地 demo 使用；生产必须留空 |
| `AGENT_AUTH_MODE` | 服务端私有 | Agent 认证模式：`demo` 或 `production` |
| `AGENT_PRODUCTION_AUTH_READY` | 服务端私有 | 生产认证边界确认开关；只有接入真实服务端认证或可信网关后才设为 `1` |
| `AGENT_API_TOKEN` | 服务端私有 | Agent 服务端校验 Token；生产不得使用 demo 占位值，也不得等于 `VITE_AGENT_API_TOKEN` |
| `LLM_PROVIDER` | 服务端私有 | LLM（大语言模型，负责生成路线和回答问题）提供方：`deepseek` 或 `longcat` |
| `LLM_MODEL` | 服务端私有 | 模型名称；未配置时 DeepSeek 默认 `deepseek-v4-flash`，LongCat 默认 `LongCat-2.0-Preview` |
| `DEEPSEEK_API_KEY` | 服务端私有 | 服务端调用 DeepSeek 的密钥 |
| `DEEPSEEK_BASE_URL` | 服务端私有 | DeepSeek OpenAI-compatible 接口地址，默认 `https://api.deepseek.com` |
| `LONGCAT_API_KEY` | 服务端私有 | 服务端调用美团 LongCat 的密钥 |
| `LONGCAT_BASE_URL` | 服务端私有 | LongCat OpenAI-compatible 接口地址，默认 `https://api.longcat.chat/openai/v1` |
| `AMAP_WEB_SERVICE_KEY` | 服务端私有 | 服务端调用高德 Web Service 的密钥 |

本地 demo 模式下，`AGENT_API_TOKEN` 与 `VITE_AGENT_API_TOKEN` 可以相同，用于隔离随手访问。生产模式下，前端不能把 `VITE_AGENT_API_TOKEN` 当作真正鉴权凭证；Agent 必须放在真实用户认证、服务端会话或可信网关之后。若 `NODE_ENV=production` 或 `AGENT_AUTH_MODE=production` 但仍使用 demo token，服务端会拒绝启动，`npm run check:env` 也会失败。

切换到美团 LongCat 时，在 `.env` 中设置：

```powershell
LLM_PROVIDER=longcat
LLM_MODEL=LongCat-2.0-Preview
LONGCAT_API_KEY=your-longcat-api-key
LONGCAT_BASE_URL=https://api.longcat.chat/openai/v1
```

## 项目结构

```text
src/
  components/      通用 UI、布局和地图组件
  mock/            演示城市、POI、行程、天气和用户数据
  pages/           登录、首页、探索、行程、实时动态、个人中心和设置页
  pages/newtrip/   新建行程分步流程
  services/        Agent、定位和实时状态服务
  store/           全局应用状态
  utils/           图片、导航、浏览器动作和行程构建工具
server/
  agent-server.mjs 本地 Agent 服务
scripts/
  smoke.mjs        冒烟测试
  check-*.mjs      环境、密钥和 POI 图片检查脚本
```

## 当前状态

该项目当前以演示和原型验证为主，已包含完整的前端页面链路、本地 Agent 接口、安全边界检查和基础构建验证。正式生产部署前，需要补充真实认证体系、持久化数据存储、多实例限流与更完整的后端权限控制。

## 生产数据源架构

生产模式下，前端不能把 `src/mock/*` 或 `data/generated-pois.json` 当作事实源。生产事实由 Agent 的 `/api/data/*` 接口返回，并使用字段级 `SourcedField` 契约记录 `sourceProvider`、`sourceEndpoint`、`sourceId`、`fetchedAt`、`expiresAt`、`confidence`、`stale`、`unavailableReason` 和 `rawSnapshotId`。

数据分为 `authoritative_static`、`provider_snapshot`、`realtime_observation`、`derived_recommendation` 和 `demo_mock` 五层。天气、路径规划和交通态势使用短 TTL；过期数据只能显示为“已过期/仅供参考”；排队、人流、票价和营业状态没有可信来源时必须显示未知或待确认。LLM 只能基于已验证事实做排序、摘要和推荐理由，不能生成未验证票价、营业时间、拥堵、排队、天气或开放状态。

运行时快照默认写入 `data/runtime/provider-snapshots/`，审计日志写入 `data/runtime/audit-log.jsonl`，可通过 `rawSnapshotId` 追溯。详细方案见 [docs/production-data-source-architecture.md](./docs/production-data-source-architecture.md)。

新增生产数据质量检查：

```powershell
npm run validate:production-data
```
