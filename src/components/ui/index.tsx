import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

export { default as CitySelect } from './CitySelect'
export { default as DatePicker } from './DatePicker'
export { Skeleton, SkeletonText }

// 骨架占位块：加载/占位状态用，支持圆角与宽高自定义
function Skeleton({
  className = '',
  rounded = 'rounded-lg',
}: {
  className?: string
  rounded?: string
}) {
  return <div className={`animate-pulse bg-slate-200/70 ${rounded} ${className}`} aria-hidden="true" />
}

// 骨架文本行：模拟段落占位
function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ width: i === lines - 1 ? '70%' : '100%' }} />
      ))}
    </div>
  )
}

// 通用卡片容器
export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={`card ${onClick ? 'card-interactive cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

// 区块标题
export function SectionTitle({
  title,
  extra,
  className = '',
}: {
  title: ReactNode
  extra?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {extra}
    </div>
  )
}

type TagTone = 'blue' | 'teal' | 'orange' | 'purple' | 'gray' | 'green' | 'red'

const toneMap: Record<TagTone, string> = {
  blue: 'border border-brand-100 bg-brand-50 text-brand-700',
  teal: 'border border-locate-100 bg-locate-50 text-locate-700',
  orange: 'border border-notice-100 bg-notice-50 text-notice-600',
  purple: 'border border-slate-200 bg-slate-100 text-slate-700',
  gray: 'border border-slate-200 bg-slate-100 text-slate-600',
  green: 'border border-emerald-100 bg-emerald-50 text-emerald-700',
  red: 'border border-risk-100 bg-risk-50 text-risk-600',
}

// 彩色标签
export function Tag({
  children,
  tone = 'blue',
  className = '',
}: {
  children: ReactNode
  tone?: TagTone
  className?: string
}) {
  return <span className={`chip ${toneMap[tone]} ${className}`}>{children}</span>
}

// 开关
export function Toggle({
  checked,
  onChange,
  ariaLabel = '切换开关',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-all duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 focus-visible:ring-offset-2 ${
        checked
          ? 'border-brand-500 bg-gradient-to-r from-brand-600 to-locate-500 shadow-sm shadow-brand-500/20'
          : 'border-slate-300 bg-slate-300 hover:bg-slate-400'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-[180ms] ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// 数值滑块
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel = '调整数值',
  name,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  ariaLabel?: string
  name?: string
}) {
  return (
    <input
      aria-label={ariaLabel}
      type="range"
      name={name}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full"
    />
  )
}

// 可多选 / 单选的选项胶囊组
export function ChipSelect({
  options,
  value,
  onToggle,
  icon,
}: {
  options: string[]
  value: string[]
  onToggle: (opt: string) => void
  icon?: (opt: string) => ReactNode
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            aria-label={`${active ? '取消选择' : '选择'}${opt}`}
            aria-pressed={active}
            onClick={() => onToggle(opt)}
            className={`inline-flex min-h-10 min-w-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 active:scale-[0.99] ${
              active
                ? 'border-brand-500 bg-brand-50 font-medium text-brand-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white hover:shadow-card'
            }`}
          >
            {icon && <span aria-hidden="true">{icon(opt)}</span>}
            <span className="truncate">{opt}</span>
          </button>
        )
      })}
    </div>
  )
}

// 评分星条
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`评分 ${rating}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 20 20"
          className={i <= Math.round(rating) ? 'text-amber-400' : 'text-slate-200'}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.2 1 5.9L10 15l-5.2 2.7 1-5.9L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  )
}

type ToastTone = 'success' | 'info' | 'warning' | 'error'

const toastToneMap: Record<ToastTone, string> = {
  success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  info: 'border-brand-100 bg-brand-50 text-brand-700',
  warning: 'border-notice-100 bg-notice-50 text-notice-600',
  error: 'border-risk-100 bg-risk-50 text-risk-600',
}

const toastIconMap = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
}

export function Toast({
  message,
  tone = 'success',
  onClose,
}: {
  message: string
  tone?: ToastTone
  onClose: () => void
}) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onClose, 2200)
    return () => window.clearTimeout(timer)
  }, [message, onClose])

  if (!message) return null

  const Icon = toastIconMap[tone]
  return (
    <div className="fixed inset-x-4 top-28 z-50 mx-auto max-w-sm sm:left-auto sm:right-5 sm:mx-0 lg:top-20" role="status" aria-live="polite" aria-atomic="true">
      <div className={`flex items-center gap-2 rounded-card border px-4 py-3 text-sm shadow-card ${toastToneMap[tone]}`}>
        <Icon size={16} aria-hidden="true" />
        <span className="min-w-0 flex-1">{message}</span>
        <button type="button" onClick={onClose} className="flex min-h-8 min-w-8 items-center justify-center rounded p-1 opacity-70 hover:bg-white/60 hover:opacity-100" aria-label="关闭提示">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  className = '',
  bodyClassName = 'px-5 py-4',
}: {
  open: boolean
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  className?: string
  bodyClassName?: string
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    window.setTimeout(() => dialogRef.current?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousBodyOverflow
      previouslyFocusedRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`command-surface max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-hidden ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-800">{title}</h2>
          <button type="button" onClick={onClose} className="flex min-h-9 min-w-9 items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600" aria-label="关闭弹窗">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={`overflow-y-auto ${bodyClassName}`}>{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} className="btn-ghost px-4 py-2 text-sm" aria-label={cancelText}>
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            aria-label={confirmText}
            className={`btn px-4 py-2 text-sm ${
              danger ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${danger ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-600'}`}>
          <AlertTriangle size={18} aria-hidden="true" />
        </span>
        <p className="min-w-0 text-sm leading-6 text-slate-600">{message}</p>
      </div>
    </Modal>
  )
}
