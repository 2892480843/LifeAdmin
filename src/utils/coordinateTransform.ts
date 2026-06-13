export type CoordinateSystem = 'WGS84' | 'GCJ-02'

export interface LngLat {
  lng: number
  lat: number
}

export interface ConvertedLngLat extends LngLat {
  converted: boolean
  coordinateSystem: CoordinateSystem
}

const PI = Math.PI
const EARTH_RADIUS = 6378245.0
const ECCENTRICITY_SQUARED = 0.006693421622965943

export function wgs84ToGcj02(point: LngLat): ConvertedLngLat {
  if (!isInChina(point)) {
    return {
      ...point,
      converted: false,
      coordinateSystem: 'WGS84',
    }
  }

  const offsetLng = point.lng - 105.0
  const offsetLat = point.lat - 35.0
  let deltaLat = transformLat(offsetLng, offsetLat)
  let deltaLng = transformLng(offsetLng, offsetLat)
  const radLat = point.lat / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - ECCENTRICITY_SQUARED * magic * magic
  const sqrtMagic = Math.sqrt(magic)

  deltaLat = (deltaLat * 180.0) / ((EARTH_RADIUS * (1 - ECCENTRICITY_SQUARED)) / (magic * sqrtMagic) * PI)
  deltaLng = (deltaLng * 180.0) / (EARTH_RADIUS / sqrtMagic * Math.cos(radLat) * PI)

  return {
    lng: point.lng + deltaLng,
    lat: point.lat + deltaLat,
    converted: true,
    coordinateSystem: 'GCJ-02',
  }
}

function isInChina(point: LngLat) {
  return point.lng >= 72.004 && point.lng <= 137.8347 && point.lat >= 0.8293 && point.lat <= 55.8271
}

function transformLat(lng: number, lat: number) {
  let value = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng))
  value += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0
  value += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0
  value += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0
  return value
}

function transformLng(lng: number, lat: number) {
  let value = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng))
  value += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0
  value += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0
  value += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0
  return value
}
