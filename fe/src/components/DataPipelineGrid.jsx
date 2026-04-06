import { motion } from 'framer-motion'
import Reveal from './Reveal'

const Motion = motion

function DataPipelineGrid({ items }) {
  return (
    <div className="mt-14 grid gap-6 lg:grid-cols-4">
      {items.map((item, index) => (
        <Reveal key={item.step} delay={index * 0.06}>
          <Motion.div whileHover={{ y: -8 }} className="glass-panel relative h-full rounded-[2rem] p-6">
            <div className="absolute right-6 top-6 text-sm font-semibold text-slate-500">{item.step}</div>
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/8 text-cyan-200">
              <item.icon className="size-5" />
            </div>
            <h3 className="mt-10 text-xl font-semibold text-white">{item.title}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">{item.description}</p>
          </Motion.div>
        </Reveal>
      ))}
    </div>
  )
}

export default DataPipelineGrid
