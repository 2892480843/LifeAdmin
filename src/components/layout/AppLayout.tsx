import type { ReactNode } from 'react'
import TopNav from './TopNav'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

// 应用主框架：顶部导航 + 可选左侧栏 + 内容区
export default function AppLayout({
  children,
  sidebar = true,
  contentClassName = '',
}: {
  children: ReactNode
  sidebar?: boolean
  contentClassName?: string
}) {
  return (
    <div className="route-system-bg flex min-h-screen flex-col text-slate-950">
      <TopNav />
      <div className="flex min-h-0 flex-1">
        {sidebar && <Sidebar />}
        <main className={`min-w-0 flex-1 overflow-x-hidden pb-16 md:pb-0 ${contentClassName}`}>{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}
