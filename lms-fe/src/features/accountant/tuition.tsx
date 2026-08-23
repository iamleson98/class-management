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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatVND, getTuitions } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { Separator } from '@/components/ui/separator'

export default function AccountantTuitionPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedTuition, setSelectedTuition] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  // TuitionFilterOpts honors a top-level `search` field — search runs
  // server-side instead of filtering the full list client-side.
  const opts = useMemo(() => ({ search: search || undefined }), [search])

  const { data: tuitions, isLoading, isError, refetch } = useQuery({
    queryKey: ['tuitions', opts],
    queryFn: () => getTuitions(opts),
  })

  const handleRecordPayment = (tuition: any) => {
    setSelectedTuition(tuition)
    setPaymentAmount('')
    setPaymentDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{t('accountant.tuition.statusPaid', 'Đã thanh toán')}</Badge>
      case 'PARTIAL': return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">{t('accountant.tuition.statusPartial', 'Thanh toán một phần')}</Badge>
      case 'UNPAID': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t('accountant.tuition.statusUnpaid', 'Chưa thanh toán')}</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredTuitions = tuitions || []

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

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('accountant.tuition.searchPlaceholder', 'Tìm kiếm học viên hoặc lớp...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3 text-muted-foreground">{t('common.loading', 'Đang tải...')}</span>
        </div>
      ) : filteredTuitions.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="h-12 w-12" />}
          title={t('accountant.tuition.noTuitionTitle', 'Chưa có khoản học phí nào')}
          description={t('accountant.tuition.noTuitionDesc', 'Không tìm thấy dữ liệu học phí')}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accountant.tuition.colStudent', 'Học viên')}</TableHead>
                <TableHead>{t('accountant.tuition.colClass', 'Lớp')}</TableHead>
                <TableHead className="text-right">{t('accountant.tuition.colTotal', 'Tổng')}</TableHead>
                <TableHead className="text-right">{t('accountant.tuition.colPaid', 'Đã thu')}</TableHead>
                <TableHead className="text-right">{t('accountant.tuition.colRemaining', 'Còn thiếu')}</TableHead>
                <TableHead>{t('common.status', 'Trạng thái')}</TableHead>
                <TableHead className="w-25 text-right">{t('common.actions', 'Thao tác')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTuitions.map((tuition: any) => (
                <TableRow key={tuition.id}>
                  <TableCell className="font-medium">{tuition.studentName || tuition.student?.name}</TableCell>
                  <TableCell>{tuition.className || tuition.class?.name}</TableCell>
                  <TableCell className="text-right">{formatVND(tuition.totalAmount || 0)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatVND(tuition.paidAmount || 0)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatVND((tuition.totalAmount || 0) - (tuition.paidAmount || 0))}</TableCell>
                  <TableCell>{getStatusBadge(tuition.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecordPayment(tuition)}
                      disabled={tuition.status === 'PAID'}
                    >
                      <Plus className="h-3 w-3 mr-1" />{t('accountant.tuition.collectFee', 'Thu phí')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
