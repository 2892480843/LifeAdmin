const MS_PER_DAY = 24 * 60 * 60 * 1000

export function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function formatMockDate(date = new Date()) {
  const local = startOfLocalDay(date)
  const year = local.getFullYear()
  const month = String(local.getMonth() + 1).padStart(2, '0')
  const day = String(local.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addMockDays(date: string | Date, offset: number) {
  const base = typeof date === 'string' ? parseMockDate(date) : startOfLocalDay(date)
  return formatMockDate(new Date(base.getTime() + offset * MS_PER_DAY))
}

export function getMockWeekdayLabel(date: string | Date) {
  const base = typeof date === 'string' ? parseMockDate(date) : date
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][base.getDay()]
}

function parseMockDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return startOfLocalDay()
  return new Date(year, month - 1, day)
}
