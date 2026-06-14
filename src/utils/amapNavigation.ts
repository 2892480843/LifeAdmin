export type AMapNavigationMode = 'car' | 'bus' | 'walk' | 'ride'

export interface NavigationPoint {
  lng?: number
  lat?: number
  name: string
}

export function canNavigateTo(point: NavigationPoint | null | undefined): point is NavigationPoint & { lng: number; lat: number } {
  return Boolean(point && typeof point.lng === 'number' && typeof point.lat === 'number')
}

export function navigationModeFromTransport(transport?: string): AMapNavigationMode {
  if (!transport) return 'car'
  if (transport.includes('步行')) return 'walk'
  if (transport.includes('地铁') || transport.includes('公交')) return 'bus'
  if (transport.includes('骑')) return 'ride'
  return 'car'
}

export function buildAmapNavigationUrl({
  from,
  to,
  mode = 'car',
  callNative = true,
}: {
  from?: NavigationPoint | null
  to: NavigationPoint
  mode?: AMapNavigationMode
  callNative?: boolean
}) {
  if (!canNavigateTo(to)) {
    throw new Error('目标地点缺少经纬度，无法发起导航')
  }

  const params = [
    canNavigateTo(from) ? `from=${formatPoint(from)}` : '',
    `to=${formatPoint(to)}`,
    `mode=${mode}`,
    `callnative=${callNative ? 1 : 0}`,
    'src=zhixing-route',
  ].filter(Boolean)

  return `https://uri.amap.com/navigation?${params.join('&')}`
}

export function openAmapNavigation(options: {
  from?: NavigationPoint | null
  to: NavigationPoint
  mode?: AMapNavigationMode
}) {
  const url = buildAmapNavigationUrl(options)
  window.open(url, '_blank', 'noopener,noreferrer')
}

function formatPoint(point: NavigationPoint & { lng: number; lat: number }) {
  return `${point.lng},${point.lat},${encodeURIComponent(point.name)}`
}
