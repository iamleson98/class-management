'use client'

import { motion } from 'framer-motion'
import { useTranslation } from '@/lib/i18n'

function BrandedSpinner() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative h-10 w-10">
        {/* Outer spinning ring */}
        <div className="absolute inset-0 rounded-full border-[3px] border-sky-100 dark:border-sky-900/60" />
        <div
          className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-sky-500 dark:border-t-sky-400 animate-spin"
          style={{ animationDuration: '0.9s' }}
        />
        {/* Middle spinning ring */}
        <div className="absolute inset-0.75 rounded-full border-2 border-cyan-100/80 dark:border-cyan-900/40" />
        <div
          className="absolute inset-0.75 rounded-full border-2 border-transparent border-l-cyan-400/70 dark:border-l-cyan-300/60 animate-spin"
          style={{ animationDuration: '1.8s' }}
        />
        {/* Inner spinning ring (counter-rotate) */}
        <div className="absolute inset-1.5 rounded-full border-2 border-teal-100 dark:border-teal-900/60" />
        <div
          className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-teal-400 dark:border-b-teal-300 animate-spin"
          style={{ animationDuration: '1.4s', animationDirection: 'reverse' }}
        />
        {/* Center dot */}
        <div className="absolute inset-3 rounded-full bg-sky-500/20 dark:bg-sky-400/20 animate-pulse" />
      </div>
      {/* Pulsing loading text */}
      <motion.p
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        className="mt-3 text-xs text-muted-foreground/60 font-medium tracking-wide"
      >
        {t('common.loading', 'Đang tải...')}
      </motion.p>
    </div>
  )
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg ${className ?? ''}`}>
      <div className="rounded-lg h-full bg-linear-to-r from-muted via-muted/80 to-muted" />
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite',
        }}
      />
    </div>
  )
}

function StatCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border bg-card p-6 space-y-4 relative overflow-hidden"
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-linear-to-r from-sky-500/40 via-teal-400/25 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3 flex-1">
          <ShimmerSkeleton className="h-3 w-20" />
          <ShimmerSkeleton className="h-10 w-16" />
          <div className="flex items-center gap-2">
            <ShimmerSkeleton className="h-3 w-10 rounded-sm" />
            <ShimmerSkeleton className="h-3 w-14" />
          </div>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-linear-to-br from-sky-100/60 to-teal-100/40 dark:from-sky-900/30 dark:to-teal-900/20 shrink-0 flex items-center justify-center">
          <div className="h-5 w-5 rounded-md bg-muted/60" />
        </div>
      </div>
    </motion.div>
  )
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <ShimmerSkeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <ShimmerSkeleton className="h-4 w-3/4 max-w-50" />
        <ShimmerSkeleton className="h-3 w-1/2 max-w-35" />
      </div>
      <ShimmerSkeleton className="h-6 w-16 rounded-md hidden sm:block" />
      <ShimmerSkeleton className="h-8 w-8 rounded-md" />
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="space-y-6">
      {/* Branded spinner */}
      <BrandedSpinner />

      {/* Stat cards skeleton grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <StatCardSkeleton />
          </motion.div>
        ))}
      </div>

      {/* Table / content section skeleton */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="rounded-xl border bg-card p-6 space-y-5"
      >
        {/* Section header */}
        <div className="flex items-center justify-between">
          <ShimmerSkeleton className="h-6 w-40" />
          <ShimmerSkeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* Table rows */}
        <div className="divide-y divide-border/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.06 }}
            >
              <TableRowSkeleton />
            </motion.div>
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex items-center justify-between pt-2">
          <ShimmerSkeleton className="h-4 w-32" />
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <ShimmerSkeleton key={i} className="h-8 w-8 rounded-md" />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Bottom fade-out */}
      <div className="relative h-8 pointer-events-none">
        <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-background via-background/80 to-transparent" />
      </div>
    </div>
  )
}