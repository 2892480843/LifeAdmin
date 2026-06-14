import type { Trip } from '../types'

export interface SharePayload {
  title: string
  text: string
  url?: string
}

export async function shareOrCopy(payload: SharePayload) {
  const url = payload.url ?? window.location.href
  const text = `${payload.text}\n${url}`

  if ('share' in navigator && typeof navigator.share === 'function') {
    await navigator.share({ title: payload.title, text: payload.text, url })
    return 'shared' as const
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return 'copied' as const
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', 'true')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
  return 'copied' as const
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadJsonFile(filename: string, data: unknown) {
  downloadTextFile(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
}

export function formatTripMarkdown(trip: Trip, cityName?: string) {
  const lines = [
    `# ${trip.title}`,
    '',
    `- 城市：${cityName ?? trip.cityId}`,
    `- 日期：${trip.startDate} 至 ${trip.endDate}`,
    `- 天数：${trip.days} 天`,
    `- 出行人数：${trip.travelers} 人`,
    `- 预算上限：¥${trip.budget}`,
    `- 总里程：${trip.distance} km`,
    `- 总时长：${trip.totalDuration}`,
    `- 方案类型：${trip.planType}`,
    '',
    '## 每日安排',
  ]

  trip.itinerary.forEach((day) => {
    lines.push('', `### Day ${day.day} · ${day.title}`, `日期：${day.date}`, '')
    day.items.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.time} ${item.name}`,
        `   - 活动：${item.activity}`,
        `   - 停留：${item.duration}`,
        `   - 交通：${item.transport}`,
        `   - 费用：${item.cost > 0 ? `¥${item.cost}` : '免费'}`,
        item.note ? `   - 备注：${item.note}` : '',
      )
    })
  })

  lines.push('', '## 行程备注')
  if (trip.notes.length) trip.notes.forEach((note) => lines.push(`- ${note}`))
  else lines.push('- 暂无')

  lines.push('', '## 检查点')
  if (trip.checkpoints.length) trip.checkpoints.forEach((item) => lines.push(`- ${item}`))
  else lines.push('- 暂无')

  lines.push('', '## 实用信息')
  if (trip.tips.length) trip.tips.forEach((tip) => lines.push(`- ${tip}`))
  else lines.push('- 暂无')

  return lines.filter((line, index, arr) => line !== '' || arr[index - 1] !== '').join('\n')
}

export function exportTripMarkdown(trip: Trip, cityName?: string) {
  const filename = `${sanitizeFilename(trip.title)}.md`
  downloadTextFile(filename, formatTripMarkdown(trip, cityName), 'text/markdown;charset=utf-8')
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_')
}
