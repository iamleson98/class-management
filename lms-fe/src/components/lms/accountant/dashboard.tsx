'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { DollarSign, TrendingUp, CreditCard, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/lms/page-header'
import { ErrorState } from '@/components/lms/error-state'
import { StatCard } from '@/components/lms/stat-card'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatVND, getDashboard } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'

export default function AccountantDashboard() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'ACCOUNTANT'],
    queryFn: () => getDashboard('ACCOUNTANT'),
  })

  const stats = data || {}

  const recentPayments = (data?.recentPayments || data?.recentTransactions || []) as any[]

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title={t('accountant.dashboard.title', 'Tổng quan kế toán')}
        description={t('accountant.dashboard.description', 'Quản lý thu chi và học phí')}
        icon={<DollarSign className="h-5 w-5" />}
        accentColor="green"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title={t('accountant.dashboard.totalRevenue', 'Tổng doanh thu')}
          value={stats.totalRevenue != null ? formatVND(Number(stats.totalRevenue)) : '—'}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title={t('accountant.dashboard.totalDebt', 'Tổng công nợ')}
          value={stats.totalDebt != null ? formatVND(Number(stats.totalDebt)) : '—'}
          icon={<AlertCircle className="h-5 w-5" />}
          iconColor="text-red-600"
          iconBg="bg-red-100"
        />
        <StatCard
          title={t('accountant.dashboard.monthlyCollected', 'Thu trong tháng')}
          value={stats.monthlyCollected != null ? formatVND(Number(stats.monthlyCollected)) : '—'}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title={t('accountant.dashboard.debtCount', 'Học viên nợ phí')}
          value={String(stats.debtCount ?? '—')}
          icon={<CreditCard className="h-5 w-5" />}
          iconColor="text-orange-600"
          iconBg="bg-orange-100"
        />
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold">{t('accountant.dashboard.recentTransactions', 'Giao dịch gần đây')}</h3>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="ml-2 text-sm text-muted-foreground">{t('common.loading', 'Đang tải...')}</span>
            </div>
          ) : recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('accountant.dashboard.noTransactions', 'Chưa có giao dịch nào')}</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accountant.dashboard.colStudent', 'Học viên')}</TableHead>
                    <TableHead>{t('accountant.dashboard.colClass', 'Lớp')}</TableHead>
                    <TableHead className="text-right">{t('accountant.dashboard.colAmount', 'Số tiền')}</TableHead>
                    <TableHead>{t('accountant.dashboard.colDate', 'Ngày thu')}</TableHead>
                    <TableHead>{t('common.status', 'Trạng thái')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((payment: any, idx: number) => (
                    <TableRow key={payment.id || idx}>
                      <TableCell className="font-medium">{payment.studentName || payment.student?.name}</TableCell>
                      <TableCell>{payment.className || payment.class?.name}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {payment.amount != null ? formatVND(payment.amount) : '—'}
                      </TableCell>
                      <TableCell>
                        {payment.date ? new Date(payment.date).toLocaleDateString('vi-VN') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          {payment.status || t('accountant.dashboard.collected', 'Đã thu')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
