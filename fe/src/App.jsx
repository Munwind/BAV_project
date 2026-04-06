import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  BriefcaseBusiness,
  ChevronRight,
  LayoutDashboard,
  LoaderCircle,
  PanelLeft,
  RefreshCcw,
  Search,
  SendHorizonal,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react'

const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Executive summary' },
  { id: 'companies', label: 'Companies', icon: BriefcaseBusiness, description: 'Tracked entities' },
  { id: 'alerts', label: 'Alerts', icon: ShieldAlert, description: 'Risk monitoring' },
]

function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'border-slate-200 bg-slate-100/90 text-slate-700',
    positive: 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700',
    negative: 'border-rose-200 bg-gradient-to-r from-rose-50 to-orange-50 text-rose-700',
    warning: 'border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700',
    info: 'border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50 text-cyan-700',
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

function Panel({ title, description, action, children }) {
  return (
    <section className="rounded-3xl border border-white/45 bg-[linear-gradient(180deg,rgba(240,248,255,0.72),rgba(232,243,255,0.64))] shadow-[0_24px_80px_-40px_rgba(15,23,42,0.22)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function StatCard({ label, value, note, tone }) {
  const surfaces = {
    default: 'bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96),rgba(226,232,240,0.82))]',
    positive: 'bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(209,250,229,0.92),rgba(167,243,208,0.76))]',
    negative: 'bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,228,230,0.92),rgba(254,205,211,0.78))]',
    warning: 'bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(254,243,199,0.92),rgba(253,230,138,0.78))]',
    info: 'bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(224,242,254,0.92),rgba(186,230,253,0.78))]',
  }

  return (
    <div className={`rounded-3xl border border-white/70 p-5 shadow-[0_22px_52px_-34px_rgba(15,23,42,0.22)] ${surfaces[tone] || surfaces.default}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <div className="mt-4">
        <Badge tone={tone}>{note}</Badge>
      </div>
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

function createWelcomeMessage(contextLabel) {
  const content =
    contextLabel === 'overview'
      ? 'Chào bạn. Tôi có thể tóm tắt bức tranh thị trường tổng quan, highlight rủi ro mới và giải thích các tín hiệu nổi bật trong dashboard.'
      : `Chào bạn. Tôi đang theo ngữ cảnh ${contextLabel}. Bạn có thể hỏi về sentiment, rủi ro, nguồn tin và các diễn biến mới nhất liên quan đến thực thể này.`

  return {
    id: `assistant-welcome-${contextLabel}`,
    role: 'assistant',
    content,
    references: [],
  }
}

export default function App() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'
  const [activeView, setActiveView] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [companies, setCompanies] = useState([])
  const [alerts, setAlerts] = useState([])
  const [selectedCompanyKey, setSelectedCompanyKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [crawlStatus, setCrawlStatus] = useState('idle')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiStatus, setAiStatus] = useState('idle')
  const [chatMessages, setChatMessages] = useState([createWelcomeMessage('overview')])
  const [aiError, setAiError] = useState('')

  const selectedCompany = useMemo(
    () => companies.find((item) => item.key === selectedCompanyKey) || companies[0] || null,
    [companies, selectedCompanyKey],
  )
  const chatContextKey = activeView === 'companies' && selectedCompany?.name ? `company:${selectedCompany.name}` : 'overview'

  async function getJson(path) {
    const response = await fetch(`${apiBaseUrl}${path}`)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || `Request failed: ${path}`)
    return data
  }

  async function loadData() {
    try {
      setLoading(true)
      setError('')
      const [overviewData, companiesData, alertsData] = await Promise.all([
        getJson('/overview'),
        getJson('/companies'),
        getJson('/alerts'),
      ])
      setOverview(overviewData)
      setCompanies(companiesData.items || [])
      setAlerts(alertsData.items || [])
      if (!selectedCompanyKey && companiesData.items?.length) {
        setSelectedCompanyKey(companiesData.items[0].key)
      }
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setChatMessages([createWelcomeMessage(chatContextKey)])
    setAiQuestion('')
    setAiError('')
    setAiStatus('idle')
  }, [chatContextKey])

  async function handleRunCrawler() {
    try {
      setCrawlStatus('loading')
      const response = await fetch(`${apiBaseUrl}/crawler/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  function renderOverview() {
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
              Trang điều hành tập trung vào tín hiệu mới nhất, nhưng vẫn giữ toàn bộ lịch sử đã ingest để không làm mất ngữ cảnh cũ.
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
            <button
              type="button"
              onClick={handleRunCrawler}
              disabled={crawlStatus === 'loading'}
              className="rounded-2xl bg-gradient-to-r from-sky-600 via-cyan-500 to-orange-400 px-4 py-3 text-sm font-medium text-white shadow-[0_16px_30px_-18px_rgba(14,165,233,0.65)] disabled:opacity-60"
            >
              {crawlStatus === 'loading' ? 'Đang crawl...' : 'Run Crawl'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
          {metrics.map(([label, value, note, tone]) => (
            <StatCard key={label} label={label} value={value} note={note} tone={tone} />
          ))}
        </div>

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
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{overview.topCompany.summary}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
            )}
          </Panel>

          <Panel title="Latest alerts" description="Danh sách cần review ngay.">
            <div className="space-y-3">
              {(overview.latestAlerts || []).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
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

        <Panel title="Latest market coverage" description="Các bài mới nhất vừa được giữ vào knowledge base.">
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

  function renderCompanies() {
    return (
      <div className="space-y-5">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tracked companies</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Companies</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Dữ liệu company lấy trực tiếp từ articles đã crawl, vừa theo dõi tín hiệu mới vừa giữ lịch sử mention cũ để phân tích không bị mất mạch.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
          <Panel title="Company list" description="Hiển thị recent mentions / lifetime mentions.">
            <div className="space-y-2">
              {companies.map((company) => (
                <button
                  key={company.key}
                  type="button"
                  onClick={() => setSelectedCompanyKey(company.key)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_110px_80px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    selectedCompany?.key === company.key
                      ? 'border-cyan-200 bg-gradient-to-r from-sky-50 to-orange-50/50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{company.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{company.industry}</p>
                  </div>
                  <div className="text-sm text-slate-500">{company.mentions}/{company.lifetimeMentions}</div>
                  <div className="text-right">
                    <Badge tone={toneForScore(company.score)}>{company.score}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title={selectedCompany ? selectedCompany.name : 'Company detail'}
            description={selectedCompany ? `${selectedCompany.industry} • ${selectedCompany.sentimentLabel}` : 'Chọn một company'}
          >
            {selectedCompany ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.score}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Trend</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.trend}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">7d mentions</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.mentions}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Signals</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.negativeSignals}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">History</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedCompany.lifetimeMentions}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,rgba(240,249,255,0.92),rgba(255,255,255,0.96),rgba(255,247,237,0.9))] px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="info">{selectedCompany.sourceCount} sources</Badge>
                    <Badge tone="default">{selectedCompany.last24hMentions} mentions / 24h</Badge>
                    <Badge tone="positive">{selectedCompany.lifetimeMentions} mentions all-time</Badge>
                    <Badge tone={toneForScore(selectedCompany.score)}>{selectedCompany.risk}</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{selectedCompany.summary}</p>
                </div>

                <div className="space-y-2">
                  {(selectedCompany.articles || []).map((article) => (
                    <a
                      key={article.id}
                      href={article.article_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-sky-200 hover:bg-sky-50/60 hover:shadow-[0_16px_30px_-24px_rgba(14,165,233,0.4)]"
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
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Alerts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Alert queue được sinh từ company analytics thật, có tính đến cả mức độ mới và lịch sử mention đang lưu trong database.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Alert queue" description="Các company cần analyst review.">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{alert.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="default">{alert.companyName}</Badge>
                        <Badge tone={toneForScore(alert.score)}>{alert.sentimentLabel}</Badge>
                        <Badge tone={toneForSeverity(alert.severity)}>{alert.mentions} recent mentions</Badge>
                        <Badge tone="default">{alert.lifetimeMentions} lifetime</Badge>
                      </div>
                    </div>
                    <Badge tone={toneForSeverity(alert.severity)}>{alert.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/80 bg-gradient-to-br from-rose-50 to-white p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.2)]">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Open Alerts</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{alerts.length}</p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-gradient-to-br from-amber-50 to-white p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.2)]">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">High Severity</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{alerts.filter((item) => item.severity === 'high').length}</p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-gradient-to-br from-cyan-50 to-white p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.2)]">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Historical Coverage</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">
                {alerts.reduce((sum, item) => sum + (item.lifetimeMentions || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderChatMessage(message) {
    const isUser = message.role === 'user'

    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[88%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
          <div
            className={`rounded-[22px] px-4 py-3 text-sm leading-7 shadow-sm ${
              isUser
                ? 'bg-[linear-gradient(135deg,rgba(14,165,233,0.96),rgba(34,211,238,0.92),rgba(251,146,60,0.88))] text-white'
                : 'border border-cyan-100 bg-[linear-gradient(135deg,rgba(236,254,255,0.94),rgba(255,255,255,0.96),rgba(255,237,213,0.82))] text-slate-800'
            }`}
          >
            <div className="whitespace-pre-line">{message.content}</div>
          </div>

          {!isUser && message.references?.length ? (
            <div className="w-full rounded-2xl border border-slate-200 bg-white/80 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">References</p>
              <div className="mt-2 space-y-2">
                {message.references.map((reference) => (
                  <a
                    key={`${message.id}-${reference.url}`}
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-sky-200 hover:bg-sky-50/70"
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
    <div className="min-h-screen bg-transparent px-4 py-4 text-slate-900 lg:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden rounded-[32px] border border-white/40 bg-[linear-gradient(180deg,rgba(225,245,255,0.78),rgba(232,243,255,0.72),rgba(255,237,213,0.58))] shadow-[0_24px_80px_-44px_rgba(15,23,42,0.3)] backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-6">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 via-cyan-500 to-orange-400 text-white shadow-[0_12px_28px_-14px_rgba(14,165,233,0.75)]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-950">SentimentX</p>
              <p className="text-sm text-slate-500">Enterprise market intelligence</p>
            </div>
          </div>

          <div className="space-y-2 px-4 py-5">
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  activeView === item.id
                    ? 'border-cyan-200 bg-[linear-gradient(90deg,rgba(224,242,254,0.95),rgba(255,237,213,0.9))] text-slate-950 shadow-[0_20px_36px_-28px_rgba(14,165,233,0.45)]'
                    : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-[linear-gradient(90deg,rgba(248,250,252,0.92),rgba(240,249,255,0.8))]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="size-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{item.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-auto px-4 pb-4">
                <div className="rounded-3xl border border-sky-100 bg-[linear-gradient(145deg,rgba(224,242,254,0.98),rgba(255,255,255,0.94),rgba(255,237,213,0.92))] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Workspace</p>
              <p className="mt-3 text-lg font-semibold text-slate-950">BAV Enterprise</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Dashboard ưu tiên workflow thật, nhiều màu hơn nhưng vẫn data-dense. Dữ liệu mới vào không làm mất dữ liệu cũ.
              </p>
            </div>
          </div>
        </aside>

        <main className="rounded-[32px] border border-white/35 bg-[linear-gradient(180deg,rgba(244,250,255,0.78),rgba(234,244,255,0.72),rgba(255,242,230,0.58))] shadow-[0_28px_100px_-52px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button type="button" className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden">
                <PanelLeft className="size-5" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">SentimentX Console</p>
                <p className="text-sm text-slate-500">
                  {loading ? 'Loading data...' : `${companies.length} companies • ${alerts.length} alerts`}
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-sky-50 px-4 py-2.5 text-sm text-slate-500 md:flex">
              <Search className="size-4" />
              Search company, topic, headline...
            </div>
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
              renderCompanies()
            ) : activeView === 'alerts' ? (
              renderAlerts()
            ) : (
              renderOverview()
            )}
          </div>
        </main>
      </div>

      <button
        type="button"
        onClick={() => setAssistantOpen((current) => !current)}
        className="fixed bottom-6 right-6 inline-flex items-center gap-3 rounded-full border border-cyan-200/70 bg-[linear-gradient(90deg,rgba(255,255,255,0.96),rgba(240,249,255,0.95),rgba(255,247,237,0.92))] px-3 py-3 pr-5 text-sm font-medium text-slate-900 shadow-[0_24px_52px_-22px_rgba(14,165,233,0.42)] backdrop-blur"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 via-cyan-400 to-orange-400 text-white shadow-[0_12px_28px_-10px_rgba(14,165,233,0.75)]">
          <Bot className="size-4" />
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span>AI Assistant</span>
          <span className="text-xs text-slate-500">
            {activeView === 'companies' && selectedCompany ? `Context: ${selectedCompany.name}` : 'Overall market context'}
          </span>
        </span>
      </button>

      {assistantOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/12 backdrop-blur-[3px]">
          <div className="absolute bottom-6 right-6 flex h-[min(760px,calc(100vh-48px))] w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden rounded-[28px] border border-cyan-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-[0_40px_110px_-40px_rgba(15,23,42,0.45)]">
            <div className="border-b border-cyan-100 bg-[linear-gradient(90deg,rgba(240,249,255,0.96),rgba(236,254,255,0.92),rgba(255,237,213,0.9))] px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-400 to-orange-400 text-white">
                    <Bot className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">AI Assistant</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {activeView === 'companies' && selectedCompany ? `Đang phân tích: ${selectedCompany.name}` : 'Đang ở chế độ phân tích tổng quan'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setAssistantOpen(false)} className="rounded-xl border border-white bg-white/80 p-2 text-slate-500 shadow-sm">
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-5 py-4">
              <div className="space-y-4">
                {chatMessages.map((message) => renderChatMessage(message))}
                {aiStatus === 'loading' ? (
                  <div className="flex justify-start">
                    <div className="rounded-[22px] border border-cyan-100 bg-white/90 px-4 py-3 text-sm text-slate-500 shadow-sm">
                      Assistant đang phân tích...
                    </div>
                  </div>
                ) : null}
                {aiError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{aiError}</div> : null}
              </div>
            </div>

            <div className="border-t border-cyan-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(240,249,255,0.9))] px-5 py-4">
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
                  className="min-h-[76px] flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300"
                />
                <button
                  type="button"
                  onClick={handleAskAi}
                  disabled={aiStatus === 'loading' || aiQuestion.trim().length < 3}
                  className="inline-flex h-[52px] items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 via-cyan-500 to-orange-400 px-4 py-2.5 text-sm font-medium text-white shadow-[0_16px_30px_-18px_rgba(14,165,233,0.65)] disabled:opacity-60"
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
