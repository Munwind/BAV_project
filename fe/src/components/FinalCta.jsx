import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Reveal from './Reveal'

const Motion = motion

function FinalCta() {
  return (
    <section className="px-6 pb-24 pt-10 lg:px-8">
      <Reveal>
        <div className="glass-panel mx-auto max-w-7xl rounded-[2.5rem] px-8 py-12 sm:px-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-cyan-300">Ready to launch</p>
              <h2 className="mt-5 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Một landing page đẹp chưa đủ. Nó cần kể đúng câu chuyện sản phẩm.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Baseline này được dựng để vừa trình bày ý tưởng SentimentX, vừa làm nền cho website marketing hoặc cổng vào dashboard sau này.
              </p>
            </div>

            <div className="grid gap-4">
              <Motion.a
                href="#home"
                whileHover={{ y: -3 }}
                className="inline-flex items-center justify-between rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/12 px-5 py-4 text-left"
              >
                <div>
                  <p className="text-base font-semibold text-white">Quay lại phần mở đầu</p>
                  <p className="mt-1 text-sm text-slate-300">Xem lại hero, dashboard mockup và điểm nhấn chính.</p>
                </div>
                <ArrowRight className="size-5 text-cyan-200" />
              </Motion.a>
              <Motion.a
                href="#pricing"
                whileHover={{ y: -3 }}
                className="inline-flex items-center justify-between rounded-[1.75rem] border border-white/10 bg-white/6 px-5 py-4 text-left"
              >
                <div>
                  <p className="text-base font-semibold text-white">Đi đến định giá</p>
                  <p className="mt-1 text-sm text-slate-300">Dùng ngay phần pricing và roadmap trong buổi pitching.</p>
                </div>
                <ArrowRight className="size-5 text-white" />
              </Motion.a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

export default FinalCta
