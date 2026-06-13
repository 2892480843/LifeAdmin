import { useEffect, useRef, useState } from 'react'
import { load } from '@amap/amap-jsapi-loader'
import type { MapMarker } from './MapCanvas'

// 高德安全配置（部分账号需要安全密钥才能调用 JSAPI 2.0）
declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}

export interface AMapCanvasProps {
  markers: MapMarker[]
  showRoute?: boolean
  routeGroups?: { color: string; points: { x: number; y: number; lng?: number; lat?: number }[] }[]
  className?: string
  onMarkerClick?: (id: string) => void
  height?: string
  // 加载或初始化失败时回调，交由上层回退到 SVG 示意图
  onError?: () => void
}

// 仅保留含真实经纬度的点，用于高德渲染
const hasLngLat = (m: { lng?: number; lat?: number }): m is { lng: number; lat: number } =>
  typeof m.lng === 'number' && typeof m.lat === 'number'

// 默认中心（上海），仅在尚无任何标记时用于地图初始视野
const DEFAULT_CENTER: [number, number] = [121.49, 31.24]
const COMPACT_LABEL_QUERY = '(max-width: 639px)'

function isCompactLabelViewport() {
  return typeof window !== 'undefined' && window.matchMedia(COMPACT_LABEL_QUERY).matches
}

// 生成标记点的 HTML 内容（数字气泡 / 小圆点），与 SVG 版视觉保持一致
function markerContent(m: MapMarker, compactLabels: boolean): string {
  const color = m.color ?? '#2563eb'
  const size = m.active ? (m.order ? 30 : 20) : m.order ? 24 : 14
  const state = m.active ? 'selected' : m.status ?? 'default'
  const stateColor = state === 'risk' ? '#e11d48' : state === 'favorite' ? '#f59e0b' : state === 'joined' ? '#11bfae' : ''
  const ring = m.active
    ? 'box-shadow:0 0 0 3px #fff,0 0 0 6px rgba(37,99,235,.22),0 8px 18px rgba(15,23,42,.22);'
    : 'box-shadow:0 2px 8px rgba(15,23,42,.18);'
  const badge = stateColor
    ? `<span style="position:absolute;right:-2px;top:-2px;width:9px;height:9px;border-radius:9999px;background:${stateColor};border:2px solid #fff;"></span>`
    : ''
  const dot = `<span style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;border:2px solid #fff;background:${color};color:#fff;font-size:11px;font-weight:700;line-height:1;${ring}">${m.order ?? ''}${badge}</span>`
  const showLabel = Boolean(m.label) && (!compactLabels || m.active)
  const label = showLabel
    ? `<span class="amap-marker-label${m.active ? ' amap-marker-label-active' : ''}" style="margin-top:4px;white-space:nowrap;background:rgba(255,255,255,.96);color:#334155;font-size:10px;font-weight:600;padding:2px 6px;border:1px solid rgba(226,232,240,.9);border-radius:6px;box-shadow:0 4px 12px rgba(15,23,42,.12);">${m.label}</span>`
    : ''
  return `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(2px);">${dot}${label}</div>`
}

// 高德地图渲染（真实底图）。失败时通过 onError 交由上层回退。
export default function AMapCanvas({
  markers,
  showRoute = false,
  routeGroups,
  className = '',
  onMarkerClick,
  height = '100%',
  onError,
}: AMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const amapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  // 保存最新回调，避免因回调变化触发重建
  const clickRef = useRef(onMarkerClick)
  clickRef.current = onMarkerClick
  const errorRef = useRef(onError)
  errorRef.current = onError
  const [ready, setReady] = useState(false)
  const [compactLabels, setCompactLabels] = useState(isCompactLabelViewport)
  const [selectedMarkerId, setSelectedMarkerId] = useState('')

  const resizeMap = () => {
    mapRef.current?.resize()
  }

  // 初始化地图（整个生命周期仅一次）
  useEffect(() => {
    const key = import.meta.env.VITE_AMAP_KEY
    if (!key) {
      errorRef.current?.()
      return
    }
    const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE
    if (securityCode) {
      window._AMapSecurityConfig = { securityJsCode: securityCode }
    }

    let destroyed = false

    load({
      key,
      version: '2.0',
      plugins: ['AMap.ToolBar', 'AMap.Scale'],
    })
      .then((AMap: any) => {
        if (destroyed || !containerRef.current) return
        amapRef.current = AMap
        const map = new AMap.Map(containerRef.current, {
          zoom: 11,
          center: DEFAULT_CENTER,
          viewMode: '2D',
          mapStyle: 'amap://styles/normal',
        })
        const compact = isCompactLabelViewport()
        map.addControl(new AMap.ToolBar({ position: { top: compact ? '84px' : '16px', right: compact ? '12px' : '16px' } }))
        map.addControl(new AMap.Scale())
        mapRef.current = map
        setReady(true)
        const resize = () => {
          if (!destroyed) map.resize()
        }
        resize()
        window.requestAnimationFrame(resize)
        window.setTimeout(resize, 80)
        window.setTimeout(resize, 240)
      })
      .catch(() => {
        if (!destroyed) errorRef.current?.()
      })

    return () => {
      destroyed = true
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
      amapRef.current = null
      overlaysRef.current = []
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia(COMPACT_LABEL_QUERY)
    const onChange = () => setCompactLabels(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (selectedMarkerId && !markers.some((m) => m.id === selectedMarkerId)) {
      setSelectedMarkerId('')
    }
  }, [markers, selectedMarkerId])

  // 高德底图会在父容器高度变化时留下空白，显式 resize 可让瓦片重新填满容器。
  useEffect(() => {
    if (!ready || !containerRef.current) return

    const resize = () => {
      resizeMap()
      window.requestAnimationFrame(resizeMap)
    }
    const frame = window.requestAnimationFrame(resize)
    window.addEventListener('resize', resize)

    const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null
    observer?.observe(containerRef.current)
    if (containerRef.current.parentElement) observer?.observe(containerRef.current.parentElement)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      observer?.disconnect()
    }
  }, [ready])

  // 标记与路线变化时，仅增删覆盖物，不重建地图
  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!ready || !map || !AMap) return

    resizeMap()

    if (overlaysRef.current.length > 0) {
      map.remove(overlaysRef.current)
      overlaysRef.current = []
    }

    const overlays: any[] = []

    markers.filter(hasLngLat).forEach((m) => {
      const markerState = { ...m, active: m.active || m.id === selectedMarkerId }
      const marker = new AMap.Marker({
        position: [m.lng, m.lat],
        content: markerContent(markerState, compactLabels),
        anchor: 'bottom-center',
        offset: new AMap.Pixel(0, 0),
        zIndex: markerState.active ? 120 : m.order ? 110 : 100,
      })
      marker.on('click', () => {
        setSelectedMarkerId(m.id)
        clickRef.current?.(m.id)
      })
      overlays.push(marker)
    })

    if (routeGroups && routeGroups.length > 0) {
      routeGroups.forEach((g) => {
        const path = g.points.filter(hasLngLat).map((p) => [p.lng, p.lat])
        if (path.length > 1) {
          overlays.push(
            new AMap.Polyline({
              path,
              strokeColor: g.color,
              strokeWeight: 5,
              strokeOpacity: 0.9,
              lineJoin: 'round',
              lineCap: 'round',
              showDir: true,
            }),
          )
        }
      })
    } else if (showRoute) {
      const path = [...markers]
        .filter(hasLngLat)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((m) => [m.lng, m.lat])
      if (path.length > 1) {
        overlays.push(
          new AMap.Polyline({
            path,
            strokeColor: '#2563eb',
            strokeWeight: 5,
            strokeOpacity: 0.9,
            strokeStyle: 'dashed',
            lineJoin: 'round',
            lineCap: 'round',
            showDir: true,
          }),
        )
      }
    }

    if (overlays.length > 0) {
      map.add(overlays)
      map.setFitView(overlays, false, [40, 40, 40, 40])
      overlaysRef.current = overlays
    }
    resizeMap()
    const frame = window.requestAnimationFrame(resizeMap)
    const timer = window.setTimeout(resizeMap, 120)
    // 无覆盖物时保持当前视野，避免空结果时跳回全国
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [compactLabels, ready, markers, routeGroups, selectedMarkerId, showRoute])

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-card border border-slate-200 ${className}`}
      style={{ height, minHeight: height }}
    />
  )
}
