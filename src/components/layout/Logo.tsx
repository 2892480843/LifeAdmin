import { Link } from 'react-router-dom'
import { Route } from 'lucide-react'

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/dashboard" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 shadow-sm">
        <Route size={20} className="text-white" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-bold text-slate-950">智行路线</span>
          <span className="hidden text-xs text-slate-400 xl:block">AI 智能旅行规划</span>
        </span>
      )}
    </Link>
  )
}
