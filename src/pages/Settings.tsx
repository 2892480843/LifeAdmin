import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  User as UserIcon,
  ShieldCheck,
  Bell,
  SlidersHorizontal,
  Lock,
  Globe,
  Accessibility,
  Sparkles,
  ChevronRight,
  Camera,
  Mail,
  Phone,
  KeyRound,
  Smartphone,
  Monitor,
  LogOut,
  Check,
  MapPin,
} from 'lucide-react'
import AppLayout from '../components/layout/AppLayout'
import { Card, CitySelect, ConfirmDialog, Modal, Toggle, Slider, Toast } from '../components/ui'
import { SystemPanel } from '../components/ui/RouteSystem'
import SmartImage from '../components/ui/SmartImage'
import { useApp } from '../store/AppContext'
import { downloadJsonFile } from '../utils/browserActions'
import { cities, cityOptionGroups, getCity, pois, preferenceProfile, trips } from '../mock'
import type { User } from '../types'

type SectionKey =
  | 'profile'
  | 'security'
  | 'notification'
  | 'preference'
  | 'privacy'
  | 'language'
  | 'accessibility'
  | 'ai'

const sections: { key: SectionKey; label: string; icon: typeof UserIcon; desc: string }[] = [
  { key: 'profile', label: '个人资料', icon: UserIcon, desc: '头像、昵称与简介' },
  { key: 'security', label: '账户与安全', icon: ShieldCheck, desc: '密码、绑定与登录设备' },
  { key: 'notification', label: '通知设置', icon: Bell, desc: '行程提醒与推送' },
  { key: 'preference', label: '旅行偏好', icon: SlidersHorizontal, desc: '默认出行偏好' },
  { key: 'privacy', label: '隐私与数据', icon: Lock, desc: '可见性与数据管理' },
  { key: 'language', label: '显示与语言', icon: Globe, desc: '界面语言与单位' },
  { key: 'accessibility', label: '无障碍选项', icon: Accessibility, desc: '字号与对比度' },
  { key: 'ai', label: 'AI 设置', icon: Sparkles, desc: '智能规划与推荐强度' },
]

type PreferenceSettings = {
  pace: string
  partner: string
  budget: number
  walk: boolean
  indoor: boolean
}

const defaultPreferenceSettings: PreferenceSettings = {
  pace: '适中',
  partner: '家庭',
  budget: 2000,
  walk: true,
  indoor: false,
}

type LanguageSettings = {
  lang: string
  region: string
  unit: string
  currency: string
}

const defaultLanguageSettings: LanguageSettings = {
  lang: '简体中文',
  region: '中国大陆',
  unit: '公制（km / ℃）',
  currency: '人民币 ¥',
}

type AccessibilitySettings = {
  fontSize: number
  contrast: boolean
  motion: boolean
  readable: boolean
}

const defaultAccessibilitySettings: AccessibilitySettings = {
  fontSize: 16,
  contrast: false,
  motion: false,
  readable: false,
}

export default function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, updateUser } = useApp()
  const [active, setActive] = useState<SectionKey>(() => getSectionFromSearch(location.search))
  const [toast, setToast] = useState('')

  useEffect(() => {
    setActive(getSectionFromSearch(location.search))
  }, [location.search])

  useEffect(() => {
    const onSettingsToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      setToast(detail || '设置已保存')
    }
    window.addEventListener('zhixing-settings-toast', onSettingsToast)
    return () => window.removeEventListener('zhixing-settings-toast', onSettingsToast)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const selectSection = (section: SectionKey) => {
    setActive(section)
    navigate(`/settings?section=${section}`, { replace: true })
  }

  return (
    <AppLayout>
      <div className="page-shell max-w-[1120px]">
        <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
          {/* 左：分组导航 */}
          <SystemPanel accent="brand" showAccentRail={false} className="h-fit p-2">
            <nav className="space-y-0.5">
              {sections.map((s) => {
                const on = active === s.key
                return (
                  <button
                    key={s.key}
                    onClick={() => selectSection(s.key)}
                    aria-label={`打开${s.label}`}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      on ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        on ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <s.icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{s.label}</span>
                    <ChevronRight size={15} className={on ? 'text-brand-500' : 'text-slate-300'} />
                  </button>
                )
              })}
            </nav>
            <div className="mt-2 border-t border-slate-100 p-2">
              <button
                onClick={handleLogout}
                aria-label="退出登录"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-50"
              >
                <LogOut size={16} /> 退出登录
              </button>
            </div>
          </SystemPanel>

          {/* 右：内容区 */}
          <div className="min-w-0">
            {active === 'profile' && <ProfileSection user={user} updateUser={updateUser} onToast={setToast} />}
            {active === 'security' && <SecuritySection onToast={setToast} />}
            {active === 'notification' && <NotificationSection />}
            {active === 'preference' && <PreferenceSection />}
            {active === 'privacy' && <PrivacySection user={user} onToast={setToast} onLogout={handleLogout} />}
            {active === 'language' && <LanguageSection />}
            {active === 'accessibility' && <AccessibilitySection />}
            {active === 'ai' && <AiSection onToast={setToast} />}
          </div>
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </AppLayout>
  )
}

function getSectionFromSearch(search: string): SectionKey {
  const section = new URLSearchParams(search).get('section')
  return sections.some((item) => item.key === section) ? (section as SectionKey) : 'profile'
}

// 通用：设置区块容器
function Panel({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card className="setting-panel p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-slate-400">{desc}</p>}
      </div>
      {children}
    </Card>
  )
}

// 通用：带开关的行
function ToggleRow({
  title,
  desc,
  value,
  onChange,
}: {
  title: string
  desc?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="os-row mb-2 flex items-center justify-between gap-4 px-3 py-3 last:mb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {desc && <p className="mt-0.5 text-xs text-slate-400">{desc}</p>}
      </div>
      <Toggle checked={value} onChange={onChange} ariaLabel={`切换${title}`} />
    </div>
  )
}

// 通用：字段输入
function Field({
  label,
  icon: Icon,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  icon?: typeof Mail
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
      <span className="field-shell">
        {Icon && <Icon size={15} className="text-slate-400" />}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent py-2.5 text-sm text-slate-700 outline-none"
        />
      </span>
    </label>
  )
}

function SaveBar({
  onSave,
  onCancel,
  savedMessage = '设置已保存',
  cancelMessage = '已取消未保存的设置',
}: {
  onSave: () => void
  onCancel: () => void
  savedMessage?: string
  cancelMessage?: string
}) {
  const [saved, setSaved] = useState(false)

  const notify = (message: string) => {
    window.dispatchEvent(new CustomEvent('zhixing-settings-toast', { detail: message }))
  }

  const saveChanges = () => {
    onSave()
    setSaved(true)
    notify(savedMessage)
    window.setTimeout(() => setSaved(false), 1800)
  }

  const cancelChanges = () => {
    onCancel()
    setSaved(false)
    notify(cancelMessage)
  }

  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        type="button"
        onClick={saveChanges}
        className={`px-5 py-2.5 ${saved ? 'btn bg-emerald-50 text-emerald-600' : 'btn-primary'}`}
        aria-label={saved ? '已保存更改' : '保存更改'}
      >
        {saved ? <><Check size={16} /> 已保存</> : '保存更改'}
      </button>
      <button type="button" onClick={cancelChanges} className="btn-ghost px-5 py-2.5 text-sm" aria-label="取消更改">取消</button>
    </div>
  )
}

type ProfileForm = Pick<User, 'name' | 'email' | 'phone' | 'bio'> & { city: string }

function ProfileSection({
  user,
  updateUser,
  onToast,
}: {
  user: ReturnType<typeof useApp>['user']
  updateUser: (patch: Partial<User>) => void
  onToast: (message: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [form, setForm] = useState<ProfileForm>(() => profileFormFromUser(user))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  useEffect(() => {
    setForm(profileFormFromUser(user))
  }, [user])

  const setField = (key: keyof ProfileForm) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  const changeAvatar = () => {
    fileRef.current?.click()
  }

  const handleAvatarFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onToast('请选择图片文件')
      return
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(URL.createObjectURL(file))
    onToast('头像预览已更新')
  }

  const saveProfile = () => {
    updateUser(form)
    setSaved(true)
    onToast('个人资料已保存')
    window.setTimeout(() => setSaved(false), 1800)
  }

  const profileCityId = getProfileCityId(form.city)
  const selectProfileCity = (cityId: string) => {
    setField('city')(getCity(cityId)?.name ?? cityId)
  }

  return (
    <Panel title="个人资料" desc="这些信息将展示在你的个人主页">
      <div className="mb-6 flex items-center gap-4">
        <div className="relative">
          <SmartImage
            src={avatarPreview || user?.avatar || ''}
            alt={user?.name ?? ''}
            fallbackText={user?.name?.slice(0, 1) ?? 'U'}
            className="h-20 w-20 rounded-2xl object-cover"
          />
          <button type="button" onClick={changeAvatar} className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white shadow" aria-label="更换头像">
            <Camera size={13} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700">{user?.name}</p>
          <p className="text-xs text-slate-400">{user?.level} · 加入于 {user?.joinedAt}</p>
          <button type="button" onClick={changeAvatar} className="mt-1.5 text-xs text-brand-600 hover:underline" aria-label="更换头像">更换头像</button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="昵称" value={form.name} onChange={setField('name')} />
        <Field label="邮箱" icon={Mail} value={form.email} onChange={setField('email')} type="email" />
        <Field label="手机号" icon={Phone} value={form.phone} onChange={setField('phone')} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-600">所在城市</span>
          <CitySelect
            value={profileCityId}
            onChange={selectProfileCity}
            groups={cityOptionGroups}
            ariaLabel="选择所在城市"
            icon={MapPin}
            showPoiCount
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-slate-600">个人简介</span>
        <textarea
          value={form.bio}
          onChange={(event) => setField('bio')(event.target.value)}
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition duration-[180ms] placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={saveProfile}
          className={`px-5 py-2.5 ${saved ? 'btn bg-emerald-50 text-emerald-600' : 'btn-primary'}`}
          aria-label={saved ? '个人资料已保存' : '保存个人资料'}
        >
          {saved ? <><Check size={16} /> 已保存</> : '保存更改'}
        </button>
      </div>
    </Panel>
  )
}

function profileFormFromUser(user: User | null): ProfileForm {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    city: user?.city ?? '上海',
    bio: user?.bio ?? '',
  }
}

function getProfileCityId(cityName: string) {
  return cities.find((city) => city.id === cityName || city.name === cityName)?.id ?? cities[0]?.id ?? ''
}

function SecuritySection({ onToast }: { onToast: (message: string) => void }) {
  const [twoFa, setTwoFa] = useState(true)
  const [loginAlert, setLoginAlert] = useState(true)
  const [devices, setDevices] = useState([
    { icon: Smartphone, name: 'iPhone 15 Pro', loc: '上海 · 当前设备', active: true },
    { icon: Monitor, name: 'MacBook Pro', loc: '上海 · 2 小时前', active: false },
    { icon: Monitor, name: 'Windows PC', loc: '杭州 · 3 天前', active: false },
  ])
  const [removingDevice, setRemovingDevice] = useState<string | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')
  const pendingDevice = devices.find((device) => device.name === removingDevice)

  const setPasswordField = (key: keyof typeof passwordForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((form) => ({ ...form, [key]: event.target.value }))
    setPasswordError('')
  }

  const closePasswordModal = () => {
    setPasswordOpen(false)
    setPasswordError('')
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
  }

  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault()
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('请完整填写当前密码、新密码和确认密码')
      return
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('新密码至少需要 6 位')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('两次输入的新密码不一致')
      return
    }
    closePasswordModal()
    onToast('密码已更新成功')
  }

  const removeDevice = () => {
    if (!pendingDevice) return
    setDevices((items) => items.filter((item) => item.name !== pendingDevice.name))
    setRemovingDevice(null)
    onToast(`已移除设备：${pendingDevice.name}`)
  }

  return (
    <div className="space-y-6">
      <Panel title="账户与安全" desc="保护你的账户安全">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><KeyRound size={17} /></span>
              <div>
                <p className="text-sm font-medium text-slate-700">登录密码</p>
                <p className="text-xs text-slate-400">上次修改于 3 个月前</p>
              </div>
            </div>
            <button onClick={() => setPasswordOpen(true)} className="btn-ghost px-4 py-2 text-sm" aria-label="修改登录密码">修改</button>
          </div>
          <ToggleRow title="两步验证" desc="登录时需额外验证短信验证码" value={twoFa} onChange={setTwoFa} />
          <ToggleRow title="异地登录提醒" desc="检测到新设备登录时通知我" value={loginAlert} onChange={setLoginAlert} />
        </div>
      </Panel>

      <Panel title="登录设备" desc="管理已登录的设备">
        <div className="space-y-2.5">
          {devices.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><d.icon size={17} /></span>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    {d.name}
                    {d.active && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">当前</span>}
                  </p>
                  <p className="text-xs text-slate-400">{d.loc}</p>
                </div>
              </div>
              {!d.active && <button onClick={() => setRemovingDevice(d.name)} className="text-xs text-rose-500 hover:underline" aria-label={`移除设备${d.name}`}>移除</button>}
            </div>
          ))}
        </div>
      </Panel>
      <Modal
        open={passwordOpen}
        title="修改密码"
        onClose={closePasswordModal}
        footer={
          <>
            <button type="button" onClick={closePasswordModal} className="btn-ghost px-4 py-2 text-sm" aria-label="取消修改密码">
              取消
            </button>
            <button type="submit" form="password-form" className="btn-primary px-4 py-2 text-sm" aria-label="保存密码">
              保存密码
            </button>
          </>
        }
      >
        <form id="password-form" onSubmit={submitPassword} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">当前密码</span>
            <input
              type="password"
              value={passwordForm.oldPassword}
              onChange={setPasswordField('oldPassword')}
              className="input"
              placeholder="输入当前密码"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">新密码</span>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={setPasswordField('newPassword')}
              className="input"
              placeholder="至少 6 位"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">确认新密码</span>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={setPasswordField('confirmPassword')}
              className="input"
              placeholder="再次输入新密码"
            />
          </label>
          {passwordError && <p className="text-sm text-rose-500">{passwordError}</p>}
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(pendingDevice)}
        title="移除登录设备"
        message={`确认移除 ${pendingDevice?.name ?? '该设备'}？移除后该设备需要重新登录。`}
        confirmText="确认移除"
        danger
        onConfirm={removeDevice}
        onCancel={() => setRemovingDevice(null)}
      />
    </div>
  )
}

function NotificationSection() {
  const [s, setS] = useState({
    trip: true,
    realtime: true,
    ai: true,
    weather: true,
    marketing: false,
    sound: true,
  })
  const set = (k: keyof typeof s) => (v: boolean) => setS((p) => ({ ...p, [k]: v }))
  return (
    <div className="space-y-6">
      <Panel title="行程通知" desc="与你的旅程相关的提醒">
        <ToggleRow title="行程提醒" desc="出发前与节点切换时提醒" value={s.trip} onChange={set('trip')} />
        <ToggleRow title="实时动态" desc="交通、天气与官方可用数据提醒" value={s.realtime} onChange={set('realtime')} />
        <ToggleRow title="天气变化" desc="目的地天气异常时通知" value={s.weather} onChange={set('weather')} />
      </Panel>
      <Panel title="智能与推广" desc="个性化推荐与活动消息">
        <ToggleRow title="AI 智能建议" desc="路线优化与新发现推送" value={s.ai} onChange={set('ai')} />
        <ToggleRow title="营销活动" desc="优惠、新功能与节日活动" value={s.marketing} onChange={set('marketing')} />
        <ToggleRow title="提示音" desc="收到通知时播放声音" value={s.sound} onChange={set('sound')} />
      </Panel>
    </div>
  )
}

function PreferenceSection() {
  const [settings, setSettings] = useState(defaultPreferenceSettings)
  const [savedSettings, setSavedSettings] = useState(defaultPreferenceSettings)

  function setPreference<K extends keyof PreferenceSettings>(key: K) {
    return (value: PreferenceSettings[K]) => {
      setSettings((current) => ({ ...current, [key]: value }))
    }
  }

  const savePreference = () => {
    setSavedSettings(settings)
  }

  const cancelPreference = () => {
    setSettings(savedSettings)
  }

  return (
    <Panel title="默认出行偏好" desc="新建行程时将以此为默认值">
      <div className="space-y-5">
        <ChoiceRow label="旅行节奏" options={['轻松', '适中', '紧凑']} value={settings.pace} onChange={setPreference('pace')} />
        <ChoiceRow label="常用出行伙伴" options={['独自', '情侣', '家庭', '朋友']} value={settings.partner} onChange={setPreference('partner')} />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">默认单日预算</span>
            <span className="text-sm font-semibold text-brand-600">¥{settings.budget}</span>
          </div>
          <Slider value={settings.budget} min={300} max={5000} step={100} onChange={setPreference('budget')} />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>¥300</span>
            <span>¥5000</span>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-2">
          <ToggleRow title="优先步行可达" desc="尽量减少打车与换乘" value={settings.walk} onChange={setPreference('walk')} />
          <ToggleRow title="优先室内景点" desc="雨天或高温时优先推荐" value={settings.indoor} onChange={setPreference('indoor')} />
        </div>
      </div>
      <SaveBar
        onSave={savePreference}
        onCancel={cancelPreference}
        savedMessage="旅行偏好已保存"
        cancelMessage="已恢复到上一次保存的旅行偏好"
      />
    </Panel>
  )
}

function PrivacySection({
  user,
  onToast,
  onLogout,
}: {
  user: ReturnType<typeof useApp>['user']
  onToast: (message: string) => void
  onLogout: () => void
}) {
  const [s, setS] = useState({
    publicProfile: true,
    showTrips: true,
    location: true,
    analytics: false,
  })
  const [historyItems, setHistoryItems] = useState(() => pois.slice(0, 4).map((poi) => poi.name))
  const [confirmAction, setConfirmAction] = useState<'history' | 'account' | null>(null)
  const set = (k: keyof typeof s) => (v: boolean) => setS((p) => ({ ...p, [k]: v }))

  const exportMyData = () => {
    downloadJsonFile('zhixing-my-data.json', {
      exportedAt: new Date().toISOString(),
      user,
      privacy: s,
      trips: trips.map(({ id, title, startDate, endDate, status }) => ({ id, title, startDate, endDate, status })),
      favorites: pois.slice(0, 2).map(({ id, name }) => ({ id, name })),
      preferenceProfile,
      browsingHistory: historyItems,
    })
    onToast('我的数据已导出为 JSON 文件')
  }

  const clearHistory = () => {
    setHistoryItems([])
    setConfirmAction(null)
    onToast('浏览历史已清空')
  }

  const cancelAccount = () => {
    setConfirmAction(null)
    onToast('账户注销请求已处理，当前会话已退出')
    onLogout()
  }

  return (
    <div className="space-y-6">
      <Panel title="隐私设置" desc="控制谁能看到你的信息">
        <ToggleRow title="公开个人主页" desc="允许其他用户查看你的主页" value={s.publicProfile} onChange={set('publicProfile')} />
        <ToggleRow title="展示我的行程" desc="在主页展示已完成的行程" value={s.showTrips} onChange={set('showTrips')} />
        <ToggleRow title="基于位置推荐" desc="使用定位提供周边推荐" value={s.location} onChange={set('location')} />
        <ToggleRow title="匿名使用分析" desc="帮助我们改进产品体验" value={s.analytics} onChange={set('analytics')} />
      </Panel>
      <Panel title="数据管理" desc="导出或清除你的数据">
        <div className="mb-4 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">浏览历史</p>
          <p className="mt-1 text-sm text-slate-700">{historyItems.length ? historyItems.join('、') : '暂无浏览历史'}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportMyData} className="btn-ghost px-4 py-2.5 text-sm" aria-label="导出我的数据">导出我的数据</button>
          <button onClick={() => setConfirmAction('history')} className="btn-ghost px-4 py-2.5 text-sm" aria-label="清除浏览历史">清除浏览历史</button>
          <button onClick={() => setConfirmAction('account')} className="rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-50" aria-label="注销账户">
            注销账户
          </button>
        </div>
      </Panel>
      <ConfirmDialog
        open={confirmAction === 'history'}
        title="清除浏览历史"
        message="确认清空浏览历史？该操作完成后列表会立即变为空。"
        confirmText="确认清除"
        danger
        onConfirm={clearHistory}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'account'}
        title="注销账户二次确认"
        message="确认后会退出当前会话并回到登录页。"
        confirmText="确认注销"
        danger
        onConfirm={cancelAccount}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}

function LanguageSection() {
  const [settings, setSettings] = useState(defaultLanguageSettings)
  const [savedSettings, setSavedSettings] = useState(defaultLanguageSettings)

  function setLanguage<K extends keyof LanguageSettings>(key: K) {
    return (value: LanguageSettings[K]) => {
      setSettings((current) => ({ ...current, [key]: value }))
    }
  }

  const saveLanguage = () => {
    setSavedSettings(settings)
  }

  const cancelLanguage = () => {
    setSettings(savedSettings)
  }

  return (
    <Panel title="语言与地区" desc="界面语言、单位与货币">
      <div className="space-y-5">
        <SelectRow label="界面语言" options={['简体中文', '繁體中文', 'English', '日本語']} value={settings.lang} onChange={setLanguage('lang')} />
        <SelectRow label="所在地区" options={['中国大陆', '中国香港', '中国台湾', '海外']} value={settings.region} onChange={setLanguage('region')} />
        <SelectRow label="单位制式" options={['公制（km / ℃）', '英制（mi / ℉）']} value={settings.unit} onChange={setLanguage('unit')} />
        <SelectRow label="货币" options={['人民币 ¥', '美元 $', '欧元 €', '日元 ¥']} value={settings.currency} onChange={setLanguage('currency')} />
      </div>
      <SaveBar
        onSave={saveLanguage}
        onCancel={cancelLanguage}
        savedMessage="显示与语言设置已保存"
        cancelMessage="已恢复到上一次保存的显示与语言设置"
      />
    </Panel>
  )
}

function AccessibilitySection() {
  const [settings, setSettings] = useState(defaultAccessibilitySettings)
  const [savedSettings, setSavedSettings] = useState(defaultAccessibilitySettings)

  function setAccessibility<K extends keyof AccessibilitySettings>(key: K) {
    return (value: AccessibilitySettings[K]) => {
      setSettings((current) => ({ ...current, [key]: value }))
    }
  }

  const saveAccessibility = () => {
    setSavedSettings(settings)
  }

  const cancelAccessibility = () => {
    setSettings(savedSettings)
  }

  return (
    <Panel title="无障碍选项" desc="让产品更易于使用">
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">字体大小</span>
            <span className="text-sm font-semibold text-brand-600">{settings.fontSize}px</span>
          </div>
          <Slider value={settings.fontSize} min={12} max={22} step={1} onChange={setAccessibility('fontSize')} />
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-600" style={{ fontSize: settings.fontSize }}>
            预览：智行路线，为你规划每一段精彩旅程。
          </p>
        </div>
        <div className="border-t border-slate-100 pt-2">
          <ToggleRow title="高对比度模式" desc="增强文字与背景的对比" value={settings.contrast} onChange={setAccessibility('contrast')} />
          <ToggleRow title="减弱动画" desc="减少过渡与动效" value={settings.motion} onChange={setAccessibility('motion')} />
          <ToggleRow title="无障碍优先路线" desc="优先推荐有无障碍设施的地点" value={settings.readable} onChange={setAccessibility('readable')} />
        </div>
      </div>
      <SaveBar
        onSave={saveAccessibility}
        onCancel={cancelAccessibility}
        savedMessage="无障碍设置已保存"
        cancelMessage="已恢复到上一次保存的无障碍设置"
      />
    </Panel>
  )
}

function AiSection({ onToast }: { onToast: (message: string) => void }) {
  const [aiIntensity, setAiIntensity] = useState(70)
  const [autoAdjust, setAutoAdjust] = useState(true)
  const [prefLearning, setPrefLearning] = useState(true)
  const [contextAware, setContextAware] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const aiToggles = [
    { key: 'auto-adjust', label: 'AI 自动调整路线', desc: '行程中出现风险时自动生成调整建议', value: autoAdjust, onChange: setAutoAdjust },
    { key: 'pref-learning', label: '偏好持续学习', desc: '根据收藏、行程完成情况更新偏好模型', value: prefLearning, onChange: setPrefLearning },
    { key: 'context-aware', label: '上下文感知推荐', desc: '结合天气、时间、位置动态调整建议', value: contextAware, onChange: setContextAware },
  ]

  return (
    <>
      <div className="space-y-5">
        <div className="command-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
              <Sparkles size={20} className="text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="section-eyebrow">AI 配置</p>
              <h2 className="text-base font-semibold text-slate-950">AI 推荐设置</h2>
              <p className="text-sm text-slate-500">控制 AI 的个性化程度与自动化行为。</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">个性化推荐强度</h3>
          <p className="mb-4 text-xs text-slate-500">值越高，AI 越偏向你的历史偏好；值越低，推荐越多样化。</p>
          <Slider
            name="ai-intensity"
            value={aiIntensity}
            min={0}
            max={100}
            step={10}
            onChange={setAiIntensity}
            ariaLabel="调整个性化推荐强度"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>多样探索</span>
            <span className="font-semibold text-brand-600">{aiIntensity}%</span>
            <span>高度个性化</span>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">AI 功能开关</h3>
          {aiToggles.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
              <div>
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
              </div>
              <Toggle checked={item.value} onChange={item.onChange} ariaLabel={`切换${item.label}`} />
            </div>
          ))}
        </div>

        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">重置 AI 偏好</h3>
          <p className="mb-4 text-sm text-slate-500">清除所有 AI 学习到的个人偏好记录，推荐将恢复为通用方案。此操作不可撤销。</p>
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="btn-danger px-4 py-2 text-sm"
            aria-label="重置 AI 偏好数据"
          >
            重置 AI 偏好数据
          </button>
        </div>
      </div>

      {resetConfirmOpen && (
        <Modal
          open={resetConfirmOpen}
          title="确认重置 AI 偏好？"
          onClose={() => setResetConfirmOpen(false)}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setResetConfirmOpen(false)} className="btn-ghost px-4 py-2 text-sm">
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetConfirmOpen(false)
                  onToast('AI 偏好已重置')
                }}
                className="btn-danger px-4 py-2 text-sm"
              >
                确认重置
              </button>
            </div>
          }
        >
          <p className="text-sm leading-6 text-slate-600">
            所有基于您行为学习到的偏好权重将被清除，下次 AI 规划将从通用模板开始。
          </p>
        </Modal>
      )}
    </>
  )
}

// 选项按钮组（单选）
function ChoiceRow({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-slate-600">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            aria-label={`选择${label}${o}`}
            aria-pressed={value === o}
          className={`control-card px-4 py-2 text-sm ${
              value === o ? 'border-brand-500 bg-brand-50 font-medium text-brand-700 ring-1 ring-brand-100' : 'text-slate-600'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

// 下拉选择
function SelectRow({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="os-row flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input sm:w-64"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}
