'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BarChart3, Users, DollarSign, ClipboardCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatVND, getReport } from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/components/shared/animations'
import { useTranslation } from '@/lib/i18n'

const REPORT_TYPES = [
  { key: 'enrollment', label: 'Đăng ký', icon: Users, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/30' },
  { key: 'revenue', label: 'Doanh thu', icon: DollarSign, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { key: 'attendance', label: 'Điểm danh', icon: ClipboardCheck, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
]

export default function AdminReports() {
  const { t } = useTranslation()
  const [selectedReport, setSelectedReport] = useState('enrollment')

  const { data: report, isLoading, isError, refetch } = useQuery({
    queryKey: ['report', selectedReport],
    queryFn: () => getReport(selectedReport),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  const stats = report?.stats || report?.data || {}
  const summary = report?.summary || {}
  const items = report?.items || report?.details || []

  const getTrendIcon = (trend: any) => {
    if (!trend) return null
    if (trend > 0) return <TrendingUp className="h-3 w-3 text-sky-600" />
    if (trend < 0) return <TrendingDown className="h-3 w-3 text-red-600" />
    return <Minus className="h-3 w-3 text-muted-foreground" />
  }

  const getTrendClass = (trend: any) => {
    if (!trend) return 'text-muted-foreground'
    if (trend > 0) return 'text-sky-600 dark:text-sky-400'
    if (trend < 0) return 'text-red-600 dark:text-red-400'
    return 'text-muted-foreground'
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader
        title={t('reports.title', 'Báo cáo thống kê')}
        description={t('reports.description', 'Xem báo cáo tổng hợp về đăng ký, doanh thu và điểm danh')}
        icon={BarChart3}
        accentColor="sky"
      />

      <Card className="rounded-xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">{t('reports.reportType', 'Loại báo cáo:')}</span>
          <Select value={selectedReport} onValueChange={setSelectedReport}>
            <SelectTrigger className="w-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((rt) => (
                <SelectItem key={rt.key} value={rt.key}>{rt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Summary Cards */}
      {summary && Object.keys(summary).length > 0 && (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Object.entries(summary).map(([key, value]: [string, any]) => (
            <motion.div key={key} variants={staggerItem}>
              <Card className="rounded-xl border">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{key}</p>
                      <p className="text-2xl font-bold">
                        {typeof value === 'number' ? (key.toLowerCase().includes('doanh') || key.toLowerCase().includes('phí') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('fee') ? formatVND(value) : value.toLocaleString()) : value}
                      </p>
                    </div>
                    <div className={cn('p-2.5 rounded-xl', REPORT_TYPES.find(r => r.key === selectedReport)?.bg)}>
                      {(() => {
                        const Icon = REPORT_TYPES.find(r => r.key === selectedReport)?.icon || BarChart3
                        return <Icon className={cn('h-5 w-5', REPORT_TYPES.find(r => r.key === selectedReport)?.color)} />
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Stats/Details */}
      {stats && typeof stats === 'object' && Object.keys(stats).length > 0 && (
        <Card className="rounded-xl">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-sky-600" />
              {t('reports.detailStats', 'Chi tiết thống kê')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(stats).map(([key, value]: [string, any]) => {
                const numValue = typeof value === 'number' ? value : value?.count || value?.total || 0
                const trend = value?.trend || value?.change
                const isMonetary = key.toLowerCase().includes('doanh') || key.toLowerCase().includes('phí') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('fee') || key.toLowerCase().includes('amount')
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', REPORT_TYPES.find(r => r.key === selectedReport)?.bg)}>
                        <span className={cn('text-sm font-bold', REPORT_TYPES.find(r => r.key === selectedReport)?.color)}>
                          {typeof value === 'object' ? (value.icon || key.charAt(0)) : key.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{key}</p>
                        {typeof value === 'object' && value.description && (
                          <p className="text-xs text-muted-foreground">{value.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {isMonetary ? formatVND(numValue) : numValue.toLocaleString()}
                      </p>
                      {trend !== undefined && (
                        <div className={cn('flex items-center justify-end gap-1 text-xs', getTrendClass(trend))}>
                          {getTrendIcon(trend)}
                          <span>{trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : '0%'}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Items */}
      {items.length > 0 && (
        <Card className="rounded-xl">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-base font-semibold">{t('reports.detailList', 'Danh sách chi tiết')}</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-2">
              {items.map((item: any, idx: number) => (
                <motion.div
                  key={item.id || idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.name || item.title || item.label || '-'}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {item.count !== undefined && <Badge variant="secondary" className="text-xs">{item.count}</Badge>}
                    {item.value !== undefined && <span className="text-sm font-bold">{item.value}</span>}
                    {item.amount !== undefined && <span className="text-sm font-bold text-sky-600">{formatVND(item.amount)}</span>}
                    {item.percentage !== undefined && <span className="text-sm font-medium">{item.percentage}%</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!stats || Object.keys(stats).length === 0) && (!summary || Object.keys(summary).length === 0) && items.length === 0 && (
        <EmptyState
          icon={BarChart3}
          title={t('reports.noData', 'Chưa có dữ liệu báo cáo')}
          description={t('reports.noDataDesc', 'Hệ thống sẽ hiển thị báo cáo khi có đủ dữ liệu.')}
        />
      )}
    </motion.div>
  )
}
