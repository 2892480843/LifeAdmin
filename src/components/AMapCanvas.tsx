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

// 单段驾车路线规划：返回真实道路折线坐标 [lng,lat][]，失败时回退为两点直线
function planDrivingSegment(
  AMap: any,
  from: [number, number],
  to: [number, number],
): Promise<[number, number][]> {
  return new Promise((resolve) => {
    try {
      // 独立的 Driving 实例，关闭其自带覆盖物与自动视野，避免污染主地图
      const driving = new AMap.Driving({
        policy: AMap.DrivingPolicy.LEAST_DISTANCE,
        hideMarkers: true,
        showTraffic: false,
        autoFitView: false,
        ferryInclude: 0,
      })
      driving.search(
        new AMap.LngLat(from[0], from[1]),
        new AMap.LngLat(to[0], to[1]),
        (status: string, result: any) => {
          if (status !== 'complete' || !result || !result.routes || !result.routes.length) {
            resolve([from, to])
            return
          }
          // 拼接每段 step 的 path，得到完整真实道路折线
          const path: [number, number][] = []
          result.routes[0].steps.forEach((step: any) => {
            const p = step.path || []
            p.forEach((pt: any) => {
              if (pt && typeof pt.lng === 'number' && typeof pt.lat === 'number') {
                path.push([pt.lng, pt.lat])
              } else if (Array.isArray(pt)) {
                path.push([pt[0], pt[1]])
              }
            })
          })
          resolve(path.length >= 2 ? path : [from, to])
        },
      )
    } catch {
      resolve([from, to])
    }
  })
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
      plugins: ['AMap.ToolBar', 'AMap.Scale', 'AMap.Driving'],
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

    // 收集需要绘制路线的分组：routeGroups 优先，否则按 showRoute 把有序标记合成单组
    const routeSegments: { color: string; points: [number, number][] }[] = []
    if (routeGroups && routeGroups.length > 0) {
      routeGroups.forEach((g) => {
        const points = g.points.filter(hasLngLat).map((p) => [p.lng, p.lat] as [number, number])
        if (points.length > 1) routeSegments.push({ color: g.color, points })
      })
    } else if (showRoute) {
      const points = [...markers]
        .filter(hasLngLat)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((m) => [m.lng, m.lat] as [number, number])
      if (points.length > 1) routeSegments.push({ color: '#2563eb', points })
    }

    // 先用直线占位，保证路线即时可见；真实道路轨迹异步返回后再替换
    const placeholderPolylines: any[] = []
    routeSegments.forEach((seg) => {
      const line = new AMap.Polyline({
        path: seg.points,
        strokeColor: seg.color,
        strokeWeight: 5,
        strokeOpacity: 0.85,
        strokeStyle: 'dashed',
        lineJoin: 'round',
        lineCap: 'round',
        showDir: true,
      })
      overlays.push(line)
      placeholderPolylines.push(line)
    })

    if (overlays.length > 0) {
      map.add(overlays)
      map.setFitView(overlays, false, [40, 40, 40, 40])
      overlaysRef.current = overlays
    }

    // 异步逐段规划真实驾车道路轨迹，成功后用真实折线替换占位直线
    let cancelled = false
    if (routeSegments.length > 0) {
      Promise.all(
        routeSegments.map(async (seg) => {
          const realPath: [number, number][] = []
          for (let i = 0; i < seg.points.length - 1; i += 1) {
            const segPath = await planDrivingSegment(AMap, seg.points[i], seg.points[i + 1])
            // 去重相邻段首尾重复点，避免折线节点叠加
            if (realPath.length > 0 && segPath.length > 1) realPath.push(...segPath.slice(1))
            else realPath.push(...segPath)
          }
          return { color: seg.color, path: realPath }
        }),
      ).then((results) => {
        // 标记/路线变化或组件卸载后，丢弃过期结果，避免污染当前覆盖物
        const liveMap = mapRef.current
        if (cancelled || !liveMap) return
        const realOverlays = results.map(
          (r) =>
            new AMap.Polyline({
              path: r.path,
              strokeColor: r.color,
              strokeWeight: 5,
              strokeOpacity: 0.9,
              lineJoin: 'round',
              lineCap: 'round',
              showDir: true,
            }),
        )
        // 移除占位直线，加入真实折线
        liveMap.remove(placeholderPolylines)
        liveMap.add(realOverlays)
        overlaysRef.current = overlaysRef.current
          .filter((o) => !placeholderPolylines.includes(o))
          .concat(realOverlays)
        // 以标记 + 真实折线重新适配视野
        try {
          liveMap.setFitView(overlaysRef.current, false, [40, 40, 40, 40])
        } catch {
          // ignore fit errors
        }
        resizeMap()
      })
    }

    resizeMap()
    const frame = window.requestAnimationFrame(resizeMap)
    const timer = window.setTimeout(resizeMap, 120)
    // 无覆盖物时保持当前视野，避免空结果时跳回全国
    return () => {
      cancelled = true
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
