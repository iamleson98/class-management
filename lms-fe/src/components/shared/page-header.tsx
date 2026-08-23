'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReactElement, isValidElement } from 'react'
import { SMOOTH_EASE } from '@/components/shared/animations'

type AccentColor = 'emerald' | 'teal' | 'amber' | 'rose' | 'violet' | 'green' | 'blue' | 'pink' | 'sky' | 'orange' | 'cyan'

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon | ReactElement
  actions?: React.ReactNode
  className?: string
  badge?: React.ReactNode
  accentColor?: AccentColor
}

const ACCENT_CONFIG = {
  emerald: {
    iconBg: 'bg-sky-100 dark:bg-sky-950/40',
    iconColor: 'text-sky-600 dark:text-sky-400',
    dotColor: 'bg-sky-400',
    patternColor: 'text-sky-500/[0.03]',
    gradientFrom: 'from-sky-500/5',
  },
  teal: {
    iconBg: 'bg-teal-100 dark:bg-teal-950/40',
    iconColor: 'text-teal-600 dark:text-teal-400',
    dotColor: 'bg-teal-400',
    patternColor: 'text-teal-500/[0.03]',
    gradientFrom: 'from-teal-500/5',
  },
  blue: {
    iconBg: 'bg-blue-100 dark:bg-blue-950/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-400',
    patternColor: 'text-blue-500/[0.03]',
    gradientFrom: 'from-blue-500/5',
  },
  green: {
    iconBg: 'bg-green-100 dark:bg-green-950/40',
    iconColor: 'text-green-600 dark:text-green-400',
    dotColor: 'bg-green-400',
    patternColor: 'text-green-500/[0.03]',
    gradientFrom: 'from-green-500/5',
  },
  amber: {
    iconBg: 'bg-amber-100 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-400',
    patternColor: 'text-amber-500/[0.03]',
    gradientFrom: 'from-amber-500/5',
  },
  rose: {
    iconBg: 'bg-rose-100 dark:bg-rose-950/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    dotColor: 'bg-rose-400',
    patternColor: 'text-rose-500/[0.03]',
    gradientFrom: 'from-rose-500/5',
  },
  pink: {
    iconBg: 'bg-pink-100 dark:bg-pink-950/40',
    iconColor: 'text-pink-600 dark:text-pink-400',
    dotColor: 'bg-pink-400',
    patternColor: 'text-pink-500/[0.03]',
    gradientFrom: 'from-pink-500/5',
  },
  violet: {
    iconBg: 'bg-violet-100 dark:bg-violet-950/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
    dotColor: 'bg-violet-400',
    patternColor: 'text-violet-500/[0.03]',
    gradientFrom: 'from-violet-500/5',
  },
  sky: {
    iconBg: 'bg-sky-100 dark:bg-sky-950/40',
    iconColor: 'text-sky-600 dark:text-sky-400',
    dotColor: 'bg-sky-400',
    patternColor: 'text-sky-500/[0.03]',
    gradientFrom: 'from-sky-500/5',
  },
  orange: {
    iconBg: 'bg-orange-100 dark:bg-orange-950/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
    dotColor: 'bg-orange-400',
    patternColor: 'text-orange-500/[0.03]',
    gradientFrom: 'from-orange-500/5',
  },
  cyan: {
    iconBg: 'bg-cyan-100 dark:bg-cyan-950/40',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    dotColor: 'bg-cyan-400',
    patternColor: 'text-cyan-500/[0.03]',
    gradientFrom: 'from-cyan-500/5',
  },
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
  badge,
  accentColor = 'sky',
}: PageHeaderProps) {
  const config = ACCENT_CONFIG[accentColor] ?? ACCENT_CONFIG.sky

  const iconNode = !Icon
    ? null
    : isValidElement(Icon)
      ? Icon
      : (() => {
          const IconComponent = Icon as LucideIcon
          return <IconComponent className={cn('h-5 w-5', config.iconColor)} strokeWidth={1.8} />
        })()

  return (
    <div className={cn('relative', className)}>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: SMOOTH_EASE }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-4 min-w-0">
          {/* Icon */}
          {iconNode && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
              className={cn(
                'p-2.5 rounded-2xl shrink-0 border border-border/60',
                config.iconBg
              )}
            >
              {iconNode}
            </motion.div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[26px] font-extrabold tracking-tight text-foreground leading-tight">
                {title}
              </h1>
              {badge}
            </div>
            {description && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="text-sm text-muted-foreground mt-1"
              >
                {description}
              </motion.p>
            )}
          </div>
        </div>
        {actions && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="flex items-center gap-2 shrink-0"
          >
            {actions}
          </motion.div>
        )}
      </motion.div>

      {/* Decorative accent line below header */}
      <div className="mt-5 h-px bg-linear-to-r from-transparent to-transparent" />
    </div>
  )
}