import { motion } from 'framer-motion'

const transition = { duration: 0.75, ease: [0.22, 1, 0.36, 1] }
const Motion = motion

function Reveal({ children, delay = 0, className = '' }) {
  return (
    <Motion.div
      className={className}
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ ...transition, delay }}
    >
      {children}
    </Motion.div>
  )
}

export default Reveal
