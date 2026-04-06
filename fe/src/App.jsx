import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  BellRing,
  Blocks,
  BriefcaseBusiness,
  ChartColumnIncreasing,
  ChevronDown,
  ChevronRight,
  Clock3,
  DatabaseZap,
  Gauge,
  Globe,
  LayoutDashboard,
  Newspaper,
  PanelLeft,
  Radar,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Waves,
} from 'lucide-react'

const Motion = motion

const sidebarItems = [
  { label: 'Overview', icon: LayoutDashboard, active: true },
  { label: 'Companies', icon: BriefcaseBusiness },
  { label: 'Industries', icon: Blocks },
  { label: 'Alerts', icon: ShieldAlert },
  { label: 'Data Sources', icon: Globe },
  { label: 'API Hub', icon: DatabaseZap },
  { label: 'Settings', icon: Settings },
]

const companies = [
  {
    name: 'VinFast',
    industry: 'Auto',
    score: 72,
    trend: '+12%',
    risk: 'Medium',
    summary: 'Social buzz tang manh sau loat bai viet ve xe dien va logistics.',
  },
  {
    name: 'Vietcombank',
    industry: 'Banking',
    score: 81,
    trend: '+6%',
    risk: 'Low',
    summary: 'Bao chi tai chinh nghieng ve goc nhin on dinh, sentiment tich cuc duy tri.',
  },
  {
    name: 'Masan',
    industry: 'Retail',
    score: 58,
    trend: '-9%',
    risk: 'High',
    summary: 'Negative mentions tang doan ngot quanh pricing va trai nghiem khach hang.',
  },
  {
    name: 'FPT',
    industry: 'Technology',
    score: 79,
    trend: '+8%',
    risk: 'Low',
    summary: 'Tin tuc doanh nghiep va social discussions dong thuan ve tang truong AI.',
  },
]

const industries = [
  { name: 'Banking', score: 78, movement: '+4%', mentions: '12.4k' },
  { name: 'Retail', score: 61, movement: '-7%', mentions: '9.2k' },
  { name: 'Technology', score: 84, movement: '+9%', mentions: '15.8k' },
  { name: 'Energy', score: 55, movement: '-3%', mentions: '6.1k' },
]

const alerts = [
  {
    title: 'Negative spike around Masan pricing',
    time: '5 mins ago',
    severity: 'High',
    description: 'Sentiment giam 18% trong 45 phut tren Facebook groups va news comments.',
  },
  {
    title: 'Banking sentiment accelerating upward',
    time: '22 mins ago',
    severity: 'Medium',
    description: 'Positive news flow tang deu, can xem xet trend gan voi thanh khoan thi truong.',
  },
  {
    title: 'VinFast social mentions crossed alert threshold',
    time: '1 hour ago',
    severity: 'Medium',
    description: 'Volume mentions tang 2.4x, phan lon den tu discussion ve giao xe va charging network.',
  },
]

const feed = [
  { source: 'CafeF', topic: 'Banking outlook', sentiment: 'Positive', impact: 82 },
  { source: 'Facebook Groups', topic: 'Retail complaints', sentiment: 'Negative', impact: 91 },
  { source: 'YouTube', topic: 'Auto review wave', sentiment: 'Positive', impact: 76 },
  { source: 'Telegram', topic: 'Short-term trading chatter', sentiment: 'Neutral', impact: 60 },
]

const apiCards = [
  {
    title: 'Sentiment API',
    text: 'Lay sentiment score theo brand, company, industry va thoi gian.',
  },
  {
    title: 'Alert Webhook',
    text: 'Push early warning signal vao he thong noi bo cua doanh nghiep.',
  },
  {
    title: 'Executive Summary API',
    text: 'Tra ve insight da duoc LLM tom tat cho dashboard management.',
  },
]

function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'border-white/10 bg-white/6 text-slate-200',
    positive: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    negative: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
    warning: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    info: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

function App() {
  const [selectedCompany, setSelectedCompany] = useState(companies[0])
  const [selectedRange, setSelectedRange] = useState('7D')
  const [crawlStatus, setCrawlStatus] = useState('idle')
  const [crawlSummary, setCrawlSummary] = useState(null)
  const [crawlError, setCrawlError] = useState('')

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

  const chartBars = useMemo(() => {
    if (selectedCompany.name === 'Masan') return [76, 64, 59, 44, 38, 41, 36]
    if (selectedCompany.name === 'VinFast') return [52, 58, 60, 68, 71, 75, 78]
    if (selectedCompany.name === 'FPT') return [62, 66, 70, 73, 74, 78, 80]
    return [70, 72, 75, 77, 78, 80, 81]
  }, [selectedCompany])

  async function handleRunCrawler() {
    try {
      setCrawlStatus('loading')
      setCrawlError('')

      const response = await fetch(`${apiBaseUrl}/crawler/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Crawler run failed')
      }

      setCrawlSummary(data)
      setCrawlStatus('success')
    } catch (error) {
      setCrawlStatus('error')
      setCrawlError(error.message || 'Crawler run failed')
    }
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-4 text-slate-100 lg:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="glass-panel hidden rounded-[2rem] p-5 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-sky-500 text-slate-950">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-white">SentimentX</p>
              <p className="text-sm text-slate-400">AI Market Sentiment Platform</p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                  item.active ? 'bg-cyan-300/12 text-white' : 'text-slate-300 hover:bg-white/6 hover:text-white'
                }`}
              >
                <item.icon className="size-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-cyan-300/20 bg-cyan-300/10 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Workspace</p>
            <p className="mt-3 text-lg font-semibold text-white">BAV Enterprise</p>
            <p className="mt-2 text-sm leading-7 text-slate-200">
              Theo doi bao chi, social media, sentiment index, early warning va API delivery.
            </p>
          </div>

          <div className="mt-auto rounded-[1.75rem] border border-white/10 bg-white/6 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                DN
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Data Strategy Team</p>
                <p className="text-xs text-slate-400">enterprise@sentimentx.ai</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="glass-panel rounded-[2rem] p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 lg:hidden">
              <button type="button" className="rounded-2xl border border-white/10 bg-white/6 p-3 text-white">
                <PanelLeft className="size-5" />
              </button>
              <div>
                <p className="font-display text-xl font-semibold text-white">SentimentX</p>
                <p className="text-sm text-slate-400">Overview Dashboard</p>
              </div>
            </div>

            <div>
              <p className="text-sm uppercase tracking-[0.26em] text-cyan-300">Logged-in product view</p>
              <h1 className="mt-2 font-display text-3xl font-semibold text-white sm:text-4xl">
                Market sentiment dashboard for enterprise teams
              </h1>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-slate-300">
                <Search className="size-4" />
                <span className="text-sm">Search company, topic, industry...</span>
              </div>
              <button
                type="button"
                onClick={handleRunCrawler}
                disabled={crawlStatus === 'loading'}
                className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {crawlStatus === 'loading' ? 'Running crawl...' : 'Run Crawl'}
              </button>
              <button type="button" className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950">
                Export Report
              </button>
            </div>
          </div>

          <section className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <Motion.div layout className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: 'Sentiment Index',
                    value: `${selectedCompany.score}/100`,
                    note: `${selectedCompany.trend} vs yesterday`,
                    icon: Gauge,
                    tone: 'info',
                  },
                  {
                    label: 'Early Warnings',
                    value: '12',
                    note: '3 high priority',
                    icon: TriangleAlert,
                    tone: 'warning',
                  },
                  {
                    label: 'Tracked Sources',
                    value: '58',
                    note: 'news + social + forums',
                    icon: Newspaper,
                    tone: 'default',
                  },
                  {
                    label: 'API Requests',
                    value: '42.8k',
                    note: 'last 24 hours',
                    icon: DatabaseZap,
                    tone: 'positive',
                  },
                  {
                    label: 'Crawler Status',
                    value:
                      crawlStatus === 'success'
                        ? `${crawlSummary?.totalStored ?? 0}`
                        : crawlStatus === 'loading'
                          ? '...'
                          : 'Ready',
                    note:
                      crawlStatus === 'success'
                        ? `stored from ${crawlSummary?.totalSources ?? 0} sources`
                        : crawlStatus === 'error'
                          ? 'crawler failed'
                          : crawlStatus === 'loading'
                            ? 'fetching RSS feeds'
                            : 'manual trigger',
                    icon: Activity,
                    tone:
                      crawlStatus === 'error'
                        ? 'negative'
                        : crawlStatus === 'success'
                          ? 'positive'
                          : 'info',
                  },
                ].map((item, index) => (
                  <Motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-400">{item.label}</p>
                        <p className="mt-3 font-display text-3xl text-white">{item.value}</p>
                      </div>
                      <div className="rounded-2xl bg-white/6 p-3 text-cyan-200">
                        <item.icon className="size-5" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Badge tone={item.tone}>{item.note}</Badge>
                    </div>
                  </Motion.div>
                ))}
              </div>

              {crawlError ? (
                <div className="rounded-[1.5rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  Crawl error: {crawlError}
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/35 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Sentiment Trend</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{selectedCompany.name}</h2>
                      <p className="mt-2 text-sm leading-7 text-slate-400">{selectedCompany.summary}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {['24H', '7D', '30D'].map((range) => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => setSelectedRange(range)}
                          className={`rounded-full px-3 py-2 text-xs font-medium ${
                            selectedRange === range ? 'bg-cyan-300 text-slate-950' : 'bg-white/6 text-slate-300'
                          }`}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 grid grid-cols-7 items-end gap-3">
                    {chartBars.map((value, index) => (
                      <div key={`${selectedCompany.name}-${index}`} className="space-y-3">
                        <div className="rounded-full bg-white/6 p-2">
                          <Motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${value * 1.5}px` }}
                            transition={{ duration: 0.5, delay: index * 0.05 }}
                            className="w-full rounded-full bg-gradient-to-t from-cyan-500 via-sky-400 to-emerald-300"
                          />
                        </div>
                        <p className="text-center text-xs text-slate-500">D{index + 1}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 grid gap-3 md:grid-cols-3">
                    {[
                      ['Risk Level', selectedCompany.risk],
                      ['Industry', selectedCompany.industry],
                      ['Trend Range', selectedRange],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</p>
                        <p className="mt-2 text-base font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/35 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Watchlist</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">Companies</h2>
                    </div>
                    <Badge tone="info">4 monitored</Badge>
                  </div>

                  <div className="mt-5 space-y-3">
                    {companies.map((company) => (
                      <button
                        key={company.name}
                        type="button"
                        onClick={() => setSelectedCompany(company)}
                        className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                          selectedCompany.name === company.name
                            ? 'border-cyan-300/40 bg-cyan-300/10'
                            : 'border-white/10 bg-white/6 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-base font-semibold text-white">{company.name}</p>
                            <p className="mt-1 text-sm text-slate-400">{company.industry}</p>
                          </div>
                          <ChevronRight className="size-5 text-slate-400" />
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <Badge tone={company.score >= 75 ? 'positive' : company.score >= 60 ? 'info' : 'negative'}>
                            Score {company.score}
                          </Badge>
                          <p className={`text-sm font-medium ${company.trend.startsWith('-') ? 'text-rose-300' : 'text-emerald-300'}`}>
                            {company.trend}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/35 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Industry Index</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">Sentiment by sector</h2>
                    </div>
                    <ChartColumnIncreasing className="size-5 text-cyan-200" />
                  </div>

                  <div className="mt-5 space-y-4">
                    {industries.map((industry) => (
                      <div key={industry.name} className="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-base font-semibold text-white">{industry.name}</p>
                            <p className="mt-1 text-sm text-slate-400">{industry.mentions} mentions</p>
                          </div>
                          <Badge tone={industry.movement.startsWith('-') ? 'negative' : 'positive'}>{industry.movement}</Badge>
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-white/8">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-300"
                            style={{ width: `${industry.score}%` }}
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-slate-400">Sentiment score</span>
                          <span className="font-medium text-white">{industry.score}/100</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/35 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Source Feed</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">News and social stream</h2>
                    </div>
                    <Badge tone="default">Live crawl</Badge>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10">
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 bg-white/6 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <span>Source</span>
                      <span>Topic</span>
                      <span>Sentiment</span>
                      <span>Impact</span>
                    </div>
                    {feed.map((item) => (
                      <div
                        key={`${item.source}-${item.topic}`}
                        className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 border-t border-white/10 px-4 py-4 text-sm"
                      >
                        <span className="font-medium text-white">{item.source}</span>
                        <span className="text-slate-300">{item.topic}</span>
                        <Badge
                          tone={
                            item.sentiment === 'Positive'
                              ? 'positive'
                              : item.sentiment === 'Negative'
                                ? 'negative'
                                : 'default'
                          }
                        >
                          {item.sentiment}
                        </Badge>
                        <span className="font-medium text-white">{item.impact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Motion.div>

            <Motion.aside layout className="space-y-4">
              <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/35 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Alert Center</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Early warning</h2>
                  </div>
                  <BellRing className="size-5 text-amber-200" />
                </div>

                <div className="mt-5 space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.title} className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <p className="max-w-[16rem] text-sm font-semibold text-white">{alert.title}</p>
                        <Badge tone={alert.severity === 'High' ? 'negative' : 'warning'}>{alert.severity}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-300">{alert.description}</p>
                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                        <Clock3 className="size-4" />
                        {alert.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/35 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">API Hub</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">For enterprise integration</h2>
                  </div>
                  <DatabaseZap className="size-5 text-cyan-200" />
                </div>

                <div className="mt-5 space-y-3">
                  {apiCards.map((card) => (
                    <div key={card.title} className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                      <p className="text-sm font-semibold text-white">{card.title}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{card.text}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-cyan-300/20 bg-cyan-300/10 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-100">Sample request</p>
                  <pre className="mt-3 overflow-x-auto text-xs leading-7 text-slate-100">
{`GET /api/sentiment?company=${selectedCompany.name.toLowerCase()}&range=${selectedRange.toLowerCase()}`}
                  </pre>
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Crawler trigger</p>
                      <p className="mt-1 text-sm text-slate-400">Frontend goi thang backend de crawl RSS.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunCrawler}
                      disabled={crawlStatus === 'loading'}
                      className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {crawlStatus === 'loading' ? 'Running...' : 'POST /crawler/run'}
                    </button>
                  </div>

                  {crawlSummary?.runs?.length ? (
                    <div className="mt-4 space-y-2">
                      {crawlSummary.runs.map((run) => (
                        <div
                          key={run.sourceKey}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2 text-xs"
                        >
                          <span className="text-slate-300">{run.sourceName}</span>
                          <span className="text-white">{run.storedCount}/{run.fetchedCount}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/35 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Core Engine</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">How the product works</h2>
                  </div>
                  <Activity className="size-5 text-cyan-200" />
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    { icon: Newspaper, title: 'News crawl', text: 'Thu thap bai viet tu bao chi va cong thong tin.' },
                    { icon: Waves, title: 'Social stream', text: 'Gom discussion tu Facebook, Telegram, YouTube.' },
                    { icon: Radar, title: 'NLP + LLM analysis', text: 'Phan tich sentiment, chu de va muc do tac dong.' },
                    { icon: Gauge, title: 'Dashboard + alert output', text: 'Xuat sentiment index, trend, early warning va API.' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3 rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
                      <div className="rounded-2xl bg-white/8 p-3 text-cyan-200">
                        <item.icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-300">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.9rem] border border-white/10 bg-gradient-to-br from-amber-300/12 via-white/6 to-cyan-300/10 p-5">
                <p className="text-sm uppercase tracking-[0.22em] text-amber-200">Roadmap extension</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Mobile app ready later</h2>
                <p className="mt-3 text-sm leading-7 text-slate-200">
                  Product hien dang uu tien web dashboard va enterprise API. Mobile app co the mo rong sau khi workflow da on dinh.
                </p>
              </div>
            </Motion.aside>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
