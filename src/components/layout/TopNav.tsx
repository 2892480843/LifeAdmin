import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  CircleHelp,
  LogOut,
  Search,
  Settings,
  User,
} from 'lucide-react'
import Logo from './Logo'
import { useApp } from '../../store/AppContext'
import SmartImage from '../ui/SmartImage'
import { Modal, Toast } from '../ui'
import { fetchSystemNotifications, markSystemNotificationRead } from '../../services/notificationService'
import type { SystemNotification } from '../../services/notificationService'

const navItems = [
  { label: '首页', path: '/dashboard' },
  { label: '行程', path: '/trips' },
  { label: '探索', path: '/explore' },
  { label: '实时动态', path: '/realtime' },
]

// 顶部主导航栏
export default function TopNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, trips } = useApp()
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [notices, setNotices] = useState<SystemNotification[]>([])
  const [noticeLoading, setNoticeLoading] = useState(false)
  const [noticeError, setNoticeError] = useState('')
  const noticeRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotices([])
      setNoticeError('')
      return
    }

    setNoticeLoading(true)
    setNoticeError('')
    try {
      const data = await fetchSystemNotifications({ user, trips })
      setNotices(data.notifications)
    } catch {
      setNotices([])
      setNoticeError('通知服务暂不可用，请稍后重试。')
    } finally {
      setNoticeLoading(false)
    }
  }, [user, trips])

  useEffect(() => {
    void refreshNotifications()
    const timer = window.setInterval(() => void refreshNotifications(), 30_000)
    return () => window.clearInterval(timer)
  }, [refreshNotifications])

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (noticeRef.current && !noticeRef.current.contains(e.target as Node)) setNoticeOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const noticeCountLabel = noticeLoading
    ? '同步中'
    : notices.length > 0
      ? `${notices.length} 条未读通知`
      : '暂无未读'

  const handleNoticeClick = async (notice: SystemNotification) => {
    setNoticeOpen(false)
    setNotices((current) => current.filter((item) => item.id !== notice.id))
    navigate(notice.path)

    try {
      await markSystemNotificationRead({ id: notice.id, userId: user?.id })
      setToast(`已读：${notice.title}`)
    } catch {
      setToast('已跳转，通知已读状态同步失败')
      void refreshNotifications()
    }
  }

  const handleLogout = () => {
    setProfileOpen(false)
    logout()
    navigate('/login')
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-4 lg:gap-8">
          <div className="shrink-0 sm:hidden">
            <Logo compact />
          </div>
          <div className="hidden shrink-0 sm:block">
            <Logo />
          </div>
          <nav className="hidden items-center gap-5 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${
                  isActive(item.path)
                    ? 'font-semibold text-brand-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Link to="/explore?focus=search" aria-label="搜索目的地、景点或行程" className="os-icon-button" title="搜索">
            <Search size={18} aria-hidden="true" />
          </Link>

          <div className="relative" ref={noticeRef}>
            <button
              type="button"
              onClick={() => {
                setNoticeOpen((v) => {
                  const nextOpen = !v
                  if (nextOpen) void refreshNotifications()
                  return nextOpen
                })
                setProfileOpen(false)
              }}
              className="os-icon-button relative"
              title="通知"
              aria-label="打开通知"
              aria-expanded={noticeOpen}
            >
              <Bell size={18} aria-hidden="true" />
              {notices.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-risk-500" aria-hidden="true" />}
            </button>
            {noticeOpen && (
              <div className="animate-dropdown fixed left-4 right-4 top-[4.5rem] overflow-hidden rounded-card border border-slate-200 bg-white shadow-card-hover sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">通知</p>
                  <span className="rounded-full bg-risk-50 px-2 py-0.5 text-[11px] font-medium text-risk-600">{noticeCountLabel}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {noticeError ? (
                    <p className="px-4 py-5 text-sm text-amber-600">{noticeError}</p>
                  ) : noticeLoading && notices.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-slate-500">正在同步后端通知...</p>
                  ) : notices.length > 0 ? (
                    notices.map((notice) => (
                      <button
                        key={notice.title}
                        type="button"
                        aria-label={`查看通知：${notice.title}`}
                        onClick={() => void handleNoticeClick(notice)}
                        className="block w-full px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <p className="text-sm font-medium text-slate-700">{notice.title}</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">{notice.desc}</p>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-5 text-sm text-slate-500">暂无与当前账号相关的系统通知。</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="os-icon-button"
            title="帮助中心"
            aria-label="打开帮助中心"
          >
            <CircleHelp size={18} aria-hidden="true" />
          </button>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v)
                setNoticeOpen(false)
              }}
              className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition hover:bg-slate-50 sm:pr-2"
              aria-label="打开用户菜单"
              aria-expanded={profileOpen}
            >
              <SmartImage
                src={user?.avatar ?? ''}
                alt={user?.name ?? '用户'}
                fallbackText={user?.name?.slice(0, 1) ?? 'U'}
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="hidden max-w-28 truncate text-sm font-medium text-slate-700 md:block">{user?.name}</span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {profileOpen && (
              <div className="animate-dropdown absolute right-0 mt-2 w-44 overflow-hidden rounded-card border border-slate-200 bg-white py-1 shadow-card-hover">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                >
                  <User size={15} aria-hidden="true" /> 个人中心
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Settings size={15} aria-hidden="true" /> 设置
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-risk-600 hover:bg-risk-50"
                >
                  <LogOut size={15} aria-hidden="true" /> 退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="sticky top-16 z-20 hidden border-b border-slate-200/80 bg-white/95 px-2 py-2 backdrop-blur md:block lg:hidden">
        <div className="mx-auto flex max-w-xl gap-1">
          {navItems.map((item) => {
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <Modal
        open={helpOpen}
        title="帮助中心"
        onClose={() => setHelpOpen(false)}
        footer={
          <button type="button" onClick={() => setHelpOpen(false)} className="btn-primary px-4 py-2 text-sm" aria-label="关闭帮助中心">
            我知道了
          </button>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>这里汇总了当前常用的操作入口，方便快速完成行程规划。</p>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-700">常见问题</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-500">
              <li>从“新建行程”填写城市、天数和偏好后生成推荐方案。</li>
              <li>在“地图探索”中筛选 POI，并打开地点详情加入行程。</li>
              <li>在行程页可分享当前链接，也可导出 Markdown 文件。</li>
            </ul>
          </div>
        </div>
      </Modal>
      <Toast message={toast} onClose={() => setToast('')} />
    </>
  )
}
