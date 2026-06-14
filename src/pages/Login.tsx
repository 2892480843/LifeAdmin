import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MapPinned,
  Route,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Modal, Toast } from '../components/ui'
import { DEMO_LOGIN_ACCOUNT, DEMO_LOGIN_PASSWORD, isValidDemoCredential } from '../auth/demoCredentials'
import { useApp } from '../store/AppContext'

const features = [
  { icon: Route, title: '智能规划', desc: 'AI 自动生成最优路线' },
  { icon: MapPinned, title: '海量景点', desc: '覆盖全国热门目的地' },
  { icon: CheckCircle2, title: '个性定制', desc: '偏好学习持续优化' },
  { icon: Zap, title: '实时优化', desc: '动态调整行程安排' },
]

export default function Login() {
  const navigate = useNavigate()
  const { login } = useApp()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [account, setAccount] = useState(DEMO_LOGIN_ACCOUNT)
  const [password, setPassword] = useState(DEMO_LOGIN_PASSWORD)
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'terms' | 'privacy' | null>(null)
  const [toast, setToast] = useState('')

  const handleTabChange = (nextTab: 'login' | 'register') => {
    if (nextTab === tab) return
    setTab(nextTab)
    setAccount(nextTab === 'login' ? DEMO_LOGIN_ACCOUNT : '')
    setPassword(nextTab === 'login' ? DEMO_LOGIN_PASSWORD : '')
    setConfirm('')
    setShowPassword(false)
    setError('')
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const nextError = validate()
    if (nextError) {
      setError(nextError)
      return
    }
    setLoading(true)
    login(tab === 'login' ? DEMO_LOGIN_ACCOUNT : account.trim())
    navigate('/dashboard')
  }

  const validate = () => {
    if (!agree) return '请先阅读并同意用户协议与隐私政策'
    if (!account.trim()) return '请输入手机号或邮箱'
    if (!password) return '请输入密码'
    if (tab === 'login' && !isValidDemoCredential(account, password)) return '账号或密码不正确'
    if (tab === 'register' && password.length < 6) return '密码至少需要 6 位'
    if (tab === 'register' && password !== confirm) return '两次输入的密码不一致'
    return ''
  }

  return (
    <div className="min-h-[100dvh] bg-white">
      <main className="grid min-h-[100dvh] lg:grid-cols-[1fr_480px]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
          <img
            src="https://images.unsplash.com/photo-1548919973-5cef591cdbc9?w=1200&q=80"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-brand-950/20" />

          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 shadow-sm ring-1 ring-white/20">
              <Route size={23} className="text-white" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-bold leading-none">智行路线</p>
              <p className="mt-1 text-xs text-white/60">AI 智能旅行规划</p>
            </div>
          </div>

          <div className="relative max-w-xl">
            <h1 className="text-4xl font-bold leading-tight text-white">
              智行路线
              <br />
              AI 智能旅行规划
            </h1>
            <p className="mt-3 text-base text-white/70">个性化行程 · 精准推荐景点</p>

            <div className="mt-9 grid gap-4">
              {features.map((feature) => (
                <div key={feature.title} className="flex items-center gap-3 rounded-card border border-white/10 bg-white/10 p-3 backdrop-blur">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                    <feature.icon size={18} className="text-white" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                    <p className="mt-0.5 text-xs text-white/70">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-card border border-white/10 bg-white/10 p-4 backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles size={16} className="text-locate-100" aria-hidden="true" />
                <p className="text-sm font-semibold">路线节点预览</p>
              </div>
              <div className="space-y-3">
                {['外滩晨景', '豫园午餐', '陆家嘴日落'].map((node, index) => (
                  <div key={node} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-700">{index + 1}</span>
                    <div className="h-px flex-1 bg-white/20" />
                    <span className="w-24 text-right text-xs text-white/75">{node}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="relative text-xs text-white/50">© 2026 智行路线 · 让每一次出发更聪明</p>
        </section>

        <section className="flex min-h-[100dvh] items-center justify-center bg-white px-4 py-8 sm:px-6">
          <div className="w-full max-w-[400px]">
            <div className="mb-7">
              <p className="section-eyebrow">账号登录</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">进入智行路线</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">使用账号登录，管理你的旅行规划。</p>
            </div>

            <div className="segmented-control mb-5 w-full">
              {[
                { key: 'login', label: '登录' },
                { key: 'register', label: '注册' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleTabChange(item.key as 'login' | 'register')}
                  className={`segmented-item flex-1 ${tab === item.key ? 'segmented-item-active' : ''}`}
                  aria-pressed={tab === item.key}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4" autoComplete="on">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">手机号 / 邮箱</span>
                <span className="field-shell">
                  <Smartphone size={16} className="text-slate-400" aria-hidden="true" />
                  <input
                    key={`${tab}-account`}
                    id={`${tab}-account`}
                    type="text"
                    name="username"
                    value={account}
                    onChange={(event) => {
                      setAccount(event.target.value)
                      setError('')
                    }}
                    className="w-full bg-transparent py-2.5 text-sm outline-none"
                    placeholder="请输入手机号或邮箱"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">密码</span>
                <span className="field-shell">
                  <Lock size={16} className="text-slate-400" aria-hidden="true" />
                  <input
                    key={`${tab}-password`}
                    id={`${tab}-password`}
                    type={showPassword ? 'text' : 'password'}
                    name={tab === 'login' ? 'password' : 'new-password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setError('')
                    }}
                    className="w-full bg-transparent py-2.5 text-sm outline-none"
                    placeholder="请输入密码"
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </span>
              </label>

              {tab === 'register' && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-600">确认密码</span>
                  <span className="field-shell">
                    <Lock size={16} className="text-slate-400" aria-hidden="true" />
                    <input
                      id="register-confirm-password"
                      type="password"
                      name="new-password-confirm"
                      value={confirm}
                      onChange={(event) => {
                        setConfirm(event.target.value)
                        setError('')
                      }}
                      className="w-full bg-transparent py-2.5 text-sm outline-none"
                      placeholder="请再次输入密码"
                      autoComplete="new-password"
                    />
                  </span>
                </label>
              )}

              {tab === 'login' && (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                    <input type="checkbox" name="remember" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                    记住我
                  </label>
                  <button type="button" onClick={() => setToast('找回邮件暂未接入发送服务')} className="ml-auto font-medium text-brand-600 hover:text-brand-700">
                    忘记密码？
                  </button>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2 rounded-card border border-slate-200/80 bg-slate-50/80 p-3 text-xs leading-5 text-slate-500">
                <input
                  type="checkbox"
                  name="agreement"
                  checked={agree}
                  onChange={(event) => {
                    setAgree(event.target.checked)
                    setError('')
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  我已阅读并同意
                  <button type="button" onClick={() => setModal('terms')} className="mx-1 font-semibold text-brand-600 hover:text-brand-700">《用户协议》</button>
                  与
                  <button type="button" onClick={() => setModal('privacy')} className="mx-1 font-semibold text-brand-600 hover:text-brand-700">《隐私政策》</button>
                </span>
              </label>

              {error && <p className="rounded-lg bg-risk-50 px-3 py-2 text-sm text-risk-600">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary min-h-12 w-full text-base">
                {loading ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> 正在进入</> : tab === 'login' ? <><Route size={18} aria-hidden="true" /> 登录</> : <><ArrowRight size={18} aria-hidden="true" /> 注册并进入</>}
              </button>
            </form>
          </div>
        </section>
      </main>

      <Modal
        open={modal !== null}
        title={modal === 'privacy' ? '隐私政策' : '用户协议'}
        onClose={() => setModal(null)}
        footer={
          <button type="button" onClick={() => setModal(null)} className="btn-primary px-4 py-2 text-sm">
            我知道了
          </button>
        }
      >
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          {modal === 'privacy' && <p>数据仅保存在当前浏览器中，不会触发真实第三方授权或支付。</p>}
          {modal === 'terms' && <p>账号、路线、收藏和设置用于产品体验与功能验收。</p>}
        </div>
      </Modal>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  )
}
