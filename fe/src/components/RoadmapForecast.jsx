import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import Reveal from './Reveal'

const Motion = motion

function RoadmapForecast({ roadmap, projections }) {
  return (
    <div className="mt-14 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <div className="grid gap-6">
        {roadmap.map((item, index) => (
          <Reveal key={item.phase} delay={index * 0.06}>
            <div className="glass-panel rounded-[2rem] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold text-white">{item.phase}</h3>
                <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-sm text-slate-300">
                  {item.time}
                </div>
              </div>
              <p className="mt-4 text-lg font-medium text-cyan-200">{item.budget}</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.goal}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.16}>
        <div className="glass-panel rounded-[2rem] p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-amber-200">Dự báo tăng trưởng</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {projections.map((item, index) => (
              <Motion.div
                key={item.year}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.08 * index }}
                className="rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-5"
              >
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{item.year}</p>
                <p className="mt-4 text-2xl font-semibold text-white">{item.revenue}</p>
                <p className="mt-3 text-sm text-cyan-200">{item.users}</p>
                <p className="mt-4 text-sm leading-7 text-slate-300">{item.note}</p>
              </Motion.div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-gradient-to-r from-cyan-400/12 to-amber-300/10 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/8 p-3 text-cyan-200">
                <TrendingUp className="size-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Mục tiêu tài chính cuối cùng</h3>
                <p className="mt-3 text-base leading-8 text-slate-300">
                  Hệ thống hướng đến mô hình doanh thu ba lớp: subscription, API và data, cùng dịch vụ phân tích theo yêu cầu để tăng biên lợi nhuận và giữ dòng tiền ổn định hơn.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )
}

export default RoadmapForecast
