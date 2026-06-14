# Real POI Plan Data Design

## Goal

Newly generated trips must use real POI data returned by the Agent's AMap search path instead of losing coordinates and metadata when the route plan is converted into a Trip.

## Current State

- `server/agent-server.mjs` already collects AMap POI candidates for `/api/agent/plan`.
- The server currently normalizes plan stops down to `poiId`, `name`, `cover`, and `order`.
- `src/utils/tripBuilders.ts` converts a selected `RoutePlan` into a `Trip` by calling `getPoi(stop.poiId)`.
- AMap POI ids are not present in local mock data, so generated Trip items can lose `lng`, `lat`, category, cover, and cost information.
- Realtime weather, route, and traffic can already use real APIs, but they need Trip itinerary nodes with real coordinates.

## Scope

In scope:
- Enrich `PlanStop` with optional real POI metadata.
- Preserve AMap candidate fields during server-side plan normalization.
- Build generated Trip itinerary items from `PlanStop` metadata first, then local mock POI fallback.
- Add focused regression tests and run type/build verification.

Out of scope:
- Database persistence.
- Production auth changes.
- Real-time queue or scenic crowd data, because the current project has no official data source for those fields.

## Design

`PlanStop` becomes the handoff boundary between the Agent and the frontend Trip builder. The server will continue letting DeepSeek choose the stop order, but `normalizeStops()` will enrich each selected stop from the collected AMap candidate list. The frontend will treat those stop fields as the preferred source of truth when constructing itinerary items.

The fallback behavior remains conservative:
- If a stop has AMap coordinates, those coordinates are used.
- If a stop lacks a field, the Trip builder falls back to the matching local mock POI.
- If neither exists, the current generic fallback remains in place.

## Error Handling

If AMap returns no candidates or external requests fail, existing `amap-fallback` and `local-fallback` behavior remains. The frontend should not invent coordinates; missing coordinates continue to become `0`, which makes realtime route generation report insufficient route data instead of presenting fake data.

## Testing

- Add a regression test proving `PlanStop` carries coordinate fields.
- Add a regression test proving server normalization enriches stops from AMap candidates.
- Add a regression test proving `buildTripFromPlan()` reads stop metadata before local mock fallback.
- Run `npm run test`, `npm run typecheck`, and `npm run build`.
