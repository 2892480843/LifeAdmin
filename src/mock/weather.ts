import type { Weather } from '../types'
import { addMockDays, formatMockDate, getMockWeekdayLabel } from './dates'

const forecastTemplate = [
  { icon: 'cloud-sun', high: 28, low: 21 },
  { icon: 'sun', high: 30, low: 22 },
  { icon: 'cloud-rain', high: 26, low: 20 },
  { icon: 'cloud', high: 27, low: 21 },
  { icon: 'sun', high: 29, low: 22 },
]

export function createMockWeather(date = new Date()): Weather {
  const today = formatMockDate(date)

  return {
    city: '上海',
    date: today,
    temp: 25,
    condition: '多云转晴',
    icon: 'cloud-sun',
    high: 28,
    low: 21,
    humidity: 65,
    wind: '东南风 3 级',
    airQuality: '优 · AQI 42',
    forecast: forecastTemplate.map((item, index) => {
      const forecastDate = addMockDays(today, index)
      return {
        day: getMockWeekdayLabel(forecastDate),
        ...item,
      }
    }),
  }
}

// 天气数据：不代表实时气象服务。
export const weather: Weather = createMockWeather()
