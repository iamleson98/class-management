'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PaginationState } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { DollarSign, Plus } from 'lucide-react'
import { createTuitionSchema, paymentSchema, type CreateTuitionInput, type PaymentInput } from '@/lib/schemas'
import { useLMSStore } from '@/store/lms-store'
import { formatVND, getTuitionsPaginated, createTuition, createPayment, getTuitionPayments } from '@/lib/api'
import { eq, and, paginate } from '@/lib/query'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { DataTable } from '@/components/data-table'
import { createTuitionColumns, TUITION_STATUS_MAP, type TuitionRow } from './tuition-columns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useTranslation } from '@/lib/i18n'

const STATUS_MAP = TUITION_STATUS_MAP

export default function AdminTuition() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { authUser } = useLMSStore()

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [selectedTuition, setSelectedTuition] = useState<TuitionRow | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  type CreateTuitionFormValues = z.input<typeof createTuitionSchema>
  type PaymentFormValues = z.input<typeof paymentSchema>
  const EMPTY_CREATE_TUITION_FORM: CreateTuitionFormValues = { studentId: '', classId: '', feePackageId: '', totalAmount: 0, discountType: 'PERCENT', discountValue: 0 }
  const EMPTY_PAYMENT_FORM: PaymentFormValues = { amount: 0, method: 'CASH', receiptNumber: '', paidById: '', note: '' }

  const createForm = useForm<CreateTuitionFormValues>({
    resolver: zodResolver(createTuitionSchema),
    defaultValues: EMPTY_CREATE_TUITION_FORM,
  })

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: EMPTY_PAYMENT_FORM,
  })

  const onStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }

  // Build the typed SearchOpts body. TuitionFilterOpts honors a top-level
  // `search` field (see server/public/model_helper/lms.go), so that goes at the
  // body root; `tuitions.status` is a column condition expressed via eq().
  const opts = useMemo(() => ({
    search: undefined,
    where_ands: and(eq('tuitions.status', statusFilter !== 'all' ? statusFilter : undefined)),
    ...paginate(pagination.pageIndex, pagination.pageSize),
  }), [statusFilter, pagination.pageIndex, pagination.pageSize])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tuitions', opts],
    queryFn: () => getTuitionsPaginated(opts),
  })

  const { data: payments = [], isLoading: isLoadingPayments, isError: isPaymentsError } = useQuery({
    queryKey: ['tuition-payments', selectedTuition?.id],
    queryFn: () => selectedTuition ? getTuitionPayments(selectedTuition.id) : Promise.resolve([]),
    enabled: paymentOpen && !!selectedTuition,
  })

  const createTuitionMutation = useMutation({
    mutationFn: (data: CreateTuitionInput) => createTuition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuitions'] })
      toast({ title: t('tuition.createSuccess', 'Tạo học phí thành công') })
      setCreateOpen(false)
      createForm.reset(EMPTY_CREATE_TUITION_FORM)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('tuition.createFail', 'Tạo học phí thất bại'), variant: 'destructive' }),
  })

  const createPaymentMutation = useMutation({
    mutationFn: ({ tuitionId, data }: { tuitionId: string; data: PaymentInput }) => createPayment(tuitionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tuitions'] })
      queryClient.invalidateQueries({ queryKey: ['tuition-payments'] })
      toast({ title: t('tuition.paymentSuccess', 'Ghi nhận thanh toán thành công') })
      setPaymentOpen(false)
      setSelectedTuition(null)
    },
    onError: (err: unknown) => toast({ title: (err as Error)?.message || t('tuition.paymentFail', 'Ghi nhận thanh toán thất bại'), variant: 'destructive' }),
  })

  const openCreate = () => {
    createForm.reset(EMPTY_CREATE_TUITION_FORM)
    setCreateOpen(true)
  }

  const openPayment = (tuition: TuitionRow) => {
    setSelectedTuition(tuition)
    const remaining = (tuition.totalFee || tuition.totalAmount || 0) - (tuition.paidAmount || 0)
    paymentForm.reset({ ...EMPTY_PAYMENT_FORM, amount: remaining, paidById: authUser?.id || '' })
    setPaymentOpen(true)
  }

  const onPaymentSubmit = (values: PaymentFormValues) => {
    if (!selectedTuition) return
    createPaymentMutation.mutate({ tuitionId: selectedTuition.id, data: paymentSchema.parse(values) })
  }

  const columns = useMemo(
    () => createTuitionColumns(t, { onCollect: openPayment }),
    [t, openPayment]
  )

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <PageHeader
        title={t('tuition.title', 'Quản lý học phí')}
        description={t('tuition.description', 'Theo dõi và ghi nhận thanh toán học phí')}
        icon={DollarSign}
        accentColor="sky"
        actions={
          <Button onClick={openCreate} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            <Plus className="h-4 w-4 mr-2" />
            {t('tuition.createTuition', 'Tạo học phí')}
          </Button>
        }
      />

      {/* Data table (server-driven pagination) */}
      <DataTable
        columns={columns}
        data={data?.items}
        paginationMode="server"
        paginationState={pagination}
        onPaginationChange={setPagination}
        rowCount={data?.totalCount ?? 0}
        isLoading={isLoading}
        toolbarActions={
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-50">
              <SelectValue placeholder={t('common.status', 'Trạng thái')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.allStatuses', 'Tất cả trạng thái')}</SelectItem>
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        emptyState={
          <EmptyState
            icon={DollarSign}
            title={t('tuition.emptyTitle', 'Chưa có khoản học phí')}
            description={t('tuition.emptyDescription', 'Tạo khoản học phí đầu tiên.')}
            actionLabel={t('tuition.createTuition', 'Tạo học phí')}
            onAction={openCreate}
          />
        }
      />

      {/* Create Tuition Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('tuition.createTuitionTitle', 'Tạo khoản học phí')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <Form {...createForm} schema={createTuitionSchema}>
            <form onSubmit={createForm.handleSubmit((data) => createTuitionMutation.mutate(createTuitionSchema.parse(data)))} className="space-y-4">
              <FormField
                control={createForm.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tuition.studentId', 'Mã học viên (ID)')}</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} placeholder="student-id" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={createForm.control}
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tuition.classId', 'Mã lớp (ID)')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="class-id" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="feePackageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tuition.feePackageId', 'Gói học phí (ID)')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder="fee-package-id" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={createForm.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tuition.totalFeeVND', 'Tổng phí (VND)')}</FormLabel>
                      <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="discountValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tuition.discountVND', 'Giảm giá (VND)')}</FormLabel>
                      <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
                <Button type="submit" disabled={createTuitionMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {createTuitionMutation.isPending ? t('common.saving', 'Đang lưu...') : t('common.create', 'Tạo')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('tuition.recordPayment', 'Ghi nhận thanh toán')}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          {selectedTuition && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('tuition.student', 'Học viên')}:</span>
                <span className="font-medium">{selectedTuition.student?.name || selectedTuition.studentName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('tuition.totalFee', 'Tổng phí')}:</span>
                <span className="font-medium">{formatVND(selectedTuition.totalFee || selectedTuition.totalAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('tuition.paidAmount', 'Đã thu')}:</span>
                <span className="font-medium text-sky-600">{formatVND(selectedTuition.paidAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t pt-2">
                <span>{t('tuition.remaining', 'Còn thiếu')}:</span>
                <span className="text-red-600">{formatVND((selectedTuition.totalFee || selectedTuition.totalAmount || 0) - (selectedTuition.paidAmount || 0))}</span>
              </div>
            </div>
          )}
          {payments.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('tuition.paymentHistory', 'Lịch sử thanh toán')}</p>
              <div className="space-y-1 max-h-30 overflow-y-auto">
                {isLoadingPayments ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin h-4 w-4 border-2 border-sky-500 border-t-transparent rounded-full" />
                  </div>
                ) : isPaymentsError ? (
                  <p className="text-sm text-destructive text-center py-4">{t('common.loadFailed', 'Tải thất bại')}</p>
                ) : payments.map((p: any) => (
                  <div key={p.id} className="flex justify-between text-sm p-2 rounded bg-muted/30">
                    <span className="text-muted-foreground">{p.date || '-'}</span>
                    <span className="font-medium text-sky-600">{formatVND(p.amount || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Form {...paymentForm} schema={paymentSchema}>
            <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4">
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tuition.paymentAmount', 'Số tiền thu (VND)')}</FormLabel>
                    <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={paymentForm.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tuition.paymentMethod', 'Phương thức')}</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="CASH">{t('tuition.cash', 'Tiền mặt')}</SelectItem>
                          <SelectItem value="TRANSFER">{t('tuition.transfer', 'Chuyển khoản')}</SelectItem>
                          <SelectItem value="CARD">{t('tuition.card', 'Thẻ')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="receiptNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tuition.receiptNumber', 'Số biên lai')}</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('tuition.receiptNumberPlaceholder', 'Số biên lai')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={paymentForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tuition.note', 'Ghi chú')}</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} placeholder={t('tuition.notePlaceholder', 'Ghi chú thanh toán')} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <input type="hidden" {...paymentForm.register('paidById')} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setPaymentOpen(false)}>{t('common.cancel', 'Hủy')}</Button>
                <Button type="submit" disabled={createPaymentMutation.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {createPaymentMutation.isPending ? t('common.saving', 'Đang lưu...') : t('tuition.confirmPayment', 'Xác nhận thu')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
