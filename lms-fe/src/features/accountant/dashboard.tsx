'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { DollarSign, TrendingUp, CreditCard, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/data-table'
import { createPaymentColumns } from './dashboard-columns'
import { formatVND, getTuitions, getPayments, getStudents } from '@/lib/api'
import { gte, desc, and } from '@/lib/query'
import { useTranslation } from '@/lib/i18n'

/**
 * Accountant overview. The backend dashboard endpoint only serves
 * admin/teacher/parent/student/counselor roles, so the accountant stats are
 * aggregated client-side from endpoints the lms_accountant role can access:
 *   - tuitions  (POST /lms/tuitions)        → debt + per-student balances
 *   - payments  (POST /lms/payments)        → recent transactions + monthly total
 *   - students  (POST /lms/students)        → payer names for the table
 */
export default function AccountantDashboard() {
  const { t } = useTranslation()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const tuitionsQuery = useQuery({
    queryKey: ['dashboard', 'accountant', 'tuitions'],
    queryFn: () => getTuitions({ limit: 1000, count_total: true }),
  })
  const paymentsQuery = useQuery({
    queryKey: ['dashboard', 'accountant', 'payments-recent'],
    queryFn: () => getPayments({ orderings: [desc('payments.createat')], limit: 10 }),
  })
  const thisMonthPaymentsQuery = useQuery({
    queryKey: ['dashboard', 'accountant', 'payments-month', monthStart.getTime()],
    queryFn: () => getPayments({ where_ands: and(gte('payments.createat', monthStart.getTime())) }),
  })
  const studentsQuery = useQuery({
    queryKey: ['dashboard', 'accountant', 'students'],
    queryFn: () => getStudents({ limit: 1000 }),
  })

  const isLoading =
    tuitionsQuery.isLoading || paymentsQuery.isLoading || thisMonthPaymentsQuery.isLoading || studentsQuery.isLoading
  const isError = tuitionsQuery.isError || paymentsQuery.isError

  const tuitions = tuitionsQuery.data || []
  const payments = paymentsQuery.data || []
  const monthPayments = thisMonthPaymentsQuery.data || []
  const students = studentsQuery.data || []
  const studentById = new Map(students.map((s: any) => [s.userId ?? s.id, s]))

  const totalRevenue = tuitions.reduce((sum: number, tui: any) => sum + Number(tui.paidAmount ?? 0), 0)
  const totalDebt = tuitions.reduce((sum: number, tui: any) => sum + Number(tui.remainingAmount ?? 0), 0)
  const debtCount = tuitions.filter((tui: any) => Number(tui.remainingAmount ?? 0) > 0).length
  const monthlyCollected = monthPayments.reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0)

  const paymentColumns = useMemo(() => createPaymentColumns(t), [t])

  // Rows with the payer resolved through the tuition → student link.
  const paymentRows = useMemo(
    () =>
      payments.map((payment: any) => ({
        ...payment,
        student: payment.student || studentById.get(payment.studentId) || studentById.get(payment.paidById),
      })),
    [payments, students]
  )

  if (isError) {
    return <ErrorState onRetry={() => tuitionsQuery.refetch()} />
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
          value={isLoading ? '…' : formatVND(totalRevenue)}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title={t('accountant.dashboard.totalDebt', 'Tổng công nợ')}
          value={isLoading ? '…' : formatVND(totalDebt)}
          icon={<AlertCircle className="h-5 w-5" />}
          iconColor="text-red-600"
          iconBg="bg-red-100"
        />
        <StatCard
          title={t('accountant.dashboard.monthlyCollected', 'Thu trong tháng')}
          value={isLoading ? '…' : formatVND(monthlyCollected)}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title={t('accountant.dashboard.debtCount', 'Học viên nợ phí')}
          value={isLoading ? '…' : String(debtCount)}
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
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('accountant.dashboard.noTransactions', 'Chưa có giao dịch nào')}</p>
          ) : (
            <DataTable
              columns={paymentColumns}
              data={paymentRows}
              paginationMode="client"
              initialPageSize={10}
              tableClassName="rounded-md"
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
