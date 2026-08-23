'use client'

import { cn } from '@/lib/utils'

const AVATAR_COLORS = [
  'bg-sky-500', 'bg-teal-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500',
  'bg-lime-500', 'bg-fuchsia-500',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const SIZE_CLASSES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-14 w-14 text-lg',
} as const

interface AvatarProps {
  name: string
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

export function Avatar({ name, size = 'sm', className }: AvatarProps) {
  const colorIndex = hashString(name) % AVATAR_COLORS.length
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white shrink-0',
        AVATAR_COLORS[colorIndex],
        SIZE_CLASSES[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}

interface StackedAvatarsProps {
  names: string[]
  max?: number
  size?: 'xs' | 'sm'
}

export function StackedAvatars({ names, max = 3, size = 'sm' }: StackedAvatarsProps) {
  if (names.length === 0) return null
  const shown = names.slice(0, max)
  const remaining = names.length - max
  const sizeClasses = size === 'xs' ? 'h-6 w-6 text-[9px]' : 'h-7 w-7 text-[10px]'

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((name, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full flex items-center justify-center font-semibold text-white border-2 border-background',
            AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length],
            sizeClasses
          )}
          style={{ zIndex: max - i }}
          title={name}
        >
          {getInitials(name)}
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-medium bg-muted text-muted-foreground border-2 border-background',
            sizeClasses
          )}
          style={{ zIndex: 0 }}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}