import { wgs84ToGcj02 } from '../utils/coordinateTransform'
import type { CoordinateSystem } from '../utils/coordinateTransform'

export type LocationStatus = 'idle' | 'requesting' | 'success' | 'denied' | 'failed' | 'unsupported'

export interface CurrentLocation {
  lng: number
  lat: number
  accuracy: number
  capturedAt: string
  coordinateSystem?: CoordinateSystem
  rawLng?: number
  rawLat?: number
  rawCoordinateSystem?: 'WGS84'
}

export interface LocationResult {
  status: Exclude<LocationStatus, 'idle' | 'requesting'>
  location?: CurrentLocation
  error?: string
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0,
}

const GEOLOCATION_ERROR_CODES = {
  permissionDenied: 1,
  positionUnavailable: 2,
  timeout: 3,
} as const

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && Boolean(navigator.geolocation)
}

export function getGeolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === GEOLOCATION_ERROR_CODES.permissionDenied) return '定位未授权'
  if (error.code === GEOLOCATION_ERROR_CODES.timeout) return '定位超时，请确认浏览器定位权限和网络状态后重试。'
  if (error.code === GEOLOCATION_ERROR_CODES.positionUnavailable || isCoreLocationUnknownError(error.message)) {
    return '定位暂时不可用，请确认系统定位服务、浏览器定位权限和网络/Wi-Fi 状态后重试。实时动态会继续使用行程节点计算。'
  }
  return '定位失败，请稍后重试。实时动态会继续使用行程节点计算。'
}

export function requestCurrentLocation(): Promise<LocationResult> {
  if (!isGeolocationSupported()) {
    return Promise.resolve({
      status: 'unsupported',
      error: '浏览器不支持定位',
    })
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rawLng = position.coords.longitude
        const rawLat = position.coords.latitude
        const converted = wgs84ToGcj02({ lng: rawLng, lat: rawLat })

        resolve({
          status: 'success',
          location: {
            lng: converted.lng,
            lat: converted.lat,
            accuracy: Math.max(0, Math.round(position.coords.accuracy || 0)),
            capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
            coordinateSystem: converted.coordinateSystem,
            rawLng,
            rawLat,
            rawCoordinateSystem: 'WGS84',
          },
        })
      },
      (error) => {
        const errorMessage = getGeolocationErrorMessage(error)
        if (error.code === GEOLOCATION_ERROR_CODES.permissionDenied) {
          resolve({ status: 'denied', error: errorMessage })
          return
        }
        resolve({ status: 'failed', error: errorMessage })
      },
      GEOLOCATION_OPTIONS,
    )
  })
}

function isCoreLocationUnknownError(message = '') {
  return /CoreLocation|kCLErrorLocationUnknown/i.test(message)
}
