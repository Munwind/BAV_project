import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  BriefcaseBusiness,
  ChevronRight,
  ExternalLink,
  Globe,
  LayoutDashboard,
  LoaderCircle,
  PanelLeft,
  RadioTower,
  RefreshCcw,
  Search,
  SendHorizonal,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  WandSparkles,
  X,
} from 'lucide-react'

const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Executive summary' },
  { id: 'companies', label: 'Companies', icon: BriefcaseBusiness, description: 'Tracked entities' },
  { id: 'alerts', label: 'Alerts', icon: ShieldAlert, description: 'Risk monitoring' },
]

const STATIC_GOOGLE_TRENDS = [
  { keyword: 'giá vàng hôm nay', traffic: '200K+', relatedQueries: ['SJC', '9999', 'tỷ giá USD'] },
  { keyword: 'chứng khoán Việt Nam', traffic: '100K+', relatedQueries: ['VN-Index', 'cổ phiếu ngân hàng'] },
  { keyword: 'lãi suất ngân hàng', traffic: '50K+', relatedQueries: ['gửi tiết kiệm', 'vay mua nhà'] },
  { keyword: 'xăng dầu', traffic: '50K+', relatedQueries: ['giá xăng', 'Petrolimex'] },
  { keyword: 'bất động sản', traffic: '20K+', relatedQueries: ['đất nền', 'chung cư'] },
  { keyword: 'tỷ giá USD', traffic: '20K+', relatedQueries: ['VND', 'ngân hàng'] },
  { keyword: 'du lịch hè', traffic: '20K+', relatedQueries: ['vé máy bay', 'khách sạn'] },
  { keyword: 'AI doanh nghiệp', traffic: '10K+', relatedQueries: ['tự động hóa', 'chatbot'] },
].map((item, index) => ({
  ...item,
  id: `static-trend-${index + 1}`,
  rank: index + 1,
  articles: [],
}))

const TREND_FORECAST_RULES = [
  {
    match: ['gia vang', 'sjc', '9999'],
    theme: 'Gold demand',
    forecast: 'Nhu cầu vàng có thể kéo attention sang nhóm bán lẻ vàng và ngân hàng.',
    action: 'Theo dõi PNJ, SJC và nhóm ngân hàng',
    impact: 'high',
  },
  {
    match: ['chung khoan', 'vn-index', 'co phieu', 'ngan hang'],
    theme: 'Market trading',
    forecast: 'Dòng tìm kiếm chứng khoán tăng, xác suất thảo luận cổ phiếu/ngân hàng nóng lên.',
    action: 'Ưu tiên coverage tài chính',
    impact: 'high',
  },
  {
    match: ['lai suat', 'gui tiet kiem', 'vay mua nha'],
    theme: 'Rate sensitivity',
    forecast: 'Lãi suất đang là pain-point, dễ tạo sentiment mới quanh ngân hàng và bất động sản.',
    action: 'Theo dõi ngân hàng và bất động sản',
    impact: 'medium',
  },
  {
    match: ['xang dau', 'gia xang', 'petrolimex'],
    theme: 'Fuel price',
    forecast: 'Giá xăng có thể đẩy thảo luận về chi phí vận hành, logistics và bán lẻ.',
    action: 'Theo dõi doanh nghiệp liên quan xăng dầu',
    impact: 'medium',
  },
  {
    match: ['bat dong san', 'dat nen', 'chung cu'],
    theme: 'Real estate',
    forecast: 'Bất động sản nóng lại có thể kéo volume sang chủ đầu tư, ngân hàng và vật liệu.',
    action: 'Rà soát watchlist bất động sản',
    impact: 'medium',
  },
  {
    match: ['ai doanh nghiep', 'automation', 'chatbot'],
    theme: 'Enterprise AI',
    forecast: 'AI doanh nghiệp tăng attention, phù hợp để theo dõi vendor, ngân hàng số và automation.',
    action: 'Bổ sung keyword liên quan AI',
    impact: 'low',
  },
]

function normalizeKeyword(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function trendTrafficScore(traffic = '') {
  const value = Number(String(traffic).replace(/[^\d]/g, '')) || 0
  if (String(traffic).includes('K')) return Math.min(value, 250)
  return value
}

function buildTrendForecast(trend) {
  const haystack = normalizeKeyword([trend.keyword, ...(trend.relatedQueries || [])].join(' '))
  const rule = TREND_FORECAST_RULES.find((item) => item.match.some((keyword) => haystack.includes(normalizeKeyword(keyword))))
  const confidence = Math.min(92, 52 + Math.round(trendTrafficScore(trend.traffic) / 5) + Math.max(0, 9 - trend.rank))

  return {
    id: `google-${trend.id}`,
    source: 'Google',
    theme: rule?.theme || 'Search spike',
    signal: trend.keyword,
    forecast: rule?.forecast || 'Keyword đang tăng tìm kiếm, nên theo dõi xem có lan sang news hoặc YouTube comments không.',
    action: rule?.action || 'Theo dõi entity liên quan',
    confidence,
    impact: rule?.impact || (confidence >= 78 ? 'high' : confidence >= 64 ? 'medium' : 'low'),
    tone: rule?.impact === 'high' ? 'negative' : rule?.impact === 'medium' ? 'warning' : 'info',
  }
}

function buildYoutubeForecast(companies = []) {
  const youtubeLeaders = companies
    .map((company) => {
      const youtube = (company.sourceSplit || []).find((item) => item.channel === 'youtube')
      if (!youtube) return null

      return {
        company,
        youtube,
        score: Number(youtube.mentions || 0) * 3 + Number(youtube.negativeShare || 0) + Number(company.forecastConfidence || 0) / 4,
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)

  const leader = youtubeLeaders[0]
  if (!leader) return null

  return {
    id: `youtube-${leader.company.key}`,
    source: 'YouTube',
    theme: 'Comment velocity',
    signal: leader.company.name,
    forecast:
      leader.youtube.negativeShare >= 35
        ? 'YouTube comments đang nghiêng tiêu cực, dễ xuất hiện alert sớm trước news chính thống.'
        : 'YouTube comments có volume đáng chú ý, nên theo dõi chuyển dịch sentiment trong 24h.',
    action: 'Mở company detail và bấm Explain',
    confidence: Math.min(92, 58 + Number(leader.youtube.mentions || 0) * 3 + Math.round(Number(leader.youtube.negativeShare || 0) / 3)),
    impact: leader.youtube.negativeShare >= 35 ? 'high' : 'medium',
    tone: leader.youtube.negativeShare >= 35 ? 'negative' : 'warning',
  }
}

function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(245,247,250,0.92))] text-slate-700 shadow-[0_10px_20px_-16px_rgba(15,23,42,0.28)]',
    positive: 'border-emerald-200/80 bg-[linear-gradient(135deg,rgba(239,252,245,0.98),rgba(209,250,229,0.88))] text-emerald-900 shadow-[0_10px_20px_-16px_rgba(5,150,105,0.32)]',
    negative: 'border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,244,245,0.98),rgba(254,215,226,0.88))] text-rose-900 shadow-[0_10px_20px_-16px_rgba(225,29,72,0.32)]',
    warning: 'border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(254,240,138,0.86))] text-amber-900 shadow-[0_10px_20px_-16px_rgba(217,119,6,0.32)]',
    info: 'border-sky-200/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(219,234,254,0.9))] text-sky-900 shadow-[0_10px_20px_-16px_rgba(37,99,235,0.28)]',
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] uppercase ${tones[tone]}`}>
      {children}
    </span>
  )
}

function Panel({ title, description, action, children }) {
  return (
    <section className="panel-surface float-card rounded-[30px]">
      <div className="panel-header flex items-start justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="font-display text-[1.15rem] font-semibold tracking-[0.01em] text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function CollapsiblePanel({ title, kicker, badge, open, onToggle, preview, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(240,249,255,0.76),rgba(255,247,237,0.62))] px-4 py-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.22)] ${className}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="min-w-0">
          {kicker ? <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{kicker}</p> : null}
          <p className="mt-1 truncate text-sm font-semibold text-slate-950">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          <span className={`flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition ${open ? 'rotate-90' : ''}`}>
            <ChevronRight className="size-4" />
          </span>
        </div>
      </button>
      {open ? <div className="mt-4">{children}</div> : preview ? <div className="mt-3">{preview}</div> : null}
    </section>
  )
}

function StatCard({ label, value, note, tone, onClick, addon }) {
  const surfaces = {
    default: 'bg-[linear-gradient(145deg,rgba(255,255,255,0.97),rgba(244,246,248,0.94),rgba(235,240,245,0.82))]',
    positive: 'bg-[linear-gradient(145deg,rgba(239,252,245,0.98),rgba(220,252,231,0.92),rgba(167,243,208,0.72))]',
    negative: 'bg-[linear-gradient(145deg,rgba(255,244,245,0.98),rgba(255,228,230,0.92),rgba(253,164,175,0.7))]',
    warning: 'bg-[linear-gradient(145deg,rgba(255,251,235,0.98),rgba(254,243,199,0.92),rgba(253,230,138,0.72))]',
    info: 'bg-[linear-gradient(145deg,rgba(239,246,255,0.98),rgba(219,234,254,0.92),rgba(191,219,254,0.72))]',
  }

  const className = `stat-surface float-card relative flex min-h-[188px] h-full flex-col justify-between overflow-hidden rounded-[28px] border p-5 shadow-[0_24px_58px_-38px_rgba(15,23,42,0.22)] ${surfaces[tone] || surfaces.default} ${
    onClick ? 'text-left transition duration-200 hover:-translate-y-1 hover:border-slate-300/80' : ''
  }`

  const content = (
    <>
      <div className="pointer-events-none absolute inset-x-5 top-0 h-[3px] rounded-full bg-[linear-gradient(90deg,rgba(14,165,233,0.38),rgba(217,70,239,0.28),rgba(251,146,60,0.3))]" />
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="font-display mt-4 text-[clamp(2.2rem,2.8vw,3rem)] font-semibold tracking-tight text-slate-950">{value}</p>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <Badge tone={tone}>{note}</Badge>
        </div>
        {addon ? <div className="shrink-0">{addon}</div> : null}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

function formatSourceDomain(value) {
  if (!value) return 'N/A'

  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}

function normalizeSourceItem(source) {
  const key = source.source_key || source.key || source.sourceKey || source.id
  const category = source.category || 'general'
  const siteUrl = source.site_url || source.siteUrl || ''
  const rssUrl = source.rss_url || source.rssUrl || ''
  const inferredPlatform =
    source.platform
    || (String(key || '').startsWith('youtube-') || category === 'video-comments' || siteUrl.includes('youtube.com') ? 'youtube' : 'rss')

  return {
    key,
    name: source.source_name || source.name || 'Unknown source',
    siteUrl,
    rssUrl,
    category,
    language: source.language_code || source.language || 'vi',
    lastCrawledAt: source.last_crawled_at || source.lastCrawledAt || null,
    platform: inferredPlatform,
    query: source.query || null,
    configuredOnly: !source.last_crawled_at && !source.lastCrawledAt,
  }
}

function ShellStat({ label, value, note }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(245,247,250,0.88))] px-4 py-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.24)]">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="font-display mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
    </div>
  )
}

function SparkBars({ values = [], tone = 'info' }) {
  const palettes = {
    default: ['from-slate-300 to-slate-400', 'from-slate-200 to-slate-300/80'],
    positive: ['from-emerald-400 to-teal-400', 'from-emerald-200 to-teal-200/80'],
    negative: ['from-rose-400 to-orange-400', 'from-rose-200 to-orange-200/80'],
    warning: ['from-amber-400 to-yellow-300', 'from-amber-200 to-yellow-200/80'],
    info: ['from-sky-500 to-fuchsia-500', 'from-sky-200 to-fuchsia-200/80'],
  }

  const [active, inactive] = palettes[tone] || palettes.default
  const normalized = values.length ? values : [2, 3, 4, 5, 6, 5]
  const maxValue = Math.max(...normalized, 1)

  return (
    <div className="flex h-12 items-end gap-1.5">
      {normalized.map((value, index) => {
        const height = `${Math.max(20, Math.round((value / maxValue) * 100))}%`
        const gradient = index >= normalized.length - 2 ? active : inactive

        return (
          <div
            key={`${tone}-${index}-${value}`}
            className={`flex-1 rounded-full bg-gradient-to-t ${gradient} shadow-[0_10px_18px_-12px_rgba(59,130,246,0.45)]`}
            style={{ height }}
          />
        )
      })}
    </div>
  )
}

function toneForScore(score) {
  if (score >= 70) return 'positive'
  if (score <= 45) return 'negative'
  return 'info'
}

function toneForSeverity(severity) {
  if (severity === 'high') return 'negative'
  if (severity === 'medium') return 'warning'
  return 'info'
}

function formatForecastLabel(level) {
  if (level === 'high') return 'High'
  if (level === 'medium') return 'Medium'
  return 'Low'
}

function formatDate(value) {
  if (!value) return 'N/A'

  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0%'
  return `${Math.round(Number(value))}%`
}

function createWelcomeMessage(contextLabel) {
  const content =
    contextLabel === 'overview'
      ? 'Chào bạn. Tôi có thể tóm tắt thị trường, highlight rủi ro mới và giải thích các tín hiệu nổi bật.'
      : `Chào bạn. Tôi đang theo ngữ cảnh ${contextLabel}. Bạn có thể hỏi về sentiment, rủi ro, nguồn tin và diễn biến mới.`

  return {
    id: `assistant-welcome-${contextLabel}`,
    role: 'assistant',
    content,
    references: [],
  }
}

export default function App() {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')
  const crawlerEnabled = import.meta.env.VITE_ENABLE_CRAWLER !== 'false'
  const adminApiKey = import.meta.env.VITE_ADMIN_API_KEY || ''
  const [activeView, setActiveView] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [companies, setCompanies] = useState([])
  const [alerts, setAlerts] = useState([])
  const [sources, setSources] = useState([])
  const [selectedCompanyKey, setSelectedCompanyKey] = useState('')
  const [companyRiskFilter, setCompanyRiskFilter] = useState('all')
  const [companySortMode, setCompanySortMode] = useState('forecast')
  const [companyPage, setCompanyPage] = useState(1)
  const [watchlistKeys, setWatchlistKeys] = useState([])
  const [selectedAlertId, setSelectedAlertId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [crawlStatus, setCrawlStatus] = useState('idle')
  const [sourceStatus, setSourceStatus] = useState('idle')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [companyPanelOpen, setCompanyPanelOpen] = useState(false)
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiStatus, setAiStatus] = useState('idle')
  const [chatMessages, setChatMessages] = useState([createWelcomeMessage('overview')])
  const [aiError, setAiError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchStatus, setSearchStatus] = useState('idle')
  const [searchResults, setSearchResults] = useState({ companies: [], alerts: [], articles: [] })
  const [expandedSections, setExpandedSections] = useState({})
  const [googleTrends] = useState({
    items: STATIC_GOOGLE_TRENDS,
    fetchedAt: new Date().toISOString(),
    sourceUrl: 'https://trends.google.com/trends/trendingsearches/daily?geo=VN',
  })
  const trendStatus = 'success'
  const [explainStatusByEntity, setExplainStatusByEntity] = useState({})
  const [explainErrorByEntity, setExplainErrorByEntity] = useState({})

  const selectedCompany = useMemo(
    () => companies.find((item) => item.key === selectedCompanyKey) || companies[0] || null,
    [companies, selectedCompanyKey],
  )
  const selectedAlert = useMemo(
    () => alerts.find((item) => item.id === selectedAlertId) || alerts[0] || null,
    [alerts, selectedAlertId],
  )
  const _compareCompanies = useMemo(() => {
    const explicit = companies.filter((company) => watchlistKeys.includes(company.key))
    if (explicit.length) return explicit.slice(0, 3)
    return companies.slice(0, 3)
  }, [companies, watchlistKeys])
  const topForecastCompany = useMemo(() => {
    if (!companies.length) return null

    const priority = { high: 3, medium: 2, low: 1 }
    return [...companies].sort((left, right) => {
      const riskGap = (priority[right.forecastRisk7d] || 0) - (priority[left.forecastRisk7d] || 0)
      if (riskGap !== 0) return riskGap
      if ((right.forecastConfidence || 0) !== (left.forecastConfidence || 0)) {
        return (right.forecastConfidence || 0) - (left.forecastConfidence || 0)
      }
      return (right.mentions || 0) - (left.mentions || 0)
    })[0]
  }, [companies])
  const filteredCompanies = useMemo(() => {
    const priority = { high: 3, medium: 2, low: 1 }
    const filtered = companies.filter((company) =>
      companyRiskFilter === 'all' ? true : company.forecastRisk7d === companyRiskFilter,
    )

    return [...filtered].sort((left, right) => {
      if (companySortMode === 'mentions') {
        if ((right.mentions || 0) !== (left.mentions || 0)) return (right.mentions || 0) - (left.mentions || 0)
        return (right.lifetimeMentions || 0) - (left.lifetimeMentions || 0)
      }

      if (companySortMode === 'score') {
        return (right.score || 0) - (left.score || 0)
      }

      const riskGap = (priority[right.forecastRisk7d] || 0) - (priority[left.forecastRisk7d] || 0)
      if (riskGap !== 0) return riskGap
      if ((right.forecastConfidence || 0) !== (left.forecastConfidence || 0)) {
        return (right.forecastConfidence || 0) - (left.forecastConfidence || 0)
      }
      return (right.mentions || 0) - (left.mentions || 0)
    })
  }, [companies, companyRiskFilter, companySortMode])
  const companyPageSize = 8
  const totalCompanyPages = Math.max(1, Math.ceil(filteredCompanies.length / companyPageSize))
  const paginatedCompanies = useMemo(() => {
    const safePage = Math.min(companyPage, totalCompanyPages)
    const startIndex = (safePage - 1) * companyPageSize
    return filteredCompanies.slice(startIndex, startIndex + companyPageSize)
  }, [companyPage, filteredCompanies, totalCompanyPages])
  const chatContextKey = activeView === 'companies' && selectedCompany?.name ? `company:${selectedCompany.name}` : 'overview'
  const activeNavItem = nav.find((item) => item.id === activeView) || nav[0]
  const sourceCategories = useMemo(
    () => [...new Set(sources.map((item) => item.category).filter(Boolean))],
    [sources],
  )
  const sourceRoster = useMemo(() => {
    return [...sources].sort((left, right) => {
      if (left.lastCrawledAt && right.lastCrawledAt) {
        return new Date(right.lastCrawledAt).getTime() - new Date(left.lastCrawledAt).getTime()
      }
      if (left.lastCrawledAt) return -1
      if (right.lastCrawledAt) return 1
      return left.name.localeCompare(right.name, 'vi')
    })
  }, [sources])
  const sourcePreview = useMemo(() => sourceRoster.slice(0, 5), [sourceRoster])
  const companyRoster = useMemo(() => {
    const priority = { high: 3, medium: 2, low: 1 }
    return [...companies].sort((left, right) => {
      const riskGap = (priority[right.forecastRisk7d] || 0) - (priority[left.forecastRisk7d] || 0)
      if (riskGap !== 0) return riskGap
      if ((right.forecastConfidence || 0) !== (left.forecastConfidence || 0)) {
        return (right.forecastConfidence || 0) - (left.forecastConfidence || 0)
      }
      return (right.mentions || 0) - (left.mentions || 0)
    })
  }, [companies])
  const recentlyCrawledSources = useMemo(
    () => sourceRoster.filter((item) => item.lastCrawledAt).length,
    [sourceRoster],
  )
  const latestCrawledSource = sourceRoster.find((item) => item.lastCrawledAt) || null
  const highRiskCompaniesCount = useMemo(
    () => companyRoster.filter((item) => item.forecastRisk7d === 'high').length,
    [companyRoster],
  )
  const earlyForecasts = useMemo(() => {
    const googleSignals = (googleTrends.items || [])
      .slice(0, 5)
      .map(buildTrendForecast)
      .sort((left, right) => right.confidence - left.confidence)
    const youtubeSignal = buildYoutubeForecast(companies)

    return [youtubeSignal, ...googleSignals].filter(Boolean).slice(0, 6)
  }, [companies, googleTrends.items])

  function isExpanded(sectionId) {
    return Boolean(expandedSections[sectionId])
  }

  function toggleExpanded(sectionId) {
    setExpandedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }))
  }

  async function getJson(path) {
    const response = await fetch(`${apiBaseUrl}${path}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || `Request failed: ${path}`)
    return data
  }

  async function loadSourceRoster() {
    setSourceStatus('loading')

    try {
      const sourceData = await getJson('/sources')
      let items = sourceData.items || []

      if (!items.length) {
        const fallbackData = await getJson('/crawler/sources')
        items = fallbackData.items || []
      }

      setSources(items.map(normalizeSourceItem))
      setSourceStatus('success')
    } catch {
      try {
        const fallbackData = await getJson('/crawler/sources')
        setSources((fallbackData.items || []).map(normalizeSourceItem))
        setSourceStatus('success')
      } catch {
        setSources([])
        setSourceStatus('error')
      }
    }
  }

  async function loadData() {
    try {
      setLoading(true)
      setError('')
      const [overviewData, companiesData, alertsData] = await Promise.all([
        getJson('/overview'),
        getJson('/companies'),
        getJson('/alerts'),
        loadSourceRoster(),
      ])
      setOverview(overviewData)
      setCompanies(companiesData.items || [])
      setAlerts(alertsData.items || [])
      if (!selectedCompanyKey && companiesData.items?.length) {
        setSelectedCompanyKey(companiesData.items[0].key)
      }
      if (!selectedAlertId && alertsData.items?.length) {
        setSelectedAlertId(alertsData.items[0].id)
      }
      if (!watchlistKeys.length && companiesData.items?.length) {
        setWatchlistKeys(companiesData.items.slice(0, 3).map((item) => item.key))
      }
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  function mergeExplanationIntoCompany(company, result) {
    if (!company || Number(company.entityId) !== Number(result.entityId)) return company

    return {
      ...company,
      explain: result.explain,
      explainability: result.explainability || company.explainability,
    }
  }

  function applyCompanyExplanation(result) {
    setCompanies((current) => current.map((company) => mergeExplanationIntoCompany(company, result)))
    setAlerts((current) => current.map((alert) => {
      if (Number(alert.entityId || 0) !== Number(result.entityId)) return alert
      return {
        ...alert,
        explain: result.explain,
        explainability: result.explainability || alert.explainability,
      }
    }))
    setOverview((current) => {
      if (!current) return current
      return {
        ...current,
        topCompany: mergeExplanationIntoCompany(current.topCompany, result),
        latestAlerts: (current.latestAlerts || []).map((alert) => {
          if (Number(alert.entityId || 0) !== Number(result.entityId)) return alert
          return {
            ...alert,
            explain: result.explain,
            explainability: result.explainability || alert.explainability,
          }
        }),
      }
    })
  }

  async function handleExplainScore(item) {
    const entityId = item?.entityId
    if (!entityId) return

    try {
      setExplainStatusByEntity((current) => ({ ...current, [entityId]: 'loading' }))
      setExplainErrorByEntity((current) => ({ ...current, [entityId]: '' }))
      const response = await fetch(`${apiBaseUrl}/companies/${entityId}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Score explanation failed')
      applyCompanyExplanation(data)
      setExplainStatusByEntity((current) => ({ ...current, [entityId]: 'success' }))
    } catch (explainError) {
      setExplainStatusByEntity((current) => ({ ...current, [entityId]: 'error' }))
      setExplainErrorByEntity((current) => ({
        ...current,
        [entityId]: explainError.message || 'Không thể tạo giải thích score',
      }))
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  // `loadData` intentionally runs on initial mount; later refreshes are explicit user actions.
  useEffect(() => {
    loadData()
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    setChatMessages([createWelcomeMessage(chatContextKey)])
    setAiQuestion('')
    setAiError('')
    setAiStatus('idle')
  }, [chatContextKey])

  useEffect(() => {
    setCompanyPage(1)
  }, [companyRiskFilter, companySortMode])

  useEffect(() => {
    setMobileNavOpen(false)
    setCompanyPanelOpen(false)
    setSourcePanelOpen(false)
  }, [activeView])

  useEffect(() => {
    if (companyPage > totalCompanyPages) {
      setCompanyPage(totalCompanyPages)
    }
  }, [companyPage, totalCompanyPages])

  useEffect(() => {
    const trimmedQuery = searchQuery.trim()

    if (trimmedQuery.length < 2) {
      setSearchResults({ companies: [], alerts: [], articles: [] })
      setSearchStatus('idle')
      return undefined
    }

    const timeoutId = setTimeout(async () => {
      try {
        setSearchStatus('loading')
        const response = await fetch(`${apiBaseUrl}/search?q=${encodeURIComponent(trimmedQuery)}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Search request failed')
        }

        setSearchResults({
          companies: data.companies || [],
          alerts: data.alerts || [],
          articles: data.articles || [],
        })
        setSearchStatus('success')
      } catch {
        setSearchResults({ companies: [], alerts: [], articles: [] })
        setSearchStatus('error')
      }
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [apiBaseUrl, searchQuery])

  function handleSelectCompanyFromSearch(companyKey) {
    setSelectedCompanyKey(companyKey)
    setActiveView('companies')
    setSearchQuery('')
    setSearchResults({ companies: [], alerts: [], articles: [] })
    setSearchStatus('idle')
  }

  function handleSelectAlertFromSearch(alertId) {
    setSelectedAlertId(alertId)
    setActiveView('alerts')
    setSearchQuery('')
    setSearchResults({ companies: [], alerts: [], articles: [] })
    setSearchStatus('idle')
  }

  function toggleWatchlist(companyKey) {
    setWatchlistKeys((current) => {
      if (current.includes(companyKey)) {
        return current.filter((key) => key !== companyKey)
      }

      return [...current, companyKey].slice(-3)
    })
  }

  function clearSearch() {
    setSearchQuery('')
    setSearchResults({ companies: [], alerts: [], articles: [] })
    setSearchStatus('idle')
  }

  function handleChangeView(viewId) {
    setActiveView(viewId)
  }

  async function handleRunCrawler() {
    try {
      setCrawlStatus('loading')
      setError('')
      const response = await fetch(`${apiBaseUrl}/crawler/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}),
        },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Crawler run failed')
      setCrawlStatus('success')
      await loadData()
    } catch (crawlError) {
      setCrawlStatus('error')
      setError(crawlError.message || 'Crawler run failed')
    }
  }

  function renderSourceSheet() {
    return (
      <div className="fixed inset-0 z-50 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.18))] backdrop-blur-[4px]">
        <div className="absolute inset-y-4 right-4 flex w-[min(760px,calc(100vw-32px))] flex-col overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,251,255,0.96),rgba(252,244,251,0.94))] shadow-[0_44px_120px_-40px_rgba(15,23,42,0.48)]">
          <div className="border-b border-white/80 bg-[linear-gradient(90deg,rgba(240,249,255,0.96),rgba(236,254,255,0.92),rgba(250,245,255,0.9),rgba(255,237,213,0.88))] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Source roster</p>
                <p className="font-display mt-2 text-3xl font-semibold tracking-tight text-slate-950">Tracked sources</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Feed roster cho crawler: category, domain, endpoint và lần crawl gần nhất.
                </p>
              </div>
              <button type="button" onClick={() => setSourcePanelOpen(false)} className="rounded-2xl border border-white bg-white/80 p-2 text-slate-500 shadow-sm">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.18)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Total feeds</p>
                <p className="font-display mt-3 text-3xl font-semibold tracking-tight text-slate-950">{sourceRoster.length || overview?.metrics?.trackedSources || 0}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Configured sources currently visible to the dashboard.</p>
              </div>
              <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.18)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Categories</p>
                <p className="font-display mt-3 text-3xl font-semibold tracking-tight text-slate-950">{sourceCategories.length}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Coverage spans business, finance, enterprise and market desks.</p>
              </div>
              <div className="rounded-[24px] border border-white/80 bg-white/80 px-4 py-4 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.18)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Last active feed</p>
                <p className="mt-3 text-sm font-semibold text-slate-950">{latestCrawledSource?.name || 'Configured only'}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {latestCrawledSource?.lastCrawledAt ? `Crawled ${formatDate(latestCrawledSource.lastCrawledAt)}` : 'No crawl timestamp yet.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-white/70 px-5 py-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">{recentlyCrawledSources} crawled</Badge>
              <Badge tone="default">{sourceCategories.length} categories</Badge>
              <Badge tone="positive">{sourceRoster.filter((item) => item.platform !== 'youtube').length} RSS links</Badge>
              <Badge tone="warning">{sourceRoster.filter((item) => item.platform === 'youtube').length} YouTube sources</Badge>
            </div>
            <button
              type="button"
              onClick={loadSourceRoster}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5"
            >
              <RefreshCcw className="size-4" />
              Reload roster
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {sourceStatus === 'loading' ? (
              <div className="flex h-full min-h-52 items-center justify-center rounded-[28px] border border-dashed border-slate-200/80 bg-white/70">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading source roster...
                </div>
              </div>
            ) : sourceRoster.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {sourceRoster.map((source) => (
                  <div key={source.key} className="rounded-[28px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(240,249,255,0.92),rgba(255,247,237,0.84))] p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.18)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-950">{source.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{source.category.replace(/-/g, ' ')}</p>
                      </div>
                      <Badge tone={source.lastCrawledAt ? 'positive' : 'default'}>
                        {source.lastCrawledAt ? 'Live' : 'Configured'}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                          <Globe className="size-3.5" />
                          Site
                        </div>
                        <a href={source.siteUrl || '#'} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950">
                          {formatSourceDomain(source.siteUrl)}
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>

                      <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                          <RadioTower className="size-3.5" />
                          {source.platform === 'youtube' ? 'Discovery endpoint' : 'Feed endpoint'}
                        </div>
                        <a href={source.rssUrl || '#'} target="_blank" rel="noreferrer" className="mt-2 block truncate text-sm font-medium text-slate-700 hover:text-slate-950">
                          {source.rssUrl || 'No RSS URL'}
                        </a>
                      </div>

                      {source.platform === 'youtube' && source.query ? (
                        <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">YouTube query</p>
                          <p className="mt-2 text-sm font-medium text-slate-700">{source.query}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge tone="default">{source.language?.toUpperCase() || 'VI'}</Badge>
                      <Badge tone={source.platform === 'youtube' ? 'warning' : 'info'}>{source.platform === 'youtube' ? 'YouTube' : 'RSS'}</Badge>
                      {source.lastCrawledAt ? <Badge tone="info">Seen {formatDate(source.lastCrawledAt)}</Badge> : null}
                      {source.configuredOnly ? <Badge tone="warning">Awaiting next crawl</Badge> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-52 items-center justify-center rounded-[28px] border border-dashed border-slate-200/80 bg-white/70 px-6 text-center">
                <div>
                  <p className="font-display text-2xl font-semibold text-slate-950">No sources loaded</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Không lấy được source roster từ backend ở lần gọi này.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  function renderCompanySheet() {
    return (
      <div className="fixed inset-0 z-50 bg-[linear-gradient(180deg,rgba(15,23,42,0.14),rgba(15,23,42,0.24))] backdrop-blur-[5px]">
        <div className="absolute inset-y-4 right-4 flex w-[min(820px,calc(100vw-32px))] flex-col overflow-hidden rounded-[34px] border border-white/20 bg-[linear-gradient(180deg,rgba(17,24,39,0.88),rgba(17,24,39,0.82),rgba(6,78,59,0.64),rgba(30,64,175,0.52))] text-white shadow-[0_46px_120px_-40px_rgba(15,23,42,0.58)]">
          <div className="border-b border-white/12 bg-[linear-gradient(90deg,rgba(30,41,59,0.92),rgba(12,74,110,0.76),rgba(190,24,93,0.44),rgba(217,119,6,0.34))] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Entity roster</p>
                <p className="font-display mt-2 text-3xl font-semibold tracking-tight text-white">Tracked companies</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                  Universe công ty đang được theo dõi. Chạm vào item để mở detail trong tab `Companies`.
                </p>
              </div>
              <button type="button" onClick={() => setCompanyPanelOpen(false)} className="rounded-2xl border border-white/20 bg-white/10 p-2 text-white/70 shadow-sm transition hover:bg-white/15">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Total tracked</p>
                <p className="font-display mt-3 text-3xl font-semibold tracking-tight text-white">{companyRoster.length || overview?.metrics?.trackedCompanies || 0}</p>
                <p className="mt-2 text-xs leading-5 text-white/62">Current company universe visible to the analyst.</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">High forecast</p>
                <p className="font-display mt-3 text-3xl font-semibold tracking-tight text-white">{highRiskCompaniesCount}</p>
                <p className="mt-2 text-xs leading-5 text-white/62">Entities needing tighter watch in the next 7 days.</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Lead company</p>
                <p className="mt-3 text-sm font-semibold text-white">{companyRoster[0]?.name || 'No company loaded'}</p>
                <p className="mt-2 text-xs leading-5 text-white/62">
                  {companyRoster[0] ? `${companyRoster[0].mentions || 0} mentions, ${formatForecastLabel(companyRoster[0].forecastRisk7d)} forecast` : 'Load analytics to see the roster.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-white/12 px-5 py-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="negative">{highRiskCompaniesCount} high 7d</Badge>
              <Badge tone="info">{watchlistKeys.length} watchlist</Badge>
              <Badge tone="default">{companyRoster.reduce((sum, item) => sum + (item.mentions || 0), 0)} mentions / 7d</Badge>
            </div>
            <button
              type="button"
              onClick={() => {
                setCompanyPanelOpen(false)
                setActiveView('companies')
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/16 bg-white/10 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-white/14"
            >
              <BriefcaseBusiness className="size-4" />
              Open Companies
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {companyRoster.map((company, index) => (
                <button
                  key={company.key}
                  type="button"
                  onClick={() => {
                    setSelectedCompanyKey(company.key)
                    setCompanyPanelOpen(false)
                    setActiveView('companies')
                  }}
                  className="group rounded-[28px] border border-white/14 bg-[linear-gradient(145deg,rgba(255,255,255,0.1),rgba(255,255,255,0.06),rgba(255,255,255,0.04))] p-4 text-left shadow-[0_18px_40px_-30px_rgba(15,23,42,0.4)] transition hover:-translate-y-1 hover:border-white/24 hover:bg-[linear-gradient(145deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08),rgba(255,255,255,0.06))]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">#{String(index + 1).padStart(2, '0')}</p>
                      <p className="mt-2 text-lg font-semibold text-white">{company.name}</p>
                      <p className="mt-1 text-sm text-white/58">{company.industry || 'Tracked entity'}</p>
                    </div>
                    <Badge tone={toneForSeverity(company.forecastRisk7d)}>7d {formatForecastLabel(company.forecastRisk7d)}</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Score</p>
                      <p className="mt-2 text-xl font-semibold text-white">{company.score}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Mentions</p>
                      <p className="mt-2 text-xl font-semibold text-white">{company.mentions}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Confidence</p>
                      <p className="mt-2 text-xl font-semibold text-white">{company.forecastConfidence || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge tone="info">{company.sourceCount || 0} sources</Badge>
                    <Badge tone="default">{company.lifetimeMentions || 0} lifetime</Badge>
                    {company.topTopics?.[0] ? <Badge tone="positive">{company.topTopics[0]}</Badge> : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="line-clamp-2 text-sm leading-6 text-white/68">
                      {company.forecastSummary || company.summary || 'Open company detail to inspect current evidence and article-level signals.'}
                    </p>
                    <ChevronRight className="size-4 shrink-0 text-white/46 transition group-hover:translate-x-0.5 group-hover:text-white/72" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  async function handleAskAi() {
    try {
      const trimmedQuestion = aiQuestion.trim()
      if (trimmedQuestion.length < 3) {
        return
      }

      setAiStatus('loading')
      setAiError('')

      const shouldUseCompanyContext = activeView === 'companies' && selectedCompany?.name
      const question = shouldUseCompanyContext
        ? `${trimmedQuestion}\n\nCông ty đang được người dùng xem chi tiết: ${selectedCompany.name}. Hãy ưu tiên phân tích công ty này.`
        : trimmedQuestion
      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmedQuestion,
        references: [],
      }
      const history = [...chatMessages, userMessage].map((item) => ({
        role: item.role,
        content: item.content,
      }))

      setChatMessages((current) => [...current, userMessage])
      setAiQuestion('')

      const response = await fetch(`${apiBaseUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          limit: 8,
          locale: 'vi-VN',
          contextMode: shouldUseCompanyContext ? 'company' : 'overview',
          companyName: shouldUseCompanyContext ? selectedCompany.name : undefined,
          entityId: shouldUseCompanyContext ? selectedCompany.entityId : undefined,
          history,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'AI request failed')

      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.answer || '',
          references: data.references || [],
        },
      ])
      setAiStatus('success')
      setAssistantOpen(true)
    } catch (requestError) {
      setAiStatus('error')
      setAiError(requestError.message || 'AI request failed')
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'Không thể lấy phản hồi từ AI ở thời điểm này. Vui lòng thử lại sau.',
          references: [],
        },
      ])
      setAssistantOpen(true)
    }
  }

  function renderNavButtons(mode = 'desktop') {
    const isCompact = mode === 'compact'
    const isDrawer = mode === 'drawer'

    return nav.map((item) => (
      <button
        key={`${mode}-${item.id}`}
        type="button"
        onClick={() => handleChangeView(item.id)}
        className={
          isCompact
            ? `inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
                activeView === item.id
                  ? 'border-slate-900 bg-slate-950 text-white shadow-[0_16px_34px_-22px_rgba(15,23,42,0.48)]'
                  : 'border-slate-200/80 bg-white/80 text-slate-600'
              }`
            : `w-full rounded-[24px] border px-4 py-3 text-left transition ${
                activeView === item.id
                  ? 'border-slate-900/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94),rgba(71,85,105,0.92))] text-white shadow-[0_26px_50px_-34px_rgba(15,23,42,0.65)]'
                  : 'border-transparent bg-white/40 text-slate-600 hover:border-slate-200/80 hover:bg-white/70'
              } ${isDrawer ? 'backdrop-blur' : ''}`
        }
      >
        <div className="flex items-center gap-3">
          <item.icon className={isCompact ? 'size-3.5' : 'size-4'} />
          <span className={isCompact ? '' : 'text-sm font-medium'}>{item.label}</span>
        </div>
        {!isCompact ? (
          <p className={`mt-2 text-xs leading-5 ${activeView === item.id ? 'text-white/70' : 'text-slate-400'}`}>
            {item.description}
          </p>
        ) : null}
      </button>
    ))
  }

  function renderSearchResultsPanel(className) {
    if (searchQuery.trim().length < 2) return null

    return (
      <div className={className}>
        {searchStatus === 'loading' ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-slate-500">
            <LoaderCircle className="size-4 animate-spin" />
            Searching...
          </div>
        ) : null}

        {searchStatus !== 'loading' ? (
          <div className="space-y-4">
            {searchResults.companies.length ? (
              <div>
                <p className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Companies</p>
                <div className="mt-2 space-y-2">
                  {searchResults.companies.map((company) => (
                    <button
                      key={company.key}
                      type="button"
                      onClick={() => handleSelectCompanyFromSearch(company.key)}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(240,249,255,0.92),rgba(250,245,255,0.86))] px-3 py-3 text-left transition hover:border-sky-200 hover:bg-[linear-gradient(90deg,rgba(224,242,254,0.92),rgba(255,255,255,0.96),rgba(255,237,213,0.82))]"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{company.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{company.industry}</p>
                      </div>
                      <Badge tone={toneForSeverity(company.forecastRisk7d)}>7d {formatForecastLabel(company.forecastRisk7d)}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {searchResults.alerts.length ? (
              <div>
                <p className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Alerts</p>
                <div className="mt-2 space-y-2">
                  {searchResults.alerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => handleSelectAlertFromSearch(alert.id)}
                      className="flex w-full items-start justify-between rounded-2xl border border-slate-200 bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(255,247,237,0.92),rgba(255,228,230,0.84))] px-3 py-3 text-left transition hover:border-sky-200 hover:bg-[linear-gradient(90deg,rgba(255,241,242,0.92),rgba(255,255,255,0.96),rgba(255,237,213,0.82))]"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{alert.companyName}</p>
                      </div>
                      <Badge tone={toneForSeverity(alert.forecastRisk7d || alert.severity)}>
                        {formatForecastLabel(alert.forecastRisk7d || alert.severity)}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {searchResults.articles.length ? (
              <div>
                <p className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Headlines</p>
                <div className="mt-2 space-y-2">
                  {searchResults.articles.map((article) => (
                    <a
                      key={article.id}
                      href={article.article_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-slate-200 bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(240,249,255,0.9),rgba(255,247,237,0.84))] px-3 py-3 transition hover:border-sky-200 hover:bg-[linear-gradient(90deg,rgba(224,242,254,0.92),rgba(255,255,255,0.96),rgba(255,237,213,0.82))]"
                    >
                      <p className="text-sm font-medium text-slate-900">{article.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{article.source_name}</p>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {!searchResults.companies.length && !searchResults.alerts.length && !searchResults.articles.length ? (
              <div className="px-2 py-3 text-sm text-slate-500">No company, alert, or headline matched this query.</div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  function renderActionablePanel(item) {
    if (!item?.actionable) return null

    return (
      <div className="rounded-3xl border border-amber-100 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.96),rgba(255,237,213,0.86))] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Actionable output</p>
          <Badge tone="warning">Analyst brief</Badge>
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Why this matters</p>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{item.actionable.whyThisMatters}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">What changed</p>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{item.actionable.whatChanged24h}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Recommended action</p>
            <p className="mt-2 line-clamp-2 text-sm leading-6 font-medium text-slate-800">{item.actionable.recommendedAction}</p>
          </div>
        </div>
      </div>
    )
  }

  function renderScoreExplainPanel(item, options = {}) {
    const scoreExplain = item?.explain || item?.explainability?.scoreExplain
    const scoreFactors = (item?.explainability?.scoreFactors || []).slice(0, options.limit || 3)
    const entityId = item?.entityId
    const explainStatus = entityId ? explainStatusByEntity[entityId] : 'idle'
    const explainError = entityId ? explainErrorByEntity[entityId] : ''
    const isLoadingExplain = explainStatus === 'loading'

    if (!scoreExplain && !scoreFactors.length && !entityId) return null

    return (
      <div className={`rounded-3xl border border-cyan-100 bg-[linear-gradient(135deg,rgba(236,254,255,0.92),rgba(255,255,255,0.96),rgba(240,249,255,0.88))] px-4 py-4 ${options.className || ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{options.title || 'Score'}</p>
          <div className="flex flex-wrap items-center gap-2">
            {item?.score != null ? <Badge tone={toneForScore(item.score)}>Score {item.score}</Badge> : null}
            {entityId ? (
              <button
                type="button"
                onClick={() => handleExplainScore(item)}
                disabled={isLoadingExplain}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-800 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {isLoadingExplain ? <LoaderCircle className="size-3.5 animate-spin" /> : <WandSparkles className="size-3.5" />}
                {scoreExplain ? 'Refresh' : 'Explain'}
              </button>
            ) : null}
          </div>
        </div>
        {scoreExplain ? (
          <p className="mt-3 text-sm leading-7 text-slate-700">{scoreExplain}</p>
        ) : (
          <p className="hidden">
            Lý do score chưa được tạo tự động. Bấm Explain để LLM sinh giải thích dựa trên evidence hiện tại.
          </p>
        )}
        {scoreFactors.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {scoreFactors.map((factor) => (
              <Badge key={`${item?.key || item?.id || item?.companyKey || 'score'}-${factor}`} tone="default">{factor}</Badge>
            ))}
          </div>
        ) : null}
        {explainError ? <p className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{explainError}</p> : null}
      </div>
    )
  }

  function renderWhatChangedPanel(data, options = {}) {
    const block = data?.whatChanged || data?.intelligence?.whatChanged
    if (!block) return null

    return (
      <div className={`rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,rgba(240,249,255,0.95),rgba(255,255,255,0.96),rgba(224,242,254,0.88))] px-4 py-4 ${options.className || ''}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{options.title || 'What changed'}</p>
          {options.badge ? <Badge tone={options.badgeTone || 'info'}>{options.badge}</Badge> : null}
        </div>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-900">{block.headline}</p>
        {options.showBullets && (block.bullets || []).length ? (
          <div className="mt-4 space-y-2">
            {block.bullets.slice(0, options.limit || 3).map((bullet) => (
              <div key={`${options.title || 'what-changed'}-${bullet}`} className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 text-sm leading-6 text-slate-600">
                {bullet}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  function renderSourceSplitPanel(data, options = {}) {
    const items = data?.sourceSplit || data?.explainability?.sourceSplit || data?.intelligence?.sourceSplit || []
    if (!items.length) return null

    return (
      <div className={`rounded-3xl border border-amber-100 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.96),rgba(255,237,213,0.88))] px-4 py-4 ${options.className || ''}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{options.title || 'Source mix'}</p>
          <Badge tone="warning">{items.length} channels</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.slice(0, options.limit || 4).map((item) => (
            <div key={`${item.channel}-${item.label}`} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.sourceCount || 0} sources</p>
                </div>
                <Badge tone={item.negativeShare >= 40 ? 'warning' : 'info'}>{item.share}% share</Badge>
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="font-display text-2xl font-semibold text-slate-950">{item.mentions || 0}</p>
                  <p className="text-xs text-slate-500">mentions</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{item.negativeShare || 0}%</p>
                  <p className="text-xs text-slate-500">negative within channel</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderGoogleTrendsPanel(options = {}) {
    const items = googleTrends.items || []

    return (
      <div className={`rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.94),rgba(255,255,255,0.96),rgba(240,249,255,0.88))] px-4 py-4 ${options.className || ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              <TrendingUp className="size-3.5" />
              Hot Trends
            </p>
            <p className="hidden">Static Google Trends seed.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="positive">{items.length || 0} keywords</Badge>
            <Badge tone="default">Hardcoded</Badge>
          </div>
        </div>

        {trendStatus === 'loading' && !items.length ? (
          <div className="mt-4 flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-emerald-100 bg-white/60 text-sm text-slate-500">
            <LoaderCircle className="mr-2 size-4 animate-spin" />
            Loading Google Trends...
          </div>
        ) : null}

        {trendStatus === 'error' && !items.length ? (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            Chưa lấy được Google Trends ở lần gọi này. Dashboard vẫn dùng news và YouTube comments như bình thường.
          </div>
        ) : null}

        {items.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {items.slice(0, options.limit || 8).map((trend) => (
              <a
                key={trend.id}
                href={`https://trends.google.com/trends/explore?geo=VN&q=${encodeURIComponent(trend.keyword)}`}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl border border-white/80 bg-white/75 px-3 py-3 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">
                      #{trend.rank} {trend.keyword}
                    </p>
                    {trend.relatedQueries?.length ? (
                      <p className="mt-2 line-clamp-1 text-xs text-slate-500">{trend.relatedQueries.join(' · ')}</p>
                    ) : null}
                  </div>
                  <Badge tone="positive">{trend.traffic || 'Trend'}</Badge>
                </div>
                {trend.articles?.[0] ? (
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">
                    {trend.articles[0].source ? `${trend.articles[0].source}: ` : ''}{trend.articles[0].title}
                  </p>
                ) : null}
              </a>
            ))}
          </div>
        ) : null}

        {trendStatus === 'footer' && (googleTrends.fetchedAt || googleTrends.sourceUrl) ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>{googleTrends.fetchedAt ? `Fetched ${formatDate(googleTrends.fetchedAt)}` : 'Live source'}</span>
            {googleTrends.sourceUrl ? (
              <a href={googleTrends.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-800">
                Open Trends
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  function renderEarlyForecastPanel(options = {}) {
    const items = earlyForecasts.slice(0, options.limit || 6)
    if (!items.length) return null

    return (
      <div className={`rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.96),rgba(236,253,245,0.86))] px-4 py-4 ${options.className || ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            <RadioTower className="size-3.5" />
            Early signals
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Google + YouTube</Badge>
            <Badge tone="warning">{items.length} forecasts</Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/80 bg-white/75 px-4 py-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.18)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{item.source}</p>
                  <p className="mt-2 truncate text-sm font-semibold text-slate-950">{item.signal}</p>
                </div>
                <Badge tone={item.tone}>{item.impact}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700">{item.forecast}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <Badge tone="default">{item.theme}</Badge>
                <Badge tone="info">{item.confidence}% conf</Badge>
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{item.action}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderNarrativePanel(data, options = {}) {
    const narrative = data?.narrative || data?.intelligence?.topNarrative
    if (!narrative) return null

    return (
      <div className={`rounded-3xl border border-fuchsia-100 bg-[linear-gradient(135deg,rgba(250,245,255,0.96),rgba(255,255,255,0.96),rgba(255,241,242,0.84))] px-4 py-4 ${options.className || ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{options.title || 'Dominant narrative'}</p>
          <div className="flex flex-wrap gap-2">
            {narrative.companyName ? <Badge tone="info">{narrative.companyName}</Badge> : null}
            {narrative.pressure ? <Badge tone={narrative.pressure.includes('downside') ? 'negative' : 'warning'}>{narrative.pressure}</Badge> : null}
          </div>
        </div>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-900">{narrative.title}</p>
        <p className="mt-2 text-sm leading-7 text-slate-600">{narrative.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {narrative.leadTopic ? <Badge tone="default">{narrative.leadTopic}</Badge> : null}
          {narrative.leadSource ? <Badge tone="default">{narrative.leadSource}</Badge> : null}
          {narrative.leadChannel ? <Badge tone="default">{narrative.leadChannel}</Badge> : null}
          {narrative.negativeSignals != null ? <Badge tone="warning">{narrative.negativeSignals} negative signals</Badge> : null}
        </div>
      </div>
    )
  }

  function _renderEvidencePanelLegacy(item) {
    if (!item?.explainability) return null

    const evidence = item.explainability
    const keyArticles = (evidence.negativeArticles?.length ? evidence.negativeArticles : evidence.keyArticles || []).slice(0, 2)
    const topSources = (evidence.sourceContributions || []).slice(0, 3)

    return (
      <div className="rounded-3xl border border-fuchsia-100 bg-[linear-gradient(135deg,rgba(250,245,255,0.96),rgba(255,255,255,0.96),rgba(224,242,254,0.84))] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Evidence and explainability</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Model confidence {evidence.averageModelConfidence}</Badge>
            <Badge tone="warning">Negative ratio {formatPercent(evidence.negativeRatio)}</Badge>
            {evidence.strongestSource ? <Badge tone="default">Strongest source {evidence.strongestSource}</Badge> : null}
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Articles pulling the score</p>
              <div className="mt-3 space-y-3">
                {keyArticles.map((article) => (
                  <a
                    key={`${item.key || item.id}-${article.id}-${article.title}`}
                    href={article.articleUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,241,242,0.84),rgba(255,247,237,0.82))] px-4 py-3 transition hover:border-sky-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{article.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {article.sourceName} • {formatDate(article.publishedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={article.sentimentSignal < 0 ? 'negative' : 'info'}>Signal {article.sentimentSignal}</Badge>
                        <Badge tone="info">Confidence {article.modelConfidence}</Badge>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{article.negativeSnippet}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Top contributing sources</p>
              <div className="mt-3 space-y-2">
                {topSources.map((source) => (
                  <div key={`${item.key || item.id}-${source.sourceKey}`} className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{source.sourceName}</p>
                      <Badge tone={source.negativeCount > 0 ? 'warning' : 'default'}>{source.mentionCount} mentions</Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {source.negativeCount} negative • impact {source.weightedImpact} • confidence {source.averageConfidence}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">What the model is seeing</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(item.topTopics || []).map((topic) => (
                  <Badge key={`${item.key || item.id}-${topic}`} tone="default">{topic}</Badge>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {(evidence.scoreBreakdown || []).map((driver) => (
                  <div key={`${item.key || item.id}-${driver.label}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                    <p className="text-sm text-slate-600">{driver.label}</p>
                    <Badge tone={driver.direction === 'negative' ? 'negative' : driver.direction === 'positive' ? 'positive' : 'default'}>
                      {driver.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">24h change log</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">{evidence.changes24h?.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="default">Now {evidence.changes24h?.last24hMentions || 0}</Badge>
                <Badge tone="default">Prev {evidence.changes24h?.previous24hMentions || 0}</Badge>
                <Badge tone={Number(evidence.changes24h?.negativeMentions24h || 0) > 0 ? 'warning' : 'info'}>
                  Negative {evidence.changes24h?.negativeMentions24h || 0}
                </Badge>
              </div>
            </div>

            {sourcePreview.length ? (
              <div className="mt-4 rounded-[26px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(240,249,255,0.84),rgba(255,247,237,0.76))] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Feed sketch</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">Các source đang được crawler theo dõi cho ingest hiện tại.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSourcePanelOpen(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-600"
                  >
                    Full roster
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sourcePreview.map((source) => (
                    <button
                      key={`source-preview-${source.key}`}
                      type="button"
                      onClick={() => setSourcePanelOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-[0_14px_26px_-22px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5"
                    >
                      <span className="font-medium">{source.name}</span>
                      <span className="text-xs uppercase tracking-[0.14em] text-slate-400">{source.category.replace(/-/g, ' ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  function renderEvidencePanel(item) {
    if (!item?.explainability) return null

    const evidence = item.explainability
    const keyArticles = (evidence.negativeArticles?.length ? evidence.negativeArticles : evidence.keyArticles || []).slice(0, 2)
    const topSources = (evidence.sourceContributions || []).slice(0, 3)
    const scoreDrivers = (evidence.scoreBreakdown || []).slice(0, 3)

    return (
      <div className="rounded-3xl border border-fuchsia-100 bg-[linear-gradient(135deg,rgba(250,245,255,0.96),rgba(255,255,255,0.96),rgba(224,242,254,0.84))] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Evidence and explainability</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Model confidence {evidence.averageModelConfidence}</Badge>
            <Badge tone="warning">Negative ratio {formatPercent(evidence.negativeRatio)}</Badge>
            {evidence.strongestSource ? <Badge tone="default">Strongest source {evidence.strongestSource}</Badge> : null}
          </div>
        </div>

        {evidence.scoreExplain ? (
          <div className="mt-4 rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Score explanation</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">{evidence.scoreExplain}</p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Articles pulling the score</p>
                <Badge tone="default">{keyArticles.length} items</Badge>
              </div>
              <div className="mt-3 space-y-2.5">
                {keyArticles.map((article) => (
                  <a
                    key={`${item.key || item.id}-${article.id}-${article.title}`}
                    href={article.articleUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,241,242,0.84),rgba(255,247,237,0.82))] px-4 py-3 transition hover:border-sky-200"
                  >
                    <div className="space-y-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{article.title}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <p className="min-w-0 text-xs text-slate-500">
                          {article.sourceName} • {formatDate(article.publishedAt)}
                        </p>
                        <div className="inline-flex flex-wrap gap-2 sm:flex-nowrap sm:justify-self-end">
                          <Badge tone={article.sentimentSignal < 0 ? 'negative' : 'info'}>Signal {article.sentimentSignal}</Badge>
                          <Badge tone="info">Conf {article.modelConfidence}</Badge>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{article.negativeSnippet}</p>
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">24h change log</p>
                <Badge tone="default">Now {evidence.changes24h?.last24hMentions || 0}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="default">Prev {evidence.changes24h?.previous24hMentions || 0}</Badge>
                <Badge tone={Number(evidence.changes24h?.negativeMentions24h || 0) > 0 ? 'warning' : 'info'}>
                  Negative {evidence.changes24h?.negativeMentions24h || 0}
                </Badge>
              </div>
              {evidence.changes24h?.summary ? (
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700">{evidence.changes24h.summary}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Top contributing sources</p>
                <Badge tone="default">{topSources.length} sources</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {topSources.map((source) => (
                  <div key={`${item.key || item.id}-${source.sourceKey}`} className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{source.sourceName}</p>
                      <Badge tone={source.negativeCount > 0 ? 'warning' : 'default'}>{source.mentionCount} mentions</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={source.negativeCount > 0 ? 'negative' : 'default'}>{source.negativeCount} negative</Badge>
                      <Badge tone="default">Impact {source.weightedImpact}</Badge>
                      <Badge tone="info">Conf {source.averageConfidence}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Forecast drivers</p>
                <Badge tone="default">{scoreDrivers.length} signals</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(item.topTopics || []).slice(0, 4).map((topic) => (
                  <Badge key={`${item.key || item.id}-${topic}`} tone="default">{topic}</Badge>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {scoreDrivers.map((driver) => (
                  <div key={`${item.key || item.id}-${driver.label}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                    <p className="text-sm text-slate-600">{driver.label}</p>
                    <Badge tone={driver.direction === 'negative' ? 'negative' : driver.direction === 'positive' ? 'positive' : 'default'}>
                      {driver.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderOverviewV2() {
    if (!overview) return null

    const metrics = [
      { label: 'Average Sentiment', value: `${overview.metrics.averageSentiment}/100`, note: 'Across tracked companies', tone: 'info' },
      { label: 'Active Alerts', value: overview.metrics.activeAlerts, note: 'Need analyst review', tone: 'warning' },
      {
        label: 'Tracked Companies',
        value: overview.metrics.trackedCompanies,
        note: companyRoster.length ? 'Open company roster' : 'Tracked entity universe',
        tone: 'warning',
        onClick: () => setCompanyPanelOpen(true),
        addon: (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
            Inspect
            <ChevronRight className="size-3.5" />
          </span>
        ),
      },
      {
        label: 'Tracked Sources',
        value: overview.metrics.trackedSources,
        note: sourceRoster.length ? 'Open feed roster' : 'Source roster preview',
        tone: 'info',
        onClick: () => setSourcePanelOpen(true),
        addon: (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
            Inspect
            <ChevronRight className="size-3.5" />
          </span>
        ),
      },
    ]

    return (
      <div className="space-y-5">
        <div className="space-y-4 border-b border-slate-200/80 pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-[clamp(2.6rem,5vw,4.5rem)] leading-none font-semibold tracking-[-0.03em] text-slate-950">
                Overview
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                {topForecastCompany?.lastSeenAt ? `Latest snapshot ${formatDate(topForecastCompany.lastSeenAt)}` : 'Waiting for ingest snapshot'}
              </p>
            </div>
            {crawlerEnabled ? (
              <button
                type="button"
                onClick={handleRunCrawler}
                disabled={crawlStatus === 'loading'}
                className="animated-gradient self-start rounded-2xl bg-[linear-gradient(90deg,rgba(15,23,42,1),rgba(30,41,59,0.96),rgba(14,116,144,0.92),rgba(180,83,9,0.88))] px-4 py-3 text-sm font-medium text-white shadow-[0_18px_34px_-18px_rgba(15,23,42,0.6)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60"
              >
                {crawlStatus === 'loading' ? 'Running crawl...' : 'Run Crawl'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <StatCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              note={metric.note}
              tone={metric.tone}
              onClick={metric.onClick}
              addon={metric.addon}
            />
          ))}
        </div>

        {topForecastCompany ? (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="soft-glow animated-gradient float-card rounded-[28px] border border-white/75 bg-[linear-gradient(135deg,rgba(16,24,40,0.9),rgba(15,23,42,0.78),rgba(14,116,144,0.5),rgba(245,158,11,0.22))] p-5 text-white shadow-[0_26px_64px_-40px_rgba(15,23,42,0.4)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">Predicted risk spotlight</p>
                  <h3 className="font-display mt-2 text-3xl font-semibold tracking-tight text-white">{topForecastCompany.name}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-white/78">{topForecastCompany.forecastSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={toneForSeverity(topForecastCompany.forecastRisk24h)}>24h {formatForecastLabel(topForecastCompany.forecastRisk24h)}</Badge>
                  <Badge tone={toneForSeverity(topForecastCompany.forecastRisk7d)}>7d {formatForecastLabel(topForecastCompany.forecastRisk7d)}</Badge>
                  <Badge tone="info">Confidence {topForecastCompany.forecastConfidence}</Badge>
                </div>
              </div>
            </div>
            <div className="animated-gradient float-card rounded-[28px] border border-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,249,255,0.92),rgba(255,237,213,0.9))] p-5 shadow-[0_26px_64px_-40px_rgba(15,23,42,0.24)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Momentum</p>
                  <p className="font-display mt-3 text-3xl font-semibold tracking-tight text-slate-950">{topForecastCompany.last24hMentions || 0}</p>
                  <p className="mt-2 text-sm text-slate-500">mentions in 24h across {topForecastCompany.sourceCount || 0} sources</p>
                </div>
                <SparkBars
                  tone={toneForSeverity(topForecastCompany.forecastRisk7d)}
                  values={[
                    topForecastCompany.last24hMentions || 1,
                    Math.max(1, Math.round((topForecastCompany.mentions || 1) / 2)),
                    topForecastCompany.mentions || 1,
                    Math.max(1, Math.round((topForecastCompany.lifetimeMentions || 1) / 8)),
                    (topForecastCompany.forecastConfidence || 1) * 8,
                    topForecastCompany.negativeSignals || 1,
                  ]}
                />
              </div>
            </div>
          </div>
        ) : null}

        {renderEarlyForecastPanel({ limit: 6 })}

        {renderGoogleTrendsPanel({ limit: 8 })}

        {overview.intelligence ? (
          <div className="grid gap-4 xl:grid-cols-3">
            {renderWhatChangedPanel(overview.intelligence, { title: 'What changed since last crawl', badge: `${overview.metrics.activeAlerts} alerts`, badgeTone: 'warning' })}
            {renderSourceSplitPanel(overview.intelligence, { title: 'Source mix across coverage' })}
            {renderNarrativePanel(overview.intelligence, { title: 'Dominant market narrative' })}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel
            title={overview.topCompany ? `Top company: ${overview.topCompany.name}` : 'Top company'}
            description="Batch highlight"
            action={overview.topCompany ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Badge tone={toneForScore(overview.topCompany.score)}>{overview.topCompany.sentimentLabel}</Badge>
                <button
                  type="button"
                  onClick={() => handleExplainScore(overview.topCompany)}
                  disabled={explainStatusByEntity[overview.topCompany.entityId] === 'loading'}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-800 shadow-sm disabled:opacity-60"
                >
                  {explainStatusByEntity[overview.topCompany.entityId] === 'loading' ? <LoaderCircle className="size-3.5 animate-spin" /> : <WandSparkles className="size-3.5" />}
                  Explain
                </button>
              </div>
            ) : null}
          >
            {overview.topCompany ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-cyan-100 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(224,242,254,0.88))] px-4 py-3">
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-900">{overview.topCompany.score}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-[linear-gradient(135deg,rgba(255,247,237,0.95),rgba(254,243,199,0.84))] px-4 py-3">
                    <p className="text-xs text-slate-500">7d mentions</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-900">{overview.topCompany.mentions}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-100 bg-[linear-gradient(135deg,rgba(255,241,242,0.95),rgba(255,228,230,0.84))] px-4 py-3">
                    <p className="text-xs text-slate-500">Risk</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-900">{overview.topCompany.risk}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(209,250,229,0.84))] px-4 py-3">
                    <p className="text-xs text-slate-500">Lifetime</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-900">{overview.topCompany.lifetimeMentions}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-cyan-100 bg-[linear-gradient(135deg,rgba(224,242,254,0.92),rgba(255,255,255,0.96),rgba(255,237,213,0.92))] px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="info">{overview.topCompany.sourceCount} sources</Badge>
                    <Badge tone="default">{overview.topCompany.last24hMentions} / 24h</Badge>
                    <Badge tone={toneForSeverity(overview.topCompany.forecastRisk24h)}>24h {formatForecastLabel(overview.topCompany.forecastRisk24h)}</Badge>
                    <Badge tone={toneForSeverity(overview.topCompany.forecastRisk7d)}>7d {formatForecastLabel(overview.topCompany.forecastRisk7d)}</Badge>
                  </div>
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-700">{overview.topCompany.summary}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Topic</p>
                    <p className="mt-2 truncate text-sm font-semibold text-slate-900">{overview.topCompany.topTopics?.[0] || 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Channel</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{overview.topCompany.sourceSplit?.[0]?.label || 'News'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Confidence</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{overview.topCompany.forecastConfidence || 'N/A'}</p>
                  </div>
                </div>
                {renderScoreExplainPanel(overview.topCompany, { title: 'Score' })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
            )}
          </Panel>

          <Panel title="Latest alerts" description="Danh sách cần review ngay.">
            <div className="space-y-3">
              {(overview.latestAlerts || []).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,247,237,0.9),rgba(250,245,255,0.82))] px-4 py-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.22)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{alert.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone={toneForSeverity(alert.severity)}>{alert.severity}</Badge>
                        <Badge tone="default">{alert.lifetimeMentions} lifetime mentions</Badge>
                      </div>
                    </div>
                    <Badge tone={toneForSeverity(alert.severity)}>{alert.score}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Latest market coverage" description="Các bài mới nhất trong knowledge base.">
          <div className="grid gap-3 xl:grid-cols-3">
            {(overview.latestNews || []).map((article) => (
              <a
                key={article.id}
                href={article.article_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-orange-50/40 px-4 py-4 transition hover:border-sky-200 hover:shadow-[0_18px_40px_-28px_rgba(14,165,233,0.35)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="info">{article.source_name}</Badge>
                  <ChevronRight className="size-4 text-slate-400" />
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-900">{article.title}</p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{article.description_text}</p>
              </a>
            ))}
          </div>
        </Panel>
      </div>
    )
  }

  function _renderOverview() {
    if (!overview) return null

    const metrics = [
      ['Average Sentiment', `${overview.metrics.averageSentiment}/100`, 'Across tracked companies', 'info'],
      ['Tracked Companies', overview.metrics.trackedCompanies, 'Entity-driven company universe', 'default'],
      ['Active Alerts', overview.metrics.activeAlerts, 'Need analyst review', 'warning'],
      ['Tracked Sources', overview.metrics.trackedSources, 'Multi-source coverage', 'info'],
      ['Knowledge Base', overview.metrics.knowledgeBase, 'Historic mentions retained', 'positive'],
    ]

    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Market intelligence workspace</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Overview</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Trang điều hành tập trung vào tín hiệu mới nhất, vẫn giữ toàn bộ lịch sử đã ingest.
            </p>
          </div>
          <div className="flex gap-3">
              <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
            >
              <RefreshCcw className="size-4" />
              Refresh
            </button>
            {crawlerEnabled ? (
              <button
              type="button"
              onClick={handleRunCrawler}
              disabled={crawlStatus === 'loading'}
              className="animated-gradient rounded-2xl bg-[linear-gradient(90deg,rgba(14,165,233,1),rgba(59,130,246,0.96),rgba(217,70,239,0.92),rgba(251,146,60,0.92))] px-4 py-3 text-sm font-medium text-white shadow-[0_18px_34px_-18px_rgba(14,165,233,0.72)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60"
            >
              {crawlStatus === 'loading' ? 'Đang crawl...' : 'Run Crawl'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
          {metrics.map(([label, value, note, tone]) => (
            <StatCard key={label} label={label} value={value} note={note} tone={tone} />
          ))}
        </div>

        {topForecastCompany ? (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="soft-glow animated-gradient float-card rounded-[28px] border border-white/75 bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(236,72,153,0.14),rgba(251,146,60,0.16),rgba(255,255,255,0.92))] p-5 shadow-[0_26px_64px_-40px_rgba(15,23,42,0.28)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Predicted risk spotlight</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{topForecastCompany.name}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{topForecastCompany.forecastSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={toneForSeverity(topForecastCompany.forecastRisk24h)}>24h {formatForecastLabel(topForecastCompany.forecastRisk24h)}</Badge>
                  <Badge tone={toneForSeverity(topForecastCompany.forecastRisk7d)}>7d {formatForecastLabel(topForecastCompany.forecastRisk7d)}</Badge>
                  <Badge tone="info">Confidence {topForecastCompany.forecastConfidence}</Badge>
                </div>
              </div>
            </div>
            <div className="animated-gradient float-card rounded-[28px] border border-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,249,255,0.92),rgba(255,237,213,0.9))] p-5 shadow-[0_26px_64px_-40px_rgba(15,23,42,0.24)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Momentum</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{topForecastCompany.last24hMentions || 0}</p>
                  <p className="mt-2 text-sm text-slate-500">mentions in 24h across {topForecastCompany.sourceCount || 0} sources</p>
                </div>
                <SparkBars
                  tone={toneForSeverity(topForecastCompany.forecastRisk7d)}
                  values={[
                    topForecastCompany.last24hMentions || 1,
                    Math.max(1, Math.round((topForecastCompany.mentions || 1) / 2)),
                    topForecastCompany.mentions || 1,
                    Math.max(1, Math.round((topForecastCompany.lifetimeMentions || 1) / 8)),
                    (topForecastCompany.forecastConfidence || 1) * 8,
                    topForecastCompany.negativeSignals || 1,
                  ]}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel
            title={overview.topCompany ? `Top company: ${overview.topCompany.name}` : 'Top company'}
            description="Doanh nghiệp nổi bật nhất trong batch gần nhất."
            action={overview.topCompany ? <Badge tone={toneForScore(overview.topCompany.score)}>{overview.topCompany.sentimentLabel}</Badge> : null}
          >
            {overview.topCompany ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-cyan-100 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(224,242,254,0.88))] px-4 py-3">
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.topCompany.score}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-[linear-gradient(135deg,rgba(255,247,237,0.95),rgba(254,243,199,0.84))] px-4 py-3">
                    <p className="text-xs text-slate-500">7d mentions</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.topCompany.mentions}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-100 bg-[linear-gradient(135deg,rgba(255,241,242,0.95),rgba(255,228,230,0.84))] px-4 py-3">
                    <p className="text-xs text-slate-500">Risk</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.topCompany.risk}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(209,250,229,0.84))] px-4 py-3">
                    <p className="text-xs text-slate-500">Lifetime</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.topCompany.lifetimeMentions}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-cyan-100 bg-[linear-gradient(135deg,rgba(224,242,254,0.92),rgba(255,255,255,0.96),rgba(255,237,213,0.92))] px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="info">{overview.topCompany.sourceCount} sources</Badge>
                    <Badge tone="default">{overview.topCompany.last24hMentions} mentions / 24h</Badge>
                    <Badge tone="positive">Seen until {formatDate(overview.topCompany.lastSeenAt)}</Badge>
                    <Badge tone={toneForSeverity(overview.topCompany.forecastRisk24h)}>24h forecast {formatForecastLabel(overview.topCompany.forecastRisk24h)}</Badge>
                    <Badge tone={toneForSeverity(overview.topCompany.forecastRisk7d)}>7d forecast {formatForecastLabel(overview.topCompany.forecastRisk7d)}</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{overview.topCompany.summary}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-500">{overview.topCompany.forecastSummary}</p>
                </div>
                {renderScoreExplainPanel(overview.topCompany, { title: 'Why the top score' })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
            )}
          </Panel>

          <Panel title="Latest alerts" description="Danh sách cần review ngay.">
            <div className="space-y-3">
              {(overview.latestAlerts || []).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,247,237,0.9),rgba(250,245,255,0.82))] px-4 py-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.22)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{alert.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone={toneForSeverity(alert.severity)}>{alert.severity}</Badge>
                        <Badge tone="default">{alert.lifetimeMentions} lifetime mentions</Badge>
                      </div>
                    </div>
                    <Badge tone={toneForSeverity(alert.severity)}>{alert.score}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Latest market coverage" description="Các bài mới nhất trong knowledge base.">
          <div className="grid gap-3 xl:grid-cols-3">
            {(overview.latestNews || []).map((article) => (
              <a
                key={article.id}
                href={article.article_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-orange-50/40 px-4 py-4 transition hover:border-sky-200 hover:shadow-[0_18px_40px_-28px_rgba(14,165,233,0.35)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="info">{article.source_name}</Badge>
                  <ChevronRight className="size-4 text-slate-400" />
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-900">{article.title}</p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{article.description_text}</p>
              </a>
            ))}
          </div>
        </Panel>
      </div>
    )
  }

  function renderCompaniesV2() {
    const highRiskCompanies = companies.filter((company) => company.forecastRisk7d === 'high').length
    const watchlistCompanies = companies.filter((company) => watchlistKeys.includes(company.key)).length
    const volumeLeader = [...companies].sort((left, right) => (right.mentions || 0) - (left.mentions || 0))[0] || null
    return (
      <div className="space-y-5">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tracked companies</p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-900">Companies</h1>
          <p className="hidden">
            Company board này ưu tiên tốc độ đọc: thấy ngay brand nóng, cần review và đáng giữ trong watchlist.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="info">{companies.length} total companies</Badge>
            <Badge tone="warning">{highRiskCompanies} high 7d forecast</Badge>
            <Badge tone="default">{watchlistCompanies} in watchlist</Badge>
            {volumeLeader ? <Badge tone="positive">Volume leader {volumeLeader.name}</Badge> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ShellStat label="Tracked" value={companies.length} note="All companies" />
          <ShellStat label="High risk" value={highRiskCompanies} note="7d forecast" />
          <ShellStat label="Watchlist" value={watchlistCompanies} note="Pinned" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Company list" description="Sort, filter, select.">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(245,247,250,0.88))] p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Visible rows</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-950">{paginatedCompanies.length}</p>
                    <p className="hidden">Rows currently visible after filters and pagination.</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Sort mode</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-950">
                      {companySortMode === 'forecast' ? 'Forecast' : companySortMode === 'mentions' ? 'Mentions' : 'Score'}
                    </p>
                    <p className="hidden">Switch between predictive ranking, volume and pure sentiment score.</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Risk filter</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-950">{companyRiskFilter === 'all' ? 'All' : formatForecastLabel(companyRiskFilter)}</p>
                    <p className="hidden">Use filter to isolate specific 7d forecast levels.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pb-2">
                <select
                  value={companyRiskFilter}
                  onChange={(event) => setCompanyRiskFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm"
                >
                  <option value="all">All risks</option>
                  <option value="high">High 7d</option>
                  <option value="medium">Medium 7d</option>
                  <option value="low">Low 7d</option>
                </select>
                <select
                  value={companySortMode}
                  onChange={(event) => setCompanySortMode(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm"
                >
                  <option value="forecast">Sort: Forecast</option>
                  <option value="mentions">Sort: Mentions</option>
                  <option value="score">Sort: Score</option>
                </select>
              </div>

              <div className="space-y-3">
                {paginatedCompanies.map((company, index) => {
                  const isSelected = selectedCompany?.key === company.key
                  const boardRank = (companyPage - 1) * companyPageSize + index + 1

                  return (
                    <div
                      key={company.key}
                      onClick={() => setSelectedCompanyKey(company.key)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedCompanyKey(company.key)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`float-card rounded-[26px] border px-4 py-4 text-left transition ${
                        isSelected
                          ? 'border-slate-900/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94),rgba(14,116,144,0.78))] text-white shadow-[0_26px_46px_-30px_rgba(15,23,42,0.55)]'
                          : 'border-slate-200 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96),rgba(255,247,237,0.74))] hover:border-sky-200 hover:bg-[linear-gradient(145deg,rgba(240,249,255,0.96),rgba(255,255,255,0.96),rgba(255,237,213,0.74))]'
                      }`}
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold ${isSelected ? 'border-white/15 bg-white/10 text-white' : 'border-slate-200 bg-white/80 text-slate-600'}`}>
                            {boardRank}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>{company.name}</p>
                              <Badge tone={toneForSeverity(company.forecastRisk7d)}>7d {formatForecastLabel(company.forecastRisk7d)}</Badge>
                              <Badge tone={toneForScore(company.score)}>Score {company.score}</Badge>
                            </div>
                            <p className={`mt-1 text-xs ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>{company.industry}</p>
                            <div className={`mt-3 grid gap-2 text-xs sm:grid-cols-2 ${isSelected ? 'text-white/74' : 'text-slate-500'}`}>
                              <div className="rounded-2xl border border-current/10 px-3 py-2">
                                <p className="uppercase tracking-[0.14em] opacity-65">Mentions</p>
                                <p className={`mt-1 text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>{company.mentions}</p>
                              </div>
                              <div className="rounded-2xl border border-current/10 px-3 py-2">
                                <p className="uppercase tracking-[0.14em] opacity-65">Confidence</p>
                                <p className={`mt-1 text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>{company.forecastConfidence || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 xl:w-[260px] xl:justify-end">
                          <div className="min-w-0 flex-1 xl:max-w-[130px]">
                            <p className={`text-[11px] uppercase tracking-[0.16em] ${isSelected ? 'text-white/55' : 'text-slate-400'}`}>Signal blend</p>
                            <div className="mt-2">
                              <SparkBars
                                tone={toneForSeverity(company.forecastRisk7d)}
                                values={[
                                  company.last24hMentions || 1,
                                  company.mentions || 1,
                                  company.lifetimeMentions || 1,
                                  company.negativeSignals || 1,
                                  (company.forecastConfidence || 1) * 8,
                                ]}
                              />
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-[11px] uppercase tracking-[0.16em] ${isSelected ? 'text-white/55' : 'text-slate-400'}`}>Lifetime</p>
                            <p className={`font-display mt-2 text-2xl font-semibold ${isSelected ? 'text-white' : 'text-slate-950'}`}>{company.lifetimeMentions}</p>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                toggleWatchlist(company.key)
                              }}
                              className={`mt-3 rounded-xl border px-3 py-2 text-[11px] font-medium ${
                                watchlistKeys.includes(company.key)
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : isSelected
                                    ? 'border-white/15 bg-white/10 text-white'
                                    : 'border-slate-200 bg-white/80 text-slate-500'
                              }`}
                            >
                              {watchlistKeys.includes(company.key) ? 'Watching' : 'Watch'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-slate-500">
                  Page {companyPage} / {totalCompanyPages} • {filteredCompanies.length} companies
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompanyPage((current) => Math.max(1, current - 1))}
                    disabled={companyPage === 1}
                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 transition hover:border-sky-200 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompanyPage((current) => Math.min(totalCompanyPages, current + 1))}
                    disabled={companyPage === totalCompanyPages}
                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 transition hover:border-sky-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title={selectedCompany ? selectedCompany.name : 'Company detail'}
            description={selectedCompany ? `${selectedCompany.industry} • ${selectedCompany.sentimentLabel}` : 'Chọn một company'}
            action={selectedCompany ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleExplainScore(selectedCompany)}
                  disabled={explainStatusByEntity[selectedCompany.entityId] === 'loading'}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800 shadow-sm disabled:opacity-60"
                >
                  {explainStatusByEntity[selectedCompany.entityId] === 'loading' ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
                  Explain
                </button>
                <button
                  type="button"
                  onClick={() => toggleWatchlist(selectedCompany.key)}
                  className={`rounded-2xl border px-3 py-2 text-xs font-medium ${
                    watchlistKeys.includes(selectedCompany.key)
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white/80 text-slate-600'
                  }`}
                >
                  {watchlistKeys.includes(selectedCompany.key) ? 'Watching' : 'Watch'}
                </button>
              </div>
            ) : null}
          >
            {selectedCompany ? (
              <div className="space-y-4">
                <div className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(240,249,255,0.94),rgba(255,247,237,0.9))] p-5 shadow-[0_24px_58px_-38px_rgba(15,23,42,0.18)]">
                  <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Selected</p>
                      <h3 className="font-display mt-3 text-3xl font-semibold tracking-tight text-slate-950">{selectedCompany.name}</h3>
                      <p className="mt-2 text-sm text-slate-500">{selectedCompany.industry}</p>
                      <p className="hidden">{selectedCompany.summary}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone={toneForScore(selectedCompany.score)}>{selectedCompany.risk}</Badge>
                        <Badge tone={toneForSeverity(selectedCompany.forecastRisk24h)}>24h {formatForecastLabel(selectedCompany.forecastRisk24h)}</Badge>
                        <Badge tone={toneForSeverity(selectedCompany.forecastRisk7d)}>7d {formatForecastLabel(selectedCompany.forecastRisk7d)}</Badge>
                        <Badge tone="info">Conf {selectedCompany.forecastConfidence}</Badge>
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-slate-200/20 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94),rgba(14,116,144,0.78))] p-5 text-white shadow-[0_24px_58px_-36px_rgba(15,23,42,0.42)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Signals</p>
                          <p className="font-display mt-3 text-3xl font-semibold tracking-tight text-white">{selectedCompany.mentions}</p>
                          <p className="hidden">7d signal blend.</p>
                        </div>
                        <Badge tone={toneForSeverity(selectedCompany.forecastRisk7d)}>7d {formatForecastLabel(selectedCompany.forecastRisk7d)}</Badge>
                      </div>
                      <div className="mt-4">
                        <SparkBars
                          tone={toneForSeverity(selectedCompany.forecastRisk7d)}
                          values={[
                            selectedCompany.last24hMentions || 1,
                            selectedCompany.mentions || 1,
                            selectedCompany.lifetimeMentions || 1,
                            (selectedCompany.forecastConfidence || 1) * 8,
                            selectedCompany.negativeSignals || 1,
                            selectedCompany.score || 1,
                          ]}
                        />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">24h velocity</p>
                          <p className="mt-2 text-xl font-semibold text-white">{selectedCompany.last24hMentions}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Sources</p>
                          <p className="mt-2 text-xl font-semibold text-white">{selectedCompany.sourceCount}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <div className="rounded-2xl border border-sky-100 bg-[linear-gradient(135deg,rgba(224,242,254,0.96),rgba(255,255,255,0.92))] px-4 py-3">
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.score}</p>
                  </div>
                  <div className="rounded-2xl border border-fuchsia-100 bg-[linear-gradient(135deg,rgba(250,245,255,0.96),rgba(255,255,255,0.92))] px-4 py-3">
                    <p className="text-xs text-slate-500">Trend</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.trend}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.92))] px-4 py-3">
                    <p className="text-xs text-slate-500">7d mentions</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.mentions}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-100 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,255,255,0.92))] px-4 py-3">
                    <p className="text-xs text-slate-500">Signals</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.negativeSignals}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.92))] px-4 py-3">
                    <p className="text-xs text-slate-500">History</p>
                    <p className="font-display mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.lifetimeMentions}</p>
                  </div>
                </div>

                {renderScoreExplainPanel(selectedCompany)}

                <CollapsiblePanel
                  title="Forecast detail"
                  kicker="Open forecast"
                  open={isExpanded(`company-forecast-${selectedCompany.key}`)}
                  onToggle={() => toggleExpanded(`company-forecast-${selectedCompany.key}`)}
                  badge={<Badge tone={toneForSeverity(selectedCompany.forecastRisk7d)}>7d {formatForecastLabel(selectedCompany.forecastRisk7d)}</Badge>}
                  preview={(
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="default">{selectedCompany.sourceCount} sources</Badge>
                      <Badge tone="info">{selectedCompany.forecastConfidence} conf</Badge>
                      <Badge tone="warning">{selectedCompany.last24hMentions} / 24h</Badge>
                    </div>
                  )}
                >
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/80 bg-white/60 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Sources</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedCompany.sourceCount}</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/60 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">24h mentions</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedCompany.last24hMentions}</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/60 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">7d forecast</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatForecastLabel(selectedCompany.forecastRisk7d)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/60 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Confidence</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{selectedCompany.forecastConfidence}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{selectedCompany.forecastSummary}</p>
                  <div className="mt-4 rounded-2xl border border-white/80 bg-white/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Forecast drivers</p>
                      </div>
                      <div className="w-40">
                        <SparkBars
                          tone={toneForSeverity(selectedCompany.forecastRisk7d)}
                          values={[
                            selectedCompany.last24hMentions || 1,
                            selectedCompany.mentions || 1,
                            selectedCompany.lifetimeMentions || 1,
                            (selectedCompany.forecastConfidence || 1) * 8,
                            selectedCompany.negativeSignals || 1,
                            selectedCompany.score || 1,
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                  {selectedCompany.forecastDrivers?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCompany.forecastDrivers.map((driver) => (
                        <Badge key={driver} tone="default">{driver}</Badge>
                      ))}
                    </div>
                  ) : null}
                </CollapsiblePanel>

                <CollapsiblePanel
                  title="Evidence"
                  kicker="Open proof"
                  open={isExpanded(`company-evidence-${selectedCompany.key}`)}
                  onToggle={() => toggleExpanded(`company-evidence-${selectedCompany.key}`)}
                  badge={<Badge tone="info">{selectedCompany.explainability?.keyArticles?.length || 0} items</Badge>}
                  preview={(
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="default">{selectedCompany.explainability?.strongestSource || 'Top source N/A'}</Badge>
                      <Badge tone="warning">{formatPercent(selectedCompany.negativeRatio)} negative</Badge>
                    </div>
                  )}
                >
                  {renderEvidencePanel(selectedCompany)}
                </CollapsiblePanel>

                <CollapsiblePanel
                  title="Latest coverage"
                  kicker="Open articles"
                  open={isExpanded(`company-coverage-${selectedCompany.key}`)}
                  onToggle={() => toggleExpanded(`company-coverage-${selectedCompany.key}`)}
                  badge={<Badge tone="default">{selectedCompany.articles?.length || 0} articles</Badge>}
                  preview={selectedCompany.articles?.[0] ? (
                    <p className="line-clamp-1 text-sm font-medium text-slate-700">{selectedCompany.articles[0].title}</p>
                  ) : null}
                >
                  <div className="space-y-2">
                  {(selectedCompany.articles || []).map((article) => (
                    <a
                      key={article.id}
                      href={article.article_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.88),rgba(255,247,237,0.84))] px-4 py-3 transition hover:border-sky-200 hover:bg-[linear-gradient(135deg,rgba(240,249,255,0.96),rgba(255,255,255,0.96),rgba(255,237,213,0.84))] hover:shadow-[0_16px_30px_-24px_rgba(14,165,233,0.4)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{article.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {article.source_name} • seen {article.crawl_count || 1}x • {formatDate(article.last_seen_at || article.published_at)}
                          </p>
                        </div>
                        <ChevronRight className="mt-1 size-4 text-slate-400" />
                      </div>
                    </a>
                  ))}
                  </div>
                </CollapsiblePanel>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Không có company được chọn.</p>
            )}
          </Panel>
        </div>
      </div>
    )
  }

  function _renderCompanies() {
    return (
      <div className="space-y-5">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tracked companies</p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-900">Companies</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Dữ liệu company lấy trực tiếp từ articles đã crawl, vừa theo dõi tín hiệu mới vừa giữ lịch sử mention cũ để phân tích không bị mất mạch.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
          <Panel title="Company list" description="Hiển thị recent mentions / lifetime mentions.">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 pb-2">
                <select
                  value={companyRiskFilter}
                  onChange={(event) => setCompanyRiskFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                >
                  <option value="all">All risks</option>
                  <option value="high">High 7d</option>
                  <option value="medium">Medium 7d</option>
                  <option value="low">Low 7d</option>
                </select>
                <select
                  value={companySortMode}
                  onChange={(event) => setCompanySortMode(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                >
                  <option value="forecast">Sort: Forecast</option>
                  <option value="mentions">Sort: Mentions</option>
                  <option value="score">Sort: Score</option>
                </select>
              </div>
              <div className="space-y-2">
                {paginatedCompanies.map((company) => (
                <div
                  key={company.key}
                  onClick={() => setSelectedCompanyKey(company.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedCompanyKey(company.key)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`float-card grid w-full grid-cols-[minmax(0,1fr)_110px_80px_92px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    selectedCompany?.key === company.key
                      ? 'border-fuchsia-200 bg-[linear-gradient(90deg,rgba(224,242,254,0.98),rgba(243,232,255,0.92),rgba(255,237,213,0.9))] shadow-[0_20px_36px_-28px_rgba(217,70,239,0.38)]'
                      : 'border-slate-200 bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96),rgba(255,247,237,0.74))] hover:border-sky-200 hover:bg-[linear-gradient(90deg,rgba(240,249,255,0.96),rgba(255,255,255,0.96),rgba(255,237,213,0.74))]'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{company.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{company.industry}</p>
                  </div>
                  <div className="text-sm text-slate-500">{company.mentions}/{company.lifetimeMentions}</div>
                  <div className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={toneForScore(company.score)}>{company.score}</Badge>
                      <Badge tone={toneForSeverity(company.forecastRisk7d)}>7d {formatForecastLabel(company.forecastRisk7d)}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleWatchlist(company.key)
                      }}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-medium ${
                        watchlistKeys.includes(company.key)
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white/80 text-slate-500'
                      }`}
                    >
                      {watchlistKeys.includes(company.key) ? 'Watching' : 'Watch'}
                    </button>
                  </div>
                </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-slate-500">
                  Page {companyPage} / {totalCompanyPages} · {filteredCompanies.length} companies
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompanyPage((current) => Math.max(1, current - 1))}
                    disabled={companyPage === 1}
                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 transition hover:border-sky-200 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompanyPage((current) => Math.min(totalCompanyPages, current + 1))}
                    disabled={companyPage === totalCompanyPages}
                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 transition hover:border-sky-200 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title={selectedCompany ? selectedCompany.name : 'Company detail'}
            description={selectedCompany ? `${selectedCompany.industry} • ${selectedCompany.sentimentLabel}` : 'Chọn một company'}
            action={selectedCompany ? (
              <button
                type="button"
                onClick={() => toggleWatchlist(selectedCompany.key)}
                className={`rounded-2xl border px-3 py-2 text-xs font-medium ${
                  watchlistKeys.includes(selectedCompany.key)
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white/80 text-slate-600'
                }`}
              >
                {watchlistKeys.includes(selectedCompany.key) ? 'In watchlist' : 'Add to watchlist'}
              </button>
            ) : null}
          >
            {selectedCompany ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="rounded-2xl border border-sky-100 bg-[linear-gradient(135deg,rgba(224,242,254,0.96),rgba(255,255,255,0.92))] px-4 py-3">
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.score}</p>
                  </div>
                  <div className="rounded-2xl border border-fuchsia-100 bg-[linear-gradient(135deg,rgba(250,245,255,0.96),rgba(255,255,255,0.92))] px-4 py-3">
                    <p className="text-xs text-slate-500">Trend</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.trend}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.92))] px-4 py-3">
                    <p className="text-xs text-slate-500">7d mentions</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.mentions}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-100 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,255,255,0.92))] px-4 py-3">
                    <p className="text-xs text-slate-500">Signals</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.negativeSignals}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.92))] px-4 py-3">
                    <p className="text-xs text-slate-500">History</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.lifetimeMentions}</p>
                  </div>
                </div>

                {renderActionablePanel(selectedCompany)}
                {renderScoreExplainPanel(selectedCompany)}

                <div className="rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,rgba(240,249,255,0.92),rgba(255,255,255,0.96),rgba(255,247,237,0.9))] px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="info">{selectedCompany.sourceCount} sources</Badge>
                    <Badge tone="default">{selectedCompany.last24hMentions} mentions / 24h</Badge>
                    <Badge tone="positive">{selectedCompany.lifetimeMentions} mentions all-time</Badge>
                    <Badge tone={toneForScore(selectedCompany.score)}>{selectedCompany.risk}</Badge>
                    <Badge tone={toneForSeverity(selectedCompany.forecastRisk24h)}>24h forecast {formatForecastLabel(selectedCompany.forecastRisk24h)}</Badge>
                    <Badge tone={toneForSeverity(selectedCompany.forecastRisk7d)}>7d forecast {formatForecastLabel(selectedCompany.forecastRisk7d)}</Badge>
                    <Badge tone="info">Confidence {selectedCompany.forecastConfidence}</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{selectedCompany.summary}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-500">{selectedCompany.forecastSummary}</p>
                  <div className="mt-4 rounded-2xl border border-white/80 bg-white/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Signal texture</p>
                        <p className="mt-2 text-sm text-slate-600">Visual blend of mention velocity, confidence, and negative signals.</p>
                      </div>
                      <div className="w-40">
                        <SparkBars
                          tone={toneForSeverity(selectedCompany.forecastRisk7d)}
                          values={[
                            selectedCompany.last24hMentions || 1,
                            selectedCompany.mentions || 1,
                            selectedCompany.lifetimeMentions || 1,
                            (selectedCompany.forecastConfidence || 1) * 8,
                            selectedCompany.negativeSignals || 1,
                            selectedCompany.score || 1,
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                  {selectedCompany.forecastDrivers?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedCompany.forecastDrivers.map((driver) => (
                        <Badge key={driver} tone="default">{driver}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                {renderEvidencePanel(selectedCompany)}

                <div className="space-y-2">
                  {(selectedCompany.articles || []).map((article) => (
                    <a
                      key={article.id}
                      href={article.article_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.88),rgba(255,247,237,0.84))] px-4 py-3 transition hover:border-sky-200 hover:bg-[linear-gradient(135deg,rgba(240,249,255,0.96),rgba(255,255,255,0.96),rgba(255,237,213,0.84))] hover:shadow-[0_16px_30px_-24px_rgba(14,165,233,0.4)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{article.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {article.source_name} • seen {article.crawl_count || 1}x • {formatDate(article.last_seen_at || article.published_at)}
                          </p>
                        </div>
                        <ChevronRight className="mt-1 size-4 text-slate-400" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Không có company được chọn.</p>
            )}
          </Panel>
        </div>
      </div>
    )
  }

  function renderAlerts() {
    return (
      <div className="space-y-5">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Risk monitoring</p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-900">Alerts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Alert queue được sinh từ company analytics thật, có tính đến độ mới và lịch sử mention.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Alert queue" description="Các company cần analyst review.">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => setSelectedAlertId(alert.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedAlert?.id === alert.id
                      ? 'border-fuchsia-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,255,255,0.96),rgba(250,245,255,0.86))] shadow-[0_18px_36px_-28px_rgba(217,70,239,0.34)]'
                      : 'border-slate-200 bg-white hover:border-sky-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{alert.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="default">{alert.companyName}</Badge>
                        <Badge tone={toneForScore(alert.score)}>{alert.sentimentLabel}</Badge>
                        <Badge tone={toneForSeverity(alert.severity)}>{alert.mentions} recent mentions</Badge>
                        <Badge tone="default">{alert.lifetimeMentions} lifetime</Badge>
                        <Badge tone={toneForSeverity(alert.forecastRisk24h)}>24h {formatForecastLabel(alert.forecastRisk24h)}</Badge>
                        <Badge tone={toneForSeverity(alert.forecastRisk7d)}>7d {formatForecastLabel(alert.forecastRisk7d)}</Badge>
                        <Badge tone="warning">Negative ratio {formatPercent(alert.negativeRatio)}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-500">{alert.forecastSummary}</p>
                      <div className="mt-4 max-w-[220px]">
                        <SparkBars
                          tone={toneForSeverity(alert.forecastRisk7d || alert.severity)}
                          values={[
                            alert.mentions || 1,
                            alert.lifetimeMentions || 1,
                            alert.score || 1,
                            alert.forecastConfidence ? alert.forecastConfidence * 8 : 2,
                            alert.negativeSignals || 1,
                          ]}
                        />
                      </div>
                    </div>
                    <Badge tone={toneForSeverity(alert.severity)}>{alert.severity}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,255,255,0.94),rgba(254,205,211,0.64))] p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.2)]">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Open Alerts</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{alerts.length}</p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.94),rgba(253,230,138,0.68))] p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.2)]">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">High Severity</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{alerts.filter((item) => item.severity === 'high').length}</p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-[linear-gradient(135deg,rgba(255,247,237,0.98),rgba(255,255,255,0.94),rgba(251,146,60,0.5))] p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.2)]">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">7d High Forecast</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{alerts.filter((item) => item.forecastRisk7d === 'high').length}</p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(255,255,255,0.94),rgba(125,211,252,0.56))] p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.2)]">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Historical Coverage</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">
                {alerts.reduce((sum, item) => sum + (item.lifetimeMentions || 0), 0)}
              </p>
            </div>

            {selectedAlert ? (
              <div className="space-y-4 rounded-3xl border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.96),rgba(255,241,242,0.84))] p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.2)]">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected Alert</p>
                  <p className="mt-3 text-xl font-semibold text-slate-900">{selectedAlert.companyName}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{selectedAlert.description}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                    <p className="text-xs text-slate-500">Severity</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedAlert.severity}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                    <p className="text-xs text-slate-500">Model confidence</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedAlert.explainability?.averageModelConfidence || selectedAlert.forecastConfidence}</p>
                  </div>
                </div>
                {renderActionablePanel(selectedAlert)}
                {renderScoreExplainPanel(selectedAlert, { title: 'Why this alert score' })}
                {renderEvidencePanel(selectedAlert)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  function _renderCompare() {
    return (
      <div className="space-y-5">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Watchlist benchmarking</p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-900">Compare</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            So sánh tối đa 3 thương hiệu theo mentions, negative ratio, forecast risk và top topics.
          </p>
        </div>

        <Panel title="Watchlist" description="Pick up to 3 companies for side-by-side comparison.">
          <div className="flex flex-wrap gap-2">
            {companies.slice(0, 18).map((company) => (
              <button
                key={`watch-${company.key}`}
                type="button"
                onClick={() => toggleWatchlist(company.key)}
                className={`rounded-2xl border px-3 py-2 text-xs font-medium ${
                  watchlistKeys.includes(company.key)
                    ? 'border-fuchsia-200 bg-[linear-gradient(90deg,rgba(224,242,254,0.96),rgba(243,232,255,0.86))] text-slate-900'
                    : 'border-slate-200 bg-white/80 text-slate-500'
                }`}
              >
                {company.name}
              </button>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-3">
          {_compareCompanies.map((company) => (
            <div key={`compare-${company.key}`} className="rounded-3xl border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.94),rgba(255,247,237,0.86))] p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.2)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{company.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{company.industry}</p>
                </div>
                <Badge tone={toneForSeverity(company.forecastRisk7d)}>7d {formatForecastLabel(company.forecastRisk7d)}</Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                  <p className="text-xs text-slate-500">Mentions</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{company.mentions}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                  <p className="text-xs text-slate-500">Negative ratio</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPercent(company.negativeRatio)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                  <p className="text-xs text-slate-500">Forecast</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{formatForecastLabel(company.forecastRisk7d)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                  <p className="text-xs text-slate-500">Top source</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{company.explainability?.strongestSource || 'N/A'}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Top topics</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(company.topTopics || []).map((topic) => (
                    <Badge key={`topic-${company.key}-${topic}`} tone="default">{topic}</Badge>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Action bias</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{company.actionable?.recommendedAction}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderChatMessage(message) {
    const isUser = message.role === 'user'

    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[90%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
          <div className={`flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
            <span
              className={`flex size-8 items-center justify-center rounded-2xl text-[11px] font-semibold uppercase tracking-[0.14em] ${
                isUser
                  ? 'bg-[linear-gradient(135deg,rgba(14,165,233,1),rgba(59,130,246,0.96),rgba(217,70,239,0.92))] text-white shadow-[0_12px_24px_-12px_rgba(59,130,246,0.72)]'
                  : 'border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(224,242,254,0.92),rgba(255,237,213,0.88))] text-slate-700 shadow-[0_12px_24px_-12px_rgba(14,165,233,0.3)]'
              }`}
            >
              {isUser ? 'You' : 'AI'}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              {isUser ? 'Analyst Prompt' : 'AI Assistant'}
            </span>
          </div>

          <div
            className={`relative overflow-hidden rounded-[24px] px-4 py-3 text-sm leading-7 shadow-[0_20px_44px_-28px_rgba(15,23,42,0.24)] ${
              isUser
                ? 'bg-[linear-gradient(135deg,rgba(14,165,233,0.98),rgba(59,130,246,0.94),rgba(217,70,239,0.9),rgba(251,146,60,0.82))] text-white'
                : 'border border-white/80 bg-[linear-gradient(135deg,rgba(236,254,255,0.96),rgba(255,255,255,0.97),rgba(250,245,255,0.9),rgba(255,237,213,0.84))] text-slate-800'
            }`}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/60" />
            <div className="whitespace-pre-line">{message.content}</div>
          </div>

          {!isUser && message.references?.length ? (
            <div className="w-full rounded-[22px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,249,255,0.92),rgba(255,247,237,0.86))] p-3 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.2)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">References</p>
                <Badge tone="info">{message.references.length} sources</Badge>
              </div>
              <div className="mt-2 space-y-2">
                {message.references.map((reference) => (
                  <a
                    key={`${message.id}-${reference.url}`}
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-slate-200 bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(240,249,255,0.92),rgba(255,237,213,0.82))] px-3 py-2.5 transition hover:border-sky-200 hover:bg-[linear-gradient(90deg,rgba(224,242,254,0.92),rgba(255,255,255,0.96),rgba(250,245,255,0.82))]"
                  >
                    <p className="text-sm font-medium text-slate-900">{reference.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {reference.source || 'Unknown source'} • {formatDate(reference.published_at)}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen bg-transparent px-4 py-4 text-slate-900 lg:px-6">
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[3px] lg:hidden" onClick={() => setMobileNavOpen(false)}>
          <div
            className="drawer-shell ml-auto flex h-full w-[min(360px,88vw)] flex-col border-l border-white/70 px-5 py-5 shadow-[0_38px_110px_-42px_rgba(15,23,42,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Navigation</p>
                <p className="font-display mt-2 text-2xl font-semibold text-slate-950">SentimentX</p>
              </div>
              <button type="button" onClick={() => setMobileNavOpen(false)} className="rounded-2xl border border-slate-200 bg-white/80 p-2 text-slate-600">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-5 space-y-2">{renderNavButtons('drawer')}</div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sidebar-shell hidden rounded-[36px] lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)] lg:flex-col">
          <div className="flex items-center gap-3 border-b border-slate-200/80 px-6 py-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(15,23,42,1),rgba(14,116,144,0.92),rgba(180,83,9,0.88))] text-white shadow-[0_16px_34px_-18px_rgba(15,23,42,0.62)]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="font-display text-2xl font-semibold text-slate-950">SentimentX</p>
              <p className="text-sm text-slate-500">Enterprise market intelligence</p>
            </div>
          </div>

          <div className="space-y-2 px-4 py-5">{renderNavButtons()}</div>

          <div className="mt-auto hidden px-4 pb-4">
                <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(155deg,rgba(255,255,255,0.94),rgba(245,247,250,0.9),rgba(255,248,240,0.82))] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Workspace</p>
              <p className="font-display mt-3 text-xl font-semibold text-slate-950">BAV Enterprise</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Dashboard ưu tiên workflow thật, nhiều màu hơn nhưng vẫn data-dense. Dữ liệu mới vào không làm mất dữ liệu cũ.
              </p>
            </div>
          </div>
        </aside>

        <main className="main-shell rounded-[36px] border border-white/50 shadow-[0_30px_110px_-52px_rgba(15,23,42,0.36)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setMobileNavOpen(true)} className="rounded-2xl border border-slate-200 bg-white/80 p-2 text-slate-600 lg:hidden">
                <PanelLeft className="size-5" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">SentimentX Console</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="font-display text-[1.45rem] font-semibold leading-none text-slate-950">{activeNavItem.label}</p>
                  <Badge tone="default">{activeNavItem.description}</Badge>
                </div>
                <p className="text-sm text-slate-500">
                  {loading ? 'Loading data...' : `${companies.length} companies • ${alerts.length} alerts`}
                </p>
              </div>
            </div>
            <div className="relative hidden md:block">
              <div className="search-shell flex min-w-[360px] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm text-slate-500 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.2)]">
                <Search className="size-4" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search company, topic, headline..."
                  className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
                />
                {searchQuery ? (
                  <button type="button" onClick={clearSearch} className="text-xs text-slate-400 hover:text-slate-600">
                    Clear
                  </button>
                ) : null}
              </div>

              {searchQuery.trim().length >= 2 ? (
                <div className="animated-gradient absolute right-0 top-[calc(100%+10px)] z-20 w-[560px] rounded-3xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(236,246,255,0.94),rgba(255,240,246,0.9))] p-4 shadow-[0_28px_90px_-40px_rgba(15,23,42,0.38)] backdrop-blur-xl">
                  {searchStatus === 'loading' ? (
                    <div className="flex items-center gap-2 px-2 py-3 text-sm text-slate-500">
                      <LoaderCircle className="size-4 animate-spin" />
                      Searching...
                    </div>
                  ) : null}

                  {searchStatus !== 'loading' ? (
                    <div className="space-y-4">
                      {searchResults.companies.length ? (
                        <div>
                          <p className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Companies</p>
                          <div className="mt-2 space-y-2">
                            {searchResults.companies.map((company) => (
                              <button
                                key={company.key}
                                type="button"
                                onClick={() => handleSelectCompanyFromSearch(company.key)}
                                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(240,249,255,0.92),rgba(250,245,255,0.86))] px-3 py-3 text-left transition hover:border-sky-200 hover:bg-[linear-gradient(90deg,rgba(224,242,254,0.92),rgba(255,255,255,0.96),rgba(255,237,213,0.82))]"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{company.name}</p>
                                  <p className="mt-1 text-xs text-slate-500">{company.industry}</p>
                                </div>
                                <Badge tone={toneForSeverity(company.forecastRisk7d)}>7d {formatForecastLabel(company.forecastRisk7d)}</Badge>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {searchResults.alerts.length ? (
                        <div>
                          <p className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Alerts</p>
                          <div className="mt-2 space-y-2">
                            {searchResults.alerts.map((alert) => (
                              <button
                                key={alert.id}
                                type="button"
                                onClick={() => handleSelectAlertFromSearch(alert.id)}
                                className="flex w-full items-start justify-between rounded-2xl border border-slate-200 bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(255,247,237,0.92),rgba(255,228,230,0.84))] px-3 py-3 text-left transition hover:border-sky-200 hover:bg-[linear-gradient(90deg,rgba(255,241,242,0.92),rgba(255,255,255,0.96),rgba(255,237,213,0.82))]"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                                  <p className="mt-1 text-xs text-slate-500">{alert.companyName}</p>
                                </div>
                                <Badge tone={toneForSeverity(alert.forecastRisk7d || alert.severity)}>{formatForecastLabel(alert.forecastRisk7d || alert.severity)}</Badge>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {searchResults.articles.length ? (
                        <div>
                          <p className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Headlines</p>
                          <div className="mt-2 space-y-2">
                            {searchResults.articles.map((article) => (
                              <a
                                key={article.id}
                                href={article.article_url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-2xl border border-slate-200 bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(240,249,255,0.9),rgba(255,247,237,0.84))] px-3 py-3 transition hover:border-sky-200 hover:bg-[linear-gradient(90deg,rgba(224,242,254,0.92),rgba(255,255,255,0.96),rgba(255,237,213,0.82))]"
                              >
                                <p className="text-sm font-medium text-slate-900">{article.title}</p>
                                <p className="mt-1 text-xs text-slate-500">{article.source_name}</p>
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {!searchResults.companies.length && !searchResults.alerts.length && !searchResults.articles.length ? (
                        <div className="px-2 py-3 text-sm text-slate-500">No company, alert, or headline matched this query.</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-b border-slate-200/80 px-4 py-4 md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">{renderNavButtons('compact')}</div>
            <div className="search-shell mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-slate-500 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.2)]">
              <Search className="size-4" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search company, topic, headline..."
                className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
              />
              {searchQuery ? (
                <button type="button" onClick={clearSearch} className="text-xs text-slate-400 hover:text-slate-600">
                  Clear
                </button>
              ) : null}
            </div>
            {renderSearchResultsPanel(
              'mt-3 rounded-3xl border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(236,246,255,0.94),rgba(255,240,246,0.9))] p-4 shadow-[0_28px_90px_-40px_rgba(15,23,42,0.22)] backdrop-blur-xl',
            )}
          </div>

          <div className="px-4 py-5 sm:px-6">
            {loading ? (
              <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400">
                  <LoaderCircle className="size-5 animate-spin" />
                  Đang tải dữ liệu dashboard...
                </div>
              </div>
            ) : error && !overview && !companies.length ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5">
                <p className="text-base font-semibold text-rose-700">Không thể tải dữ liệu</p>
                <p className="mt-2 text-sm text-rose-600">{error}</p>
              </div>
            ) : activeView === 'companies' ? (
              renderCompaniesV2()
            ) : activeView === 'alerts' ? (
              renderAlerts()
            ) : (
              renderOverviewV2()
            )}
          </div>
        </main>
      </div>

      <button
        type="button"
        onClick={() => setAssistantOpen((current) => !current)}
        className="float-card fixed bottom-6 right-6 inline-flex items-center gap-3 rounded-full border border-white/80 bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(240,249,255,0.96),rgba(250,245,255,0.9),rgba(255,247,237,0.9))] px-3 py-3 pr-5 text-sm font-medium text-slate-900 shadow-[0_28px_68px_-24px_rgba(59,130,246,0.38)] backdrop-blur"
      >
        <span className="animated-gradient flex size-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(14,165,233,1),rgba(59,130,246,0.96),rgba(217,70,239,0.92),rgba(251,146,60,0.92))] text-white shadow-[0_16px_34px_-12px_rgba(59,130,246,0.72)]">
          <Bot className="size-4" />
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[13px] font-semibold">AI Assistant</span>
          <span className="text-xs text-slate-500">
            {activeView === 'companies' && selectedCompany ? `Context: ${selectedCompany.name}` : 'Overall market context'}
          </span>
        </span>
      </button>

      {companyPanelOpen ? renderCompanySheet() : null}
      {sourcePanelOpen ? renderSourceSheet() : null}

      {assistantOpen ? (
        <div className="fixed inset-0 z-50 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.16))] backdrop-blur-[4px]">
          <div className="absolute bottom-6 right-6 flex h-[min(760px,calc(100vh-48px))] w-[min(580px,calc(100vw-32px))] flex-col overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,251,255,0.96),rgba(252,244,251,0.94))] shadow-[0_44px_120px_-40px_rgba(15,23,42,0.48)]">
            <div className="border-b border-white/80 bg-[linear-gradient(90deg,rgba(240,249,255,0.96),rgba(236,254,255,0.92),rgba(250,245,255,0.9),rgba(255,237,213,0.88))] px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,rgba(14,165,233,1),rgba(59,130,246,0.96),rgba(217,70,239,0.92),rgba(251,146,60,0.92))] text-white shadow-[0_16px_32px_-14px_rgba(59,130,246,0.72)]">
                    <Bot className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">AI Assistant</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {activeView === 'companies' && selectedCompany ? `Đang phân tích: ${selectedCompany.name}` : 'Đang ở chế độ phân tích tổng quan'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="info">{activeView === 'companies' && selectedCompany ? 'Company mode' : 'Overview mode'}</Badge>
                  <button type="button" onClick={() => setAssistantOpen(false)} className="rounded-xl border border-white bg-white/80 p-2 text-slate-500 shadow-sm">
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,255,0.96),rgba(255,244,249,0.9))] px-5 py-4">
              <div className="space-y-4">
                {chatMessages.map((message) => renderChatMessage(message))}
                {aiStatus === 'loading' ? (
                  <div className="flex justify-start">
                    <div className="thinking-card rounded-[24px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,249,255,0.94),rgba(250,245,255,0.9),rgba(255,237,213,0.84))] px-4 py-3 text-sm text-slate-500 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.2)]">
                      <div className="relative z-[1] mb-2 flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(217,70,239,0.14),rgba(251,146,60,0.16))]">
                          <Bot className="size-4 text-sky-600" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">Thinking</span>
                            <span className="thinking-dots" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">Gathering context and references.</p>
                        </div>
                      </div>
                      Assistant đang phân tích...
                    </div>
                  </div>
                ) : null}
                {aiError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{aiError}</div> : null}
              </div>
            </div>

            <div className="border-t border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,249,255,0.92),rgba(250,245,255,0.88))] px-5 py-4">
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone="info">
                  {activeView === 'companies' && selectedCompany ? `Context company: ${selectedCompany.name}` : 'Context overall dashboard'}
                </Badge>
              </div>
              <div className="flex items-end gap-3">
                <textarea
                  value={aiQuestion}
                  onChange={(event) => setAiQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      handleAskAi()
                    }
                  }}
                  rows={3}
                  placeholder="Nhập câu hỏi tiếp theo..."
                  className="min-h-[84px] flex-1 rounded-[24px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,249,255,0.94),rgba(250,245,255,0.88))] px-4 py-3 text-sm text-slate-900 outline-none shadow-[0_16px_34px_-26px_rgba(15,23,42,0.2)] focus:border-sky-300"
                />
                <button
                  type="button"
                  onClick={handleAskAi}
                  disabled={aiStatus === 'loading' || aiQuestion.trim().length < 3}
                  className="inline-flex h-[56px] items-center gap-2 rounded-[22px] bg-[linear-gradient(90deg,rgba(14,165,233,1),rgba(59,130,246,0.96),rgba(217,70,239,0.92),rgba(251,146,60,0.92))] px-5 py-2.5 text-sm font-medium text-white shadow-[0_22px_40px_-18px_rgba(59,130,246,0.72)] disabled:opacity-60"
                >
                  <SendHorizonal className="size-4" />
                  Gửi
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}



