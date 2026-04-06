import { motion } from 'framer-motion'
import { Newspaper, Radar } from 'lucide-react'

const Motion = motion

function DashboardPreview() {
  return (
    <div className="glass-panel soft-ring relative overflow-hidden rounded-[2rem] p-5 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-cyan-400/25 via-teal-300/12 to-transparent" />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Live dashboard</p>
            <h3 className="mt-2 font-display text-2xl text-white">SentimentX Pulse</h3>
          </div>
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
            +18.6% tuần này
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Sentiment Index', '78 / 100'],
            ['Dữ liệu 24h', '128.4K'],
            ['Early Warnings', '12 tín hiệu'],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
              <p className="mt-2 text-xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-4">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Market mood timeline</p>
              <p className="mt-1 text-sm text-slate-400">Tương quan sentiment và price action trong 7 ngày</p>
            </div>
            <div className="rounded-full bg-white/6 px-3 py-1 text-xs text-slate-300">Realtime</div>
          </div>

          <div className="grid grid-cols-7 items-end gap-3">
            {[34, 52, 46, 68, 62, 88, 74].map((height, index) => (
              <Motion.div
                key={`${height}-${index}`}
                className="space-y-3"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.08 * index }}
              >
                <div className="rounded-full bg-white/6 p-2">
                  <div
                    className="w-full rounded-full bg-gradient-to-t from-cyan-500 via-sky-400 to-amber-300"
                    style={{ height: `${height * 1.4}px` }}
                  />
                </div>
                <p className="text-center text-xs text-slate-500">T{index + 1}</p>
              </Motion.div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
            <div className="flex items-center gap-3">
              <Newspaper className="size-5 text-cyan-300" />
              <div>
                <p className="text-sm font-semibold text-white">Tin tức chính</p>
                <p className="text-sm text-slate-400">56% thảo luận xoay quanh ngân hàng và chứng khoán.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
            <div className="flex items-center gap-3">
              <Radar className="size-5 text-amber-300" />
              <div>
                <p className="text-sm font-semibold text-white">Alert active</p>
                <p className="text-sm text-slate-400">Sentiment cực đoan tăng mạnh trước biến động giá.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPreview
