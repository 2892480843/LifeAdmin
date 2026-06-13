# Routewise 美团点评 POI 接入执行清单

更新时间：2026-06-08

## 结论

Routewise 可以按“服务端代理 + 字段级溯源 + 权限分级申请”的方式推进美团点评 POI 接入。公开官方文档能确认 POI 搜索、POI 详情字段、实时排队字段和签名规则；价格、QPS、城市范围、字段授权、缓存期限和上线展示规范仍需美团商务或开放平台审核确认。

## 已核验官方能力

| 能力 | 官方接口/字段 | Routewise 用途 | 当前判断 |
|---|---|---|---|
| POI 搜索 | `POST https://poiopen.dianping.com/router/poisearch/search` | 探索页搜索餐饮、购物、娱乐等 POI | 可申请；地址、距离、类目等字段需权限 |
| 授权城市 | `POST https://poiopen.dianping.com/router/city/opencity` | 判断哪些城市可用点评数据 | 应申请 |
| 单 POI 详情 | `POST https://poiopen.dianping.com/router/poi/getsinglepoi` | 详情页口碑、图片、人均、推荐菜 | 应申请 |
| 批量 POI 详情 | `POST https://poiopen.dianping.com/router/poi/batchgetpoi` | 行程列表批量补齐口碑字段 | 应申请；官方示例标注最多 100 条 |
| 实时排队 | `POST https://poiopen.dianping.com/router/realtime/getcoopinfo`，`queueInfo.msg`、`queueInfo.shortMsg` | 实时动态和餐厅详情排队提示 | 应申请；属于短 TTL 实时事实 |
| POI 电话实时查询 | `POST https://poiopen.dianping.com/router/realtime/getpoiphone` | Routewise 暂无呼叫商户场景 | 暂不申请 |

来源：美团点评 POI 搜索文档、POI 数据开放文档、实时数据开放文档：
[POI 搜索](https://poiopen.dianping.com/instructions/doc/poisearch.html)、
[POI 数据开放](https://poiopen.dianping.com/instructions/doc/poi.html)、
[实时数据开放](https://poiopen.dianping.com/instructions/doc/coop.html)。

## 申请字段

| 优先级 | 字段 | 用途 | 申请说明 |
|---|---|---|---|
| P0 | `openshopid`、`name`、`branch_name`、`address`、`city`、`latitude`、`longitude`、`categories` | 搜索、地图、详情页基础展示 | 核心字段 |
| P0 | `mShopInfoUrl`、`appShopInfoUrl`、`pcShopInfoUrl`、`wxShopInfoUrl` | 跳转官方详情页和来源归因 | 建议明确展示规范 |
| P0 | `star`、`avgprice`、`reviewCount` | 路线排序、预算估算、口碑展示 | 只做辅助展示，不替代官方详情页 |
| P0 | `shopPics`、`headPic` | POI 封面和详情图片 | 需确认图片缓存期限和可展示位置 |
| P0 | `dishs`、`mRecommendDishUrl`、`appRecommendDishUrl` | 餐厅推荐菜和跳转 | 仅在餐饮类目启用 |
| P0 | `queueable`、`mQueueUrl`、`appQueueUrl`、`queueInfo` | 排队提示和官方排号入口 | `queueInfo` 需短 TTL |
| P1 | `reviewTags`、`mReviewAllUrl`、`appReviewAllUrl` | 评论标签和跳转评论页 | 优先申请摘要/标签，不拉取全文评论 |
| P2 | `ugcs` | 评论列表 | 需谨慎；不建议复制或长期存储完整 UGC |
| 暂缓 | `telephone`、`getpoiphone` | 电话联系商户 | 涉及用户手机号和呼叫场景，当前不申请 |

## 当前代码落点

| 模块 | 状态 | 说明 |
|---|---|---|
| `server/providers/dianping-provider.mjs` | 已对齐官方路径 | 使用服务端签名，搜索走 `poisearch/search`，详情走 `poi/getsinglepoi`，排队走 `realtime/getcoopinfo` |
| `.env.example` | 已预留私有配置 | `DIANPING_APP_KEY`、`DIANPING_APP_SECRET`、`DIANPING_SESSION` 只在服务端使用 |
| `src/services/dianpingService.ts` | 已走 Agent 代理 | 浏览器端只调用 `/api/data/dianping/*`，不暴露密钥 |
| `src/pages/PoiDetail.tsx` | 已有来源面板 | 展示点评字段、来源、有效/过期状态和不可用原因 |
| `scripts/dianping-provider.test.mjs` | 已覆盖接入契约 | 覆盖签名、搜索解析、详情字段、排队字段、无凭证降级 |

## 拿到权限后的验证步骤

1. 在服务端环境变量中配置：

```bash
DIANPING_ENABLED=1
DIANPING_APP_KEY=...
DIANPING_APP_SECRET=...
DIANPING_SESSION=...
DIANPING_CACHE_TTL_MS=600000
DIANPING_MIN_INTERVAL_MS=300
```

2. 启动 Agent：

```bash
npm run agent
```

3. 用 `openshopid` 验证详情和排队接口：

```bash
curl -X POST http://127.0.0.1:8787/api/data/dianping/pois/detail \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <AGENT_API_TOKEN>' \
  -d '{"sourceId":"<openshopid>"}'
```

```bash
curl -X POST http://127.0.0.1:8787/api/data/dianping/realtime/queue \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <AGENT_API_TOKEN>' \
  -d '{"sourceId":"<openshopid>"}'
```

4. 验收标准：

| 验收项 | 标准 |
|---|---|
| 签名 | 请求参数包含毫秒级 `timestamp`、`appkey`、`session`、`sign` |
| 搜索 | 官方 `records` 能归一化为 Routewise POI |
| 详情 | `star`、`avgprice`、`reviewCount`、`shopPics`、`dishs` 能进入 `SourcedField` |
| 排队 | `queueInfo.msg`/`shortMsg` 能进入短 TTL 实时字段 |
| 降级 | 权限、限额、超时、未配置时返回 `unavailableReason`，不伪造事实 |
| 审计 | `data/runtime/audit-log.jsonl` 能追溯 `rawSnapshotId` |

## 商务沟通模板

主题：Routewise 申请美团点评 POI 搜索、详情与实时排队接口合作

正文：

```text
您好，

我们是 Routewise，产品场景是旅行和城市出行路线规划。希望通过服务端接口接入美团点评 POI 能力，用于用户在行程规划中查看餐饮、购物、休闲娱乐等 POI 的基础信息、口碑摘要、图片、人均价格、推荐菜、官方详情页跳转和实时排队提示。

拟申请能力：
1. POI 搜索：poisearch/search
2. 授权城市查询：city/opencity
3. 单 POI 详情：poi/getsinglepoi
4. 批量 POI 详情：poi/batchgetpoi
5. 实时排队信息：realtime/getcoopinfo

拟申请字段：
openshopid、name、branch_name、address、city、latitude、longitude、categories、business_hour、mShopInfoUrl、appShopInfoUrl、pcShopInfoUrl、wxShopInfoUrl、star、avgprice、reviewCount、reviewTags、shopPics、headPic、dishs、queueable、mQueueUrl、appQueueUrl、queueInfo。

我们不会在前端暴露 appkey/appsecret/session；不会将模型生成内容标记为官方事实；不会长期复制完整评论库；所有外部字段会记录来源、抓取时间、过期时间和原始快照 ID。请协助确认：

1. Routewise 应按哪类合作身份申请？
2. 上述接口和字段是否可授权给行程规划辅助展示场景？
3. 是否有字段级缓存 TTL、QPS、日配额、城市范围、类目范围限制？
4. 是否必须展示美团/大众点评 Logo、来源文案、跳转入口或其他品牌规范？
5. 是否需要上线前安全审核、等保、隐私协议、数据合规承诺或其他材料？
6. 商务价格、免费配额、超额计费、保证金或账单周期如何确认？

谢谢。
```

## 合规约束

- 所有美团点评密钥只允许存在服务端环境变量中，浏览器端不得出现 `DIANPING_APP_KEY`、`DIANPING_APP_SECRET`、`DIANPING_SESSION`。
- `queueInfo` 是实时观察字段，必须短 TTL；过期后只能显示为过期或未知。
- `star`、`avgprice`、`reviewCount`、`shopPics`、`dishs` 属于外部 provider 快照，必须展示来源和抓取时间。
- LLM 只能基于已验证字段做摘要和排序，不能生成或补全未返回的排队、价格、评分、营业状态。
- 完整 UGC 评论内容默认不做长期镜像；如商务授权允许读取，也需要单独确认展示、缓存和删除规则。

## 仍需官方确认

| 问题 | 影响 |
|---|---|
| 具体合作身份和审核材料 | 决定能否进入权限审批 |
| 字段级授权范围 | 决定详情页可展示哪些点评字段 |
| QPS、日配额和费用 | 决定缓存、限流和成本模型 |
| 城市和类目范围 | 决定产品首发城市和 fallback 逻辑 |
| 品牌展示规范 | 决定 UI 来源文案、Logo、跳转按钮 |
| 缓存期限和 UGC 规则 | 决定数据存储和删除策略 |
