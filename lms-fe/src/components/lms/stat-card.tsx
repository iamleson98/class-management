'use client'

import { useEffect, useState, useRef, ReactNode, isValidElement } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon | ReactNode
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  className?: string
  iconColor?: string
  iconBg?: string
  gradient?: string
  compact?: boolean
  sparkData?: number[]
}

const GRADIENT_PRESETS = {
  sky: 'from-sky-500/5 via-sky-400/[0.02] to-transparent dark:from-sky-500/10 dark:via-sky-400/5',
  teal: 'from-sky-400/5 via-sky-500/[0.02] to-transparent dark:from-sky-400/10 dark:via-sky-500/5',
  warm: 'from-amber-500/5 via-orange-500/[0.02] to-transparent dark:from-amber-500/10 dark:via-orange-500/5',
  rose: 'from-rose-500/5 via-pink-500/[0.02] to-transparent dark:from-rose-500/10 dark:from-pink-500/5',
}

const ACCENT_LINE_PRESETS = {
  sky: 'from-sky-500/60 via-sky-400/40 to-transparent',
  teal: 'from-sky-400/60 via-sky-500/40 to-transparent',
  warm: 'from-amber-500/60 via-orange-400/40 to-transparent',
  rose: 'from-rose-500/60 via-pink-400/40 to-transparent',
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 })
  const display = useTransform(spring, (v) => Math.round(v))
  const [displayValue, setDisplayValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    spring.set(value)
    const unsubscribe = display.on('change', (v) => setDisplayValue(v))
    return unsubscribe
  }, [value, spring, display])

  return <span ref={ref}>{displayValue.toLocaleString()}</span>
}

function MiniSparkline({ data, color = '#059669' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 80
  const h = 28
  const padding = 2

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2)
    const y = padding + (1 - (v - min) / range) * (h - padding * 2)
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,${h} ${points} ${w},${h}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.length > 0 && (
        <circle
          cx={padding + ((data.length - 1) / (data.length - 1)) * (w - padding * 2)}
          cy={padding + (1 - (data[data.length - 1] - min) / range) * (h - padding * 2)}
          r="2"
          fill={color}
          className="animate-pulse"
        />
      )}
    </svg>
  )
}

export function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  trendValue,
  className,
  iconColor = 'text-sky-600 dark:text-sky-400',
  iconBg = 'bg-sky-100 dark:bg-sky-950/50',
  gradient = 'sky',
  compact = false,
  sparkData,
}: StatCardProps) {
  const gradientClass = GRADIENT_PRESETS[gradient as keyof typeof GRADIENT_PRESETS] ?? GRADIENT_PRESETS.sky
  const accentLine = ACCENT_LINE_PRESETS[gradient as keyof typeof ACCENT_LINE_PRESETS] ?? ACCENT_LINE_PRESETS.sky
  const isNumeric = typeof value === 'number'

  const sparkColor = {
    sky: '#0284c7',
    teal: '#0284c7',
    warm: '#d97706',
    rose: '#e11d48',
  }[gradient] ?? '#0284c7'

  const iconNode = isValidElement(icon)
    ? icon
    : typeof icon === 'function'
      ? (() => {
          const IconComponent = icon as any as LucideIcon
          return <IconComponent className={cn('h-5 w-5', iconColor)} strokeWidth={1.8} />
        })()
      : (() => {
          const IconComponent = icon as any as LucideIcon
          return <IconComponent className={cn('h-5 w-5', iconColor)} strokeWidth={1.8} />
        })()

  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-2xl border',
        'hover:border-sky-200/50 dark:hover:border-sky-800/30',
        'transition-colors duration-200 group cursor-default',
        className
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-linear-to-br pointer-events-none',
          gradientClass
        )}
      />
      <div className={cn('absolute top-0 left-0 right-0 h-[2.5px] bg-linear-to-r', accentLine)} />
      <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none opacity-[0.04] group-hover:opacity-[0.07] transition-opacity duration-500">
        <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full border-2 border-current" />
      </div>

      <CardContent className={cn('relative', compact ? 'p-4' : 'p-6')}>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1 min-w-0">
            <p className={cn(
              'font-semibold uppercase tracking-widest',
              compact ? 'text-[10px]' : 'text-xs',
              'text-muted-foreground/70'
            )}>
              {title}
            </p>

            <p className={cn(
              'font-extrabold tracking-tight text-foreground tabular-nums-override',
              compact ? 'text-2xl' : 'text-4xl'
            )}>
              {isNumeric ? <AnimatedNumber value={value as number} /> : value}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {trend && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg',
                    trend === 'up' && 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40',
                    trend === 'down' && 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
                    trend === 'neutral' && 'text-muted-foreground bg-muted',
                  )}
                >
                  {trend === 'up' && <TrendingUp className="h-3 w-3" />}
                  {trend === 'down' && <TrendingDown className="h-3 w-3" />}
                  {trend === 'neutral' && <Minus className="h-3 w-3" />}
                  {trendValue || (trend === 'up' ? '+12%' : trend === 'down' ? '-5%' : '0%')}
                </span>
              )}
              {description && (
                <p className="text-xs text-muted-foreground/80 leading-relaxed">{description}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className={cn(
              'rounded-2xl shrink-0',
              compact ? 'p-2.5' : 'p-3.5',
              iconBg
            )}>
              {iconNode}
            </div>

            {sparkData && sparkData.length >= 2 && (
              <div className="w-16 h-7 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                <MiniSparkline data={sparkData} color={sparkColor} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}