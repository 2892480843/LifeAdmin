import { useState } from 'react'
import { Plus, Minus, Navigation, Layers, Locate } from 'lucide-react'
import AMapCanvas from './AMapCanvas'
import { canNavigateTo, openAmapNavigation } from '../utils/amapNavigation'

export interface MapMarker {
  id: string
  x: number // 0-100
  y: number // 0-100
  // 真实经纬度（GCJ-02），提供时可在高德地图上精确定位
  lng?: number
  lat?: number
  label?: string
  color?: string
  order?: number
  active?: boolean
  status?: 'default' | 'selected' | 'risk' | 'favorite' | 'joined'
}

export interface RouteGroup {
  color: string
  points: { x: number; y: number; lng?: number; lat?: number }[]
}

interface MapCanvasProps {
  markers: MapMarker[]
  // 是否按 order 连线（行程路线）
  showRoute?: boolean
  // 多段路线分组（按颜色），用于多天/多色路线
  routeGroups?: RouteGroup[]
  className?: string
  onMarkerClick?: (id: string) => void
  height?: string
}

// 可切换地图：有高德 Key 时走高德真实底图，加载失败或仅有无经纬度的旧数据时回退 SVG 地图
export default function MapCanvas(props: MapCanvasProps) {
  const [amapFailed, setAmapFailed] = useState(false)
  const hasKey = Boolean(import.meta.env.VITE_AMAP_KEY)
  // 仅当存在标记且全部缺少经纬度时才判定为"无地理数据"（空结果不算，避免筛选无结果时回退到示意图）
  const onlyNonGeoMarkers =
    props.markers.length > 0 &&
    props.markers.every((m) => typeof m.lng !== 'number' || typeof m.lat !== 'number')

  if (hasKey && !amapFailed && !onlyNonGeoMarkers) {
    return <AMapCanvas {...props} onError={() => setAmapFailed(true)} />
  }
  return <FallbackMap {...props} />
}

// 回退地图底图 + 标记点 + 路线，纯 SVG/CSS 实现
function FallbackMap({
  markers,
  showRoute = false,
  routeGroups,
  className = '',
  onMarkerClick,
  height = '100%',
}: MapCanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [layer, setLayer] = useState<'normal' | 'simple' | 'dark'>('normal')
  const [message, setMessage] = useState('')
  const [selectedMarkerId, setSelectedMarkerId] = useState('')

  const sorted = [...markers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const routePath = sorted.map((m) => `${m.x},${m.y}`).join(' ')
  const selectedMarker = markers.find((m) => m.active) ?? markers.find((m) => m.id === selectedMarkerId)
  const layerConfig = {
    normal: {
      label: '普通',
      bg: '#eaf0f6',
      water: '#cfe3f5',
      river: '#bcd8f0',
      green: '#d6ead2',
      grid: '#dde5ee',
      road: '#ffffff',
    },
    simple: {
      label: '简洁',
      bg: '#f8fafc',
      water: '#dbeafe',
      river: '#bfdbfe',
      green: '#dcfce7',
      grid: '#e2e8f0',
      road: '#f1f5f9',
    },
    dark: {
      label: '深色',
      bg: '#172033',
      water: '#1e3a5f',
      river: '#244c77',
      green: '#1f5134',
      grid: '#334155',
      road: '#64748b',
    },
  }[layer]

  const cycleLayer = () => {
    const layers = ['normal', 'simple', 'dark'] as const
    const next = layers[(layers.indexOf(layer) + 1) % layers.length]
    setLayer(next)
    setMessage(`已切换到${next === 'normal' ? '普通' : next === 'simple' ? '简洁' : '深色'}底图`)
  }

  const locate = () => {
    setMessage('当前位置请使用页面上的浏览器定位按钮获取')
  }

  const navigateToSelected = () => {
    if (!selectedMarker) {
      setMessage('请先选择地点')
      return
    }

    const point = {
      name: selectedMarker.label ?? '选中地点',
      lng: selectedMarker.lng,
      lat: selectedMarker.lat,
    }

    if (!canNavigateTo(point)) {
      setMessage('选中地点缺少经纬度，暂时无法导航')
      return
    }

    openAmapNavigation({ to: point, mode: 'car' })
    setMessage(`已打开高德导航：${point.name}`)
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-card border border-slate-200 ${className}`}
      style={{ height, minHeight: height }}
    >
      {/* 底图：渐变水域 + 街区纹理 */}
      <div className="absolute inset-0" style={{ backgroundColor: layerConfig.bg }} />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full transition-transform duration-300"
        style={{ transform: `scale(${zoom})` }}
      >
        {/* 水域：黄浦江 */}
        <path
          d="M0,30 C20,28 30,45 45,50 C60,55 70,72 85,78 L100,82 L100,100 L0,100 Z"
          fill={layerConfig.water}
          opacity="0.85"
        />
        <path
          d="M68,0 C66,15 78,28 80,45 C82,60 74,80 78,100"
          fill="none"
          stroke={layerConfig.river}
          strokeWidth="10"
          opacity="0.5"
        />
        {/* 绿地 */}
        <circle cx="80" cy="60" r="9" fill={layerConfig.green} opacity="0.8" />
        <rect x="6" y="62" width="16" height="12" rx="2" fill={layerConfig.green} opacity="0.7" />
        {/* 街区网格 */}
        <g stroke={layerConfig.grid} strokeWidth="0.4">
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={'h' + i} x1="0" y1={i * 10} x2="100" y2={i * 10} />
          ))}
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={'v' + i} x1={i * 10} y1="0" x2={i * 10} y2="100" />
          ))}
        </g>
        {/* 主干道 */}
        <g stroke={layerConfig.road} strokeWidth="1.6" opacity="0.9">
          <line x1="0" y1="40" x2="65" y2="44" />
          <line x1="30" y1="0" x2="36" y2="100" />
          <line x1="50" y1="20" x2="58" y2="90" />
        </g>

        {/* 路线连线 */}
        {showRoute && !routeGroups && sorted.length > 1 && (
          <polyline
            points={routePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="1"
            strokeLinecap="round"
            strokeDasharray="2 1.5"
          />
        )}
        {routeGroups?.map((g, gi) => (
          <polyline
            key={gi}
            points={g.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={g.color}
            strokeWidth="1"
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* 标记点（HTML 层，保证文字清晰） */}
      <div className="absolute inset-0" style={{ transform: `scale(${zoom})` }}>
        {markers.map((m) => {
          const active = m.active || m.id === selectedMarkerId
          const state = active ? 'selected' : m.status ?? 'default'
          const stateClass =
            state === 'risk'
              ? 'after:absolute after:-right-0.5 after:-top-0.5 after:h-2.5 after:w-2.5 after:rounded-full after:bg-risk-500 after:ring-2 after:ring-white'
              : state === 'favorite'
                ? 'after:absolute after:-right-0.5 after:-top-0.5 after:h-2.5 after:w-2.5 after:rounded-full after:bg-notice-500 after:ring-2 after:ring-white'
                : state === 'joined'
                  ? 'after:absolute after:-right-0.5 after:-top-0.5 after:h-2.5 after:w-2.5 after:rounded-full after:bg-locate-500 after:ring-2 after:ring-white'
                  : ''
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSelectedMarkerId(m.id)
                setMessage(`已选择：${m.label ?? '地点'}`)
                onMarkerClick?.(m.id)
              }}
              aria-label={`选择地图地点：${m.label ?? '地点'}`}
              aria-pressed={active}
              className={`group absolute -translate-x-1/2 -translate-y-full ${stateClass}`}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
            >
              <span
                className={`flex items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-md transition-transform group-hover:scale-110 ${
                  active ? 'scale-125 ring-4 ring-brand-500/20 shadow-lg' : ''
                }`}
                style={{
                  backgroundColor: m.color ?? '#2563eb',
                  width: active ? (m.order ? 28 : 20) : m.order ? 22 : 14,
                  height: active ? (m.order ? 28 : 20) : m.order ? 22 : 14,
                }}
              >
                {m.order ?? ''}
              </span>
              {m.label && (
                <span
                  className={`pointer-events-none absolute left-1/2 top-full mt-2 max-w-36 -translate-x-1/2 truncate whitespace-nowrap rounded-md border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm transition-opacity ${
                    active ? 'block opacity-100' : 'hidden opacity-0 group-hover:opacity-100 sm:block'
                  }`}
                >
                  {m.label}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 缩放与工具按钮 */}
      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm max-sm:top-20">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(z + 0.15, 1.6))}
          className="p-2 text-slate-600 hover:bg-slate-50"
          title="放大"
          aria-label="放大地图"
        >
          <Plus size={16} />
        </button>
        <div className="h-px bg-slate-200" />
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.8))}
          className="p-2 text-slate-600 hover:bg-slate-50"
          title="缩小"
          aria-label="缩小地图"
        >
          <Minus size={16} />
        </button>
      </div>
      {message && (
        <div className="absolute bottom-4 left-4 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm max-sm:bottom-28">
          {message}
        </div>
      )}
      <div className="absolute bottom-4 right-4 flex gap-2 max-sm:bottom-28">
        <button type="button" onClick={cycleLayer} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50" title={`图层：${layerConfig.label}`} aria-label={`切换地图图层，当前为${layerConfig.label}`}>
          <Layers size={16} />
        </button>
        <button type="button" onClick={locate} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50" title="定位" aria-label="标记当前位置">
          <Locate size={16} />
        </button>
        <button type="button" onClick={navigateToSelected} className="rounded-lg bg-brand-600 p-2 text-white shadow-sm hover:bg-brand-700" title="导航" aria-label="打开选中地点导航">
          <Navigation size={16} />
        </button>
      </div>
    </div>
  )
}
