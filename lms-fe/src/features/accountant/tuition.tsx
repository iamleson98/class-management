'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { DollarSign, Search, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/data-table'
import { createAccountantTuitionColumns, type AccountantTuitionRow } from './tuition-columns'
import { formatVND, getTuitions } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { Separator } from '@/components/ui/separator'

export default function AccountantTuitionPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedTuition, setSelectedTuition] = useState<AccountantTuitionRow | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  // TuitionFilterOpts honors a top-level `search` field — search runs
  // server-side instead of filtering the full list client-side.
  const opts = useMemo(() => ({ search: search || undefined }), [search])

  const { data: tuitions, isLoading, isError, refetch } = useQuery({
    queryKey: ['tuitions', opts],
    queryFn: () => getTuitions(opts),
  })

  const handleRecordPayment = (tuition: AccountantTuitionRow) => {
    setSelectedTuition(tuition)
    setPaymentAmount('')
    setPaymentDialogOpen(true)
  }

  const columns = useMemo(
    () => createAccountantTuitionColumns(t, handleRecordPayment),
    [t, handleRecordPayment]
  )

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <PageHeader
        title={t('accountant.tuition.title', 'Quản lý học phí')}
        description={t('accountant.tuition.description', 'Theo dõi và ghi nhận thanh toán học phí')}
        icon={<DollarSign className="h-5 w-5" />}
        accentColor="green"
      />

      <DataTable
        columns={columns}
        data={tuitions}
        paginationMode="client"
        initialPageSize={10}
        isLoading={isLoading}
        toolbarActions={
          <div className="relative w-full sm:max-w-70">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-slot="accountant-tuition-search"
              placeholder={t('accountant.tuition.searchPlaceholder', 'Tìm kiếm học viên hoặc lớp...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        }
        emptyState={
          <EmptyState
            icon={<DollarSign className="h-12 w-12" />}
            title={t('accountant.tuition.noTuitionTitle', 'Chưa có khoản học phí nào')}
            description={t('accountant.tuition.noTuitionDesc', 'Không tìm thấy dữ liệu học phí')}
          />
        }
      />

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('accountant.tuition.recordPayment', 'Ghi nhận thanh toán')}</DialogTitle>
            <DialogDescription>
              {t('accountant.tuition.collectFor', 'Thu phí cho học viên')}: {selectedTuition?.studentName || selectedTuition?.student?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('accountant.tuition.totalTuition', 'Tổng học phí')}</p>
              <p className="text-lg font-semibold">{formatVND(selectedTuition?.totalAmount || 0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('accountant.tuition.paid', 'Đã thu')}</p>
              <p className="text-lg font-semibold text-green-600">{formatVND(selectedTuition?.paidAmount || 0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('accountant.tuition.remaining', 'Còn thiếu')}</p>
              <p className="text-lg font-semibold text-red-600">
                {formatVND((selectedTuition?.totalAmount || 0) - (selectedTuition?.paidAmount || 0))}
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>{t('accountant.tuition.paymentAmount', 'Số tiền thu')}</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={t('accountant.tuition.enterAmount', 'Nhập số tiền')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
            <Button
              onClick={() => {
                if (selectedTuition && paymentAmount) {
                  toast({ title: t('accountant.tuition.paymentSuccess', 'Ghi nhận thanh toán thành công') })
                  queryClient.invalidateQueries({ queryKey: ['tuitions'] })
                  setPaymentDialogOpen(false)
                }
              }}
            >
              {t('accountant.tuition.confirmCollect', 'Xác nhận thu')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
