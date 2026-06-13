# Production Data Source Architecture

Routewise must not treat static POI JSON as a production fact source. Production data is served by the Node Agent through auditable, timestamped and expirable facts.

## Data Source Layers

| Layer | Purpose | Examples | Production Rule |
|---|---|---|---|
| `authoritative_static` | Low-frequency official static data | Ministry of Civil Affairs city/adcode data | Keep local JSON with source metadata and validation tests. |
| `provider_snapshot` | External provider snapshots | AMap POI name, address, coordinates, rating, opening-hours text, images | Store a raw snapshot id and field provenance before returning to the UI. |
| `realtime_observation` | Short TTL realtime observations | AMap weather, route duration, traffic status | Expire quickly and mark stale instead of presenting old data as live. |
| `derived_recommendation` | Recommendations derived from verified fields | Route order, explanation, summary | LLM output may rank or explain, but must not invent ticket, opening, traffic, queue, weather or availability facts. |
| `demo_mock` | Local demo and seed data | `src/mock/*`, `data/generated-pois.json` | Allowed only for local demo. Production mode excludes it from the app fact pool. |

## Field Contract

External facts are returned as `SourcedField<T>`:

```ts
{
  value: T | null,
  sourceProvider: string,
  sourceEndpoint: string,
  sourceId: string,
  fetchedAt: string,
  expiresAt: string,
  confidence: 'authoritative_static' | 'provider_snapshot' | 'realtime_observation' | 'derived_recommendation' | 'demo_mock' | 'unavailable',
  stale: boolean,
  unavailableReason: string | null,
  rawSnapshotId: string
}
```

The UI may display a field as fresh only when `stale === false`, `unavailableReason === null`, and the source is not `demo_mock`.

## Server Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/data/pois/search` | `POST` | Search POIs and return `provider_snapshot` fields. |
| `/api/data/pois/detail` | `POST` | Fetch a POI detail snapshot by provider id or keyword fallback. |
| `/api/data/realtime/snapshot` | `POST` | Return realtime route, weather and traffic fields with short TTL metadata. |
| `/api/data/audit/:rawSnapshotId` | `GET` | Read the audit record for a stored snapshot. |

All `/api/data/*` endpoints use the existing Agent authentication and rate-limit boundary. Provider keys such as `AMAP_WEB_SERVICE_KEY` and `DEEPSEEK_API_KEY` remain server-only.

## Persistence And Rollback

Runtime snapshots are written under `data/runtime/provider-snapshots/`. Audit rows are appended to `data/runtime/audit-log.jsonl`.

To roll back, the service can read an older `rawSnapshotId` and restore it as the active source. The first implementation uses files because the current project has no database dependency. SQLite or Postgres can replace this storage later without changing the `SourcedField` contract.

## Cache And Refresh

| Data | Default TTL | Refresh Behavior |
|---|---:|---|
| POI search/detail | `AGENT_AMAP_CACHE_TTL_MS`, default 10 minutes | Serve fresh cache, refresh on miss or forced detail request. |
| Weather | 10 minutes | Mark stale when expired. |
| Route and traffic | 2 minutes | Mark stale quickly because travel conditions change. |
| Queue/crowd | none | Return unavailable unless an official source is added. |

Failures return `value: null` plus `unavailableReason`. Stale snapshots may be shown only as stale references, never as realtime facts.

生产刷新策略：服务端优先读未过期缓存；缓存过期或强制刷新时请求外部 provider，并写入新的 `rawSnapshotId`。

## 降级策略

外部接口失败、超时、限额或缺少可信字段时，服务端返回空值和 `unavailableReason`，并保留审计记录。若存在旧快照，只能以 `stale: true` 的降级状态展示，不能标记为实时、准确或当前开放。

## Demo Data Policy

`data/generated-pois.json` remains a cold-start seed and quality-report target. `src/mock/pois.ts` remains local demo data. In production mode, `AppContext` initializes without these local POIs, so demo facts cannot silently enter production UI state.

## Known Limits

- AMap POI search can provide opening-hours text and per-capita cost for some categories, but ticket price is not treated as a stable verified fact.
- Queue time and crowd level have no configured official source and are always marked unavailable.
- File persistence is suitable for local and single-instance deployment only; multi-instance production should move snapshots and audit rows to a database.
- LLM output is `derived_recommendation`; it is never an authoritative source.
