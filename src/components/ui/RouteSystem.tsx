import { useId, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Navigation, Sparkles } from 'lucide-react'

export type RouteMapNode = { id: string; label: string; color?: string }

// 由字符串生成稳定的伪随机数，保证同一条路线的拓扑形态固定
function hashString(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

// 在 0-100 的归一化坐标系内，把节点排布成一条蜿蜒的"路线"形态
export function buildRoutePoints(nodes: RouteMapNode[]): { x: number; y: number }[] {
  const count = nodes.length
  return nodes.map((node, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1)
    const x = 12 + t * 76
    const phase = ((hashString(node.id || node.label) % 100) / 100) * Math.PI * 2
    const wave = Math.sin(index * 0.95 + phase) * 20
    const jitter = ((hashString(node.label) % 9) - 4) * 1.6
    const y = Math.max(18, Math.min(82, 50 + wave + jitter))
    return { x, y }
  })
}

// 用 Catmull-Rom 转贝塞尔，生成平滑路线路径
export function routeSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  const segments = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`]
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[index + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    segments.push(
      `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    )
  }
  return segments.join(' ')
}

type Tone = 'brand' | 'emerald' | 'amber' | 'rose' | 'slate'

const toneMap: Record<Tone, { soft: string; text: string; border: string; dot: string }> = {
  brand: {
    soft: 'bg-brand-50',
    text: 'text-brand-700',
    border: 'border-brand-200',
    dot: 'bg-brand-600',
  },
  emerald: {
    soft: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  amber: {
    soft: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  rose: {
    soft: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  slate: {
    soft: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
}

export function RoutePageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  status = '已同步',
  statusTone = 'emerald',
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  status?: ReactNode
  statusTone?: Tone
}) {
  return (
    <div className="route-header flex flex-col gap-4 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <span className="status-dot-live" />
          <span className="h-px w-8 bg-gradient-to-r from-brand-400 to-transparent" />
          <p className="section-eyebrow">{eyebrow}</p>
        </div>
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap gap-2">{meta}</div>}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        <StatusPill tone={statusTone}>{status}</StatusPill>
        {actions}
      </div>
    </div>
  )
}

export function SystemPanel({
  children,
  className = '',
  accent = 'brand',
  scan = false,
  showAccentRail = true,
}: {
  children: ReactNode
  className?: string
  accent?: Tone
  scan?: boolean
  showAccentRail?: boolean
}) {
  return (
    <section className={`command-panel route-panel relative min-w-0 ${toneMap[accent].border} ${scan ? 'route-scan-line' : ''} ${className}`}>
      {showAccentRail && <div className={`absolute bottom-4 left-3 top-4 w-0.5 rounded-full ${toneMap[accent].dot} opacity-85`} aria-hidden="true" />}
      {children}
    </section>
  )
}

export function MetricTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'brand',
  trend,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: Tone
  trend?: ReactNode
}) {
  const toneClass = toneMap[tone]
  return (
    <div className="metric-tile min-w-0 px-3 py-3">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneClass.border} ${toneClass.soft} ${toneClass.text}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-slate-500">{label}</p>
          <p className="mt-0.5 truncate text-base font-semibold text-slate-950">{value}</p>
        </div>
        {trend && <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${toneClass.soft} ${toneClass.text}`}>{trend}</span>}
      </div>
      {detail && <p className="mt-2 truncate text-xs text-slate-400">{detail}</p>}
    </div>
  )
}

export function StatusPill({
  children,
  tone = 'slate',
  pulse = false,
}: {
  children: ReactNode
  tone?: Tone
  pulse?: boolean
}) {
  const toneClass = toneMap[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass.border} ${toneClass.soft} ${toneClass.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${toneClass.dot} ${pulse || tone === 'emerald' ? 'animate-route-pulse' : ''}`} aria-hidden="true" />
      {children}
    </span>
  )
}

export function RouteNodeRail({
  nodes,
  activeId,
  onActivate,
  className = '',
}: {
  nodes: { id: string; time?: string; label: string; meta?: ReactNode; status?: string; color?: string }[]
  activeId?: string
  onActivate?: (id: string) => void
  className?: string
}) {
  return (
    <ol className={`route-rail space-y-2 ${className}`}>
      {nodes.map((node, index) => {
        const active = node.id === activeId
        return (
          <li key={node.id} className="relative">
            <span
              className={`absolute -left-[29px] top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm ${
                active ? 'node-pulse ring-4 ring-brand-100' : ''
              }`}
              style={{ backgroundColor: node.color ?? (active ? '#2563eb' : '#94a3b8') }}
            >
              {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onActivate?.(node.id)}
              onMouseEnter={() => onActivate?.(node.id)}
              aria-pressed={active}
              aria-label={`选择路线节点 ${node.label}`}
              className={`w-full rounded-lg px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${
                active ? 'bg-brand-50 text-brand-800 ring-1 ring-brand-100' : 'hover:bg-slate-50 hover:shadow-sm'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {node.time && <span className="shrink-0 text-xs font-medium text-slate-400">{node.time}</span>}
                <span className="truncate text-sm font-semibold text-slate-800">{node.label}</span>
              </div>
              {node.meta && <div className="mt-0.5 truncate text-xs text-slate-500">{node.meta}</div>}
              {node.status && <div className="mt-1 text-[11px] text-slate-400">{node.status}</div>}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function DecisionCard({
  title,
  reason,
  impact,
  risk = '低',
  tone = 'brand',
  actionLabel = '执行建议',
  onAction,
}: {
  title: string
  reason: string
  impact: string
  risk?: '低' | '中' | '高'
  tone?: Tone
  actionLabel?: string
  onAction?: () => void
}) {
  const riskTone: Tone = risk === '高' ? 'rose' : risk === '中' ? 'amber' : 'emerald'
  const toneClass = toneMap[tone]
  return (
    <div className={`rounded-card border bg-white p-4 ${toneClass.border}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass.soft} ${toneClass.text}`}>
          <Sparkles size={17} aria-hidden="true" />
        </span>
        <StatusPill tone={riskTone}>{risk}风险</StatusPill>
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2 text-xs leading-5 text-slate-500">
        <p><span className="font-semibold text-slate-700">原因：</span>{reason}</p>
        <p><span className="font-semibold text-slate-700">影响：</span>{impact}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        aria-label={actionLabel}
      >
        {actionLabel} <ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

export function CheckpointStrip({ items }: { items: string[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item, index) => (
        <span
          key={item}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">
            {index + 1}
          </span>
          {item}
        </span>
      ))}
    </div>
  )
}

export function RiskBadge({ level }: { level: '低' | '中' | '高' }) {
  if (level === '高') return <StatusPill tone="rose"><AlertTriangle size={12} aria-hidden="true" /> 高风险</StatusPill>
  if (level === '中') return <StatusPill tone="amber"><AlertTriangle size={12} aria-hidden="true" /> 中风险</StatusPill>
  return <StatusPill tone="emerald"><CheckCircle2 size={12} aria-hidden="true" /> 低风险</StatusPill>
}

export function RouteLoadingState({
  title = '正在同步路线数据',
  description = 'AI 正在读取当前上下文，请稍候。',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="empty-state route-scan-line py-8">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
    </div>
  )
}

export function RouteEmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state py-8">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={20} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

// 真实感路线拓扑缩略图：地图网格 + 渐变流动路线 + 编号节点 + 活动节点脉冲
export function RouteMiniMap({
  nodes,
  activeIndex = 0,
  tone = 'light',
  className = '',
  showLegend = true,
  showCompass = true,
}: {
  nodes: RouteMapNode[]
  activeIndex?: number
  tone?: 'light' | 'dark'
  className?: string
  showLegend?: boolean
  showCompass?: boolean
}) {
  const gradientId = useId().replace(/:/g, '')
  const dark = tone === 'dark'
  const surfaceClass = dark ? 'map-grid-surface-dark' : 'map-grid-surface'
  const chipClass = dark
    ? 'border-white/15 bg-white/10 text-white/85'
    : 'border-white/70 bg-white/85 text-slate-600'
  const eyebrowClass = dark ? 'text-white/55' : 'text-slate-500'

  if (!nodes.length) {
    return (
      <div className={`${surfaceClass} route-scan-line flex items-center justify-center ${className}`}>
        <p className={`text-xs ${dark ? 'text-white/55' : 'text-slate-400'}`}>暂无路线节点</p>
      </div>
    )
  }

  const points = buildRoutePoints(nodes)
  const pathD = routeSmoothPath(points)
  const safeActive = Math.max(0, Math.min(activeIndex, nodes.length - 1))
  const endColor = '#11bfae'

  return (
    <div className={`${surfaceClass} route-scan-line relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5">
        <span className="status-dot-live" />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${eyebrowClass}`}>路线拓扑</span>
      </div>
      {showCompass && (
        <div className={`pointer-events-none absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border ${dark ? 'border-white/15 text-white/70' : 'border-slate-200/80 bg-white/70 text-slate-500'}`}>
          <Navigation size={13} aria-hidden="true" />
        </div>
      )}

      {pathD && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id={`routeGrad-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="55%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#11bfae" />
            </linearGradient>
          </defs>
          <path d={pathD} fill="none" stroke={dark ? 'rgba(96,165,250,0.28)' : 'rgba(37,99,235,0.18)'} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path
            d={pathD}
            className="animate-route-flow"
            fill="none"
            stroke={`url(#routeGrad-${gradientId})`}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray="5 6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {points.map((point, index) => {
        const active = index === safeActive
        const isStart = index === 0
        const isEnd = index === nodes.length - 1
        const color = nodes[index].color ?? (isEnd ? endColor : '#2563eb')
        return (
          <div
            key={nodes[index].id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            {active && (
              <span
                className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 animate-node-ping rounded-full"
                style={{ backgroundColor: color }}
              />
            )}
            <span
              className={`relative flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-bold text-white shadow ${
                active ? 'border-white ring-2 ring-brand-200/70' : dark ? 'border-command-950' : 'border-white'
              }`}
              style={{ backgroundColor: color }}
            >
              {isStart || isEnd ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : index + 1}
            </span>
          </div>
        )
      })}

      {showLegend && nodes.length > 1 && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2">
          <span className={`inline-flex max-w-[46%] items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm backdrop-blur ${chipClass}`}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
            <span className="truncate">{nodes[0].label}</span>
          </span>
          <span className={`shrink-0 text-[10px] font-medium ${dark ? 'text-white/45' : 'text-slate-400'}`}>{nodes.length} 节点</span>
          <span className={`inline-flex max-w-[46%] items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm backdrop-blur ${chipClass}`}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-locate-500" />
            <span className="truncate">{nodes[nodes.length - 1].label}</span>
          </span>
        </div>
      )}
    </div>
  )
}

export function RouteErrorState({
  title = '同步失败',
  description,
  action,
}: {
  title?: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state border-risk-200 bg-risk-50/60 py-8">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-risk-50 text-risk-600">
        <AlertTriangle size={20} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-600">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
