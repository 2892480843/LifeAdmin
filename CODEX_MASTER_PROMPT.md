# 智行路线 — Codex 全量优化主提示词（V2 完整版）

> 将本文件全文复制粘贴给 Codex，它将按顺序完成所有 8 项优化任务。

---

## 项目背景

你正在优化一个名为**智行路线（Routewise）**的旅行规划 Web App。

- **技术栈：** React 18.3.1 + TypeScript 5.6.3 + Vite 8 + Tailwind CSS 3.4.15
- **图标库：** lucide-react（唯一允许的图标库）
- **状态管理：** React Context API + localStorage（`src/store/AppContext.tsx`）
- **路由：** React Router 6，所有路由已在 `src/App.tsx` 定义

## 全局约束（每项任务都必须遵守）

```
✅ 只修改指定文件，不新增组件文件（除非任务明确要求）
✅ 保持现有 mock data 结构不变（src/mock/ 和 src/types/ 不改动）
✅ 保持现有路由结构（src/App.tsx 不改动）
✅ 所有样式优先使用现有 Tailwind 工具类和项目 @layer components 类
✅ 图标统一使用 lucide-react
❌ 不引入新的 UI 组件库（antd/shadcn/chakra 等）
❌ 不添加真实 API 调用（保持 mock 数据驱动）
❌ 不引入新的 npm 包
```

---

## 任务列表（按顺序执行，共 8 项）

---

### 任务 1 · 修复 StepPlans 路线类型真实过滤
**文件：** `src/pages/newtrip/StepPlans.tsx`

**问题：** `activeType` 只影响 Tab 高亮样式，`displayPlans.slice(0, 3)` 永远展示全部三条方案，切换 Tab 没有实际过滤效果。

**修复步骤：**

1. 在渲染卡片列表之前，添加过滤逻辑：

```tsx
const filteredPlans = displayPlans.filter(p => p.type === activeType)
const visiblePlans = filteredPlans.length > 0 ? filteredPlans : displayPlans.slice(0, 3)
```

2. 把渲染卡片的 `displayPlans.slice(0, 3).map(...)` 改为 `visiblePlans.map(...)`。

3. Tab 切换时同步重置选中方案（找到 `setActiveType` 调用处，改为）：

```tsx
onClick={() => {
  const nextType = filter.key
  setActiveType(nextType)
  const nextPlan = displayPlans.find(p => p.type === nextType)
  if (nextPlan) setSelectedPlanId(nextPlan.id)
}}
```

4. 若 `filteredPlans.length === 0`，在卡片列表区域显示空状态：

```tsx
{filteredPlans.length === 0 && (
  <div className="col-span-3 py-12 text-center">
    <p className="text-sm text-slate-400">当前类型暂无方案，已展示全部推荐</p>
  </div>
)}
```

5. 不改动其他逻辑（openPlan、AI 推荐理由、满意度评分）。

---

### 任务 2 · 修复 Dashboard 快速规划表单跳转
**文件：** `src/pages/Dashboard.tsx`

**问题：** `submitQuickPlan` 函数更新 draft 后只弹 toast，缺少 `navigate('/new-trip')`，用户无法进入新建行程流程。

**修复步骤：**

1. 确认文件顶部已导入 `useNavigate`（如未导入则添加）：
```tsx
import { useNavigate } from 'react-router-dom'
```

2. 确认组件内已调用（如未声明则添加）：
```tsx
const navigate = useNavigate()
```

3. 在 `submitQuickPlan` 函数内，找到 `updateDraft({...})` 调用之后：
   - 删除原来的 `setToast(...)` 调用（navigate 之后 toast 不会显示）
   - 追加：
```tsx
navigate('/new-trip')
```

4. 找到快速规划表单的提交按钮，确认文字为「立即规划」并带有 Sparkles 图标：
```tsx
<button type="submit" className="btn-primary ...">
  <Sparkles size={16} /> 立即规划
</button>
```
   若按钮文字是其他内容（如"开始规划"），统一改为「立即规划」。

5. 不改动 `submitQuickPlan` 以外的任何其他逻辑。

---

### 任务 3 · TripOverview 补齐日期 Tab 切换
**文件：** `src/pages/TripOverview.tsx`

**问题：** 当前实现把所有天全部展开为卡片列表，缺少日期 Tab 切换，用户无法按天聚焦。

**修复步骤：**

1. 在组件顶部添加 `activeDay` state（默认第 1 天）：
```tsx
const [activeDay, setActiveDay] = useState(trip.itinerary[0]?.day ?? 1)
```

2. 在左侧面板的 `overflow-y-auto` 容器内、节点列表**之前**插入 Day Tab 行：
```tsx
<div className="sticky top-0 z-10 flex overflow-x-auto border-b border-slate-100 bg-white px-3 pt-2">
  {trip.itinerary.map((day) => (
    <button
      key={day.day}
      type="button"
      onClick={() => setActiveDay(day.day)}
      className={`mr-1 flex-shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeDay === day.day
          ? 'border-brand-600 text-brand-600'
          : 'border-transparent text-slate-500 hover:text-slate-900'
      }`}
      aria-pressed={activeDay === day.day}
    >
      Day {day.day}
    </button>
  ))}
</div>
```

3. 左侧只渲染当前激活天的内容，把现有的：
```tsx
{trip.itinerary.map((day, di) => ( ... ))}
```
改为：
```tsx
{trip.itinerary
  .filter((day) => day.day === activeDay)
  .map((day, di) => ( ... ))}
```

4. 地图标记同步：当 `activeDay` 切换时，在生成 `numbered` markers 的位置，为当天节点加高亮标识：
```tsx
const numbered: MapMarker[] = trip.itinerary.flatMap((day) =>
  day.items.map((it) => ({
    ...it,
    active: it.id === activeNodeId || day.day === activeDay,
  }))
)
```
（`MapMarker` 类型中若没有 `active` 字段，则按 `day.day === activeDay` 区分标记颜色即可，不强制修改类型定义）

5. 不改动地图、备注、检查点、实用信息等其他区块。

---

### 任务 4 · 移动端底部导航栏
**文件 1（新建）：** `src/components/layout/BottomNav.tsx`  
**文件 2（修改）：** `src/components/layout/AppLayout.tsx`  
**文件 3（修改）：** `src/index.css`（或项目主 CSS 文件）

**目标：** 在移动端（md 以下）底部添加固定的 5 Tab 导航栏，桌面端不变。

**步骤 A — 新建 BottomNav.tsx：**

```tsx
import { NavLink } from 'react-router-dom'
import { Compass, LayoutDashboard, MapPin, Radio, User } from 'lucide-react'

const tabs = [
  { to: '/dashboard', icon: LayoutDashboard, label: '首页' },
  { to: '/trips',     icon: MapPin,          label: '行程' },
  { to: '/explore',   icon: Compass,         label: '探索' },
  { to: '/realtime',  icon: Radio,           label: '动态' },
  { to: '/profile',   icon: User,            label: '我的' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-200 bg-white/95 backdrop-blur safe-area-pb md:hidden"
      aria-label="底部导航"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-brand-600' : 'text-slate-400 hover:text-slate-700'
            }`
          }
          aria-label={tab.label}
        >
          {({ isActive }) => (
            <>
              <tab.icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                className={isActive ? 'text-brand-600' : ''}
                aria-hidden="true"
              />
              <span>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
```

**步骤 B — 修改 AppLayout.tsx：**

1. 在文件顶部导入：
```tsx
import BottomNav from './BottomNav'
```

2. 在 `</main>` 结束标签之后追加：
```tsx
<BottomNav />
```

3. 给 `<main>` 元素添加底部内边距，防止内容被遮挡：
```tsx
<main className="... pb-16 md:pb-0">
```
（在已有 className 末尾追加 `pb-16 md:pb-0`）

**步骤 C — 在主 CSS 文件的 `@layer components` 末尾追加：**
```css
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

---

### 任务 5 · POI 详情页增强：照片墙 + 底部浮动操作栏
**文件：** `src/pages/PoiDetail.tsx`

**目标：** 补齐照片墙（图片网格）和底部固定操作栏。

**步骤 A — 照片墙（插入在 AI 推荐卡与用户评价之间）：**

```tsx
{poi.images.length > 0 && (
  <section className="p-4 sm:p-5">
    <h2 className="mb-3 text-base font-semibold text-slate-950">照片墙</h2>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {poi.images.slice(0, 10).map((img, i) => (
        <button
          key={i}
          type="button"
          className="relative overflow-hidden rounded-lg aspect-square focus-visible:ring-2 focus-visible:ring-brand-300"
          aria-label={`查看第 ${i + 1} 张照片`}
        >
          <SmartImage
            src={img}
            alt={`${poi.name} 照片 ${i + 1}`}
            fallbackText={poi.name}
            className="h-full w-full object-cover transition duration-200 hover:scale-105"
          />
          {i === 9 && poi.images.length > 10 && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
              <span className="text-sm font-semibold text-white">+{poi.images.length - 10}</span>
            </div>
          )}
        </button>
      ))}
    </div>
  </section>
)}
```

**步骤 B — 底部浮动操作栏（在 AppLayout 内容最底部追加）：**

```tsx
<div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur safe-area-pb md:hidden">
  <div className="mx-auto flex max-w-lg gap-3">
    <button
      type="button"
      onClick={navigateToPoi}
      className="btn-ghost flex-1 py-2.5"
      aria-label="导航前往该地点"
    >
      <Navigation size={16} aria-hidden="true" /> 导航前往
    </button>
    <button
      type="button"
      onClick={() => setJoinOpen(true)}
      className="btn-primary flex-1 py-2.5"
      aria-label="加入行程"
    >
      <Plus size={16} aria-hidden="true" /> 加入行程
    </button>
  </div>
</div>
```

同时给页面最外层 `<div>` 追加 `pb-20 md:pb-0`，防止内容被浮动栏遮挡。

确认 `Navigation`、`Plus` 已从 lucide-react 导入；若无 `navigateToPoi` 函数则检查文件中已有的导航函数名并使用正确名称。

---

### 任务 6 · Explore 过滤面板补全"重置过滤"按钮
**文件：** `src/pages/Explore.tsx`

**问题：** 左侧过滤面板底部缺少"重置过滤"按钮，用户无法一键清空过滤条件。

**步骤：**

1. 阅读文件，找到过滤相关的所有 state 变量名（如 `selectedCategories`、`minRating`、`maxDistance`、`openFilter` 等，以实际变量名为准）。

2. 在组件内添加 `hasActiveFilters` 计算值（变量名以文件实际为准）：
```tsx
const hasActiveFilters = useMemo(() => (
  selectedCategories.length > 0 ||
  minRating > 0 ||
  maxDistance < 50 ||
  openFilter !== '全部'
), [selectedCategories, minRating, maxDistance, openFilter])
```

3. 添加 `resetFilters` 函数（将所有 filter state 恢复默认值）：
```tsx
const resetFilters = () => {
  setSelectedCategories([])
  setMinRating(0)
  setMaxDistance(50)
  setOpenFilter('全部')
  // 若有其他 filter state，一并重置
}
```

4. 在左侧过滤面板 `aside` 内最后一个元素之后追加重置按钮：
```tsx
<div className="mt-6 border-t border-slate-100 pt-4">
  <button
    type="button"
    onClick={resetFilters}
    disabled={!hasActiveFilters}
    className="btn-ghost w-full py-2 text-sm"
    aria-label="重置所有过滤条件"
  >
    <RotateCcw size={14} aria-hidden="true" /> 重置过滤
  </button>
</div>
```

5. 确认 `RotateCcw` 已从 lucide-react 导入（若未导入则追加）。

6. 确认 `useMemo` 已从 react 导入（若未导入则追加）。

7. 不改动地图、搜索框、结果列表等其他区块。

---

### 任务 7 · 全局统一空状态与骨架屏
**涉及文件：**
- `src/pages/Trips.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Explore.tsx`

**子任务 A — Trips.tsx（无行程时）：**

找到行程卡片列表渲染位置，在 `filteredTrips.length === 0` 时展示（替换或包裹现有空态内容）：

```tsx
{filteredTrips.length === 0 && (
  <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-slate-200 py-20 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
      <MapPin size={28} className="text-slate-300" aria-hidden="true" />
    </div>
    <h3 className="text-base font-semibold text-slate-600">暂无行程</h3>
    <p className="mt-1 text-sm text-slate-400">还没有创建任何行程，去规划你的第一次出发吧</p>
    <Link to="/new-trip" className="btn-primary mt-5 px-6 py-2.5 text-sm">
      <Plus size={16} /> 新建行程
    </Link>
  </div>
)}
```

确认 `MapPin`、`Plus` 已从 lucide-react 导入；`Link` 已从 react-router-dom 导入。

**子任务 B — Profile.tsx（收藏为空时）：**

找到收藏列表渲染位置，在 `favPois.length === 0`（以实际变量名为准）的空态处替换为：

```tsx
{favPois.length === 0 && (
  <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-200 py-10 text-center">
    <Heart size={24} className="mb-2 text-slate-200" aria-hidden="true" />
    <p className="text-sm text-slate-400">还没有收藏，去探索页发现心仪地点吧</p>
    <Link to="/explore" className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
      前往探索 →
    </Link>
  </div>
)}
```

确认 `Heart` 已从 lucide-react 导入。

**子任务 C — Explore.tsx（搜索无结果时）：**

找到结果列表渲染位置，当过滤后结果为空时展示（结果变量名以实际为准）：

```tsx
{filteredResults.length === 0 && (
  <div className="flex flex-col items-center py-16 text-center">
    <Search size={28} className="mb-3 text-slate-200" aria-hidden="true" />
    <h3 className="text-sm font-semibold text-slate-600">没有找到符合条件的地点</h3>
    <p className="text-xs text-slate-400 mt-1">尝试减少过滤条件或切换城市</p>
    <button
      type="button"
      onClick={resetFilters}
      className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700"
    >
      重置所有过滤 →
    </button>
  </div>
)}
```

（注意：`resetFilters` 在任务 6 中已添加，此处直接引用）

**子任务 D — 骨架屏一致性检查（只做检查，不新增 loading state）：**

在 `Dashboard.tsx` 的"为你推荐"POI 卡片列表中，检查是否使用了 `skeleton-line` 类。若有使用但部分行漏掉了，补齐即可。若完全没有使用，跳过此步，不新增 loading 状态或 async 数据加载。

---

### 任务 8 · Settings AI 设置面板完善
**文件：** `src/pages/Settings.tsx`

**目标：** 将 AI 推荐设置面板从占位内容补充为完整的可交互面板。

**步骤 A — 在组件内追加以下 state（加到现有 state 列表末尾）：**

```tsx
const [aiIntensity, setAiIntensity] = useState(70)
const [autoAdjust, setAutoAdjust] = useState(true)
const [prefLearning, setPrefLearning] = useState(true)
const [contextAware, setContextAware] = useState(false)
const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

const aiToggles = [
  { key: 'auto-adjust',   label: 'AI 自动调整路线',  desc: '行程中出现风险时自动生成调整建议',      value: autoAdjust,   onChange: setAutoAdjust },
  { key: 'pref-learning', label: '偏好持续学习',      desc: '根据收藏、行程完成情况更新偏好模型',    value: prefLearning, onChange: setPrefLearning },
  { key: 'context-aware', label: '上下文感知推荐',    desc: '结合天气、时间、位置动态调整建议',      value: contextAware, onChange: setContextAware },
]
```

**步骤 B — 找到 `activeSection === 'ai'` 对应的渲染分支，替换为以下完整 AI 设置面板：**

```tsx
<div className="space-y-5">

  {/* 标题区 */}
  <div className="command-surface p-5">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
        <Sparkles size={20} className="text-white" aria-hidden="true" />
      </div>
      <div>
        <p className="section-eyebrow">AI Configuration</p>
        <h2 className="text-base font-semibold text-slate-950">AI 推荐设置</h2>
        <p className="text-sm text-slate-500">控制 AI 的个性化程度与自动化行为。</p>
      </div>
    </div>
  </div>

  {/* 个性化推荐强度 */}
  <div className="card p-5">
    <h3 className="mb-1 text-sm font-semibold text-slate-900">个性化推荐强度</h3>
    <p className="mb-4 text-xs text-slate-500">值越高，AI 越偏向你的历史偏好；值越低，推荐越多样化。</p>
    <input
      type="range"
      name="ai-intensity"
      min={0}
      max={100}
      step={10}
      value={aiIntensity}
      onChange={(e) => setAiIntensity(Number(e.target.value))}
      className="w-full accent-brand-600"
      aria-label="调整个性化推荐强度"
    />
    <div className="mt-1 flex justify-between text-xs text-slate-500">
      <span>多样探索</span>
      <span className="font-semibold text-brand-600">{aiIntensity}%</span>
      <span>高度个性化</span>
    </div>
  </div>

  {/* AI 功能开关列表 */}
  <div className="card p-5">
    <h3 className="mb-4 text-sm font-semibold text-slate-900">AI 功能开关</h3>
    {aiToggles.map((item) => (
      <div
        key={item.key}
        className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0"
      >
        <div>
          <p className="text-sm font-medium text-slate-900">{item.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={item.value}
          aria-label={`切换${item.label}`}
          onClick={() => item.onChange(!item.value)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-brand-300 ${
            item.value ? 'bg-brand-600' : 'bg-slate-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              item.value ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    ))}
  </div>

  {/* 危险操作 */}
  <div className="card p-5">
    <h3 className="mb-1 text-sm font-semibold text-slate-900">重置 AI 偏好</h3>
    <p className="mb-4 text-sm text-slate-500">
      清除所有 AI 学习到的个人偏好记录，推荐将恢复为通用方案。此操作不可撤销。
    </p>
    <button
      type="button"
      onClick={() => setResetConfirmOpen(true)}
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
      aria-label="重置 AI 偏好数据"
    >
      重置 AI 偏好数据
    </button>
  </div>

</div>
```

**步骤 C — 在文件 JSX 末尾追加重置确认弹窗：**

找到文件中已有的 Modal 组件导入方式（如 `import Modal from '../components/ui/Modal'`），然后追加：

```tsx
{resetConfirmOpen && (
  <Modal
    open={resetConfirmOpen}
    title="确认重置 AI 偏好？"
    onClose={() => setResetConfirmOpen(false)}
    footer={
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setResetConfirmOpen(false)}
          className="btn-ghost px-4 py-2 text-sm"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => {
            setResetConfirmOpen(false)
            setToast?.('AI 偏好已重置')
          }}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          确认重置
        </button>
      </div>
    }
  >
    <p className="text-sm leading-6 text-slate-600">
      所有基于您行为学习到的偏好权重将被清除，下次 AI 规划将从通用模板开始。
    </p>
  </Modal>
)}
```

**约束：**
- 若文件中已有 `Slider` 和 `Toggle` 组件，优先使用它们替换上面的 `<input type="range">` 和 `<button role="switch">`
- 确认 `Sparkles` 已从 lucide-react 导入
- 若 `setToast` 不存在，改为调用文件中已有的 toast/通知函数
- 不改动其他设置分区（profile/security/notification/language 等）

---

## 验收标准

全部 8 项任务完成后，执行以下验收命令：

```bash
npm run typecheck   # TypeScript 无报错
npm run lint        # ESLint 无报错
npm run build       # Vite 生产构建成功
```

若 typecheck 报错：
- 检查新增变量的类型注解是否遗漏
- 检查导入的组件/函数名称是否与文件实际导出一致
- **不要**通过添加 `as any` 或 `// @ts-ignore` 来绕过类型检查，应修复根因

若 lint 报错：
- 检查未使用的导入是否需要删除
- 检查是否有缺少 `key` prop 的列表渲染

---

## 执行顺序提示

建议按以下顺序执行，从最小改动到影响范围最大：

```
任务 1 → 任务 2 → 任务 3 → 任务 6 → 任务 7 → 任务 5 → 任务 8 → 任务 4
```

（任务 4 最后执行，因为涉及新建文件和修改全局布局）
