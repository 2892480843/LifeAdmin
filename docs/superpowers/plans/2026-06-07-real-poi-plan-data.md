# Real POI Plan Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve real AMap POI metadata from Agent route generation through to generated Trip itinerary items.

**Architecture:** The Agent remains the source for generated route plans. `PlanStop` becomes the typed transfer object carrying optional POI metadata, and `buildTripFromPlan()` consumes that metadata before local mock fallbacks.

**Tech Stack:** Vite, React, TypeScript, Node.js HTTP Agent, Node test runner.

---

### Task 1: Regression Test

**Files:**
- Modify: `scripts/newtrip-generated-data.test.mjs`

- [ ] **Step 1: Write the failing test**

Add assertions that `PlanStop` includes `lng` and `lat`, that server normalization enriches stops from candidates, and that `tripBuilders.ts` uses `stop.lng` and `stop.lat`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/newtrip-generated-data.test.mjs`
Expected: FAIL because `PlanStop` and `tripBuilders.ts` do not yet preserve real POI coordinates.

### Task 2: Type And Server Enrichment

**Files:**
- Modify: `src/types/index.ts`
- Modify: `server/agent-server.mjs`

- [ ] **Step 1: Extend `PlanStop`**

Add optional real POI fields: `category`, `lng`, `lat`, `x`, `y`, `rating`, `cost`, `address`, `openingHours`, `imageConfidence`, `imageSource`, `imageVerifiedAt`, `imagePendingReview`, and `imageReviewReason`.

- [ ] **Step 2: Enrich server stops**

Update `normalizeStops()` and `fallbackPlans()` so every stop matched to an AMap candidate carries those fields.

- [ ] **Step 3: Run regression test**

Run: `node --test scripts/newtrip-generated-data.test.mjs`
Expected: FAIL only on frontend Trip builder usage until Task 3 is complete.

### Task 3: Trip Builder Consumption

**Files:**
- Modify: `src/utils/tripBuilders.ts`

- [ ] **Step 1: Prefer stop metadata**

Update `buildTripFromPlan()` itinerary item construction so it reads `stop.category`, `stop.cover`, `stop.cost`, `stop.lng`, `stop.lat`, `stop.x`, and `stop.y` before local mock POI fallback.

- [ ] **Step 2: Run regression test**

Run: `node --test scripts/newtrip-generated-data.test.mjs`
Expected: PASS.

### Task 4: Verification

**Files:**
- No additional source files.

- [ ] **Step 1: Run targeted tests**

Run: `npm run test`
Expected: all Node tests pass.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: TypeScript exits with code 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: build exits with code 0.

- [ ] **Step 4: Smoke real Agent plan without DeepSeek**

Start a temporary Agent on a non-default port with `DEEPSEEK_API_KEY` empty and configured AMap key, then call `/api/agent/plan`. Expected: `source` is `amap-fallback` and returned stops include finite `lng` and `lat`.
