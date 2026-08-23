import type { Variants } from 'framer-motion'

export const SMOOTH_EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]

export const fadeIn: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: SMOOTH_EASE } },
}

export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.04 } },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}