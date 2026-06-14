# Codex 全功能验证提示词

适用项目：`E:\hyy\智能路线`

当前项目静态识别结果：

- 技术栈：Vite + React + TypeScript + Tailwind CSS。
- 前端入口：`src/main.tsx`、`src/App.tsx`。
- 本地 Agent：`server/agent-server.mjs`。
- 主要验收脚本：`npm run lint`、`npm run smoke`、`npm audit --audit-level=moderate`。
- 核心功能页：登录/注册、首页仪表盘、新建行程、地图探索、POI 详情、我的行程、行程总览、行程详情、演示动态、个人中心、设置。
- 重要边界：`.env` 含本地变量，验证时只能输出变量名或脱敏信息，不能泄露密钥值。

## 使用方式

建议按顺序复制下面提示词给 Codex。除非某条提示词明确要求修复，否则先让 Codex **只验证、不修改代码**。每轮完成后，让 Codex 输出可复现的命令、路径、截图位置、发现的问题和建议修复优先级。

## 0. 总控提示词

```markdown
你现在在 Windows + PowerShell 环境下工作，项目路径是 `E:\hyy\智能路线`。请先完整理解项目结构、技术栈、启动方式、页面路由、Agent 服务、mock 数据和验收脚本，然后为本项目执行全功能验证。

要求：

1. 优先读取本地一手证据：`package.json`、`DELIVERY.md`、`src/App.tsx`、`src/store/AppContext.tsx`、`src/pages/**`、`src/services/agent.ts`、`server/agent-server.mjs`、`scripts/**`。
2. 先只验证，不修改代码；除非我明确说“修复”，否则不要改文件。
3. 不能输出 `.env` 中的真实密钥值；需要检查环境变量时，只输出变量名、是否存在、是否为空或是否脱敏。
4. 所有命令用 PowerShell 兼容写法。
5. 验证结果按表格输出：功能模块、验证方法、实际结果、问题等级、复现步骤、建议修复。
6. 若需要打开浏览器，请启动本地服务后使用浏览器自动化检查桌面和移动端视口。
7. 每个发现必须给出文件路径、页面路径或接口路径作为证据。

请先输出验证计划和你将执行的命令清单，确认后再开始。
```

## 1. 项目基线验证

```markdown
请在 `E:\hyy\智能路线` 执行项目基线验证。

验证范围：

1. 检查 Node/npm 版本、依赖是否已安装、`package-lock.json` 是否存在。
2. 执行：
   - `npm run lint`
   - `npm run smoke`
   - `npm audit --audit-level=moderate`
3. 检查 `.env.example` 与 `.env` 的变量名是否匹配，输出脱敏结果。
4. 检查 `dist/` 是否为最新构建产物；如不确定，用 `npm run build` 重新构建。

只验证，不修改代码。

输出：

| 验证项 | 命令/方法 | 结果 | 关键输出 | 风险 |
|---|---|---|---|---|

如果失败，请给出最小复现命令和初步根因。
```

## 2. 路由与鉴权验证

```markdown
请验证本项目的路由与登录态控制，重点阅读 `src/App.tsx` 和 `src/store/AppContext.tsx`。

验证目标：

1. 未登录访问 `/`、`/dashboard`、`/new-trip`、`/explore`、`/trips`、`/realtime`、`/profile`、`/settings` 都应跳转到 `/login`。
2. 登录后访问 `/login` 应跳转到 `/dashboard`。
3. 登录态来自 `localStorage`，刷新页面后应保持。
4. 退出登录后应清除登录态并回到 `/login`。
5. 未知路径 `/*` 应回到登录或首页逻辑。

请使用浏览器自动化执行，不要只读代码。桌面视口和移动视口各测一遍。

输出每条路由的预期、实际、截图路径和问题等级。
```

## 3. 登录/注册页验证

```markdown
请验证 `/login` 页面全部交互，文件为 `src/pages/Login.tsx`。

覆盖用例：

1. 登录 tab：空账号、空密码、未勾选协议时的错误提示。
2. 登录 tab：填写手机号或邮箱、勾选协议后可进入 `/dashboard`。
3. 密码显示/隐藏按钮可切换 input 类型。
4. 注册 tab：密码少于 6 位、两次密码不一致、未勾选协议的错误提示。
5. 注册成功后进入 `/dashboard`。
6. 顶部“产品介绍”“帮助中心”“简体中文”反馈正常。
7. 用户协议、隐私政策弹窗可打开和关闭。
8. 忘记密码弹窗：空输入报错，填写后出现模拟发送 toast。
9. 移动端布局不溢出、不遮挡。

只验证，不修改代码。请输出可复现步骤、实际页面文本和截图。
```

## 4. 首页仪表盘验证

```markdown
请验证 `/dashboard` 页面，文件为 `src/pages/Dashboard.tsx`。

覆盖用例：

1. 统计卡片显示：已完成行程、收藏地点、草稿行程、收藏路线。
2. 快速规划：输入目的地、出发日期、返回日期、人数，点击“开始规划”进入 `/new-trip`，并检查草稿数据是否带入。
3. 目的地输入已知城市和未知城市各测一次。
4. 人数输入 0、负数、空值时是否被修正为至少 1。
5. “为你推荐”卡片点击进入 `/poi/:id`。
6. “查看更多”进入 `/explore`。
7. 推荐路线点击后进入 `/trip/:id`，并展示所选推荐方案。
8. 最近行程点击进入对应行程详情。
9. 天气卡片和出行灵感按钮展示/跳转正常。

请使用浏览器自动化验证，并输出每个用例的实际结果。
```

## 5. 新建行程五步流程验证

```markdown
请完整验证 `/new-trip` 五步流程，涉及：

- `src/pages/newtrip/NewTrip.tsx`
- `StepBasic.tsx`
- `StepPreference.tsx`
- `StepConstraints.tsx`
- `StepGenerating.tsx`
- `StepPlans.tsx`

覆盖用例：

1. 第 1 步基础信息：城市、天数、日期、人数、旅行类型、行程风格、出发地、结束地都可修改。
2. 第 2 步偏好设置：兴趣、美食、节奏、伙伴、热门/小众、无障碍开关可修改并保持。
3. 第 3 步约束条件：预算滑块、活动时间、交通方式、步行范围、餐饮预算、排队容忍度、其他偏好开关可修改。
4. 第 4 步生成中：进度条推进，Agent 成功或失败时都能进入方案页。
5. 第 5 步推荐方案：三种类型切换、查看详情、选择方案都能进入 `/trip/:id`。
6. 从步骤 2/3 点击“上一步”数据不丢失。
7. 从步骤 1 点击返回应回到 `/dashboard`。
8. Agent 服务关闭时，生成页应回退到本地方案，不应卡死。
9. Agent 服务开启且配置 token 时，检查 `/api/agent/plan` 请求成功。

请分别验证“Agent 可用”和“Agent 不可用”两种场景。只验证，不修改代码。
```

## 6. 地图探索与 POI 搜索验证

```markdown
请验证 `/explore` 地图探索页，涉及 `src/pages/Explore.tsx`、`src/services/agent.ts`、`src/components/MapCanvas.tsx`、`src/components/AMapCanvas.tsx`。

覆盖用例：

1. 城市切换后本地 POI 列表、地图点位和筛选结果同步变化。
2. 分类多选可叠加和取消。
3. 最低评分筛选生效。
4. 距离滑块筛选生效。
5. 营业时间筛选：全部、本机时间估算、24 小时、晚间营业。
6. 搜索框：输入本地存在关键词、无结果关键词、按 Enter、点击搜索按钮。
7. Agent 搜索成功时应展示高德结果，并能进入远程 POI 详情。
8. Agent 搜索失败或未配置时，应显示“远程搜索暂不可用，已显示本地样例数据”或稳定降级结果。
9. 点击地图 marker 后高亮对应地点；点击结果卡片进入 POI 详情。
10. 没有 `VITE_AMAP_KEY` 时应使用 SVG mock 地图；有 Key 时应加载高德地图，失败应回退 mock 地图。
11. 桌面端右侧结果列表正常，移动端不应出现不可操作的关键功能缺失。

输出：每个筛选条件的输入、结果数量变化、截图和问题等级。
```

## 7. POI 详情页验证

```markdown
请验证 `/poi/:id` 页面，文件为 `src/pages/PoiDetail.tsx`。

覆盖用例：

1. 本地 POI 详情字段完整：封面、分类、评分、开放时间、门票、建议游玩、适合人群、地址、联系电话。
2. 收藏按钮：收藏/取消收藏状态正确，并影响个人中心收藏数量。
3. 分享按钮：支持系统分享时调用分享，否则复制到剪贴板并出现 toast。
4. “加入行程”：弹窗打开，可选择未完成行程，确认后追加到最后一天末尾。
5. 同一个 POI 重复加入同一行程应提示已存在，不应重复插入。
6. 已完成行程不应出现在可加入列表。
7. “导航前往”：有经纬度时打开高德导航 URL；缺经纬度时提示无法导航。
8. 用户评价“有用”：第一次加 1，重复点击提示已标记。
9. 周边推荐点击跳转到其他 POI。
10. 无效 id 访问 `/poi/not-exist` 应显示未找到。

请使用浏览器自动化验证，并检查应用状态变化。
```

## 8. 我的行程、总览与详情验证

```markdown
请验证行程相关页面：

- `/trips`：`src/pages/Trips.tsx`
- `/trip/:id`：`src/pages/TripOverview.tsx`
- `/trip/:id/detail`：`src/pages/TripDetail.tsx`
- `src/utils/browserActions.ts`
- `src/utils/amapNavigation.ts`
- `src/utils/tripBuilders.ts`

覆盖用例：

1. `/trips` 状态筛选：全部、规划中、已完成、草稿、收藏。
2. 新建行程按钮进入 `/new-trip`。
3. 行程卡片点击进入 `/trip/:id`。
4. `/trip/:id` 展示统计、每日安排、地图、备注、检查点、实用信息。
5. 分享行程：系统分享或剪贴板降级都有 toast。
6. 导出行程：下载 Markdown 文件，文件名合法，内容包含标题、日期、每日安排、备注、检查点和实用信息。
7. 编辑行程/开始导航进入 `/trip/:id/detail`。
8. `/trip/:id/detail` 地图视图与列表视图切换正常。
9. Day tab 切换后导航目标列表同步。
10. 点击时间轴节点，地图 active marker 更新。
11. 导航到此：有经纬度时打开高德 URL，无经纬度时提示。
12. 列表视图费用合计正确。
13. 从推荐方案生成的临时 trip id 也能正常展示。
14. 无效 trip id 的回退行为是否符合预期，并记录是否会误显示 `mainTrip`。

请输出每条用例的页面路径、操作、实际结果和下载文件检查结果。
```

## 9. 演示动态与智行助手验证

```markdown
请验证 `/realtime` 页面，文件为 `src/pages/Realtime.tsx`。

覆盖用例：

1. 风险事件卡片展示 4 类事件：交通拥堵、天气变化、排队提醒、景点拥挤。
2. 点击“应用调整方案”后：
   - 按钮变为已应用状态；
   - 行程进度变化；
   - 动态日志新增“调整方案已应用”；
   - 待确认调整变为 0；
   - 再次点击不会重复新增。
3. 调整前后地图都能渲染，不空白。
4. 智行助手：空输入不发送；输入问题并点击发送/按 Enter 都能追加用户消息。
5. Agent 可用时显示 Agent 回复；Agent 不可用时显示本地降级回复。
6. 发送中状态显示“助手正在输入…”。
7. 长文本消息不撑破容器。
8. 移动端和桌面端布局无明显遮挡。

只验证，不修改代码。输出截图和问题清单。
```

## 10. 个人中心验证

```markdown
请验证 `/profile` 页面，文件为 `src/pages/Profile.tsx`。

覆盖用例：

1. 用户资料卡显示头像、昵称、等级、简介。
2. 统计卡片显示总行程、行程城市、样例 POI、规划天数。
3. 偏好画像：标签、出行偏好、时间分配、兴趣偏好、美食偏好展示正常。
4. 我的行程卡片点击进入对应 `/trip/:id`。
5. 我的收藏列表与 POI 详情收藏状态联动。
6. 最近浏览点击进入 POI 详情。
7. 账户快捷入口分别跳转：
   - 个人资料：`/settings?section=profile`
   - 账户安全：`/settings?section=security`
   - 通知设置：`/settings?section=notification`
   - 会员中心：`/settings?section=ai`
   - 系统设置：`/settings?section=language`
8. 收藏为空时应有空态文案。

请输出联动验证步骤和实际结果。
```

## 11. 设置页全分组验证

```markdown
请验证 `/settings` 页面，文件为 `src/pages/Settings.tsx`。

覆盖分组：

1. `profile` 个人资料：
   - 修改昵称、邮箱、手机号、城市、简介；
   - 保存后刷新仍保持；
   - 取消后恢复上一次保存；
   - 上传非图片文件提示错误；
   - 上传图片显示本地预览。
2. `security` 账户与安全：
   - 修改密码弹窗字段校验；
   - 新密码小于 6 位报错；
   - 两次新密码不一致报错；
   - 保存成功 toast；
   - 两步验证、异地登录提醒开关；
   - 移除非当前设备需要二次确认。
3. `notification` 通知设置：所有开关可切换。
4. `preference` 偏好配置：单选、预算滑块、开关、保存按钮状态。
5. `privacy` 隐私与数据：
   - 隐私开关；
   - 导出我的数据 JSON，检查内容脱敏合理；
   - 清除浏览历史二次确认；
   - 注销账户二次确认后退出到 `/login`。
6. `language` 语言与地区：下拉选择和保存。
7. `accessibility` 无障碍：字体大小预览、高对比度、减弱动画、无障碍优先路线。
8. `ai` AI 推荐设置：强度滑块和所有开关。
9. 左侧 section 切换会更新 URL query，刷新后仍停留在对应 section。
10. 退出登录按钮回到登录页。

请使用浏览器自动化，并检查下载 JSON 文件、localStorage 状态和刷新后的持久化。
```

## 12. 顶部导航、侧边栏与全局 UI 验证

```markdown
请验证全局布局组件：

- `src/components/layout/TopNav.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/ui/index.tsx`

覆盖用例：

1. 顶部导航：首页、行程、探索、动态、我的跳转和 active 状态。
2. 顶部搜索按钮进入 `/explore`。
3. 通知弹层：打开、点击通知、toast、关闭。
4. 帮助中心弹窗：打开、关闭、Esc 关闭。
5. 语言菜单：切换语言并显示 toast。
6. 用户头像按钮进入 `/profile`。
7. 侧边栏所有导航项跳转正确。
8. 升级会员弹窗打开/关闭，不触发真实支付。
9. Modal、Toast、ConfirmDialog 的 Esc、关闭按钮和自动消失行为。
10. 桌面、平板、移动端视口下导航不遮挡内容。

请输出 UI 截图、失败用例和建议修复。
```

## 13. Agent API 与安全边界验证

```markdown
请验证 `server/agent-server.mjs` 和 `src/services/agent.ts` 的接口、安全边界与降级行为。

验证接口：

1. `GET /health`
2. `POST /api/agent/plan`
3. `POST /api/agent/chat`
4. `POST /api/agent/search`

覆盖用例：

1. 无 `AGENT_API_TOKEN` 时受保护接口返回 503。
2. 无 token 请求受保护接口返回 401。
3. 错误 token 返回 401。
4. 正确 Bearer token 返回 200。
5. `X-Agent-Token` 也可鉴权。
6. 非白名单 Origin 返回 403。
7. OPTIONS 预检请求符合 CORS 预期。
8. 触发限流后返回 429，并包含 `X-RateLimit-*` 与 `Retry-After`。
9. 请求体非法 JSON 返回 400。
10. 请求体过大返回 400。
11. DeepSeek 未配置时 chat/plan 返回 local fallback 或 amap fallback，不泄露异常细节。
12. AMap 未配置时 search 返回 local fallback。
13. AMap 配置时检查缓存和最小请求间隔是否生效。
14. 服务端日志不得输出密钥。

请优先使用 Node 脚本或 PowerShell `Invoke-RestMethod` 复现，并输出命令、状态码、关键响应字段，不输出任何真实密钥。
```

## 14. 视觉回归与响应式验证

```markdown
请启动本项目并做视觉回归验证。

视口：

1. 桌面：1440x900
2. 笔记本：1280x720
3. 平板：768x1024
4. 手机：390x844

页面：

- `/login`
- `/dashboard`
- `/new-trip`
- `/explore`
- `/trips`
- `/trip/trip-shanghai-classic`
- `/trip/trip-shanghai-classic/detail`
- `/realtime`
- `/profile`
- `/settings`

检查标准：

1. 页面首屏不空白。
2. 无明显横向溢出。
3. 按钮文字不截断。
4. 卡片内文字不重叠。
5. 地图区域不空白。
6. 弹窗在移动端可见且可关闭。
7. toast 不遮挡关键操作。
8. 表格在小屏可横向滚动。
9. 图片加载失败时 fallback 正常。
10. 控件 hover/click 后不导致布局跳动。

请保存截图到 `frontend-audit-shots/`，并输出截图清单和视觉问题表。
```

## 15. 数据一致性与状态流验证

```markdown
请验证前端状态一致性，重点看 `src/store/AppContext.tsx`。

覆盖用例：

1. 登录账号是邮箱时更新用户 email，是手机号时更新 phone。
2. `updateUser` 保存后刷新仍可读取。
3. 退出登录后 `zhixing-auth` 被清除。
4. `zhixing-user` 解析失败时能清理异常数据，不导致白屏。
5. `resetDraft` 后新建行程草稿回到默认值。
6. `selectedPlan` 选择后，行程总览和详情都能使用同一方案。
7. `addPoiToTrip`：
   - 未找到 trip 返回 false；
   - 重复 POI 返回 false；
   - 新 POI 追加到最后一天；
   - budget 和 distance 同步增加；
   - 空 itinerary 时自动创建第 1 天。
8. `remotePois` upsert 同 id 不重复。
9. `favorites` toggle 逻辑正确，并影响 Dashboard/Profile。

请用浏览器自动化和必要的控制台脚本验证，输出状态变化证据。
```

## 16. 发现问题后的修复提示词

```markdown
请根据上一轮验证报告修复问题。

要求：

1. 先按严重程度排序：P0 阻断、P1 主要功能错误、P2 体验/边界问题、P3 文案或轻微样式。
2. 每次只修复一组强相关问题，避免大范围重构。
3. 修复前先定位根因，引用具体文件和代码路径。
4. 保持项目现有 React + TypeScript + Tailwind 风格。
5. 不引入新依赖，除非说明必要性并获得确认。
6. 不泄露 `.env` 密钥，不提交真实密钥。
7. 修复后至少执行：
   - `npm run lint`
   - `npm run smoke`
   - 与修复点相关的浏览器回归验证

输出：

| 问题 | 根因 | 修改文件 | 验证命令/步骤 | 结果 | 残留风险 |
|---|---|---|---|---|---|
```

## 17. 最终验收报告提示词

```markdown
请基于所有验证结果生成最终验收报告。

报告结构：

1. 验收结论：是否达到“全部核心功能可演示、可构建、可降级”的标准。
2. 验收环境：系统、Node/npm 版本、浏览器、端口、环境变量脱敏摘要。
3. 命令验证结果：
   - `npm run lint`
   - `npm run smoke`
   - `npm audit --audit-level=moderate`
4. 功能模块验收矩阵：
   - 登录注册
   - 首页仪表盘
   - 新建行程
   - 地图探索
   - POI 详情
   - 我的行程
   - 行程总览/详情
   - 演示动态
   - 个人中心
   - 设置
   - Agent API
   - 安全与降级
   - 响应式与视觉
5. 问题清单：按 P0/P1/P2/P3 分类。
6. 已修复项与复验结果。
7. 未修复风险与上线建议。
8. 附录：截图目录、下载文件样例、接口请求样例、关键日志摘要。

要求：所有结论必须有命令、截图、文件路径、页面路径或接口响应作为证据。
```
