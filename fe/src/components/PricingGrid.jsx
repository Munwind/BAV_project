import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import Reveal from './Reveal'

const Motion = motion

function PricingGrid({ plans }) {
  return (
    <div className="mt-14 grid gap-6 xl:grid-cols-3">
      {plans.map((plan, index) => (
        <Reveal key={plan.name} delay={index * 0.07}>
          <Motion.div
            whileHover={{ y: -8 }}
            className={`glass-panel relative rounded-[2rem] p-7 ${
              plan.featured ? 'border-cyan-300/35 bg-cyan-300/10' : ''
            }`}
          >
            {plan.featured ? (
              <div className="absolute right-6 top-6 rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950">
                Khuyến nghị
              </div>
            ) : null}
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{plan.audience}</p>
            <h3 className="mt-4 font-display text-3xl text-white">{plan.name}</h3>
            <p className="mt-3 text-4xl font-semibold text-white">{plan.price}</p>
            <p className="mt-2 text-sm text-slate-400">{plan.price === 'Miễn phí' ? 'Bước vào funnel' : 'VNĐ / tháng'}</p>

            <div className="mt-8 space-y-4">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-5 text-emerald-300" />
                  <p className="text-sm leading-7 text-slate-300">{feature}</p>
                </div>
              ))}
            </div>
          </Motion.div>
        </Reveal>
      ))}
    </div>
  )
}

export default PricingGrid
