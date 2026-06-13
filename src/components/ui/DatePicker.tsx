import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  name?: string
  ariaLabel: string
  placeholder?: string
  className?: string
}

interface CalendarDay {
  date: Date
  value: string
  day: number
  inMonth: boolean
  selected: boolean
  today: boolean
}

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

export default function DatePicker({
  value,
  onChange,
  name,
  ariaLabel,
  placeholder = '选择日期',
  className = '',
}: DatePickerProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const selectedDate = parseDateValue(value)
  const today = useMemo(() => startOfLocalDay(new Date()), [])
  const [viewMonth, setViewMonth] = useState(() => selectedDate ?? today)

  const days = useMemo(
    () => buildCalendarDays(viewMonth, selectedDate, today),
    [selectedDate, today, viewMonth],
  )
  const displayValue = value ? formatDisplayDate(value) : placeholder

  useEffect(() => {
    if (!open) return
    setViewMonth(selectedDate ?? today)
  }, [open, selectedDate, today])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      const gap = 8
      const viewportPadding = 12
      const menuWidth = Math.min(Math.max(rect.width, 356), window.innerWidth - viewportPadding * 2)
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
      const spaceAbove = rect.top - viewportPadding
      const menuHeight = 452
      const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow
      const rawLeft = Math.min(rect.left, window.innerWidth - menuWidth - viewportPadding)
      const preferredTop = openAbove
        ? Math.max(viewportPadding, rect.top - menuHeight - gap)
        : rect.bottom + gap
      const top = Math.max(
        viewportPadding,
        Math.min(preferredTop, window.innerHeight - menuHeight - viewportPadding),
      )

      setMenuStyle({
        left: Math.max(viewportPadding, rawLeft),
        top,
        width: menuWidth,
        maxHeight: window.innerHeight - viewportPadding * 2,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const chooseDate = (nextDate: Date) => {
    onChange(formatDateValue(nextDate))
    setOpen(false)
    window.requestAnimationFrame(() => buttonRef.current?.focus())
  }

  const clearDate = () => {
    onChange('')
    setOpen(false)
    window.requestAnimationFrame(() => buttonRef.current?.focus())
  }

  const chooseToday = () => {
    chooseDate(today)
  }

  const menu = open && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="fixed z-[90] overflow-hidden rounded-card border border-slate-200 bg-white shadow-panel"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              buttonRef.current?.focus()
            }
          }}
        >
          <div className="border-b border-slate-100 bg-slate-50/80 px-3.5 py-3">
            <div className="flex min-h-10 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-normal text-slate-400">Calendar</p>
                <h3 id={titleId} className="mt-0.5 truncate text-base font-semibold text-slate-950">
                  {formatMonthLabel(viewMonth)}
                </h3>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setViewMonth((month) => addMonths(month, -1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                  aria-label="上个月"
                >
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMonth((month) => addMonths(month, 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                  aria-label="下个月"
                >
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="px-3.5 pb-3.5 pt-3">
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div key={day} className="flex h-8 items-center justify-center text-xs font-semibold text-slate-400">
                  {day}
                </div>
              ))}
              {days.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => chooseDate(item.date)}
                  className={`flex h-10 items-center justify-center rounded-control text-sm font-semibold transition duration-[180ms] focus-visible:ring-offset-0 ${
                    item.selected
                      ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700'
                      : item.today
                        ? 'border border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300 hover:bg-brand-100'
                        : item.inMonth
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-50 hover:text-slate-500'
                  }`}
                  aria-current={item.today ? 'date' : undefined}
                  aria-label={`${formatDisplayDate(item.value)}${item.selected ? '，已选择' : ''}`}
                >
                  {item.day}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={clearDate}
                className="rounded-control px-2.5 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                清除
              </button>
              <button
                type="button"
                onClick={chooseToday}
                className="rounded-control px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                今天
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={buttonRef}
        type="button"
        className={`field-shell min-h-11 w-full text-left ${open ? 'border-brand-500 ring-2 ring-brand-100' : ''} ${className}`}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarDays size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span className={`min-w-0 flex-1 truncate py-2.5 text-sm ${value ? 'text-slate-900' : 'text-slate-400'}`}>
          {displayValue}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-[180ms] ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {menu}
    </>
  )
}

function buildCalendarDays(month: Date, selectedDate: Date | null, today: Date): CalendarDay[] {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - monthStart.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return {
      date,
      value: formatDateValue(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthStart.getMonth(),
      selected: Boolean(selectedDate && isSameDay(date, selectedDate)),
      today: isSameDay(date, today),
    }
  })
}

function parseDateValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function formatDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(value: string) {
  return value.replace(/-/g, '/')
}

function formatMonthLabel(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}年${month}月`
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
